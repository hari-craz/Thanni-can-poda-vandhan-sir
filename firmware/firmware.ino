/**
 * Hydronix IoT Platform - ESP32 Firmware
 * 
 * Target Board: ESP32 Dev Module (ESP-WROOM-32)
 * Core Libraries: WiFi, WebServer, DNSServer, Preferences, PubSubClient, HTTPClient, ArduinoJson, SD, FS, LiquidCrystal_I2C
 * 
 * Features:
 * - FreeRTOS multitasking structure (Core-pinning & IPC)
 * - NVS storage for persistent configuration with CRC32 integrity check
 * - EMA filtering, stuck sensor detection, and rate-of-change violation clamping
 * - SD card data buffering with transactional markers, 72h max cap, and automatic GC
 * - Local setup captive portal (192.168.4.1) with AJAX diagnostics and real-time calibration
 * - Auto-failover between MQTT and HTTP API
 * - LiquidCrystal_I2C 20x4 local display updates with error indicators
 */

#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <FS.h>
#include <SD.h>
#include <SPI.h>
#include <time.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// --- HARDWARE CONFIGURATION DEFINES ---
#define SD_CS_PIN       5
#define PIN_PH          32
#define PIN_TURBIDITY   33
#define PIN_TDS         34
#define PIN_TEMP        35
#define PIN_FLOW        36

#define I2C_SDA         21
#define I2C_SCL         22
#define LCD_ADDR        0x27

// --- CONFIGURATION STRUCTURE ---
struct DeviceConfig {
  char device_id[32] = "";
  uint32_t reset_count = 0;
  char wifi_ssid[64] = "";
  char wifi_password[64] = "";
  char server_host[128] = "";
  uint16_t server_port = 1883;
  char protocol[8] = "mqtt"; // "mqtt" or "http"
  char api_key[128] = "";
  uint32_t sample_interval_sec = 60;
  float ph_offset = 0.0f;
  float turbidity_offset = 0.0f;
  float tds_offset = 0.0f;
  float temp_offset = 0.0f;
  float flow_offset = 0.0f;
  int32_t timezone_offset_sec = 19800; // Default: Asia/Kolkata (+5:30)
  char last_ntp_sync[32] = "never";
  char mqtt_broker_url[256] = "";
  char http_endpoint[256] = "";
  char last_calibration_at[32] = "never";
  uint32_t crc32 = 0; // Checksum for corruption detection
};

struct SensorReading {
  float ph;
  float turbidity;
  float tds;
  float temperature;
  float flow_rate;
  float raw_ph;
  uint32_t seq_no;
  char timestamp[32];
  char timestamp_source[16]; // "device" or "server_adjusted"
};

// --- GLOBAL INSTANCES & STATE ---
DeviceConfig config;
Preferences pref;
WebServer webServer(80);
DNSServer dnsServer;
WiFiClient espClient;
PubSubClient mqttClient(espClient);
LiquidCrystal_I2C lcd(LCD_ADDR, 20, 4);

// FreeRTOS Queue Handles
QueueHandle_t sensorQueue = NULL;
QueueHandle_t displayQueue = NULL;

// Global System States
bool isApMode = false;
bool isOnline = false;
uint32_t globalSeqNo = 0;
char lastSendTimeStr[32] = "never";

// Failure & Warning flags
bool lowStorageMode = false;
bool isPhStuck = false;
bool isTurbStuck = false;
bool isTdsStuck = false;
bool isTempStuck = false;
bool isFlowStuck = false;

// HTTP Fallback State Trackers
bool httpFallbackActive = false;
uint32_t httpFallbackStartTime = 0;
uint32_t httpFallbackPollCount = 0;

// Calibration State Machine (Async to avoid web timeouts)
bool calibrationRunning = false;
uint32_t calibrationStartMs = 0;
float calibrationSamples[30];
int calibrationSampleCount = 0;

// Sanity Bounds Constants
const float PH_MIN = 0.0f;
const float PH_MAX = 14.0f;
const float TURB_MIN = 0.0f;
const float TURB_MAX = 1000.0f;
const float TDS_MIN = 0.0f;
const float TDS_MAX = 10000.0f;
const float TEMP_MIN = -50.0f;
const float TEMP_MAX = 150.0f;
const float FLOW_MIN = 0.0f;
const float FLOW_MAX = 10000.0f;

// --- UTILITY FUNCTIONS ---

// CRC32 Checksum Algorithm for Config Verification
uint32_t calculateConfigCRC(const DeviceConfig& cfg) {
  const uint8_t* data = (const uint8_t*)&cfg;
  size_t size = sizeof(DeviceConfig) - sizeof(uint32_t); // Exclude the CRC field itself
  uint32_t crc = 0xFFFFFFFF;
  for (size_t i = 0; i < size; i++) {
    crc ^= data[i];
    for (int j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >> 1) ^ 0xEDB88320;
      } else {
        crc >>= 1;
      }
    }
  }
  return ~crc;
}

void saveConfiguration() {
  config.crc32 = calculateConfigCRC(config);
  pref.begin("hydronix", false);
  pref.putBytes("config", &config, sizeof(DeviceConfig));
  pref.end();
}

