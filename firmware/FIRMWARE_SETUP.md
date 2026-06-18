# Hydronix ESP32 Firmware Setup Guide

This guide covers everything you need to compile and upload the Hydronix firmware to your OceanLabz ESP32-WROOM-32 board using the Arduino IDE.

## 1. Install the Arduino IDE
If you haven't already, download and install the latest Arduino IDE (v2.x recommended) from [arduino.cc/en/software](https://www.arduino.cc/en/software).

## 2. Add ESP32 Board Support
1. Open the Arduino IDE.
2. Go to **File > Preferences** (or **Arduino > Preferences** on macOS).
3. In the "Additional boards manager URLs" field, paste this link:
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
4. Click **OK**.
5. Go to **Tools > Board > Boards Manager...**
6. Search for `esp32` and install the package named **esp32 by Espressif Systems**.

## 3. Install Required Libraries
The firmware uses several built-in libraries (like WiFi, SPI, SD), but you must manually install these external libraries:

1. Go to **Sketch > Include Library > Manage Libraries...**
2. Search for and install:
   * **`ArduinoJson`** (by Benoit Blanchon) — *Install version 6.x or 7.x (the code is compatible).*
   * **`LiquidCrystal I2C`** (by Frank de Brabander) — *(Note: It may say "for AVR", but it works perfectly on the ESP32).*

## 4. Select the Correct Board and Settings
1. Plug your ESP32 into your computer via a data-sync USB cable.
2. Go to **Tools > Board > esp32** and select **ESP32 Dev Module**.
3. Go to **Tools > Port** and select the COM port (Windows) or `/dev/cu.usbserial-xxx` (Mac) your board is connected to.
4. Ensure the following **Tools** menu settings are applied:
   * **Flash Mode:** QIO
   * **Flash Size:** 4MB (32Mb)
   * **Upload Speed:** 115200
   * **Partition Scheme:** "Huge APP (3MB No OTA/1MB SPIFFS)" *(Highly recommended to accommodate the large HTTPS and JSON libraries)*
   * **Core Debug Level:** None (or "Info" if you are troubleshooting crashes)

## 5. Compile and Upload
1. Open `firmware.ino` in the Arduino IDE.
2. Click the **Verify** (checkmark) button in the top left to ensure it compiles without errors.
3. Click the **Upload** (right arrow) button.
4. *Important note for ESP32 boards:* If you see `Connecting...` in the bottom terminal and it doesn't proceed, press and hold the physical **BOOT** button on your ESP32 board for 2-3 seconds until the upload starts.

## 6. Serial Monitor & WiFi Provisioning

1. Once uploaded, open the **Serial Monitor** (magnifying glass icon in top right).
2. Set the baud rate in the bottom corner of the monitor to **115200**.
3. Press the **EN** (reset) button on the ESP32.
4. If this is a fresh ESP32, you will see it spin up its own WiFi network called `Hydronix_Setup_XXXX`.
5. Connect your phone or laptop to that WiFi network.
   * **Password:** The password is deterministic. By default, it is **`hydro-001-setup`**. (If your device ID is `HYDRO_005`, the password is `hydro-005-setup`).
6. Open your web browser and go to: **`http://192.168.4.1`**
7. Fill out the Captive Portal form:
   * **Device ID:** Leave as `HYDRO_001` (or change if deploying multiple).
   * **WiFi SSID & Password:** Your home/office WiFi credentials.
   * **API Base URL:** Your backend Cloudflare URL (e.g., `https://api.hydronix.com`). *Must start with https://*
   * **API Key:** Your backend secret key.
   * **Sample Interval:** How often to send data (e.g., `60` seconds).
8. Click **Save Configuration**. The ESP32 will save the settings, turn off its Setup WiFi, and connect to your home WiFi router!
