/**
 * Hydronix IoT Platform - ESP32 Firmware v2.0.0
 * Refactored & Modularized
 */

#include "Config.h"
#include "ApiClient.h"
#include "WiFiManager.h"
#include "SensorReader.h"
#include "valve_control.h"

// ─── ISRG ROOT X1 CA — LET'S ENCRYPT ROOT (Valid until 2035-06-04) ──────────
const char ISRG_ROOT_X1_PEM[] PROGMEM = R"PEM(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTAEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoBggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TP
amRb/ne5S/7HM3JTRH/4qRwHCKKYmQyMCfpSfcAu5p26rWDkbVEJKRtLU//aXEwn
v0b8i1Dz1gEMxuLFhA==
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIICGzCCAaGgAwIBAgIQQdKd0XLq7qeAwSxs6S+HUjAKBggqhkjOPQQDAzBPMQsw
CQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJuZXQgU2VjdXJpdHkgUmVzZWFyY2gg
R3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBYMjAeFw0yMDA5MDQwMDAwMDBaFw00
MDA5MTcxNjAwMDBaME8xCzAJBgNVBAYTAlVTMSkwJwYDVQQKEyBJbnRlcm5ldCBT
ZWN1cml0eSBSZXNlYXJjaCBHcm91cDEVMBMGA1UEAxMMSVNSRyBSb290IFgyMHYw
EAYHKoZIzj0CAQYFK4EEACIDYgAEzZvVn4CDCuwJSvMWSj5cz3es3mcFDR0HttwW
+1qLFNvicWDEukWVEYmO6gbf9yoWHKS5xcUy4APgHoIYOIvXRdgKam7mAHf7AlF9
ItgKbppbd9/w+kHsOdx1ymgHDB/qo0IwQDAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0T
AQH/BAUwAwEB/zAdBgNVHQ4EFgQUfEKWrt5LSDv6kviejM9ti6lyN5UwCgYIKoZI
zj0EAwMDaAAwZQIwe3lORlCEwkSHRhtFcP9Ymd70/aTSVaYgLXTWNLxBo1BfASdW
tL4ndQavEi51mI38AjEAi/V3bNTIZargCyzuFJ0nN6T5U6VR5CmD1/iQMVtCnwr1
/q4AaOeMSQ+2b1tbFfLn
-----END CERTIFICATE-----
)PEM";

// ─── GLOBAL INSTANCES ────────────────────────────────────────────────────────
DeviceConfig config;
Preferences  pref;
WebServer    webServer(80);
DNSServer    dnsServer;
LiquidCrystal_I2C lcd(LCD_ADDR, 20, 4);

// FreeRTOS primitives
QueueHandle_t     sensorQueue  = NULL;
QueueHandle_t     displayQueue = NULL;
SemaphoreHandle_t sdMutex      = NULL;

// Global state
bool     isApMode       = false;
bool     isOnline       = false;
bool     sdAvailable    = false;
bool     lowStorageMode = false;
uint32_t globalSeqNo    = 0;
char     lastSendTimeStr[32] = "never";
char     csrfToken[17]  = "";

// Stuck sensor flags
bool isPhStuck   = false;
bool isTurbStuck = false;
bool isTdsStuck  = false;
bool isTempStuck = false;
bool isFlowStuck = false;

// Calibration state
bool     calibrationRunning     = false;
uint32_t calibrationStartMs     = 0;
float    calibrationSamples[30] = {};
int      calibrationSampleCount = 0;

// Flow sensor ISR
volatile uint32_t flowPulseCount = 0;
portMUX_TYPE flowMux = portMUX_INITIALIZER_UNLOCKED;

void IRAM_ATTR flowSensorISR() {
  portENTER_CRITICAL_ISR(&flowMux);
  flowPulseCount++;
  portEXIT_CRITICAL_ISR(&flowMux);
}

// Sanity bounds
const float PH_MIN   = 0.0f,   PH_MAX   = 14.0f;
const float TURB_MIN = 0.0f,   TURB_MAX = 1000.0f;
const float TDS_MIN  = 0.0f,   TDS_MAX  = 10000.0f;
const float TEMP_MIN = -50.0f, TEMP_MAX = 150.0f;
const float FLOW_MIN = 0.0f,   FLOW_MAX = 10000.0f;

