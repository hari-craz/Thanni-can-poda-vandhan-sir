#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>

void startSetupPortal();
void handleRootPortal();
void handleSavePortal();
void handleResetPortal();
void handleCalibratePortal();
void handleCalibrationStatus();
void handleTestWiFi();
void handleTestServer();

#endif // WIFI_MANAGER_H