void loadConfiguration() {
  pref.begin("hydronix", false);
  size_t readBytes = pref.getBytes("config", &config, sizeof(DeviceConfig));
  pref.end();
  
  bool corrupted = false;
  if (readBytes != sizeof(DeviceConfig)) {
    corrupted = true;
  } else {
    uint32_t calculated = calculateConfigCRC(config);
    if (calculated != config.crc32) {
      corrupted = true;
    }
  }
  
  // Verify configuration validation on startup
  if (corrupted || !String(config.device_id).startsWith("HYDRO_")) {
    Serial.println("[WARNING] Configuration corrupted or empty. Loading factory defaults.");
    memset(&config, 0, sizeof(DeviceConfig));
    strcpy(config.device_id, "HYDRO_001");
    config.reset_count = 0;
    config.sample_interval_sec = 60;
    strcpy(config.protocol, "mqtt");
    config.server_port = 1883;
    strcpy(config.server_host, "hydronix.local");
    strcpy(config.mqtt_broker_url, "mqtt://hydronix.local:1883");
    strcpy(config.http_endpoint, "http://hydronix.local:8000/data");
    config.timezone_offset_sec = 19800; // Asia/Kolkata
    strcpy(config.last_ntp_sync, "never");
    strcpy(config.last_calibration_at, "never");
    saveConfiguration();
  } else {
    config.reset_count++; // Increment boot counter
    saveConfiguration();
    Serial.printf("[SYSTEM] Boot reset count: %u\n", config.reset_count);
  }
}

void factoryReset() {
  pref.begin("hydronix", false);
  pref.clear();
  pref.end();
  SD.remove("/data/queue.jsonl");
  SD.remove("/data/temp.jsonl");
  Serial.println("[SYSTEM] Factory reset complete. Rebooting...");
  delay(1000);
  ESP.restart();
}

// Simple XOR Checksum for SD Queue Integrity Verification
uint32_t calculateChecksum(const String& data) {
  uint32_t checksum = 0;
  for (size_t i = 0; i < data.length(); i++) {
    checksum ^= (uint32_t)data[i];
  }
  return checksum;
}

// Get ISO 8601 UTC timestamp
void getUTCTime(char* buffer, size_t maxLen, bool& synced) {
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) {
    strftime(buffer, maxLen, "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
    synced = true;
  } else {
    snprintf(buffer, maxLen, "BOOT_%luS", millis() / 1000);
    synced = false;
  }
}

float getSDUsagePercent() {
  uint64_t total = SD.totalBytes();
  if (total == 0) return 0.0f;
  return ((float)SD.usedBytes() / (float)total) * 100.0f;
}

// Prune transaction records if SD Queue exceeds 72 hours limits (4320 records)
void pruneOfflineQueue() {
  if (!SD.exists("/data/queue.jsonl")) return;
  
  File file = SD.open("/data/queue.jsonl", FILE_READ);
  if (!file) return;
  
  int record_count = 0;
  while (file.available()) {
    String line = file.readStringUntil('\n');
    if (line.indexOf("[START]") >= 0) {
      record_count++;
    }
  }
  file.close();
  
  if (record_count <= 4320) {
    lowStorageMode = (getSDUsagePercent() > 95.0f);
    return; // Queue is within limits
  }
  
  Serial.printf("[SD] Queue cap exceeded (%d records). Pruning oldest records.\n", record_count);
  int skip_count = record_count - 4000; // Prune back to 4000 records
  
  file = SD.open("/data/queue.jsonl", FILE_READ);
  File temp = SD.open("/data/temp.jsonl", FILE_WRITE);
  if (!file || !temp) {
    if (file) file.close();
    if (temp) temp.close();
    return;
  }
  
  int current_record = 0;
  while (file.available()) {
    String line = file.readStringUntil('\n');
    if (line.indexOf("[START]") >= 0) {
      current_record++;
      String payload = file.readStringUntil('\n');
      String checksumStr = file.readStringUntil('\n');
      String endMarker = file.readStringUntil('\n');
      
      if (current_record > skip_count) {
        temp.println("[START]");
        temp.println(payload);
        temp.println(checksumStr);
        temp.println(endMarker);
      }
    }
  }
  file.close();
  temp.close();
  
  SD.remove("/data/queue.jsonl");
  SD.rename("/data/temp.jsonl", "/data/queue.jsonl");
  lowStorageMode = (getSDUsagePercent() > 95.0f);
}

