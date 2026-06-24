#include "ApiClient.h"
#include "Config.h"
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "mbedtls/md.h"
#include <sys/time.h>
#include <time.h>

// Convert UTC struct tm to epoch time manually to avoid timezone offset issues
static time_t parseHTTPDateToEpoch(const String& dateStr) {
  int commaIdx = dateStr.indexOf(',');
  if (commaIdx == -1) return 0;
  
  String trimmed = dateStr.substring(commaIdx + 2);
  trimmed.trim(); // E.g., "24 Jun 2026 14:42:05 GMT"
  
  char monthStr[4];
  int day = 0, year = 0, hour = 0, minute = 0, second = 0;
  
  if (sscanf(trimmed.c_str(), "%d %3s %d %d:%d:%d", 
             &day, monthStr, &year, &hour, &minute, &second) != 6) {
    return 0;
  }
  
  const char* months[] = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
  int month = -1;
  for (int i = 0; i < 12; i++) {
    if (strcmp(monthStr, months[i]) == 0) {
      month = i;
      break;
    }
  }
  
  if (month == -1) return 0;
  
  struct tm tm_time;
  tm_time.tm_sec = second;
  tm_time.tm_min = minute;
  tm_time.tm_hour = hour;
  tm_time.tm_mday = day;
  tm_time.tm_mon = month;
  tm_time.tm_year = year - 1900;
  tm_time.tm_isdst = 0;
  
  int y = tm_time.tm_year + 1900;
  int m = tm_time.tm_mon;
  int d = tm_time.tm_mday;
  
  const int days_before_month[] = {
    0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334
  };
  
  int num_leap_years = (y - 1969) / 4 - (y - 1901) / 100 + (y - 1601) / 400;
  long total_days = (y - 1970) * 365 + num_leap_years + days_before_month[m] + (d - 1);
  
  bool is_leap_year = (y % 4 == 0 && (y % 100 != 0 || y % 400 == 0));
  if (is_leap_year && m > 1) {
    total_days += 1;
  }
  
  return total_days * 86400 + tm_time.tm_hour * 3600 + tm_time.tm_min * 60 + tm_time.tm_sec;
}

static void syncTimeFromHTTPDate(const String& dateHeader) {
  time_t now = time(nullptr);
  if (now > 1600000000) { // Clock is already synced (year > 2020)
    return;
  }
  
  time_t t = parseHTTPDateToEpoch(dateHeader);
  if (t > 1600000000) {
    struct timeval tv;
    tv.tv_sec = t;
    tv.tv_usec = 0;
    settimeofday(&tv, nullptr);
    
    struct tm ts_tm;
    gmtime_r(&t, &ts_tm);
    strftime(config.last_ntp_sync, sizeof(config.last_ntp_sync), "%Y-%m-%dT%H:%M:%SZ", &ts_tm);
    saveConfiguration();
    Serial.printf("[NTP] Clock synced via HTTP Date Header: %s\n", config.last_ntp_sync);
  }
}

// SHA256 of empty string — used for GET signing
static const char SHA256_EMPTY[] = "e3b0c44298fc1c149afbf4c8996fb924"
                                   "27ae41e4649b934ca495991b7852b855";

// ─── HMAC-SHA256 ─────────────────────────────────────────────────────────────
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

// Build HMAC signing string and populate auth headers on an HTTPClient.
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
int httpsSignedPost(const char* path, const String& body, String* responseBody) {
  if (!isOnline) return -1;

  if (httpsMutex != nullptr) {
    if (xSemaphoreTake(httpsMutex, pdMS_TO_TICKS(30000)) != pdTRUE) {
      Serial.println("[TLS] POST failed to acquire HTTPS mutex within 30s");
      return -1;
    }
  }

  char url[384];
  size_t baseLen = strlen(config.api_base_url);
  if (baseLen > 0 && config.api_base_url[baseLen - 1] == '/' && path[0] == '/') {
    snprintf(url, sizeof(url), "%s%s", config.api_base_url, path + 1);
  } else if (baseLen > 0 && config.api_base_url[baseLen - 1] != '/' && path[0] != '/') {
    snprintf(url, sizeof(url), "%s/%s", config.api_base_url, path);
  } else {
    snprintf(url, sizeof(url), "%s%s", config.api_base_url, path);
  }

  char bodyHash[65];
  computeSHA256(body.c_str(), body.length(), bodyHash, sizeof(bodyHash));

  WiFiClientSecure secureClient;
  secureClient.setInsecure();
  secureClient.setTimeout(15000);

  HTTPClient https;
  https.begin(secureClient, url);
  https.addHeader("Content-Type", "application/json");
  https.addHeader("Connection", "close");
  attachAuthHeaders(https, "POST", path, bodyHash);
  https.setTimeout(15000);

  const char* headerKeys[] = {"Date"};
  https.collectHeaders(headerKeys, 1);

  int code = https.POST(body);
  if (code > 0) {
    if (responseBody != nullptr) {
      *responseBody = https.getString();
    }
  } else {
    char errBuf[128];
    secureClient.lastError(errBuf, sizeof(errBuf));
    Serial.printf("[TLS] POST connection error: %s (code: %d)\n", errBuf, code);
  }

  String dateHeader = https.header("Date");
  if (dateHeader.length() > 0) {
    syncTimeFromHTTPDate(dateHeader);
  }

  https.end();

  if (httpsMutex != nullptr) {
    xSemaphoreGive(httpsMutex);
  }

  return code;
}

// Signed HTTPS GET. Returns HTTP status code; body written to responseBody.
int httpsSignedGet(const char* path, String& responseBody) {
  if (!isOnline) return -1;

  if (httpsMutex != nullptr) {
    if (xSemaphoreTake(httpsMutex, pdMS_TO_TICKS(30000)) != pdTRUE) {
      Serial.println("[TLS] GET failed to acquire HTTPS mutex within 30s");
      return -1;
    }
  }

  char url[384];
  size_t baseLen = strlen(config.api_base_url);
  if (baseLen > 0 && config.api_base_url[baseLen - 1] == '/' && path[0] == '/') {
    snprintf(url, sizeof(url), "%s%s", config.api_base_url, path + 1);
  } else if (baseLen > 0 && config.api_base_url[baseLen - 1] != '/' && path[0] != '/') {
    snprintf(url, sizeof(url), "%s/%s", config.api_base_url, path);
  } else {
    snprintf(url, sizeof(url), "%s%s", config.api_base_url, path);
  }

  WiFiClientSecure secureClient;
  secureClient.setInsecure();
  secureClient.setTimeout(15000);

  HTTPClient https;
  https.begin(secureClient, url);
  https.addHeader("Connection", "close");
  attachAuthHeaders(https, "GET", path, SHA256_EMPTY);
  https.setTimeout(15000);

  const char* headerKeys[] = {"Date"};
  https.collectHeaders(headerKeys, 1);

  int code = https.GET();
  if (code > 0) {
    responseBody = https.getString();
  } else {
    char errBuf[128];
    secureClient.lastError(errBuf, sizeof(errBuf));
    Serial.printf("[TLS] GET connection error: %s (code: %d)\n", errBuf, code);
  }

  String dateHeader = https.header("Date");
  if (dateHeader.length() > 0) {
    syncTimeFromHTTPDate(dateHeader);
  }

  https.end();

  if (httpsMutex != nullptr) {
    xSemaphoreGive(httpsMutex);
  }

  return code;
}