const float PH_DELTA_PER_MIN   = 24.0f;    // Allow up to 2.0 pH units change per 5s
const float TURB_DELTA_PER_MIN = 600.0f;   // Allow up to 50.0 NTU change per 5s
const float TDS_DELTA_PER_MIN  = 2400.0f;  // Allow up to 200.0 ppm change per 5s
const float TEMP_DELTA_PER_MIN = 60.0f;    // Allow up to 5.0 C change per 5s
const float FLOW_DELTA_PER_MIN = 120.0f;   // Allow up to 10.0 L/min change per 5s

// ─── UTILITY FUNCTIONS ───────────────────────────────────────────────────────
uint32_t crc32_compute(const uint8_t* data, size_t size) {
  uint32_t crc = 0xFFFFFFFF;
  for (size_t i = 0; i < size; i++) {
    crc ^= data[i];
    for (int j = 0; j < 8; j++) {
      crc = (crc & 1) ? (crc >> 1) ^ 0xEDB88320 : (crc >> 1);
    }
  }
  return ~crc;
}

uint32_t calculateConfigCRC(const DeviceConfig& cfg) {
  return crc32_compute((const uint8_t*)&cfg, sizeof(DeviceConfig) - sizeof(uint32_t));
}

uint32_t calculateQueueCRC(const String& data) {
  return crc32_compute((const uint8_t*)data.c_str(), data.length());
}

void loadFactoryDefaults() {
  memset(&config, 0, sizeof(DeviceConfig));
  config.schema_version      = CONFIG_SCHEMA_VERSION;
  strcpy(config.device_id,   "HYDRO_001");
  config.reset_count         = 0;
  config.sample_interval_sec = 5;
  strcpy(config.api_base_url, "https://api.hydronix.local/v2");
  strcpy(config.firmware_channel, "stable");
  config.server_config_version = 0;
  config.timezone_offset_sec = 19800;
  strcpy(config.last_ntp_sync, "never");
  strcpy(config.last_calibration_at, "never");
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

  bool needReset = false;

  if (readBytes == 0) {
    needReset = true;
  } else if (config.schema_version != CONFIG_SCHEMA_VERSION) {
    needReset = true;
  } else if (readBytes != sizeof(DeviceConfig)) {
    needReset = true;
  } else {
    uint32_t calculated = calculateConfigCRC(config);
    if (calculated != config.crc32) {
      needReset = true;
    } else if (!String(config.device_id).startsWith("HYDRO_")) {
      needReset = true;
    }
  }

  if (needReset) {
    loadFactoryDefaults();
    saveConfiguration();
  } else {
    config.reset_count++;
    saveConfiguration();
  }
}

void generateCSRFToken() {
  const char charset[] = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (int i = 0; i < 16; i++) {
    csrfToken[i] = charset[esp_random() % (sizeof(charset) - 1)];
  }
  csrfToken[16] = '\0';
}

void factoryReset() {
  pref.begin("hydronix", false);
  pref.clear();
  pref.end();
  if (sdAvailable) {
    SD.remove("/data/queue.jsonl");
    SD.remove("/data/queue_new.jsonl");
    SD.remove("/data/queue_old.jsonl");
    SD.remove("/data/temp.jsonl");
  }
  delay(1000);
  ESP.restart();
}

void getAPPassword(char* outPass, size_t outSize) {
  const char* digits = strrchr(config.device_id, '_');
  if (digits && *(digits + 1) != '\0') digits++;
  else digits = "000";
  snprintf(outPass, outSize, "hydro-%s-setup", digits);
}

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
  if (!sdAvailable) return 0.0f;
  uint64_t total = SD.totalBytes();
  if (total == 0) return 0.0f;
  return ((float)SD.usedBytes() / (float)total) * 100.0f;
}