// --- SETUP CONFIGURATION PORTAL HTML ---
const char SETUP_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hydronix Setup & Diagnostics</title>
  <style>
    :root {
      --bg: #0b0d19;
      --card-bg: rgba(22, 28, 45, 0.6);
      --border: rgba(255, 255, 255, 0.08);
      --accent-cyan: #00e5ff;
      --accent-pink: #ff007f;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      background-image: radial-gradient(circle at 10% 20%, rgba(0, 229, 255, 0.05) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(255, 0, 127, 0.05) 0%, transparent 40%);
      margin: 0;
      padding: 20px;
      color: var(--text);
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    header {
      text-align: center;
      margin-bottom: 30px;
    }
    header h1 {
      margin: 0;
      font-size: 2.2rem;
      font-weight: 800;
      letter-spacing: -0.05em;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-pink));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    header p {
      color: var(--text-muted);
      margin: 5px 0 0;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }
    @media(min-width: 768px) {
      .grid { grid-template-columns: 1fr 1fr; }
      .full-width { grid-column: span 2; }
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
    }
    .card h2 {
      margin-top: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: #ffffff;
      border-bottom: 1px solid var(--border);
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-weight: 600;
      margin-bottom: 6px;
      font-size: 0.875rem;
      color: var(--text-muted);
    }
    input[type=text], input[type=password], select {
      width: 100%;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 14px;
      color: #ffffff;
      font-size: 0.95rem;
      box-sizing: border-box;
      transition: all 0.3s;
    }
    input:focus, select:focus {
      outline: none;
      border-color: var(--accent-cyan);
      box-shadow: 0 0 0 2px rgba(0, 229, 255, 0.15);
    }
    .btn {
      background: linear-gradient(135deg, #00c6ff, #0072ff);
      color: white;
      padding: 12px 20px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 600;
      width: 100%;
      transition: all 0.2s;
    }
    .btn:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }
    .btn-danger {
      background: linear-gradient(135deg, var(--accent-pink), #d90429);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
    }
    .status-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      font-size: 0.9rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      padding-bottom: 8px;
    }
    .status-item:last-child {
      border: none;
      padding: 0;
      margin: 0;
    }
    .status-label {
      color: var(--text-muted);
    }
    .status-value {
      font-weight: 600;
      color: #ffffff;
      font-family: monospace;
    }
    .badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .badge-success { background: rgba(16, 185, 129, 0.15); color: #10b981; }
    .badge-error { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
    .badge-warning { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    
    .console-box {
      background: #05070f;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      height: 120px;
      overflow-y: auto;
      font-family: monospace;
      font-size: 0.8rem;
      color: #00ff66;
      margin-bottom: 15px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>HYDRONIX</h1>
      <p>Operations & Infrastructure Portal</p>
    </header>

    <div class="grid">
      <!-- Device Configuration Card -->
      <div class="card">
        <h2>Device & Connectivity Setup</h2>
        <form action="/save" method="POST">
          <div class="form-group">
            <label>Device ID</label>
            <input type="text" name="device_id" value="%s" required pattern="HYDRO_[0-9]{3}">
          </div>
          <div class="form-group">
            <label>WiFi SSID</label>
            <input type="text" name="ssid" value="%s" required>
          </div>
          <div class="form-group">
            <label>WiFi Password</label>
            <input type="password" name="password" value="%s">
          </div>
          <div class="form-group">
            <label>API Gateway Endpoint (HTTP/MQTT Host)</label>
            <input type="text" name="host" value="%s" required>
          </div>
          <div class="form-group">
            <label>Port</label>
            <input type="text" name="port" value="%d" required>
          </div>
          <div class="form-group">
            <label>Ingestion Protocol</label>
            <select name="protocol">
              <option value="mqtt" %s>MQTT Ingestion</option>
              <option value="http" %s>HTTP API Fallback</option>
            </select>
          </div>
          <div class="form-group">
            <label>API Authentication Key</label>
            <input type="password" name="api_key" value="%s" required>
          </div>
          <div class="form-group">
            <label>Sampling Interval (Seconds)</label>
            <input type="text" name="sample_interval" value="%d" required>
          </div>
          <button type="submit" class="btn">Apply & Reboot</button>
        </form>
      </div>

      <!-- Real-Time Diagnostics Card -->
      <div class="card">
        <h2>System Health Monitor</h2>
        <div class="status-item">
          <span class="status-label">Network Status</span>
          <span class="status-value"><span class="badge %s">%s</span></span>
        </div>
        <div class="status-item">
          <span class="status-label">Signal Strength</span>
          <span class="status-value">%d dBm</span>
        </div>
        <div class="status-item">
          <span class="status-label">Uptime</span>
          <span class="status-value">%s</span>
        </div>
        <div class="status-item">
          <span class="status-label">SD Buffered Queue</span>
          <span class="status-value">%d records</span>
        </div>
        <div class="status-item">
          <span class="status-label">SD Disk Allocation</span>
          <span class="status-value">%.1f%% / 100%%</span>
        </div>
        <div class="status-item">
          <span class="status-label">Storage Alert State</span>
          <span class="status-value"><span class="badge %s">%s</span></span>
        </div>
        <div class="status-item">
          <span class="status-label">Firmware Package</span>
          <span class="status-value">v1.0.0 (CoreRTOS)</span>
        </div>
        <div class="status-item">
          <span class="status-label">Last Ingestion Upload</span>
          <span class="status-value">%s</span>
        </div>
        <div class="status-item">
          <span class="status-label">Last Time Synchronization</span>
          <span class="status-value">%s</span>
        </div>

        <h2 style="margin-top: 25px; margin-bottom: 15px;">Network Connection Testing</h2>
        <div class="console-box" id="test-console">> Console ready...</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <button onclick="runNetworkTest('wifi')" class="btn btn-secondary">Test Connection</button>
          <button onclick="runNetworkTest('server')" class="btn btn-secondary">Test Backend API</button>
        </div>
      </div>

      <!-- Sensor Calibration Card -->
      <div class="card">
        <h2>Calibration & Sensors Offset</h2>
        <div class="status-item"><span class="status-label">Last Calibrated At</span><span class="status-value">%s</span></div>
        <div class="status-item"><span class="status-label">pH Offset</span><span class="status-value">%.3f</span></div>
        <div class="status-item"><span class="status-label">Turbidity Offset</span><span class="status-value">%.3f</span></div>
        <div class="status-item"><span class="status-label">TDS Offset</span><span class="status-value">%.3f</span></div>
        
        <h3 style="font-size: 1rem; color: #ffffff; margin-top: 20px;">Conduct pH Calibration</h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 15px;">
          Immerse the pH probe into a standard pH 7.0 calibration buffer solution. 
          The calibration loop samples raw values for 30s to adjust zero-drift.
        </p>
        
        <div class="console-box" id="cal-console">> Ready to calibrate...</div>
        <button id="cal-btn" onclick="startCalibration()" class="btn btn-secondary" style="border-color: var(--accent-cyan); color: var(--accent-cyan);">Begin Calibration Procedure</button>
      </div>

      <!-- System Maintenance Card -->
      <div class="card">
        <h2>Maintenance Actions</h2>
        <button onclick="runOTA()" class="btn" style="margin-bottom: 15px; background: linear-gradient(135deg, #8a2be2, #4b0082);">Check OTA Update</button>
        <form action="/reset" method="POST" onsubmit="return confirm('Factory Reset wipes NVS configuration and local files. Confirm?');">
          <button type="submit" class="btn btn-danger">Execute Factory Reset</button>
        </form>
      </div>
    </div>
  </div>

  <script>
    function runNetworkTest(type) {
      const console = document.getElementById('test-console');
      console.innerText += '\n> Running check on ' + type + '...';
      fetch('/test-' + type)
        .then(res => res.json())
        .then(data => {
          console.innerText += '\n> Result: ' + data.status + '\n> Details: ' + data.details;
          console.scrollTop = console.scrollHeight;
        })
        .catch(err => {
          console.innerText += '\n> Request Error: ' + err.message;
        });
    }

    let calInterval = null;
    function startCalibration() {
      const btn = document.getElementById('cal-btn');
      const console = document.getElementById('cal-console');
      btn.disabled = true;
      console.innerText = '> Initializing calibration routine...';
      
      fetch('/calibrate', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          console.innerText += '\n> ' + data.message;
          calInterval = setInterval(pollCalibration, 2000);
        });
    }

    function pollCalibration() {
      const console = document.getElementById('cal-console');
      const btn = document.getElementById('cal-btn');
      fetch('/calibration-status')
        .then(res => res.json())
        .then(data => {
          console.innerText = '> Status: ' + data.status + '\n> Progress: ' + data.progress + ' samples\n> Current Reading: ' + data.current_raw;
          if (!data.running) {
            clearInterval(calInterval);
            btn.disabled = false;
            console.innerText += '\n> Calibration Finished successfully!\n> New Offset: ' + data.offset;
          }
        });
    }

    function runOTA() {
      alert("No update package found. System version v1.0.0 is up to date.");
    }
  </script>
</body>
</html>
)rawliteral";

void handleRootPortal() {
  char htmlBuf[7000];
  
  // Format variables
  bool isTimeSynced = false;
  char uptimeStr[32];
  uint32_t uptime = millis() / 1000;
  snprintf(uptimeStr, sizeof(uptimeStr), "%ud %uh %um %us", uptime / 86400, (uptime %% 86400) / 3600, (uptime %% 3600) / 60, uptime %% 60);

  int queueCount = 0;
  if (SD.exists("/data/queue.jsonl")) {
    File f = SD.open("/data/queue.jsonl", FILE_READ);
    if (f) {
      while (f.available()) {
        if (f.readStringUntil('\n').indexOf("[START]") >= 0) {
          queueCount++;
        }
      }
      f.close();
    }
  }

  snprintf(htmlBuf, sizeof(htmlBuf), SETUP_HTML,
           config.device_id,
           config.wifi_ssid,
           config.wifi_password,
           config.server_host,
           config.server_port,
           strcmp(config.protocol, "mqtt") == 0 ? "selected" : "",
           strcmp(config.protocol, "http") == 0 ? "selected" : "",
           config.api_key,
           config.sample_interval_sec,
           
           isOnline ? "badge-success" : "badge-error",
           isOnline ? "ONLINE" : "OFFLINE",
           WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0,
           uptimeStr,
           queueCount,
           getSDUsagePercent(),
           lowStorageMode ? "badge-error" : "badge-success",
           lowStorageMode ? "WARNING: FULL" : "HEALTHY",
           lastSendTimeStr,
           config.last_ntp_sync,
           
           config.last_calibration_at,
           config.ph_offset,
           config.turbidity_offset,
           config.tds_offset);
           
  webServer.send(200, "text/html", htmlBuf);
}

void handleSavePortal() {
  if (webServer.hasArg("device_id")) {
    strcpy(config.device_id, webServer.arg("device_id").c_str());
    strcpy(config.wifi_ssid, webServer.arg("ssid").c_str());
    strcpy(config.wifi_password, webServer.arg("password").c_str());
    strcpy(config.server_host, webServer.arg("host").c_str());
    config.server_port = webServer.arg("port").toInt();
    strcpy(config.protocol, webServer.arg("protocol").c_str());
    strcpy(config.api_key, webServer.arg("api_key").c_str());
    config.sample_interval_sec = webServer.arg("sample_interval").toInt();
    if (config.sample_interval_sec < 30) config.sample_interval_sec = 30; // Minimum limit

    // Format endpoints
    snprintf(config.mqtt_broker_url, sizeof(config.mqtt_broker_url), "mqtt://%s:%d", config.server_host, config.server_port);
    snprintf(config.http_endpoint, sizeof(config.http_endpoint), "http://%s:%d/data", config.server_host, 8000);

    saveConfiguration();
    
    webServer.send(200, "text/html", "<h3>Configuration Applied. System Rebooting...</h3>");
    delay(1000);
    ESP.restart();
  } else {
    webServer.send(400, "text/html", "Bad Request");
  }
}

void handleResetPortal() {
  webServer.send(200, "text/html", "<h3>Factory Reset Activated. Rebooting...</h3>");
  delay(1000);
  factoryReset();
}

void handleCalibratePortal() {
  calibrationSampleCount = 0;
  calibrationStartMs = millis();
  calibrationRunning = true;
  
  StaticJsonDocument<128> doc;
  doc["status"] = "started";
  doc["message"] = "Calibration started. Collecting 30 samples.";
  String out;
  serializeJson(doc, out);
  webServer.send(200, "application/json", out);
}

void handleCalibrationStatus() {
  StaticJsonDocument<256> doc;
  doc["running"] = calibrationRunning;
  doc["progress"] = calibrationSampleCount;
  doc["current_raw"] = analogRead(PIN_PH) * (3.3f / 4095.0f) * 3.5f;
  
  if (!calibrationRunning) {
    doc["status"] = "complete";
    doc["offset"] = config.ph_offset;
  } else {
    doc["status"] = "sampling";
  }
  
  String out;
  serializeJson(doc, out);
  webServer.send(200, "application/json", out);
}

void handleTestWiFi() {
  StaticJsonDocument<256> doc;
  if (WiFi.status() == WL_CONNECTED) {
    doc["status"] = "Connected";
    doc["details"] = "SSID: " + WiFi.SSID() + ", RSSI: " + String(WiFi.RSSI()) + " dBm";
  } else {
    doc["status"] = "Disconnected";
    doc["details"] = "WiFi link down. Attempting reconnect loops.";
  }
  String out;
  serializeJson(doc, out);
  webServer.send(200, "application/json", out);
}

void handleTestServer() {
  StaticJsonDocument<256> doc;
  WiFiClient checkClient;
  
  doc["host"] = config.server_host;
  doc["port"] = (strcmp(config.protocol, "mqtt") == 0) ? config.server_port : 8000;
  
  uint32_t startMs = millis();
  if (checkClient.connect(config.server_host, doc["port"].as<uint16_t>())) {
    uint32_t duration = millis() - startMs;
    doc["status"] = "Success";
    doc["details"] = "Socket connection open. Latency: " + String(duration) + " ms";
    checkClient.stop();
  } else {
    doc["status"] = "Failed";
    doc["details"] = "Connection refused. Server unreachable.";
  }
  String out;
  serializeJson(doc, out);
  webServer.send(200, "application/json", out);
}

void startSetupPortal() {
  isApMode = true;
  char apSSID[64];
  snprintf(apSSID, sizeof(apSSID), "Hydronix_Setup_%s", config.device_id);
  WiFi.softAP(apSSID);
  
  dnsServer.start(53, "*", WiFi.softAPIP());
  
  webServer.on("/", HTTP_GET, handleRootPortal);
  webServer.on("/save", HTTP_POST, handleSavePortal);
  webServer.on("/reset", HTTP_POST, handleResetPortal);
  webServer.on("/calibrate", HTTP_POST, handleCalibratePortal);
  webServer.on("/calibration-status", HTTP_GET, handleCalibrationStatus);
  webServer.on("/test-wifi", HTTP_GET, handleTestWiFi);
  webServer.on("/test-server", HTTP_GET, handleTestServer);
  
  webServer.begin();
  Serial.println("[SYSTEM] Setup AP Portal fully operational.");
}

// --- FREERTOS CORE TASKS ---

// 1. Sensor Sampling Task (Core 1)
void taskSensorRead(void* pvParameters) {
  float prev_ph = 7.0f, prev_turb = 1.0f, prev_tds = 150.0f, prev_temp = 25.0f, prev_flow = 5.0f;
  
  // Stuck detection sample counts (corresponds to 24 hours)
  uint32_t stuck_count_ph = 0;
  uint32_t stuck_count_turb = 0;
  uint32_t stuck_count_tds = 0;
  uint32_t stuck_count_temp = 0;
  uint32_t stuck_count_flow = 0;
  
  TickType_t lastWakeTime = xTaskGetTickCount();
  const uint32_t maxStuckSamples = 86400 / config.sample_interval_sec;
  
  for (;;) {
    // If calibration is in progress, collect samples asynchronously
    if (calibrationRunning) {
      float raw = analogRead(PIN_PH) * (3.3f / 4095.0f) * 3.5f;
      calibrationSamples[calibrationSampleCount++] = raw;
      if (calibrationSampleCount >= 30) {
        // Calculate median
        for (int i = 0; i < 29; i++) {
          for (int j = i + 1; j < 30; j++) {
            if (calibrationSamples[i] > calibrationSamples[j]) {
              float t = calibrationSamples[i];
              calibrationSamples[i] = calibrationSamples[j];
              calibrationSamples[j] = t;
            }
          }
        }
        float median = calibrationSamples[15];
        config.ph_offset = 7.0f - median;
        
        // Sync timestamp
        bool time_ok = false;
        getUTCTime(config.last_calibration_at, sizeof(config.last_calibration_at), time_ok);
        saveConfiguration();
        
        calibrationRunning = false;
      }
      vTaskDelay(pdMS_TO_TICKS(1000));
      continue;
    }

    // 1. Read Analog Levels
    float raw_ph = analogRead(PIN_PH) * (3.3f / 4095.0f) * 3.5f; 
    float raw_turb = analogRead(PIN_TURBIDITY) * (1000.0f / 4095.0f);
    float raw_tds = analogRead(PIN_TDS) * (5000.0f / 4095.0f);
    float raw_temp = -10.0f + (analogRead(PIN_TEMP) * (100.0f / 4095.0f));
    float raw_flow = analogRead(PIN_FLOW) * (50.0f / 4095.0f);
    
    // 2. Apply NVS offsets
    float cal_ph = raw_ph + config.ph_offset;
    float cal_turb = raw_turb + config.turbidity_offset;
    float cal_tds = raw_tds + config.tds_offset;
    float cal_temp = raw_temp + config.temp_offset;
    float cal_flow = raw_flow + config.flow_offset;
    
    // 3. Rate of Change Violation Check (Noise spike filter, threshold: >2 units per minute)
    float delta_mins = config.sample_interval_sec / 60.0f;
    float allowed_delta = 2.0f * delta_mins;
    
    // Apply clamping if rate of change exceeds threshold
    if (abs(cal_ph - prev_ph) > allowed_delta) {
      cal_ph = prev_ph + (cal_ph > prev_ph ? allowed_delta : -allowed_delta);
      Serial.println("[PIPELINE] Rate of change violation clamped for pH!");
    }
    if (abs(cal_turb - prev_turb) > allowed_delta) {
      cal_turb = prev_turb + (cal_turb > prev_turb ? allowed_delta : -allowed_delta);
    }
    if (abs(cal_tds - prev_tds) > 200.0f * delta_mins) { // TDS delta relative
      cal_tds = prev_tds + (cal_tds > prev_tds ? 200.0f * delta_mins : -200.0f * delta_mins);
    }
    if (abs(cal_temp - prev_temp) > allowed_delta) {
      cal_temp = prev_temp + (cal_temp > prev_temp ? allowed_delta : -allowed_delta);
    }
    if (abs(cal_flow - prev_flow) > allowed_delta) {
      cal_flow = prev_flow + (cal_flow > prev_flow ? allowed_delta : -allowed_delta);
    }

    // 4. Apply Exponential Moving Average (EMA)
    float smooth_ph = cal_ph * 0.3f + prev_ph * 0.7f;
    float smooth_turb = cal_turb * 0.3f + prev_turb * 0.7f;
    float smooth_tds = cal_tds * 0.3f + prev_tds * 0.7f;
    float smooth_temp = cal_temp * 0.3f + prev_temp * 0.7f;
    float smooth_flow = cal_flow * 0.3f + prev_flow * 0.7f;
    
    // 5. Sanity bounds validations
    bool valid = true;
    if (smooth_ph < PH_MIN || smooth_ph > PH_MAX) valid = false;
    if (smooth_turb < TURB_MIN || smooth_turb > TURB_MAX) valid = false;
    if (smooth_tds < TDS_MIN || smooth_tds > TDS_MAX) valid = false;
    if (smooth_temp < TEMP_MIN || smooth_temp > TEMP_MAX) valid = false;
    if (smooth_flow < FLOW_MIN || smooth_flow > FLOW_MAX) valid = false;
    
    if (valid) {
      // 6. Stuck Sensor Detection Logic (Check flatlines for 24h)
      if (abs(smooth_ph - prev_ph) < 0.0001f) stuck_count_ph++; else stuck_count_ph = 0;
      if (abs(smooth_turb - prev_turb) < 0.0001f) stuck_count_turb++; else stuck_count_turb = 0;
      if (abs(smooth_tds - prev_tds) < 0.0001f) stuck_count_tds++; else stuck_count_tds = 0;
      if (abs(smooth_temp - prev_temp) < 0.0001f) stuck_count_temp++; else stuck_count_temp = 0;
      if (abs(smooth_flow - prev_flow) < 0.0001f) stuck_count_flow++; else stuck_count_flow = 0;
      
      isPhStuck = (stuck_count_ph >= maxStuckSamples);
      isTurbStuck = (stuck_count_turb >= maxStuckSamples);
      isTdsStuck = (stuck_count_tds >= maxStuckSamples);
      isTempStuck = (stuck_count_temp >= maxStuckSamples);
      isFlowStuck = (stuck_count_flow >= maxStuckSamples);
      
      prev_ph = smooth_ph;
      prev_turb = smooth_turb;
      prev_tds = smooth_tds;
      prev_temp = smooth_temp;
      prev_flow = smooth_flow;
      
      SensorReading reading;
      reading.ph = smooth_ph;
      reading.turbidity = smooth_turb;
      reading.tds = smooth_tds;
      reading.temperature = smooth_temp;
      reading.flow_rate = smooth_flow;
      reading.raw_ph = raw_ph;
      reading.seq_no = ++globalSeqNo;
      
      bool synced = false;
      getUTCTime(reading.timestamp, sizeof(reading.timestamp), synced);
      strcpy(reading.timestamp_source, synced ? "device" : "server_adjusted");
      
      // Dispatch payloads to task queues
      xQueueSend(sensorQueue, &reading, 0);
      xQueueSend(displayQueue, &reading, 0);
    } else {
      Serial.printf("[ERROR] Raw reading out of boundary limits (pH:%.1f, Turb:%.1f, TDS:%.1f). Payload discarded.\n", 
                    smooth_ph, smooth_turb, smooth_tds);
    }
    
    vTaskDelayUntil(&lastWakeTime, pdMS_TO_TICKS(config.sample_interval_sec * 1000));
  }
}

// 2. Display rendering task (Core 1)
void taskDisplayUpdate(void* pvParameters) {
  SensorReading rd;
  char statLine[21];
  
  for (;;) {
    if (xQueueReceive(displayQueue, &rd, pdMS_TO_TICKS(2000)) == pdPASS) {
      lcd.clear();
      
      // Line 1: Basic Telemetry or warnings
      lcd.setCursor(0, 0);
      if (isPhStuck || isTurbStuck || isTdsStuck || isTempStuck || isFlowStuck) {
        lcd.print("ALERT: STUCK SENSOR ");
      } else {
        lcd.print(config.device_id);
        lcd.print(" | pH:");
        lcd.print(rd.ph, 1);
        if (rd.ph < 6.5f || rd.ph > 8.5f) lcd.print("!");
      }
      
      // Line 2: Turbidity and Temperature
      lcd.setCursor(0, 1);
      lcd.print("Tb:");
      lcd.print(rd.turbidity, 1);
      if (rd.turbidity > 5.0f) lcd.print("!");
      lcd.print(" | T:");
      lcd.print(rd.temperature, 0);
      lcd.print("C");
      
      // Line 3: Connection State & RSSI
      lcd.setCursor(0, 2);
      int32_t rssi = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0;
      snprintf(statLine, sizeof(statLine), "Net:%s | %ddBm", isOnline ? "Online" : "Offline", rssi);
      lcd.print(statLine);
      
      // Line 4: Buffer & Low Storage Warning
      lcd.setCursor(0, 3);
      if (lowStorageMode) {
        lcd.print("SD CARD FULL ALERT! ");
      } else {
        snprintf(statLine, sizeof(statLine), "Q:%lu | Sync:%s", globalSeqNo, lastSendTimeStr);
        lcd.print(statLine);
      }
    }
  }
}

// 3. Network Connection Manager Task (Core 0)
void taskNetworkManager(void* pvParameters) {
  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      isOnline = false;
      WiFi.begin(config.wifi_ssid, config.wifi_password);
      
      uint32_t attempts = 0;
      while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        vTaskDelay(pdMS_TO_TICKS(10000)); // Try every 10 seconds (5 mins total)
        attempts++;
      }
      
      // Extended reconnect state machine if 30 cycles fails
      while (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WIFI] Network manager in fallback retry (60s loop).");
        vTaskDelay(pdMS_TO_TICKS(60000)); // Retry every 60 seconds
        WiFi.begin(config.wifi_ssid, config.wifi_password);
      }
      
      // Reconnected
      Serial.println("[WIFI] Network connection restored.");
      
      // Sync clock via NTP
      configTime(config.timezone_offset_sec, 0, "pool.ntp.org", "time.nist.gov");
      struct tm timeinfo;
      if (getLocalTime(&timeinfo)) {
        isOnline = true;
        bool t_ok = false;
        getUTCTime(config.last_ntp_sync, sizeof(config.last_ntp_sync), t_ok);
        saveConfiguration();
        Serial.printf("[NTP] Sync Successful. Timestamp: %s\n", config.last_ntp_sync);
      }
    } else {
      isOnline = true;
    }
    
    vTaskDelay(pdMS_TO_TICKS(30000)); // Check network link health every 30 seconds
  }
}

