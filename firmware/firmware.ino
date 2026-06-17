/**
 * Hydronix IoT Platform - ESP32 Firmware v2.0.0
 *
 * Target Board : ESP32 Dev Module (ESP-WROOM-32)
 * Libraries    : WiFi, WiFiClientSecure, WebServer, DNSServer, Preferences,
 *                HTTPClient, ArduinoJson, SD, FS, LiquidCrystal_I2C, mbedtls
 *
 * v2.0.0 Changes vs v1.0.0:
 *  [SECURITY]    MQTT removed; HTTPS-only transport via Cloudflare Tunnel
 *  [SECURITY]    WiFiClientSecure with ISRG Root X1 CA pinning (TLS 1.3)
 *  [SECURITY]    HMAC-SHA256 per-request signing — replay attack protection
 *  [SECURITY]    Captive portal AP now password-protected (no longer open)
 *  [SECURITY]    Credentials never rendered in HTML — masked display only
 *  [SECURITY]    CSRF token on captive portal form
 *  [SECURITY]    strncpy bounds-checked in all form handlers
 *  [CONFIG]      Schema v2: api_base_url, firmware_channel, schema_version
 *  [CONFIG]      NVS v1→v2 migration: graceful reprovision on first upgrade
 *  [RELIABILITY] CRC32 for SD queue records (replaces weak XOR checksum)
 *  [RELIABILITY] Atomic 3-step SD rename — power-loss safe
 *  [RELIABILITY] JSON parse validation before SD record replay
 *  [RELIABILITY] sdAvailable flag guards every SD operation
 *  [RELIABILITY] sdMutex semaphore — concurrent task-safe SD access
 *  [RELIABILITY] Retry-with-backoff (3×) before SD buffer fallback
 *  [RELIABILITY] 401/403 = non-retriable; no SD buffering for auth errors
 *  [RELIABILITY] Per-sensor rate-of-change delta thresholds (not universal)
 *  [RELIABILITY] xQueueSend drop detection with Serial warning
 *  [MONITORING]  free_heap + queued_records in heartbeat payload
 *  [MONITORING]  config_version pull from heartbeat response
 *  [UX]          LCD targeted-overwrite (no flicker from lcd.clear())
 *  [UX]          htmlBuf allocated on heap — no stack overflow risk
 *  [UX]          NTP always syncs UTC (configTime(0, 0, ...))
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <FS.h>
#include <SD.h>
#include <SPI.h>
#include <time.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "mbedtls/md.h"

// ─── HARDWARE PINS ───────────────────────────────────────────────────────────
#define SD_CS_PIN       5
#define PIN_PH          32
#define PIN_TURBIDITY   33
#define PIN_TDS         34
#define PIN_TEMP        35
#define PIN_FLOW        36
#define I2C_SDA         21
#define I2C_SCL         22
#define LCD_ADDR        0x27
#define FIRMWARE_VERSION "2.0.0"

// ─── CONFIG SCHEMA VERSION ───────────────────────────────────────────────────
#define CONFIG_SCHEMA_VERSION  2
#define QUEUE_FORMAT_VERSION   2   // CRC32-based queue format

// ─── ISRG ROOT X1 CA — LET'S ENCRYPT ROOT (Valid until 2035-06-04) ──────────
// Source: https://letsencrypt.org/certificates/
// Cloudflare uses Let's Encrypt for Tunnel-exposed HTTPS endpoints.
// NOTE: If you use a different CA for api.hydronix.com, replace this PEM.
static const char ISRG_ROOT_X1_PEM[] PROGMEM = R"PEM(
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
)PEM";

// ─── CONFIGURATION STRUCTURE v2 ──────────────────────────────────────────────
struct DeviceConfig {
  // Schema management — MUST be first field
  uint8_t  schema_version;        // Always CONFIG_SCHEMA_VERSION (2)
  uint8_t  _reserved[3];          // Alignment padding

  // Identity
  char     device_id[32];
  uint32_t reset_count;

  // Network credentials
  char     wifi_ssid[64];
  char     wifi_password[64];

  // API transport (replaces server_host/port/protocol/mqtt_broker_url/http_endpoint)
  char     api_base_url[256];     // e.g. "https://api.hydronix.com"
  char     api_key[192];          // Expanded from 128 → 192

  // Operational
  uint32_t sample_interval_sec;   // Sampling period in seconds (min 30)
  char     firmware_channel[16];  // "stable" | "beta" | "canary"
  uint32_t server_config_version; // Last pulled config version from server

  // Calibration offsets
  float    ph_offset;
  float    turbidity_offset;
  float    tds_offset;
  float    temp_offset;
  float    flow_offset;

  // Time
  int32_t  timezone_offset_sec;   // Kept for display; NTP always syncs UTC
  char     last_ntp_sync[32];
  char     last_calibration_at[32];

  // Integrity — MUST be last field
  uint32_t crc32;
};

// ─── SENSOR READING ──────────────────────────────────────────────────────────
struct SensorReading {
  float    ph;
  float    turbidity;
  float    tds;
  float    temperature;
  float    flow_rate;
  float    raw_ph;
  uint32_t seq_no;
  char     timestamp[32];
  char     timestamp_source[16];  // "device" or "server_adjusted"
};

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

// ─── GLOBAL STATE ────────────────────────────────────────────────────────────
bool     isApMode       = false;
bool     isOnline       = false;
bool     sdAvailable    = false;
bool     lowStorageMode = false;
uint32_t globalSeqNo    = 0;
char     lastSendTimeStr[32] = "never";
char     csrfToken[17]  = "";   // CSRF token for captive portal form

// Stuck sensor flags
bool isPhStuck   = false;
bool isTurbStuck = false;
bool isTdsStuck  = false;
bool isTempStuck = false;
bool isFlowStuck = false;

// Calibration state machine
bool     calibrationRunning     = false;
uint32_t calibrationStartMs     = 0;
float    calibrationSamples[30] = {};
int      calibrationSampleCount = 0;

// ─── SANITY BOUNDS ───────────────────────────────────────────────────────────
const float PH_MIN   = 0.0f,   PH_MAX   = 14.0f;
const float TURB_MIN = 0.0f,   TURB_MAX = 1000.0f;
const float TDS_MIN  = 0.0f,   TDS_MAX  = 10000.0f;
const float TEMP_MIN = -50.0f, TEMP_MAX = 150.0f;
const float FLOW_MIN = 0.0f,   FLOW_MAX = 10000.0f;

// Per-sensor max rate-of-change per MINUTE (physically meaningful thresholds)
const float PH_DELTA_PER_MIN   = 1.0f;   // pH:   1.0 unit/min max
const float TURB_DELTA_PER_MIN = 50.0f;  // NTU:  50 /min max
const float TDS_DELTA_PER_MIN  = 200.0f; // ppm:  200/min max
const float TEMP_DELTA_PER_MIN = 2.0f;   // °C:   2.0/min max
const float FLOW_DELTA_PER_MIN = 5.0f;   // L/m:  5.0/min max

// ═══════════════════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// ─── CRC32 (Ethernet polynomial 0xEDB88320) ──────────────────────────────────
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
  // Exclude the crc32 field itself (last 4 bytes)
  return crc32_compute((const uint8_t*)&cfg, sizeof(DeviceConfig) - sizeof(uint32_t));
}

// CRC32 of a String payload (for SD queue records)
uint32_t calculateQueueCRC(const String& data) {
  return crc32_compute((const uint8_t*)data.c_str(), data.length());
}

// ─── HMAC-SHA256 ─────────────────────────────────────────────────────────────
// Writes 64-char hex string + null into outHex. outHexSize must be >= 65.
bool computeHMAC_SHA256(const char* key, const char* message,
                         char* outHex, size_t outHexSize) {
  if (!key || !message || !outHex || outHexSize < 65) return false;
  uint8_t hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  const mbedtls_md_info_t* mdInfo = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (!mdInfo || mbedtls_md_setup(&ctx, mdInfo, 1) != 0) {
    mbedtls_md_free(&ctx);
    return false;
  }
  mbedtls_md_hmac_starts(&ctx, (const uint8_t*)key, strlen(key));
  mbedtls_md_hmac_update(&ctx, (const uint8_t*)message, strlen(message));
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);
  for (int i = 0; i < 32; i++) snprintf(outHex + (i * 2), 3, "%02x", hmacResult[i]);
  outHex[64] = '\0';
  return true;
}

// SHA256 of a data buffer — writes 64-char hex + null into outHex.
bool computeSHA256(const char* data, size_t len,
                   char* outHex, size_t outHexSize) {
  if (!data || !outHex || outHexSize < 65) return false;
  uint8_t sha256Result[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  const mbedtls_md_info_t* mdInfo = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (!mdInfo || mbedtls_md_setup(&ctx, mdInfo, 0) != 0) {
    mbedtls_md_free(&ctx);
    return false;
  }
  mbedtls_md_starts(&ctx);
  mbedtls_md_update(&ctx, (const uint8_t*)data, len);
  mbedtls_md_finish(&ctx, sha256Result);
  mbedtls_md_free(&ctx);
  for (int i = 0; i < 32; i++) snprintf(outHex + (i * 2), 3, "%02x", sha256Result[i]);
  outHex[64] = '\0';
  return true;
}

// SHA256 of empty string — used for GET signing
static const char SHA256_EMPTY[] = "e3b0c44298fc1c149afbf4c8996fb924"
                                   "27ae41e4649b934ca495991b7852b855";

// ─── TIME UTILITIES ───────────────────────────────────────────────────────────
// Returns ISO 8601 UTC timestamp when NTP has synced (configTime(0,...) used).
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

// ─── SD UTILITIES ────────────────────────────────────────────────────────────
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

// ─── AP PASSWORD DERIVATION ───────────────────────────────────────────────────
// Generates a deterministic AP password from device_id.
// HYDRO_001 → "hydro-001-setup"  (displayed on LCD for technician)
void getAPPassword(char* outPass, size_t outSize) {
  const char* digits = strrchr(config.device_id, '_');
  if (digits && *(digits + 1) != '\0') digits++;
  else digits = "000";
  snprintf(outPass, outSize, "hydro-%s-setup", digits);
}

// ─── CSRF TOKEN ───────────────────────────────────────────────────────────────
void generateCSRFToken() {
  uint32_t r1 = esp_random();
  uint32_t r2 = esp_random();
  snprintf(csrfToken, sizeof(csrfToken), "%08lx%08lx", (unsigned long)r1, (unsigned long)r2);
}

// ═══════════════════════════════════════════════════════════════════════════
//  CONFIGURATION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

void loadFactoryDefaults() {
  memset(&config, 0, sizeof(DeviceConfig));
  config.schema_version      = CONFIG_SCHEMA_VERSION;
  strcpy(config.device_id,   "HYDRO_001");
  config.reset_count         = 0;
  config.sample_interval_sec = 60;
  // Default to Cloudflare Tunnel API base (includes /v2 prefix)
  strcpy(config.api_base_url, "https://api.hydronix.local/v2");
  strcpy(config.firmware_channel, "stable");
  config.server_config_version = 0;
  config.timezone_offset_sec = 19800;  // Asia/Kolkata (+5:30)
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
    // First boot ever — fresh device
    Serial.println("[CONFIG] No saved config. Loading factory defaults.");
    needReset = true;
  } else if (config.schema_version != CONFIG_SCHEMA_VERSION) {
    // v1 config detected — graceful reprovision on first v2 upgrade
    Serial.printf("[CONFIG] Schema version mismatch (found %u, expected %u). "
                  "Reprovisioning required.\n",
                  config.schema_version, CONFIG_SCHEMA_VERSION);
    needReset = true;
  } else if (readBytes != sizeof(DeviceConfig)) {
    // Size mismatch — struct layout changed
    Serial.println("[CONFIG] Config size mismatch. Loading factory defaults.");
    needReset = true;
  } else {
    // Validate CRC32
    uint32_t calculated = calculateConfigCRC(config);
    if (calculated != config.crc32) {
      Serial.println("[CONFIG] CRC32 mismatch — config corrupted. Loading factory defaults.");
      needReset = true;
    } else if (!String(config.device_id).startsWith("HYDRO_")) {
      Serial.println("[CONFIG] Invalid device_id format. Loading factory defaults.");
      needReset = true;
    }
  }

  if (needReset) {
    loadFactoryDefaults();
    saveConfiguration();
  } else {
    config.reset_count++;
    saveConfiguration();
    Serial.printf("[CONFIG] Loaded OK. Device: %s  Boot count: %u\n",
                  config.device_id, config.reset_count);
  }
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
  Serial.println("[SYSTEM] Factory reset complete. Rebooting...");
  delay(1000);
  ESP.restart();
}

// ═══════════════════════════════════════════════════════════════════════════
//  HTTPS SIGNED REQUEST HELPERS
// ═══════════════════════════════════════════════════════════════════════════

// Build HMAC signing string and populate auth headers on an HTTPClient.
// Message format: "METHOD\nPATH\nTIMESTAMP\nNONCE\nBODY_SHA256"
static void attachAuthHeaders(HTTPClient& https, const char* method,
                               const char* path, const char* bodyHash) {
  uint32_t ts = (uint32_t)(time(nullptr));
  char tsStr[16];
  snprintf(tsStr, sizeof(tsStr), "%lu", (unsigned long)ts);

  char nonce[16];
  snprintf(nonce, sizeof(nonce), "%08lx", (unsigned long)esp_random());

  char signMsg[384];
  snprintf(signMsg, sizeof(signMsg), "%s\n%s\n%s\n%s\n%s",
           method, path, tsStr, nonce, bodyHash);

  char sig[65];
  if (!computeHMAC_SHA256(config.api_key, signMsg, sig, sizeof(sig))) {
    strncpy(sig, "hmac_error", sizeof(sig));
  }

  https.addHeader("X-API-Key",    config.api_key);
  https.addHeader("X-Timestamp",  tsStr);
  https.addHeader("X-Nonce",      nonce);
  https.addHeader("X-Signature",  sig);
}

// Signed HTTPS POST. Returns HTTP status code, or negative on connection error.
int httpsSignedPost(const char* path, const String& body) {
  if (!isOnline) return -1;

  char url[384];
  snprintf(url, sizeof(url), "%s%s", config.api_base_url, path);

  char bodyHash[65];
  computeSHA256(body.c_str(), body.length(), bodyHash, sizeof(bodyHash));

  WiFiClientSecure secureClient;
  secureClient.setCACert(ISRG_ROOT_X1_PEM);
  secureClient.setTimeout(15);

  HTTPClient https;
  https.begin(secureClient, url);
  https.addHeader("Content-Type", "application/json");
  attachAuthHeaders(https, "POST", path, bodyHash);
  https.setTimeout(15000);

  int code = https.POST(body);
  https.end();
  return code;
}

// Signed HTTPS GET. Returns HTTP status code; body written to responseBody.
int httpsSignedGet(const char* path, String& responseBody) {
  if (!isOnline) return -1;

  char url[384];
  snprintf(url, sizeof(url), "%s%s", config.api_base_url, path);

  WiFiClientSecure secureClient;
  secureClient.setCACert(ISRG_ROOT_X1_PEM);
  secureClient.setTimeout(15);

  HTTPClient https;
  https.begin(secureClient, url);
  attachAuthHeaders(https, "GET", path, SHA256_EMPTY);
  https.setTimeout(15000);

  int code = https.GET();
  if (code > 0) responseBody = https.getString();
  https.end();
  return code;
}

// ═══════════════════════════════════════════════════════════════════════════
//  SD QUEUE — CRC32 + ATOMIC RENAME
// ═══════════════════════════════════════════════════════════════════════════

// Write a sensor payload to the offline SD queue (CRC32 integrity).
// Format:
//   [START:v2]
//   <seq_no>:<device_id>
//   <json_payload>
//   [CRC32:<hex>]
//   [END]
void writeToSDQueue(const String& payload, uint32_t seqNo) {
  if (!sdAvailable) {
    Serial.println("[BUFFER] SD not available — payload lost.");
    return;
  }
  if (xSemaphoreTake(sdMutex, pdMS_TO_TICKS(3000)) != pdPASS) {
    Serial.println("[BUFFER] SD mutex timeout — payload lost.");
    return;
  }
  if (!SD.exists("/data") && !SD.mkdir("/data")) {
    Serial.println("[BUFFER] Failed to create /data directory.");
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
    Serial.println("[BUFFER] Payload buffered to SD queue.");
  } else {
    lowStorageMode = true;
    Serial.println("[CRITICAL] SD queue write failed!");
  }
  xSemaphoreGive(sdMutex);
}

// Prune oldest records if queue exceeds 4320 entries (72h at 60s interval).
void pruneOfflineQueue() {
  if (!sdAvailable) return;
  if (xSemaphoreTake(sdMutex, pdMS_TO_TICKS(5000)) != pdPASS) return;

  lowStorageMode = (getSDUsagePercent() > 90.0f);

  if (!SD.exists("/data/queue.jsonl")) {
    xSemaphoreGive(sdMutex);
    return;
  }

  // Count records
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

  Serial.printf("[SD] Queue capped (%d records). Pruning oldest.\n", recordCount);
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

  // Atomic 3-step rename (power-loss safe)
  SD.remove("/data/queue_old.jsonl");
  SD.rename("/data/queue.jsonl",     "/data/queue_old.jsonl");
  SD.rename("/data/queue_new.jsonl", "/data/queue.jsonl");
  SD.remove("/data/queue_old.jsonl");

  lowStorageMode = (getSDUsagePercent() > 90.0f);
  xSemaphoreGive(sdMutex);
}

// ═══════════════════════════════════════════════════════════════════════════
//  CAPTIVE PORTAL HTML
// ═══════════════════════════════════════════════════════════════════════════

// HTML is stored in PROGMEM. Placeholders substituted in handleRootPortal().
// %s / %d positions (in order):
//  1  device_id
//  2  wifi_ssid
//  3  api_base_url
//  4  api_key_masked  (last 4 chars only)
//  5  sample_interval_sec
//  6  firmware_channel  "stable"  selected attr
//  7  firmware_channel  "beta"    selected attr
//  8  firmware_channel  "canary"  selected attr
//  9  csrf_token
//  10 net_badge_class
//  11 net_status_text
//  12 rssi (int)
//  13 uptime_str
//  14 queue_count (int)
//  15 sd_usage (float)
//  16 storage_badge_class
//  17 storage_status_text
//  18 last_send_time
//  19 last_ntp_sync
//  20 last_calibration_at
//  21 ph_offset (float)
//  22 turbidity_offset (float)
//  23 tds_offset (float)
//  24 ap_password
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
  function runTest(type) {
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
  function startCal() {
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
  function pollCal() {
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

// ═══════════════════════════════════════════════════════════════════════════
//  WEB HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

void handleRootPortal() {
  // Mask API key — show only last 4 chars
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

  // Allocate HTML buffer on heap — avoids stack overflow in web handler
  const size_t BUF_SIZE = 9000;
  char* html = (char*)malloc(BUF_SIZE);
  if (!html) {
    webServer.send(500, "text/plain", "OOM");
    return;
  }

  snprintf(html, BUF_SIZE, SETUP_HTML,
    // AP info section (device_id + ap_password + csrf_token)
    config.device_id,
    apPass,
    csrfToken,
    // Form fields
    config.device_id,
    config.wifi_ssid,
    config.api_base_url,
    apiKeyMasked,
    (int)config.sample_interval_sec,
    strcmp(config.firmware_channel, "stable") == 0 ? "selected" : "",
    strcmp(config.firmware_channel, "beta")   == 0 ? "selected" : "",
    strcmp(config.firmware_channel, "canary") == 0 ? "selected" : "",
    // Health monitor
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
    // Calibration section
    config.last_calibration_at,
    config.ph_offset,
    config.turbidity_offset,
    config.tds_offset,
    // Maintenance reset CSRF
    csrfToken
  );

  webServer.send(200, "text/html", html);
  free(html);
}

void handleSavePortal() {
  // ── CSRF validation ──────────────────────────────────────────────────────
  if (!webServer.hasArg("csrf_token") ||
      webServer.arg("csrf_token") != String(csrfToken)) {
    webServer.send(403, "text/plain", "Invalid CSRF token");
    return;
  }
  // ── Required fields present ──────────────────────────────────────────────
  if (!webServer.hasArg("device_id")) {
    webServer.send(400, "text/plain", "Missing required fields");
    return;
  }

  // ── API URL must use HTTPS ───────────────────────────────────────────────
  String newApiUrl = webServer.arg("api_base_url");
  if (!newApiUrl.startsWith("https://")) {
    webServer.send(400, "text/html",
      "<h3>Error: API Base URL must start with https://</h3>");
    return;
  }

  // ── Bounds-checked strncpy for all string fields ─────────────────────────
  strncpy(config.device_id, webServer.arg("device_id").c_str(),
          sizeof(config.device_id) - 1);
  config.device_id[sizeof(config.device_id) - 1] = '\0';

  strncpy(config.wifi_ssid, webServer.arg("ssid").c_str(),
          sizeof(config.wifi_ssid) - 1);
  config.wifi_ssid[sizeof(config.wifi_ssid) - 1] = '\0';

  // Password: only update if a new one was provided
  String newPass = webServer.arg("password");
  if (newPass.length() > 0) {
    strncpy(config.wifi_password, newPass.c_str(),
            sizeof(config.wifi_password) - 1);
    config.wifi_password[sizeof(config.wifi_password) - 1] = '\0';
  }

  strncpy(config.api_base_url, newApiUrl.c_str(),
          sizeof(config.api_base_url) - 1);
  config.api_base_url[sizeof(config.api_base_url) - 1] = '\0';

  // API key: only update if a new one was provided
  String newKey = webServer.arg("api_key");
  if (newKey.length() > 0) {
    strncpy(config.api_key, newKey.c_str(), sizeof(config.api_key) - 1);
    config.api_key[sizeof(config.api_key) - 1] = '\0';
  }

  uint32_t interval = (uint32_t)webServer.arg("sample_interval").toInt();
  config.sample_interval_sec = max(30u, min(3600u, interval));

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

void startSetupPortal() {
  isApMode = true;
  generateCSRFToken();

  char apSSID[64];
  char apPass[32];
  snprintf(apSSID, sizeof(apSSID), "Hydronix_Setup_%s", config.device_id);
  getAPPassword(apPass, sizeof(apPass));

  WiFi.softAP(apSSID, apPass);
  dnsServer.start(53, "*", WiFi.softAPIP());

  webServer.on("/",                   HTTP_GET,  handleRootPortal);
  webServer.on("/save",               HTTP_POST, handleSavePortal);
  webServer.on("/reset",              HTTP_POST, handleResetPortal);
  webServer.on("/calibrate",          HTTP_POST, handleCalibratePortal);
  webServer.on("/calibration-status", HTTP_GET,  handleCalibrationStatus);
  webServer.on("/test-wifi",          HTTP_GET,  handleTestWiFi);
  webServer.on("/test-server",        HTTP_GET,  handleTestServer);
  webServer.begin();

  Serial.printf("[PORTAL] AP SSID: %s  Password: %s  IP: %s\n",
                apSSID, apPass, WiFi.softAPIP().toString().c_str());
}

// ═══════════════════════════════════════════════════════════════════════════
//  FREERTOS TASKS
// ═══════════════════════════════════════════════════════════════════════════

// ─── 1. Sensor Sampling Task (Core 1, Priority 3) ────────────────────────────
void taskSensorRead(void* pvParameters) {
  float prev_ph   = 7.0f, prev_turb = 1.0f, prev_tds  = 150.0f;
  float prev_temp = 25.0f, prev_flow = 5.0f;

  uint32_t stuck_ph = 0, stuck_turb = 0, stuck_tds = 0;
  uint32_t stuck_temp = 0, stuck_flow = 0;

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
    const uint32_t maxStuckSamples = 86400 / max(1u, config.sample_interval_sec);

    // Async calibration sample collection
    if (calibrationRunning) {
      float raw = analogRead(PIN_PH) * (3.3f / 4095.0f) * 3.5f;
      if (calibrationSampleCount < 30) {
        calibrationSamples[calibrationSampleCount++] = raw;
      }
      if (calibrationSampleCount >= 30) {
        // Insertion sort for median
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

    // ── ADC reads ────────────────────────────────────────────────────────
    float raw_ph   = analogRead(PIN_PH)        * (3.3f / 4095.0f) * 3.5f;
    float raw_turb = analogRead(PIN_TURBIDITY) * (1000.0f / 4095.0f);
    float raw_tds  = analogRead(PIN_TDS)       * (5000.0f / 4095.0f);
    float raw_temp = -10.0f + analogRead(PIN_TEMP) * (100.0f / 4095.0f);
    float raw_flow = analogRead(PIN_FLOW)      * (50.0f / 4095.0f);

    // ── Calibration offsets ──────────────────────────────────────────────
    float cal_ph   = raw_ph   + config.ph_offset;
    float cal_turb = raw_turb + config.turbidity_offset;
    float cal_tds  = raw_tds  + config.tds_offset;
    float cal_temp = raw_temp + config.temp_offset;
    float cal_flow = raw_flow + config.flow_offset;

    // ── Per-sensor rate-of-change clamp ─────────────────────────────────
    float dMin = (float)config.sample_interval_sec / 60.0f;
    float lim_ph   = PH_DELTA_PER_MIN   * dMin;
    float lim_turb = TURB_DELTA_PER_MIN * dMin;
    float lim_tds  = TDS_DELTA_PER_MIN  * dMin;
    float lim_temp = TEMP_DELTA_PER_MIN * dMin;
    float lim_flow = FLOW_DELTA_PER_MIN * dMin;

    auto clamp = [](float val, float prev, float limit) -> float {
      float diff = val - prev;
      if (diff > limit)  return prev + limit;
      if (diff < -limit) return prev - limit;
      return val;
    };

    cal_ph   = clamp(cal_ph,   prev_ph,   lim_ph);
    cal_turb = clamp(cal_turb, prev_turb, lim_turb);
    cal_tds  = clamp(cal_tds,  prev_tds,  lim_tds);
    cal_temp = clamp(cal_temp, prev_temp, lim_temp);
    cal_flow = clamp(cal_flow, prev_flow, lim_flow);

    // ── EMA smoothing (alpha = 0.3) ──────────────────────────────────────
    float sm_ph   = cal_ph   * 0.3f + prev_ph   * 0.7f;
    float sm_turb = cal_turb * 0.3f + prev_turb * 0.7f;
    float sm_tds  = cal_tds  * 0.3f + prev_tds  * 0.7f;
    float sm_temp = cal_temp * 0.3f + prev_temp * 0.7f;
    float sm_flow = cal_flow * 0.3f + prev_flow * 0.7f;

    // ── Sanity bounds ────────────────────────────────────────────────────
    bool valid = (sm_ph   >= PH_MIN   && sm_ph   <= PH_MAX   &&
                  sm_turb >= TURB_MIN && sm_turb <= TURB_MAX &&
                  sm_tds  >= TDS_MIN  && sm_tds  <= TDS_MAX  &&
                  sm_temp >= TEMP_MIN && sm_temp <= TEMP_MAX &&
                  sm_flow >= FLOW_MIN && sm_flow <= FLOW_MAX);

    if (valid) {
      // ── Stuck sensor detection (24h flatline threshold) ───────────────
      auto tick = [](float cur, float prev, uint32_t& cnt) {
        if (fabsf(cur - prev) < 0.0001f) cnt++; else cnt = 0;
      };
      tick(sm_ph,   prev_ph,   stuck_ph);
      tick(sm_turb, prev_turb, stuck_turb);
      tick(sm_tds,  prev_tds,  stuck_tds);
      tick(sm_temp, prev_temp, stuck_temp);
      tick(sm_flow, prev_flow, stuck_flow);

      isPhStuck   = stuck_ph   >= maxStuckSamples;
      isTurbStuck = stuck_turb >= maxStuckSamples;
      isTdsStuck  = stuck_tds  >= maxStuckSamples;
      isTempStuck = stuck_temp >= maxStuckSamples;
      isFlowStuck = stuck_flow >= maxStuckSamples;

      prev_ph = sm_ph; prev_turb = sm_turb; prev_tds = sm_tds;
      prev_temp = sm_temp; prev_flow = sm_flow;

      SensorReading rd;
      rd.ph          = sm_ph;
      rd.turbidity   = sm_turb;
      rd.tds         = sm_tds;
      rd.temperature = sm_temp;
      rd.flow_rate   = sm_flow;
      rd.raw_ph      = raw_ph;
      rd.seq_no      = ++globalSeqNo;
      bool synced = false;
      getUTCTime(rd.timestamp, sizeof(rd.timestamp), synced);
      strncpy(rd.timestamp_source, synced ? "device" : "server_adjusted",
              sizeof(rd.timestamp_source) - 1);

      if (xQueueSend(sensorQueue, &rd, 0) != pdPASS) {
        Serial.println("[SENSOR] sensorQueue full — reading dropped!");
      }
      if (xQueueSend(displayQueue, &rd, 0) != pdPASS) {
        // Display queue drop is non-critical — suppress log
      }
    } else {
      Serial.printf("[SENSOR] Out-of-bounds (pH:%.2f Turb:%.1f TDS:%.1f) — discarded.\n",
                    sm_ph, sm_turb, sm_tds);
    }

    vTaskDelayUntil(&lastWakeTime, pdMS_TO_TICKS(interval * 1000));
  }
}

// ─── 2. LCD Display Task (Core 1, Priority 1) ────────────────────────────────
// Uses targeted cursor writes instead of lcd.clear() to eliminate flicker.
void taskDisplayUpdate(void* pvParameters) {
  SensorReading rd;
  char line[21];

  for (;;) {
    if (xQueueReceive(displayQueue, &rd, pdMS_TO_TICKS(2500)) == pdPASS) {
      // Line 0: Device ID / stuck sensor alert
      lcd.setCursor(0, 0);
      if (isPhStuck || isTurbStuck || isTdsStuck || isTempStuck || isFlowStuck) {
        snprintf(line, sizeof(line), "STUCK:%-14s",
          String(isPhStuck ? "pH " : "") +
          String(isTurbStuck ? "Tb " : "") +
          String(isTdsStuck ? "TD " : "") +
          String(isTempStuck ? "Tm " : "") +
          String(isFlowStuck ? "Fl" : ""));
      } else {
        snprintf(line, sizeof(line), "%-9s pH:%-6.1f",
                 config.device_id, rd.ph);
        if (rd.ph < 6.5f || rd.ph > 8.5f) line[18] = '!';
      }
      lcd.print(line);

      // Line 1: Turbidity + Temp
      lcd.setCursor(0, 1);
      snprintf(line, sizeof(line), "Tb:%-6.1f  T:%-4.0fC",
               rd.turbidity, rd.temperature);
      if (rd.turbidity > 5.0f) line[9] = '!';
      lcd.print(line);

      // Line 2: Network + RSSI
      lcd.setCursor(0, 2);
      int32_t rssi = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0;
      snprintf(line, sizeof(line), "%-7s %4ddBm  HTTPS",
               isOnline ? "Online" : "Offline", rssi);
      lcd.print(line);

      // Line 3: Queue depth / storage alert
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
}

// ─── 3. Network Manager Task (Core 0, Priority 2) ────────────────────────────
void taskNetworkManager(void* pvParameters) {
  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      isOnline = false;
      WiFi.begin(config.wifi_ssid, config.wifi_password);

      uint32_t attempts = 0;
      while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        vTaskDelay(pdMS_TO_TICKS(10000));
        attempts++;
      }
      // Extended fallback loop
      while (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WIFI] Extended reconnect (60s loop)...");
        vTaskDelay(pdMS_TO_TICKS(60000));
        WiFi.begin(config.wifi_ssid, config.wifi_password);
      }

      Serial.println("[WIFI] Connection restored.");

      // Sync to UTC (offset 0 — not local time)
      configTime(0, 0, "pool.ntp.org", "time.nist.gov");
      struct tm timeinfo;
      if (getLocalTime(&timeinfo)) {
        isOnline = true;
        bool tOk = false;
        getUTCTime(config.last_ntp_sync, sizeof(config.last_ntp_sync), tOk);
        saveConfiguration();
        Serial.printf("[NTP] UTC sync OK: %s\n", config.last_ntp_sync);
      }
    } else {
      isOnline = true;
    }

    vTaskDelay(pdMS_TO_TICKS(30000));
  }
}

// ─── 4. Uplink Sender Task (Core 0, Priority 2) ──────────────────────────────
// HTTPS only — MQTT removed. 3x retry with backoff before SD buffer.
void taskUplinkSender(void* pvParameters) {
  SensorReading rd;
  static const int RETRY_DELAYS_MS[] = {2000, 4000, 8000};

  for (;;) {
    if (xQueueReceive(sensorQueue, &rd, portMAX_DELAY) == pdPASS) {
      // Build JSON payload
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
          // Server already has this reading (duplicate) — treat as success
          success = true;
          Serial.println("[UPLINK] Duplicate seq_no — server accepted idempotently.");
        } else if (lastCode == 401 || lastCode == 403) {
          authError = true;
          Serial.printf("[UPLINK] Auth error %d — check API key. Not buffering.\n",
                        lastCode);
        } else {
          Serial.printf("[UPLINK] HTTP %d on attempt %d/3.\n",
                        lastCode, attempt + 1);
        }
      }

      if (success) {
        bool tOk = false;
        getUTCTime(lastSendTimeStr, sizeof(lastSendTimeStr), tOk);
        Serial.printf("[UPLINK] seq_no %lu delivered (HTTP %d).\n",
                      (unsigned long)rd.seq_no, lastCode);
      } else if (!authError) {
        // Buffer to SD after all retries exhausted
        writeToSDQueue(payload, rd.seq_no);
      }
    }
  }
}

// ─── 5. Offline Queue Recovery Task (Core 0, Priority 1) ─────────────────────
// CRC32-verified replay. Atomic 3-step file rename. JSON parse validation.
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

              // ── Integrity validation ──────────────────────────────────
              bool integrityOk = false;
              if (endLine == "[END]" && crcLine.startsWith("[CRC32:")) {
                String hexCrc = crcLine.substring(7, crcLine.length() - 1);
                uint32_t expected = (uint32_t)strtoul(hexCrc.c_str(), nullptr, 16);
                uint32_t actual   = calculateQueueCRC(jsonBody);
                integrityOk = (expected == actual);
                if (!integrityOk) {
                  Serial.printf("[SYNC] CRC32 mismatch — record seq:%s discarded.\n",
                                seqLine.c_str());
                }
              } else {
                Serial.println("[SYNC] Malformed record (bad END/CRC) — discarded.");
              }

              // ── JSON parse validation before replay ───────────────────
              bool jsonOk = false;
              if (integrityOk) {
                StaticJsonDocument<512> testDoc;
                DeserializationError err = deserializeJson(testDoc, jsonBody);
                jsonOk = (err == DeserializationError::Ok &&
                          testDoc.containsKey("device_id") &&
                          testDoc.containsKey("seq_no"));
                if (!jsonOk) {
                  Serial.println("[SYNC] JSON invalid — record discarded.");
                }
              }

              // ── HTTPS replay ──────────────────────────────────────────
              bool replayed = false;
              if (jsonOk) {
                xSemaphoreGive(sdMutex); // Release during network I/O
                int code = httpsSignedPost("/data", jsonBody);
                xSemaphoreTake(sdMutex, pdMS_TO_TICKS(5000));

                if (code == HTTP_CODE_OK || code == HTTP_CODE_CREATED ||
                    code == 409) {  // 409 = duplicate, drop it
                  replayed = true;
                  Serial.printf("[SYNC] Replayed seq:%s (HTTP %d).\n",
                                seqLine.c_str(), code);
                } else if (code == 401 || code == 403) {
                  // Auth error — discard rather than retry forever
                  replayed = true;
                  Serial.printf("[SYNC] Auth error %d on replay — discarding.\n", code);
                }
              }

              // Keep record if replay failed and integrity was good
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

          // Atomic 3-step rename (power-loss safe)
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

// ─── 6. Diagnostics Heartbeat Task (Core 0, Priority 1) ──────────────────────
// Sends device health to backend every 30 minutes via HTTPS.
// Pulls remote config_version from response to detect server-side config updates.
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

      Serial.printf("[HB] Heartbeat HTTP %d | heap: %lu | queue: %d\n",
                    code, (unsigned long)ESP.getFreeHeap(), getQueueCount());

      // ── Config version check: pull if server has newer config ─────────
      if (code == HTTP_CODE_OK) {
        // Re-fetch response for config_version check
        int getCode = httpsSignedGet(path, responseBody);
        if (getCode == HTTP_CODE_OK && responseBody.length() > 0) {
          StaticJsonDocument<256> resp;
          if (deserializeJson(resp, responseBody) == DeserializationError::Ok) {
            uint32_t remoteVer = resp["config_version"] | 0;
            if (remoteVer > config.server_config_version) {
              Serial.printf("[HB] Remote config v%lu > local v%lu. Pulling...\n",
                            (unsigned long)remoteVer,
                            (unsigned long)config.server_config_version);
              char cfgPath[96];
              snprintf(cfgPath, sizeof(cfgPath), "/devices/%s/config", config.device_id);
              String cfgBody;
              int cfgCode = httpsSignedGet(cfgPath, cfgBody);
              if (cfgCode == HTTP_CODE_OK && cfgBody.length() > 0) {
                StaticJsonDocument<512> cfgDoc;
                if (deserializeJson(cfgDoc, cfgBody) == DeserializationError::Ok) {
                  // Apply updatable fields
                  if (cfgDoc.containsKey("sample_interval_sec")) {
                    uint32_t si = (uint32_t)cfgDoc["sample_interval_sec"];
                    config.sample_interval_sec = max(30u, min(3600u, si));
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
                  Serial.printf("[HB] Config updated to server v%lu.\n",
                                (unsigned long)remoteVer);
                }
              }
            }
          }
        }
      }
    }

    vTaskDelay(pdMS_TO_TICKS(1800000)); // Every 30 minutes
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SETUP & LOOP
// ═══════════════════════════════════════════════════════════════════════════

void setup() {
  Serial.begin(115200);

  Wire.begin(I2C_SDA, I2C_SCL);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0); lcd.print("Hydronix v2.0 Boot");

  loadConfiguration();

  // Initialize SD card
  if (!SD.begin(SD_CS_PIN)) {
    Serial.println("[SD] Mount failed — offline buffering disabled.");
    lcd.setCursor(0, 1); lcd.print("SD: FAIL (no buffer)");
    sdAvailable    = false;
    lowStorageMode = true;
  } else {
    sdAvailable = true;
    Serial.printf("[SD] Mounted OK. Usage: %.1f%%\n", getSDUsagePercent());

    // Power-loss recovery: if queue_old exists, prior rename was interrupted
    if (SD.exists("/data/queue_old.jsonl")) {
      Serial.println("[SD] Recovering from interrupted rename...");
      if (!SD.exists("/data/queue.jsonl")) {
        SD.rename("/data/queue_old.jsonl", "/data/queue.jsonl");
      } else {
        SD.remove("/data/queue_old.jsonl");
      }
    }
    // Remove any orphaned temp file
    if (SD.exists("/data/queue_new.jsonl")) {
      SD.remove("/data/queue_new.jsonl");
    }
  }

  // Captive portal mode: no WiFi credentials configured
  if (strlen(config.wifi_ssid) == 0) {
    char apPass[32];
    getAPPassword(apPass, sizeof(apPass));

    lcd.setCursor(0, 0); lcd.print("SETUP MODE — v2.0   ");
    lcd.setCursor(0, 1); lcd.print("SSID:Hydronix_Setup_");
    lcd.setCursor(0, 2); lcd.printf("%-20s", config.device_id);
    lcd.setCursor(0, 3); lcd.printf("Pass: %-14s", apPass);

    startSetupPortal();
    return; // loop() will run the portal
  }

  lcd.setCursor(0, 1); lcd.printf("Device: %-12s", config.device_id);
  lcd.setCursor(0, 2); lcd.print("Connecting to WiFi..");

  WiFi.begin(config.wifi_ssid, config.wifi_password);

  // Create synchronization primitives
  sdMutex      = xSemaphoreCreateMutex();
  sensorQueue  = xQueueCreate(10, sizeof(SensorReading));
  displayQueue = xQueueCreate(5,  sizeof(SensorReading));

  // Spawn FreeRTOS tasks
  // Core 1 — sensor + display (isolated from network I/O)
  xTaskCreatePinnedToCore(taskSensorRead,    "SensorSampling", 4096, NULL, 3, NULL, 1);
  xTaskCreatePinnedToCore(taskDisplayUpdate, "LCDDisplay",     2048, NULL, 1, NULL, 1);
  // Core 0 — network I/O tasks
  // Note: taskUplinkSender + taskOfflineSync use WiFiClientSecure;
  //       stack increased to 8192 to accommodate TLS context heap overhead.
  xTaskCreatePinnedToCore(taskNetworkManager, "NetWatchdog",  3072, NULL, 2, NULL, 0);
  xTaskCreatePinnedToCore(taskUplinkSender,   "UplinkSender", 8192, NULL, 2, NULL, 0);
  xTaskCreatePinnedToCore(taskOfflineSync,    "OfflineSync",  8192, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(taskHealthHeartbeat,"Heartbeat",    6144, NULL, 1, NULL, 0);

  Serial.printf("[SYSTEM] Hydronix v%s started. Device: %s\n",
                FIRMWARE_VERSION, config.device_id);
}

void loop() {
  if (isApMode) {
    dnsServer.processNextRequest();
    webServer.handleClient();
  }
  delay(1);
}