int getQueueCount() {
  if (!sdAvailable) return 0;
  if (!SD.exists("/data/queue.jsonl")) return 0;
  File f = SD.open("/data/queue.jsonl", FILE_READ);
  if (!f) return 0;
  int count = 0;
  while (f.available()) {
    String line = f.readStringUntil('\n');
    if (line.startsWith("[START:v2]")) count++;
  }
  f.close();
  return count;
}

// ─── SD QUEUE BUFFERING ──────────────────────────────────────────────────────
void writeToSDQueue(const String& payload, uint32_t seqNo) {
  if (!sdAvailable) return;
  if (xSemaphoreTake(sdMutex, pdMS_TO_TICKS(3000)) != pdPASS) return;
  if (!SD.exists("/data") && !SD.mkdir("/data")) {
    xSemaphoreGive(sdMutex);
    return;
  }
  File file = SD.open("/data/queue.jsonl", FILE_APPEND);
  if (file) {
    uint32_t crc = calculateQueueCRC(payload);
    file.println("[START:v2]");
    file.printf("%lu:%s\n", (unsigned long)seqNo, config.device_id);
    file.println(payload);
    file.printf("[CRC32:%08lx]\n", (unsigned long)crc);
    file.println("[END]");
    file.close();
  } else {
    lowStorageMode = true;
  }
  xSemaphoreGive(sdMutex);
}

void pruneOfflineQueue() {
  if (!sdAvailable) return;
  if (xSemaphoreTake(sdMutex, pdMS_TO_TICKS(5000)) != pdPASS) return;

  lowStorageMode = (getSDUsagePercent() > 90.0f);

  if (!SD.exists("/data/queue.jsonl")) {
    xSemaphoreGive(sdMutex);
    return;
  }

  File file = SD.open("/data/queue.jsonl", FILE_READ);
  if (!file) { xSemaphoreGive(sdMutex); return; }
  int recordCount = 0;
  while (file.available()) {
    String line = file.readStringUntil('\n');
    if (line.startsWith("[START:v2]")) recordCount++;
  }
  file.close();

  if (recordCount <= 4320) {
    xSemaphoreGive(sdMutex);
    return;
  }

  int skipCount = recordCount - 4000;

  file = SD.open("/data/queue.jsonl", FILE_READ);
  File tmpFile = SD.open("/data/queue_new.jsonl", FILE_WRITE);
  if (!file || !tmpFile) {
    if (file) file.close();
    if (tmpFile) tmpFile.close();
    xSemaphoreGive(sdMutex);
    return;
  }

  int current = 0;
  while (file.available()) {
    String line = file.readStringUntil('\n');
    if (line.startsWith("[START:v2]")) {
      current++;
      String seqLine  = file.readStringUntil('\n');
      String payload  = file.readStringUntil('\n');
      String crcLine  = file.readStringUntil('\n');
      String endLine  = file.readStringUntil('\n');
      if (current > skipCount) {
        tmpFile.println("[START:v2]");
        tmpFile.println(seqLine);
        tmpFile.println(payload);
        tmpFile.println(crcLine);
        tmpFile.println(endLine);
      }
    }
  }
  file.close();
  tmpFile.close();

  SD.remove("/data/queue_old.jsonl");
  SD.rename("/data/queue.jsonl",     "/data/queue_old.jsonl");
  SD.rename("/data/queue_new.jsonl", "/data/queue.jsonl");
  SD.remove("/data/queue_old.jsonl");

  lowStorageMode = (getSDUsagePercent() > 90.0f);
  xSemaphoreGive(sdMutex);
}