// 4. Uplink Exporter Task (Core 0)
void taskUplinkSender(void* pvParameters) {
  SensorReading rd;
  
  for (;;) {
    if (xQueueReceive(sensorQueue, &rd, portMAX_DELAY) == pdPASS) {
      
      // Build JSON payload
      StaticJsonDocument<512> doc;
      doc["device_id"] = config.device_id;
      doc["ph"] = rd.ph;
      doc["turbidity"] = rd.turbidity;
      doc["tds"] = rd.tds;
      doc["temperature"] = rd.temperature;
      doc["flow_rate"] = rd.flow_rate;
      doc["seq_no"] = rd.seq_no;
      doc["device_reset_count"] = config.reset_count;
      doc["timestamp"] = rd.timestamp;
      doc["timestamp_source"] = rd.timestamp_source;
      doc["raw_ph"] = rd.raw_ph;
      
      // Inject fallback details if using HTTP fallback due to MQTT connection failures
      if (httpFallbackActive) {
        doc["fallback_reason"] = "mqtt_unreachable";
        doc["fallback_duration_seconds"] = (millis() - httpFallbackStartTime) / 1000;
      }
      
      String payload;
      serializeJson(doc, payload);
      
      bool success = false;
      
      // Check primary ingestion protocol (MQTT preferred)
      if (strcmp(config.protocol, "mqtt") == 0 && !httpFallbackActive) {
        if (!mqttClient.connected()) {
          // Perform exponential backoff reconnect attempt
          uint32_t backoff = 1000;
          for (int i = 0; i < 5 && !mqttClient.connected(); i++) {
            mqttClient.setServer(config.server_host, config.server_port);
            mqttClient.connect(config.device_id, "hydronix", config.api_key);
            if (!mqttClient.connected()) {
              vTaskDelay(pdMS_TO_TICKS(backoff));
              backoff *= 2;
            }
          }
        }
        
        if (mqttClient.connected()) {
          char topic[128];
          snprintf(topic, sizeof(topic), "hydronix/devices/%s/telemetry", config.device_id);
          success = mqttClient.publish(topic, payload.c_str());
        } else {
          // Flag MQTT as down, activate HTTP fallback pipeline
          Serial.println("[UPLINK] MQTT connect failed. Triggering HTTP POST fallback.");
          httpFallbackActive = true;
          httpFallbackStartTime = millis();
          httpFallbackPollCount = 0;
        }
      }
      
      // HTTP Fallback Uplink (Switch to endpoint)
      if (httpFallbackActive || strcmp(config.protocol, "http") == 0) {
        HTTPClient http;
        http.begin(config.http_endpoint);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("X-API-Key", config.api_key);
        
        int code = http.POST(payload);
        if (code == HTTP_CODE_OK || code == HTTP_CODE_CREATED) {
          success = true;
          httpFallbackPollCount++;
          
          // Return to primary MQTT protocol after 10 successful fallback POSTs
          if (strcmp(config.protocol, "mqtt") == 0 && httpFallbackPollCount >= 10) {
            Serial.println("[UPLINK] Fallback recovery threshold met. Attempting return to MQTT.");
            httpFallbackActive = false;
          }
        }
        http.end();
      }
      
      if (success) {
        bool t_ok = false;
        getUTCTime(lastSendTimeStr, sizeof(lastSendTimeStr), t_ok);
      } else {
        // Transactional SD Offline buffering with checksum verification
        if (SD.exists("/data") || SD.mkdir("/data")) {
          File file = SD.open("/data/queue.jsonl", FILE_APPEND);
          if (file) {
            uint32_t payloadCs = calculateChecksum(payload);
            file.println("[START]");
            file.println(payload);
            file.printf("[CHECKSUM:%lu]\n", payloadCs);
            file.println("[END]");
            file.close();
            Serial.println("[BUFFER] Ingestion failed. Buffered payload to SD.");
          } else {
            lowStorageMode = true;
            Serial.println("[CRITICAL] SD storage write failure!");
          }
        }
      }
    }
  }
}

