#include "WiFiManager.h"
#include "Config.h"
#include "ApiClient.h"
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <ArduinoJson.h>

// SETUP_HTML PROGMEM definition
const char SETUP_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hydronix Setup &amp; Diagnostics</title>
  <style>
    :root {
      --bg:#0b0d19; --card:rgba(22,28,45,.6); --border:rgba(255,255,255,.08);
      --cyan:#00e5ff; --pink:#ff007f; --text:#f3f4f6; --muted:#9ca3af;
    }
    *{box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
      background:var(--bg);background-image:
        radial-gradient(circle at 10%% 20%%,rgba(0,229,255,.05) 0%%,transparent 40%%),
        radial-gradient(circle at 90%% 80%%,rgba(255,0,127,.05) 0%%,transparent 40%%);
      margin:0;padding:20px;color:var(--text)}
    .container{max-width:820px;margin:0 auto}
    header{text-align:center;margin-bottom:30px}
    header h1{margin:0;font-size:2.2rem;font-weight:800;letter-spacing:-.05em;
      background:linear-gradient(135deg,var(--cyan),var(--pink));
      -webkit-background-clip:text;-webkit-text-fill-color:transparent}
    header p{color:var(--muted);margin:5px 0 0}
    .grid{display:grid;grid-template-columns:1fr;gap:20px}
    @media(min-width:768px){.grid{grid-template-columns:1fr 1fr}.full{grid-column:span 2}}
    .card{background:var(--card);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
      border:1px solid var(--border);border-radius:16px;padding:24px;
      box-shadow:0 10px 30px rgba(0,0,0,.25)}
    .card h2{margin-top:0;font-size:1.15rem;font-weight:700;color:#fff;
      border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px}
    .fg{margin-bottom:14px}
    label{display:block;font-weight:600;margin-bottom:5px;font-size:.85rem;color:var(--muted)}
    input[type=text],input[type=password],input[type=number],select{
      width:100%%;background:rgba(0,0,0,.3);border:1px solid var(--border);
      border-radius:8px;padding:10px 14px;color:#fff;font-size:.95rem;
      transition:border-color .3s,box-shadow .3s}
    input:focus,select:focus{outline:none;border-color:var(--cyan);
      box-shadow:0 0 0 2px rgba(0,229,255,.15)}
    .note{font-size:.78rem;color:var(--muted);margin-top:4px}
    .btn{background:linear-gradient(135deg,#00c6ff,#0072ff);color:#fff;
      padding:12px 20px;border:none;border-radius:8px;cursor:pointer;
      font-size:.95rem;font-weight:600;width:100%%;transition:all .2s;margin-top:4px}
    .btn:hover{opacity:.9;transform:translateY(-1px)}
    .btn-danger{background:linear-gradient(135deg,var(--pink),#d90429)}
    .btn-secondary{background:rgba(255,255,255,.08);color:var(--text);
      border:1px solid var(--border)}
    .btn-secondary:hover{background:rgba(255,255,255,.12)}
    .si{display:flex;justify-content:space-between;margin-bottom:10px;
      font-size:.88rem;border-bottom:1px solid rgba(255,255,255,.03);padding-bottom:8px}
    .si:last-child{border:none;margin:0;padding:0}
    .sl{color:var(--muted)} .sv{font-weight:600;color:#fff;font-family:monospace}
    .badge{padding:2px 8px;border-radius:4px;font-size:.72rem;font-weight:700}
    .badge-ok{background:rgba(16,185,129,.15);color:#10b981}
    .badge-err{background:rgba(239,68,68,.15);color:#ef4444}
    .badge-warn{background:rgba(245,158,11,.15);color:#f59e0b}
    .console{background:#05070f;border:1px solid var(--border);border-radius:8px;
      padding:12px;height:110px;overflow-y:auto;font-family:monospace;
      font-size:.78rem;color:#00ff66;margin-bottom:12px}
    .ap-note{background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.2);
      border-radius:8px;padding:12px;margin-bottom:16px;font-size:.82rem}
    .ap-note strong{color:var(--cyan)}
  </style>
</head>
<body>
<div class="container">
  <header>
    <h1>HYDRONIX</h1>
    <p>Operations &amp; Infrastructure Portal &mdash; v2.0</p>
  </header>

  <div class="grid">
    <!-- Device Configuration Card -->
    <div class="card">
      <h2>&#128268; Device &amp; API Configuration</h2>
      <div class="ap-note">
        &#128274; This portal is AP-protected.<br>
        AP SSID: <strong>Hydronix_Setup_%s</strong><br>
        AP Password: <strong>%s</strong>
      </div>
      <form action="/save" method="POST">
        <input type="hidden" name="csrf_token" value="%s">
        <div class="fg">
          <label>Device ID</label>
          <input type="text" name="device_id" value="%s" required
                 pattern="HYDRO_[0-9]{3}" maxlength="31">
          <div class="note">Format: HYDRO_XXX (e.g. HYDRO_001)</div>
        </div>
        <div class="fg">
          <label>WiFi SSID</label>
          <input type="text" name="ssid" value="%s" required maxlength="63">
        </div>
        <div class="fg">
          <label>WiFi Password</label>
          <input type="password" name="password" placeholder="Enter new password (leave blank to keep)" maxlength="63">
          <div class="note">Leave blank to keep existing password</div>
        </div>
        <div class="fg">
          <label>API Base URL</label>
          <input type="text" name="api_base_url" value="%s" required maxlength="255"
                 placeholder="https://api.hydronix.com">
          <div class="note">Must start with https://</div>
        </div>
        <div class="fg">
          <label>API Key</label>
          <input type="password" name="api_key" placeholder="Enter new key (leave blank to keep)" maxlength="191">
          <div class="note">Current key: &bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;%s</div>
        </div>
        <div class="fg">
          <label>Sampling Interval (seconds)</label>
          <input type="number" name="sample_interval" value="%d" min="30" max="3600" required>
        </div>
        <div class="fg">
          <label>Firmware Channel</label>
          <select name="firmware_channel">
            <option value="stable" %s>Stable (recommended)</option>
            <option value="beta"   %s>Beta</option>
            <option value="canary" %s>Canary (experimental)</option>
          </select>
        </div>
        <button type="submit" class="btn">&#10003; Apply &amp; Reboot</button>
      </form>
    </div>

    <!-- System Health Monitor Card -->
    <div class="card">
      <h2>&#128307; System Health Monitor</h2>
      <div class="si"><span class="sl">Network</span>
        <span class="sv"><span class="badge %s">%s</span></span></div>
      <div class="si"><span class="sl">Signal Strength</span>
        <span class="sv">%d dBm</span></div>
      <div class="si"><span class="sl">Uptime</span>
        <span class="sv">%s</span></div>
      <div class="si"><span class="sl">SD Buffered Records</span>
        <span class="sv">%d</span></div>
      <div class="si"><span class="sl">SD Disk Usage</span>
        <span class="sv">%.1f%%</span></div>
      <div class="si"><span class="sl">Storage State</span>
        <span class="sv"><span class="badge %s">%s</span></span></div>
      <div class="si"><span class="sl">Firmware</span>
        <span class="sv">v2.0.0 (HTTPS/CF-Tunnel)</span></div>
      <div class="si"><span class="sl">Last Uplink</span>
        <span class="sv">%s</span></div>
      <div class="si"><span class="sl">NTP Sync</span>
        <span class="sv">%s</span></div>

      <h2 style="margin-top:20px">&#128241; Connectivity Test</h2>
      <div class="console" id="test-console">&gt; Console ready...</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button onclick="runTest('wifi')" class="btn btn-secondary">Test WiFi</button>
        <button onclick="runTest('server')" class="btn btn-secondary">Test API</button>
      </div>
    </div>

    <!-- Sensor Calibration Card -->
    <div class="card">
      <h2>&#9881; Calibration &amp; Sensor Offsets</h2>
      <div class="si"><span class="sl">Last Calibrated</span>
        <span class="sv">%s</span></div>
      <div class="si"><span class="sl">pH Offset</span>
        <span class="sv">%.3f</span></div>
      <div class="si"><span class="sl">Turbidity Offset</span>
        <span class="sv">%.3f</span></div>
      <div class="si"><span class="sl">TDS Offset</span>
        <span class="sv">%.3f</span></div>
      <h2 style="margin-top:18px;font-size:1rem">pH Calibration</h2>
      <p style="font-size:.82rem;color:var(--muted);line-height:1.4;margin-bottom:12px">
        Immerse pH probe in pH 7.0 buffer solution.
        The routine collects 30 samples over ~30s to compute zero-drift offset.
      </p>
      <div class="console" id="cal-console">&gt; Ready to calibrate...</div>
      <button id="cal-btn" onclick="startCal()" class="btn btn-secondary"
              style="border-color:var(--cyan);color:var(--cyan)">
        Begin Calibration
      </button>
    </div>

    <!-- Maintenance Card -->
    <div class="card">
      <h2>&#128295; Maintenance</h2>
      <form action="/reset" method="POST"
            onsubmit="return confirm('Factory Reset wipes NVS and SD queue. Confirm?')">
        <input type="hidden" name="csrf_token" value="%s">
        <button type="submit" class="btn btn-danger">&#128465; Factory Reset</button>
      </form>
    </div>
  </div>
</div>

<script>
  const runTest = (type) => {
    const con = document.getElementById('test-console');
    con.innerText += '\n> Running ' + type + ' test...';
    fetch('/test-' + type)
      .then(r => r.json())
      .then(d => {
        con.innerText += '\n> Status: ' + d.status + '\n> ' + d.details;
        con.scrollTop = con.scrollHeight;
      })
      .catch(e => { con.innerText += '\n> Error: ' + e.message; });
  }

  let calTimer = null;
  const startCal = () => {
    const btn = document.getElementById('cal-btn');
    const con = document.getElementById('cal-console');
    btn.disabled = true;
    con.innerText = '> Starting calibration...';
    fetch('/calibrate', { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        con.innerText += '\n> ' + d.message;
        calTimer = setInterval(pollCal, 2000);
      });
  }
  const pollCal = () => {
    const btn = document.getElementById('cal-btn');
    const con = document.getElementById('cal-console');
    fetch('/calibration-status')
      .then(r => r.json())
      .then(d => {
        con.innerText = '> Status: ' + d.status
          + '\n> Samples: ' + d.progress + '/30'
          + '\n> Raw: ' + d.current_raw.toFixed(3);
        if (!d.running) {
          clearInterval(calTimer);
          btn.disabled = false;
          con.innerText += '\n> Done. New pH offset: ' + d.offset.toFixed(3);
        }
      });
  }
</script>
</body>
</html>
)rawliteral";

void handleRootPortal() {
  char apiKeyMasked[8] = "????";
  size_t kLen = strlen(config.api_key);
  if (kLen >= 4) {
    strncpy(apiKeyMasked, config.api_key + kLen - 4, 4);
    apiKeyMasked[4] = '\0';
  } else if (kLen > 0) {
    strncpy(apiKeyMasked, config.api_key, sizeof(apiKeyMasked) - 1);
  }

  char uptimeStr[32];
  uint32_t upSec = millis() / 1000;
  snprintf(uptimeStr, sizeof(uptimeStr), "%ud %uh %um",
           upSec / 86400, (upSec % 86400) / 3600, (upSec % 3600) / 60);

  char apPass[32];
  getAPPassword(apPass, sizeof(apPass));

  int qCount = getQueueCount();

  const size_t BUF_SIZE = 9000;
  char* html = (char*)malloc(BUF_SIZE);
  if (!html) {
    webServer.send(500, "text/plain", "OOM");
    return;
  }

  snprintf(html, BUF_SIZE, SETUP_HTML,
    config.device_id,
    apPass,
    csrfToken,
    config.device_id,
    config.wifi_ssid,
    config.api_base_url,
    apiKeyMasked,
    (int)config.sample_interval_sec,
    strcmp(config.firmware_channel, "stable") == 0 ? "selected" : "",
    strcmp(config.firmware_channel, "beta")   == 0 ? "selected" : "",
    strcmp(config.firmware_channel, "canary") == 0 ? "selected" : "",
    isOnline ? "badge-ok" : "badge-err",
    isOnline ? "ONLINE"   : "OFFLINE",
    WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0,
    uptimeStr,
    qCount,
    getSDUsagePercent(),
    lowStorageMode ? "badge-err"  : "badge-ok",
    lowStorageMode ? "FULL ALERT" : "HEALTHY",
    lastSendTimeStr,
    config.last_ntp_sync,
    config.last_calibration_at,
    config.ph_offset,
    config.turbidity_offset,
    config.tds_offset,
    csrfToken
  );

  webServer.send(200, "text/html", html);
  free(html);
}

void handleSavePortal() {
  if (!webServer.hasArg("csrf_token") ||
      webServer.arg("csrf_token") != String(csrfToken)) {
    webServer.send(403, "text/plain", "Invalid CSRF token");
    return;
  }
  if (!webServer.hasArg("device_id")) {
    webServer.send(400, "text/plain", "Missing required fields");
    return;
  }

  String newApiUrl = webServer.arg("api_base_url");
  if (!newApiUrl.startsWith("https://")) {
    webServer.send(400, "text/html",
      "<h3>Error: API Base URL must start with https://</h3>");
    return;
  }

  strncpy(config.device_id, webServer.arg("device_id").c_str(),
          sizeof(config.device_id) - 1);
  config.device_id[sizeof(config.device_id) - 1] = '\0';

  strncpy(config.wifi_ssid, webServer.arg("ssid").c_str(),
          sizeof(config.wifi_ssid) - 1);
  config.wifi_ssid[sizeof(config.wifi_ssid) - 1] = '\0';

  String newPass = webServer.arg("password");
  if (newPass.length() > 0) {
    strncpy(config.wifi_password, newPass.c_str(),
            sizeof(config.wifi_password) - 1);
    config.wifi_password[sizeof(config.wifi_password) - 1] = '\0';
  }

  strncpy(config.api_base_url, newApiUrl.c_str(),
          sizeof(config.api_base_url) - 1);
  config.api_base_url[sizeof(config.api_base_url) - 1] = '\0';

  String newKey = webServer.arg("api_key");
  if (newKey.length() > 0) {
    strncpy(config.api_key, newKey.c_str(), sizeof(config.api_key) - 1);
    config.api_key[sizeof(config.api_key) - 1] = '\0';
  }

  uint32_t interval = (uint32_t)webServer.arg("sample_interval").toInt();
  config.sample_interval_sec = max(30UL, min(3600UL, (unsigned long)interval));

  String chan = webServer.arg("firmware_channel");
  if (chan == "beta" || chan == "canary") {
    strncpy(config.firmware_channel, chan.c_str(),
            sizeof(config.firmware_channel) - 1);
  } else {
    strcpy(config.firmware_channel, "stable");
  }
  config.firmware_channel[sizeof(config.firmware_channel) - 1] = '\0';

  saveConfiguration();
  webServer.send(200, "text/html",
    "<!DOCTYPE html><html><body style='background:#0b0d19;color:#f3f4f6;"
    "font-family:sans-serif;text-align:center;padding:60px'>"
    "<h2>&#10003; Configuration saved.</h2><p>Device rebooting...</p></body></html>");
  delay(1200);
  ESP.restart();
}

void handleResetPortal() {
  if (!webServer.hasArg("csrf_token") ||
      webServer.arg("csrf_token") != String(csrfToken)) {
    webServer.send(403, "text/plain", "Invalid CSRF token");
    return;
  }
  webServer.send(200, "text/html",
    "<!DOCTYPE html><html><body style='background:#0b0d19;color:#f3f4f6;"
    "font-family:sans-serif;text-align:center;padding:60px'>"
    "<h2>Factory Reset Initiated. Rebooting...</h2></body></html>");
  delay(1200);
  factoryReset();
}

void handleCalibratePortal() {
  calibrationSampleCount = 0;
  calibrationStartMs     = millis();
  calibrationRunning     = true;
  StaticJsonDocument<128> doc;
  doc["status"]  = "started";
  doc["message"] = "Calibration started. Collecting 30 samples over 30s.";
  String out;
  serializeJson(doc, out);
  webServer.send(200, "application/json", out);
}

void handleCalibrationStatus() {
  StaticJsonDocument<256> doc;
  doc["running"]     = calibrationRunning;
  doc["progress"]    = calibrationSampleCount;
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
    doc["status"]  = "Connected";
    doc["details"] = "SSID: " + WiFi.SSID() + " | RSSI: " + String(WiFi.RSSI()) + " dBm";
  } else {
    doc["status"]  = "Disconnected";
    doc["details"] = "WiFi link is down.";
  }
  String out;
  serializeJson(doc, out);
  webServer.send(200, "application/json", out);
}

void handleTestServer() {
  StaticJsonDocument<256> doc;
  doc["url"] = String(config.api_base_url) + "/health";

  if (WiFi.status() != WL_CONNECTED) {
    doc["status"]  = "Failed";
    doc["details"] = "WiFi not connected.";
  } else {
    String body;
    uint32_t t0 = millis();
    int code = httpsSignedGet("/health", body);
    uint32_t latency = millis() - t0;
    if (code == 200) {
      doc["status"]  = "OK";
      doc["details"] = "HTTPS /health returned 200 in " + String(latency) + "ms";
    } else if (code < 0) {
      doc["status"]  = "Failed";
      doc["details"] = "TLS/connection error. Check CA cert and api_base_url.";
    } else {
      doc["status"]  = "Error";
      doc["details"] = "HTTP " + String(code) + " from server.";
    }
  }
  String out;
  serializeJson(doc, out);
  webServer.send(200, "application/json", out);
}

void initWebServer() {
  static bool initialized = false;
  if (initialized) return;
  initialized = true;

  generateCSRFToken();

  webServer.on("/",                   HTTP_GET,  handleRootPortal);
  webServer.on("/save",               HTTP_POST, handleSavePortal);
  webServer.on("/reset",              HTTP_POST, handleResetPortal);
  webServer.on("/calibrate",          HTTP_POST, handleCalibratePortal);
  webServer.on("/calibration-status", HTTP_GET,  handleCalibrationStatus);
  webServer.on("/test-wifi",          HTTP_GET,  handleTestWiFi);
  webServer.on("/test-server",        HTTP_GET,  handleTestServer);
  webServer.begin();

  Serial.println("[WEBSERVER] Local dashboard server started.");
}

void startSetupPortal() {
  isApMode = true;

  char apSSID[64];
  char apPass[32];
  snprintf(apSSID, sizeof(apSSID), "Hydronix_Setup_%s", config.device_id);
  getAPPassword(apPass, sizeof(apPass));

  WiFi.softAP(apSSID, apPass);
  dnsServer.start(53, "*", WiFi.softAPIP());

  initWebServer();

  Serial.printf("[PORTAL] AP SSID: %s  Password: %s  IP: %s\n",
                apSSID, apPass, WiFi.softAPIP().toString().c_str());
}