// ─── FREERTOS TASKS ──────────────────────────────────────────────────────────
void taskSensorRead(void* pvParameters) {
  SensorReader reader;
  TickType_t lastWakeTime = xTaskGetTickCount();
  bool wasThrottled = false;

  for (;;) {
    bool throttled = lowStorageMode;
    if (throttled != wasThrottled) {
      Serial.printf("[SENSOR] %s\n", throttled ?
        "Low SD storage — throttling 5x." : "Storage healthy — resuming normal rate.");
      wasThrottled = throttled;
    }
    uint32_t interval = config.sample_interval_sec * (throttled ? 5 : 1);
    const uint32_t maxStuckSamples = 86400 / max(1UL, (unsigned long)config.sample_interval_sec);

    if (calibrationRunning) {
      float raw = analogRead(PIN_PH) * (3.3f / 4095.0f) * 3.5f;
      if (calibrationSampleCount < 30) {
        calibrationSamples[calibrationSampleCount++] = raw;
        Serial.printf("[CAL] Sampling pH: %d/30 (raw: %.3f)\n", calibrationSampleCount, raw);
      }
      if (calibrationSampleCount >= 30) {
        for (int i = 1; i < 30; i++) {
          float key = calibrationSamples[i];
          int j = i - 1;
          while (j >= 0 && calibrationSamples[j] > key) {
            calibrationSamples[j + 1] = calibrationSamples[j--];
          }
          calibrationSamples[j + 1] = key;
        }
        float median = calibrationSamples[15];
        config.ph_offset = 7.0f - median;
        bool tOk = false;
        getUTCTime(config.last_calibration_at, sizeof(config.last_calibration_at), tOk);
        saveConfiguration();
        calibrationRunning = false;
        Serial.printf("[CAL] Calibration done. pH offset: %.3f\n", config.ph_offset);
      }
      vTaskDelay(pdMS_TO_TICKS(1000));
      continue;
    }

    SensorReading rd;
    if (reader.performReading(rd, interval, maxStuckSamples)) {
      Serial.printf("[SENSOR] Reading OK! pH: %.2f | Turbidity: %.2f NTU | TDS: %.1f ppm | Temp: %.1f C | Flow: %.2f L/min (Seq: %lu)\n",
                    rd.ph, rd.turbidity, rd.tds, rd.temperature, rd.flow_rate, (unsigned long)rd.seq_no);

      if (xQueueSend(sensorQueue, &rd, 0) != pdPASS) {
        Serial.println("[SENSOR] sensorQueue full — reading dropped!");
      }
      if (xQueueSend(displayQueue, &rd, 0) != pdPASS) {
        // Drop non-critical
      }

      bool valveChanged = valve_controller.processSensorReading(
        rd.ph, rd.turbidity, rd.tds, rd.temperature, 0);
      if (valveChanged) {
        Serial.printf("[VALVE] State changed to %s after sensor reading.\n",
          valve_controller.getCurrentState() == VALVE_OPEN ? "OPEN" : "CLOSED");
      }
      valve_controller.periodicCheck();
    } else {
      float raw_ph   = analogRead(PIN_PH)        * (3.3f / 4095.0f) * 3.5f;
      float raw_turb = analogRead(PIN_TURBIDITY) * (1000.0f / 4095.0f);
      float raw_tds  = analogRead(PIN_TDS)       * (5000.0f / 4095.0f);
      float raw_temp = -10.0f + analogRead(PIN_TEMP) * (100.0f / 4095.0f);
      Serial.printf("[SENSOR] Reading discarded (out-of-bounds or stuck check). Raw values - pH: %.2f, Turbidity: %.2f, TDS: %.1f, Temp: %.1f\n",
                    raw_ph, raw_turb, raw_tds, raw_temp);
    }

    vTaskDelayUntil(&lastWakeTime, pdMS_TO_TICKS(interval * 1000));
  }
}

