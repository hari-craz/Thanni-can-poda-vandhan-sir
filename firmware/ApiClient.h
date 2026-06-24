#ifndef API_CLIENT_H
#define API_CLIENT_H

#include <Arduino.h>

bool computeHMAC_SHA256(const char* key, const char* message, char* outHex, size_t outHexSize);
bool computeSHA256(const char* data, size_t len, char* outHex, size_t outHexSize);
int httpsSignedPost(const char* path, const String& body, String* responseBody = nullptr);
int httpsSignedGet(const char* path, String& responseBody);

#endif // API_CLIENT_H