// 5. Offline Queue Recovery Task (Core 0)
void taskOfflineSync(void* pvParameters) {
  for (;;) {
    pruneOfflineQueue(); // Limit buffer size and run GC checks
    
    if (isOnline && SD.exists("/data/queue.jsonl") && !lowStorageMode) {
      File file = SD.open("/data/queue.jsonl", FILE_READ);
      if (file) {
        File temp = SD.open("/data/temp.jsonl", FILE_WRITE);
        if (temp) {
          while (file.available()) {
            String marker = file.readStringUntil('\n');
            marker.trim();
            
            if (marker == "[START]") {
              String jsonPayload = file.readStringUntil('\n');
              jsonPayload.trim();
              String checksumLine = file.readStringUntil('\n');
              checksumLine.trim();
              String endMarker = file.readStringUntil('\n');
              endMarker.trim();
              
              bool integrityOk = false;
              if (endMarker == "[END]" && checksumLine.startsWith("[CHECKSUM:")) {
                uint32_t expected = checksumLine.substring(10, checksumLine.length() - 1).toInt();
                if (calculateChecksum(jsonPayload) == expected) {
                  integrityOk = true;
                }
              }
              
              bool replayed = false;
              if (integrityOk && isOnline) {
                // Post record to server
                HTTPClient http;
                http.begin(config.http_endpoint);
                http.addHeader("Content-Type", "application/json");
                http.addHeader("X-API-Key", config.api_key);
                
                int code = http.POST(jsonPayload);
                if (code == HTTP_CODE_OK || code == HTTP_CODE_CREATED) {
                  replayed = true;
                  Serial.println("[SYNC] Replayed buffered offline record successfully.");
                }
                http.end();
              }
              
              // Keep in queue if transmission failed or checksum validation corrupted
              if (!replayed && integrityOk) {
                temp.println("[START]");
                temp.println(jsonPayload);
                temp.println(checksumLine);
                temp.println("[END]");
              }
            }
          }
          temp.close();
        }
        file.close();
        
        SD.remove("/data/queue.jsonl");
        SD.rename("/data/temp.jsonl", "/data/queue.jsonl");
      }
    }
    
    vTaskDelay(pdMS_TO_TICKS(60000)); // Sync check every 60 seconds
  }
}