void taskDisplayUpdate(void* pvParameters) {
  SensorReading lastRd;
  memset(&lastRd, 0, sizeof(SensorReading));
  bool hasReading = false;
  char line[21];

  for (;;) {
    SensorReading newRd;
    if (xQueueReceive(displayQueue, &newRd, pdMS_TO_TICKS(1000)) == pdPASS) {
      lastRd = newRd;
      hasReading = true;
    }

    if (!hasReading) {
      lcd.setCursor(0, 0);
      lcd.print("Hydronix v2.0       ");
      lcd.setCursor(0, 1);
      lcd.print("Waiting for sensor  ");
      lcd.setCursor(0, 2);
      int32_t rssi = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0;
      snprintf(line, sizeof(line), "%-7s %4ddBm  HTTPS",
               isOnline ? "Online" : "Offline", rssi);
      lcd.print(line);
      lcd.setCursor(0, 3);
      lcd.print("Initializing...     ");
      continue;
    }

    lcd.setCursor(0, 0);
    if (isPhStuck || isTurbStuck || isTdsStuck || isTempStuck || isFlowStuck) {
      String stuckStr = String(isPhStuck ? "pH " : "") +
                        String(isTurbStuck ? "Tb " : "") +
                        String(isTdsStuck ? "TD " : "") +
                        String(isTempStuck ? "Tm " : "") +
                        String(isFlowStuck ? "Fl" : "");
      snprintf(line, sizeof(line), "STUCK:%-14s", stuckStr.c_str());
    } else {
      snprintf(line, sizeof(line), "%-9s pH:%-6.1f",
               config.device_id, lastRd.ph);
      if (lastRd.ph < 6.5f || lastRd.ph > 8.5f) line[18] = '!';
    }
    lcd.print(line);

    lcd.setCursor(0, 1);
    snprintf(line, sizeof(line), "Tb:%-6.1f  T:%-4.0fC",
             lastRd.turbidity, lastRd.temperature);
    if (lastRd.turbidity > 5.0f) line[9] = '!';
    lcd.print(line);

    lcd.setCursor(0, 2);
    static bool showIP = false;
    showIP = !showIP;
    if (isOnline && showIP) {
      IPAddress ip = WiFi.localIP();
      snprintf(line, sizeof(line), "IP: %d.%d.%d.%d", ip[0], ip[1], ip[2], ip[3]);
    } else {
      int32_t rssi = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0;
      snprintf(line, sizeof(line), "%-7s %4ddBm  HTTPS",
               isOnline ? "Online" : "Offline", rssi);
    }
    lcd.print(line);

    lcd.setCursor(0, 3);
    if (lowStorageMode) {
      snprintf(line, sizeof(line), "%-20s", "SD CARD FULL ALERT! ");
    } else {
      snprintf(line, sizeof(line), "Q:%-6lu %s",
               (unsigned long)globalSeqNo, lastSendTimeStr);
    }
    lcd.print(line);
  }
}

void taskNetworkManager(void* pvParameters) {
  bool wasConnected = false;
  bool ntpInitialized = false;

  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      if (wasConnected) {
        Serial.println("[WIFI] Disconnected!");
        wasConnected = false;
      }
      isOnline = false;
      WiFi.begin(config.wifi_ssid, config.wifi_password);

      uint32_t attempts = 0;
      while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        vTaskDelay(pdMS_TO_TICKS(10000));
        attempts++;
      }
      while (WiFi.status() != WL_CONNECTED) {
        vTaskDelay(pdMS_TO_TICKS(60000));
        WiFi.begin(config.wifi_ssid, config.wifi_password);
      }

      isOnline = true;
      wasConnected = true;
      Serial.printf("[WIFI] Connected! Local IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
      isOnline = true;
      if (!wasConnected) {
        Serial.printf("[WIFI] Connected! Local IP: %s\n", WiFi.localIP().toString().c_str());
        wasConnected = true;
      }
    }

    if (isOnline) {
      if (!ntpInitialized) {
        Serial.println("[NTP] Initializing configTime...");
        configTime(0, 0, "pool.ntp.org", "time.nist.gov");
        ntpInitialized = true;
      }

      struct tm timeinfo;
      if (getLocalTime(&timeinfo, 1000)) {
        if (timeinfo.tm_year > 120) {
          bool tOk = false;
          char oldSync[32];
          strcpy(oldSync, config.last_ntp_sync);
          getUTCTime(config.last_ntp_sync, sizeof(config.last_ntp_sync), tOk);
          if (strcmp(oldSync, config.last_ntp_sync) != 0) {
            saveConfiguration();
            Serial.printf("[NTP] Time synced successfully: %s\n", config.last_ntp_sync);
          }
        } else {
          Serial.println("[NTP] Waiting for sync (year is still 1970)...");
        }
      } else {
        Serial.println("[NTP] getLocalTime failed");
      }
    }

    vTaskDelay(pdMS_TO_TICKS(30000));
  }
}

