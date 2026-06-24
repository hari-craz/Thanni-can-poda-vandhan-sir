#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>
#include <LiquidCrystal_I2C.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <ArduinoJson.h>
#include <FS.h>
#include <SPI.h>
#include <SD.h>
#include <HTTPClient.h>

// ─── HARDWARE PINS ───────────────────────────────────────────────────────────
#define SD_CS_PIN       5
#define PIN_PH          32
#define PIN_TURBIDITY   33
#define PIN_TDS         34
#define PIN_TEMP        35
#define PIN_FLOW        36    // Pulse-based flow sensor
#define I2C_SDA         21
#define I2C_SCL         22
#define LCD_ADDR        0x27
#define FIRMWARE_VERSION "2.0.0"

// ─── CONFIG SCHEMA VERSION ───────────────────────────────────────────────────
#define CONFIG_SCHEMA_VERSION  2
#define QUEUE_FORMAT_VERSION   2

// ─── CONFIGURATION STRUCTURE v2 ──────────────────────────────────────────────
struct DeviceConfig {
  uint8_t  schema_version;
  uint8_t  _reserved[3];
  char     device_id[32];
  uint32_t reset_count;
  char     wifi_ssid[64];
  char     wifi_password[64];
  char     api_base_url[256];
  char     api_key[192];
  uint32_t sample_interval_sec;
  char     firmware_channel[16];
  uint32_t server_config_version;
  float    ph_offset;
  float    turbidity_offset;
  float    tds_offset;
  float    temp_offset;
  float    flow_offset;
  int32_t  timezone_offset_sec;
  char     last_ntp_sync[32];
  char     last_calibration_at[32];
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
  char     timestamp_source[16];
};

// ─── GLOBAL INSTANCE EXTERN DECLARATIONS ──────────────────────────────────────
extern DeviceConfig config;
extern Preferences  pref;
extern WebServer    webServer;
extern DNSServer    dnsServer;
extern LiquidCrystal_I2C lcd;

// FreeRTOS primitives
extern QueueHandle_t     sensorQueue;
extern QueueHandle_t     displayQueue;
extern SemaphoreHandle_t sdMutex;
extern SemaphoreHandle_t httpsMutex;

// Global state
extern bool     isApMode;
extern bool     isOnline;
extern bool     sdAvailable;
extern bool     lowStorageMode;
extern uint32_t globalSeqNo;
extern char     lastSendTimeStr[32];
extern char     csrfToken[17];

// Stuck sensor flags
extern bool isPhStuck;
extern bool isTurbStuck;
extern bool isTdsStuck;
extern bool isTempStuck;
extern bool isFlowStuck;

// Calibration state
extern bool     calibrationRunning;
extern uint32_t calibrationStartMs;
extern float    calibrationSamples[30];
extern int      calibrationSampleCount;

// Flow sensor ISR
extern volatile uint32_t flowPulseCount;
extern portMUX_TYPE flowMux;

// Sanity bounds
extern const float PH_MIN, PH_MAX;
extern const float TURB_MIN, TURB_MAX;
extern const float TDS_MIN, TDS_MAX;
extern const float TEMP_MIN, TEMP_MAX;
extern const float FLOW_MIN, FLOW_MAX;

extern const float PH_DELTA_PER_MIN;
extern const float TURB_DELTA_PER_MIN;
extern const float TDS_DELTA_PER_MIN;
extern const float TEMP_DELTA_PER_MIN;
extern const float FLOW_DELTA_PER_MIN;

// ISRG Root X1 CA cert (Let's Encrypt Root)
extern const char ISRG_ROOT_X1_PEM[] PROGMEM;

// Function declarations that are shared
uint32_t calculateConfigCRC(const DeviceConfig& cfg);
uint32_t calculateQueueCRC(const String& data);
void saveConfiguration();
void loadConfiguration();
void factoryReset();
void getAPPassword(char* outPass, size_t outSize);
void getUTCTime(char* buffer, size_t maxLen, bool& synced);
int getQueueCount();
float getSDUsagePercent();
void generateCSRFToken();
void initWebServer();

#endif // CONFIG_H