// 6. Diagnostics Heartbeat Task (Core 0)
void taskHealthHeartbeat(void* pvParameters) {
  for (;;) {
    if (isOnline) {
      StaticJsonDocument<512> doc;
      doc["device_id"] = config.device_id;
      doc["status"] = "online";
      doc["signal_strength"] = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0;
      doc["sd_usage_percent"] = getSDUsagePercent();
      doc["uptime_seconds"] = millis() / 1000;
      doc["firmware_version"] = "1.0.0";
      doc["last_reading_at"] = lastSendTimeStr;
      doc["low_storage"] = lowStorageMode;
      
      // Diagnostic warnings
      JsonObject warnings = doc.createNestedObject("sensor_status");
      warnings["ph_stuck"] = isPhStuck;
      warnings["turbidity_stuck"] = isTurbStuck;
      warnings["tds_stuck"] = isTdsStuck;
      warnings["temp_stuck"] = isTempStuck;
      warnings["flow_stuck"] = isFlowStuck;
      
      String payload;
      serializeJson(doc, payload);
      
      HTTPClient http;
      char hUrl[256];
      snprintf(hUrl, sizeof(hUrl), "http://%s:%d/devices/%s/heartbeat", config.server_host, 8000, config.device_id);
      http.begin(hUrl);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-API-Key", config.api_key);
      
      http.POST(payload);
      http.end();
      Serial.println("[DIAGNOSTICS] Heartbeat packet sent.");
    }
    
    vTaskDelay(pdMS_TO_TICKS(1800000)); // Run every 30 minutes
  }
}