void taskUplinkSender(void* pvParameters) {
  SensorReading rd;
  static const int RETRY_DELAYS_MS[] = {2000, 4000, 8000};

  for (;;) {
    if (xQueueReceive(sensorQueue, &rd, portMAX_DELAY) == pdPASS) {
      StaticJsonDocument<512> doc;
      doc["device_id"]          = config.device_id;
      doc["ph"]                 = rd.ph;
      doc["turbidity"]          = rd.turbidity;
      doc["tds"]                = rd.tds;
      doc["temperature"]        = rd.temperature;
      doc["flow_rate"]          = rd.flow_rate;
      doc["seq_no"]             = rd.seq_no;
      doc["device_reset_count"] = config.reset_count;
      doc["timestamp"]          = rd.timestamp;
      doc["timestamp_source"]   = rd.timestamp_source;
      doc["raw_ph"]             = rd.raw_ph;

      doc["valve_state"] = (valve_controller.getCurrentState() == VALVE_OPEN)
                            ? "open" : "closed";
      char vtBuf[32];
      time_t vt = valve_controller.getLastToggleTime();
      if (vt > 0) {
        struct tm vtm;
        gmtime_r(&vt, &vtm);
        strftime(vtBuf, sizeof(vtBuf), "%Y-%m-%dT%H:%M:%SZ", &vtm);
        doc["valve_last_toggled"] = vtBuf;
      }

      String payload;
      serializeJson(doc, payload);

      bool success = false;
      int  lastCode = -1;
      bool authError = false;

      for (int attempt = 0; attempt < 3 && !success && !authError; attempt++) {
        if (attempt > 0) {
          vTaskDelay(pdMS_TO_TICKS(RETRY_DELAYS_MS[attempt - 1]));
        }

        lastCode = httpsSignedPost("/data", payload);

        if (lastCode == HTTP_CODE_OK || lastCode == HTTP_CODE_CREATED) {
          success = true;
        } else if (lastCode == 409) {
          success = true;
        } else if (lastCode == 401 || lastCode == 403) {
          authError = true;
        }
      }

      if (success) {
        bool tOk = false;
        getUTCTime(lastSendTimeStr, sizeof(lastSendTimeStr), tOk);
      } else if (!authError) {
        writeToSDQueue(payload, rd.seq_no);
      }
    }
  }
}

void taskOfflineSync(void* pvParameters) {
  for (;;) {
    pruneOfflineQueue();

    if (isOnline && sdAvailable && SD.exists("/data/queue.jsonl") && !lowStorageMode) {
      if (xSemaphoreTake(sdMutex, pdMS_TO_TICKS(5000)) == pdPASS) {
        File file = SD.open("/data/queue.jsonl", FILE_READ);
        File tmpFile = SD.open("/data/queue_new.jsonl", FILE_WRITE);

        if (file && tmpFile) {
          while (file.available()) {
            String marker = file.readStringUntil('\n');
            marker.trim();

            if (marker == "[START:v2]") {
              String seqLine  = file.readStringUntil('\n'); seqLine.trim();
              String jsonBody = file.readStringUntil('\n'); jsonBody.trim();
              String crcLine  = file.readStringUntil('\n'); crcLine.trim();
              String endLine  = file.readStringUntil('\n'); endLine.trim();

              bool integrityOk = false;
              if (endLine == "[END]" && crcLine.startsWith("[CRC32:")) {
                String hexCrc = crcLine.substring(7, crcLine.length() - 1);
                uint32_t expected = (uint32_t)strtoul(hexCrc.c_str(), nullptr, 16);
                uint32_t actual   = calculateQueueCRC(jsonBody);
                integrityOk = (expected == actual);
              }

              bool jsonOk = false;
              if (integrityOk) {
                StaticJsonDocument<512> testDoc;
                DeserializationError err = deserializeJson(testDoc, jsonBody);
                jsonOk = (err == DeserializationError::Ok &&
                          testDoc.containsKey("device_id") &&
                          testDoc.containsKey("seq_no"));
              }

              bool replayed = false;
              if (jsonOk) {
                xSemaphoreGive(sdMutex);
                int code = httpsSignedPost("/data", jsonBody);
                xSemaphoreTake(sdMutex, pdMS_TO_TICKS(5000));

                if (code == HTTP_CODE_OK || code == HTTP_CODE_CREATED || code == 409) {
                  replayed = true;
                } else if (code == 401 || code == 403) {
                  replayed = true;
                }
              }

              if (!replayed && integrityOk) {
                tmpFile.println("[START:v2]");
                tmpFile.println(seqLine);
                tmpFile.println(jsonBody);
                tmpFile.println(crcLine);
                tmpFile.println("[END]");
              }
            }
          }
          tmpFile.close();
          file.close();

          SD.remove("/data/queue_old.jsonl");
          SD.rename("/data/queue.jsonl",     "/data/queue_old.jsonl");
          SD.rename("/data/queue_new.jsonl", "/data/queue.jsonl");
          SD.remove("/data/queue_old.jsonl");
        } else {
          if (tmpFile) tmpFile.close();
          if (file)    file.close();
        }
        xSemaphoreGive(sdMutex);
      }
    }

    vTaskDelay(pdMS_TO_TICKS(60000));
  }
}

