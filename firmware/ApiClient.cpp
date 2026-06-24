#include "ApiClient.h"
#include "Config.h"
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "mbedtls/md.h"

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

  int code = https.GET();
  if (code > 0) {
    responseBody = https.getString();
  } else {
    char errBuf[128];
    secureClient.lastError(errBuf, sizeof(errBuf));
    Serial.printf("[TLS] GET connection error: %s (code: %d)\n", errBuf, code);
  }
  https.end();

  if (httpsMutex != nullptr) {
    xSemaphoreGive(httpsMutex);
  }

  return code;
}