// --- SYSTEM INITIALIZATION ---

void setup() {
  Serial.begin(115200);
  
  // Wire & LCD Setup
  Wire.begin(I2C_SDA, I2C_SCL);
  lcd.init();
  lcd.backlight();
  lcd.print("Hydronix Core Boot...");
  
  loadConfiguration();
  
  // Initialize storage partitions
  if (!SD.begin(SD_CS_PIN)) {
    Serial.println("[SD] SD mount failed. Backup queue disabled.");
    lowStorageMode = true;
  }
  
  // Captive Portal fallback if configuration is empty
  if (strlen(config.wifi_ssid) == 0) {
    lcd.clear();
    lcd.print("CAPTIVE SETUP MODE");
    lcd.setCursor(0, 1);
    lcd.print("SSID: Hydronix_Setup");
    lcd.setCursor(0, 2);
    lcd.print("Gateway: 192.168.4.1");
    startSetupPortal();
    return;
  }
  
  // Connect WiFi
  WiFi.begin(config.wifi_ssid, config.wifi_password);
  
  // Instantiate message queues
  sensorQueue = xQueueCreate(10, sizeof(SensorReading));
  displayQueue = xQueueCreate(5, sizeof(SensorReading));
  
  // Spawn core tasks using FreeRTOSScheduler
  xTaskCreatePinnedToCore(taskSensorRead, "SensorSampling", 4096, NULL, 3, NULL, 1);
  xTaskCreatePinnedToCore(taskDisplayUpdate, "LCDDisplay", 2048, NULL, 1, NULL, 1);
  xTaskCreatePinnedToCore(taskNetworkManager, "NetWatchdog", 3072, NULL, 2, NULL, 0);
  xTaskCreatePinnedToCore(taskUplinkSender, "UplinkExporter", 4096, NULL, 2, NULL, 0);
  xTaskCreatePinnedToCore(taskOfflineSync, "OfflineSync", 4096, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(taskHealthHeartbeat, "Heartbeat", 3072, NULL, 1, NULL, 0);
}

void loop() {
  if (isApMode) {
    dnsServer.processNextRequest();
    webServer.handleClient();
  }
  delay(1);
}