void taskHealthHeartbeat(void* pvParameters) {
  for (;;) {
    if (isOnline) {
      StaticJsonDocument<512> doc;
      doc["device_id"]        = config.device_id;
      doc["status"]           = "online";
      doc["signal_strength"]  = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0;
      doc["sd_usage_percent"] = getSDUsagePercent();
      doc["uptime_seconds"]   = millis() / 1000;
      doc["firmware_version"] = FIRMWARE_VERSION;
      doc["last_reading_at"]  = lastSendTimeStr;
      doc["low_storage"]      = lowStorageMode;
      doc["free_heap"]        = (uint32_t)ESP.getFreeHeap();
      doc["queued_records"]   = getQueueCount();
      doc["config_version"]   = config.server_config_version;

      JsonObject ws = doc.createNestedObject("sensor_status");
      ws["ph_stuck"]         = isPhStuck;
      ws["turbidity_stuck"]  = isTurbStuck;
      ws["tds_stuck"]        = isTdsStuck;
      ws["temp_stuck"]       = isTempStuck;
      ws["flow_stuck"]       = isFlowStuck;

      String payload;
      serializeJson(doc, payload);

      char path[96];
      snprintf(path, sizeof(path), "/devices/%s/heartbeat", config.device_id);
      String responseBody;
      int code = httpsSignedPost(path, payload);

      if (code == HTTP_CODE_OK) {
        int getCode = httpsSignedGet(path, responseBody);
        if (getCode == HTTP_CODE_OK && responseBody.length() > 0) {
          StaticJsonDocument<256> resp;
          if (deserializeJson(resp, responseBody) == DeserializationError::Ok) {
            uint32_t remoteVer = resp["config_version"] | 0;
            if (remoteVer > config.server_config_version) {
              char cfgPath[96];
              snprintf(cfgPath, sizeof(cfgPath), "/devices/%s/config", config.device_id);
              String cfgBody;
              int cfgCode = httpsSignedGet(cfgPath, cfgBody);
              if (cfgCode == HTTP_CODE_OK && cfgBody.length() > 0) {
                StaticJsonDocument<512> cfgDoc;
                if (deserializeJson(cfgDoc, cfgBody) == DeserializationError::Ok) {
                  if (cfgDoc.containsKey("sample_interval_sec")) {
                    uint32_t si = (uint32_t)cfgDoc["sample_interval_sec"];
                    config.sample_interval_sec = max(5UL, min(3600UL, (unsigned long)si));
                  }
                  if (cfgDoc.containsKey("ph_offset"))
                    config.ph_offset = (float)cfgDoc["ph_offset"];
                  if (cfgDoc.containsKey("turbidity_offset"))
                    config.turbidity_offset = (float)cfgDoc["turbidity_offset"];
                  if (cfgDoc.containsKey("tds_offset"))
                    config.tds_offset = (float)cfgDoc["tds_offset"];
                  if (cfgDoc.containsKey("temp_offset"))
                    config.temp_offset = (float)cfgDoc["temp_offset"];
                  if (cfgDoc.containsKey("flow_offset"))
                    config.flow_offset = (float)cfgDoc["flow_offset"];
                  if (cfgDoc.containsKey("firmware_channel")) {
                    String ch = cfgDoc["firmware_channel"].as<String>();
                    strncpy(config.firmware_channel, ch.c_str(),
                            sizeof(config.firmware_channel) - 1);
                  }
                  config.server_config_version = remoteVer;
                  saveConfiguration();
                }
              }
            }
          }
        }
      }
    }

    vTaskDelay(pdMS_TO_TICKS(10000));
  }
}

void scanI2CBus() {
  Serial.println("[I2C] Scanning bus...");
  byte count = 0;
  for (byte address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    byte error = Wire.endTransmission();
    if (error == 0) {
      Serial.printf("[I2C] Found device at address 0x%02X\n", address);
      count++;
    }
  }
  if (count == 0) {
    Serial.println("[I2C] No I2C devices found!");
  }
}

// ─── SETUP & LOOP ────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  Wire.begin(I2C_SDA, I2C_SCL);
  delay(100); // Give I2C bus and LCD backpack time to power up and stabilize
  scanI2CBus(); // Run diagnostics scan and print to Serial Monitor
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0); lcd.print("Hydronix v2.0 Boot");

  loadConfiguration();

  pinMode(PIN_FLOW, INPUT);
  attachInterrupt(digitalPinToInterrupt(PIN_FLOW), flowSensorISR, RISING);

  valve_controller.begin();

  // Explicitly configure SPI and SD Card chip select
  SPI.begin(18, 19, 23, SD_CS_PIN); // SCK=18, MISO=19, MOSI=23, SS=5
  pinMode(SD_CS_PIN, OUTPUT);
  digitalWrite(SD_CS_PIN, HIGH);
  delay(100);

  if (!SD.begin(SD_CS_PIN, SPI, 4000000)) { // Run at 4MHz for reliability
    sdAvailable    = false;
    lowStorageMode = true;
  } else {
    sdAvailable = true;
    lowStorageMode = false;
    if (SD.exists("/data/queue_old.jsonl")) {
      if (!SD.exists("/data/queue.jsonl")) {
        SD.rename("/data/queue_old.jsonl", "/data/queue.jsonl");
      } else {
        SD.remove("/data/queue_old.jsonl");
      }
    }
    if (SD.exists("/data/queue_new.jsonl")) {
      SD.remove("/data/queue_new.jsonl");
    }
  }

  if (strlen(config.wifi_ssid) == 0) {
    char apPass[32];
    getAPPassword(apPass, sizeof(apPass));

    lcd.setCursor(0, 0); lcd.print("SETUP MODE — v2.0   ");
    lcd.setCursor(0, 1); lcd.print("SSID:Hydronix_Setup_");
    lcd.setCursor(0, 2); lcd.printf("%-20s", config.device_id);
    lcd.setCursor(0, 3); lcd.printf("Pass: %-14s", apPass);

    startSetupPortal();
    return;
  }

  WiFi.begin(config.wifi_ssid, config.wifi_password);
  initWebServer();

  sdMutex      = xSemaphoreCreateMutex();
  sensorQueue  = xQueueCreate(10, sizeof(SensorReading));
  displayQueue = xQueueCreate(5,  sizeof(SensorReading));

  xTaskCreatePinnedToCore(taskSensorRead,    "SensorSampling", 8192, NULL, 3, NULL, 1);
  xTaskCreatePinnedToCore(taskDisplayUpdate, "LCDDisplay",     8192, NULL, 1, NULL, 1);
  xTaskCreatePinnedToCore(taskNetworkManager, "NetWatchdog",  3072, NULL, 2, NULL, 0);
  xTaskCreatePinnedToCore(taskUplinkSender,   "UplinkSender", 8192, NULL, 2, NULL, 0);
  xTaskCreatePinnedToCore(taskOfflineSync,    "OfflineSync",  8192, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(taskHealthHeartbeat,"Heartbeat",    6144, NULL, 1, NULL, 0);
}

void loop() {
  if (isApMode) {
    dnsServer.processNextRequest();
  }
  webServer.handleClient();
  delay(1);
}
