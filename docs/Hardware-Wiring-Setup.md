# Hardware Wiring & Setup Guide

This guide details the physical wiring and setup for the Hydronix system based on the **OceanLabz ESP32-WROOM-32 C Type (38 Pins, CP2102)** with its Expansion Board, and the specific hardware components used in the project.

## 1. Power Supply Distribution

The system requires multiple voltage levels. **DO NOT power high-draw components (like the valve or multiple 5V sensors) directly from the ESP32's 3.3V or 5V pins if possible.** Use a dedicated power module (like your XL6019 Boost Module + 3S Battery setup) to distribute power.

*   **ESP32 Board:** Power via USB-C or provide stable 5V to the `5V` pin.
*   **3.3V Rail (from ESP32 3V3 pin):**
    *   TDS Sensor (VCC)
    *   Temperature Sensor (VCC)
*   **5V Rail (from external 5V regulator or ESP32 5V pin):**
    *   pH Sensor (VCC)
    *   Turbidity Sensor (VCC)
    *   Flow Sensor (VCC)
    *   I2C LCD Display (VCC)
    *   Relay Module (VCC)
*   **24V Rail (from Boost Converter/External Supply):**
    *   Solenoid Valve power (switched through Relay)

---

## 2. Analog Sensors (ADC1)

All analog sensors must be connected to **ADC1** pins (GPIO 32-39). ADC2 pins cannot be used for analog reads while WiFi is active.

| Sensor | Wire Color (Typical) | ESP32 Pin | Notes |
| :--- | :--- | :--- | :--- |
| **pH Sensor** | Yellow / Signal | **GPIO 32** | Connect VCC to 5V, GND to Common GND. |
| **Turbidity Sensor**| Orange / Signal | **GPIO 33** | Connect VCC to 5V, GND to Common GND. |
| **TDS Sensor** | Blue / Signal | **GPIO 34** | Connect VCC to 3.3V, GND to Common GND. |
| **Temperature** | Green / Data | **GPIO 35** | Add 4.7kΩ pull-up resistor between Data & 3.3V. |

---

## 3. Flow Sensor (SAIER HW21WA - Pulse Based)

Because this is a pulse-based sensor (Hall effect), it must be connected to a pin capable of handling interrupts.

| Flow Sensor | ESP32 Pin | Notes |
| :--- | :--- | :--- |
| Signal (Yellow/White) | **GPIO 36 (VP)** | VCC to 5V, GND to Common GND. The firmware uses hardware interrupts to count pulses on this pin. |

---

## 4. I2C Display (20x4 LCD with I2C Backpack)

The ESP32 uses default I2C pins.

| LCD Module | ESP32 Pin | Notes |
| :--- | :--- | :--- |
| SDA | **GPIO 21** | Data line. |
| SCL | **GPIO 22** | Clock line. |
| VCC | 5V | The LCD requires 5V for the backlight to function properly. |
| GND | GND | Common GND. |

---

## 5. Micro SD Card Reader Module (SPI)

The module uses the default VSPI bus on the ESP32.

| SD Module | ESP32 Pin | Notes |
| :--- | :--- | :--- |
| CS | **GPIO 5** | Chip Select. |
| MOSI | **GPIO 23** | Master Out Slave In. |
| MISO | **GPIO 19** | Master In Slave Out. |
| SCK / CLK | **GPIO 18** | Serial Clock. |
| VCC | 3.3V or 5V | Check module specs; most accept 5V. |
| GND | GND | Common GND. |

---

## 6. Solenoid Valve Control (Relay Module)

You are using a **Normally Closed 24V DC 1/2" Solenoid Valve**. 
*Normally Closed means the valve blocks water flow when it has no power. It opens when 24V is applied.*

**ESP32 to Relay:**
| Relay Module | ESP32 Pin / Power |
| :--- | :--- |
| IN / Signal | **GPIO 27** |
| VCC | 5V |
| GND | GND |

**Relay to Valve (24V Circuit):**
1.  Connect **24V Power Supply (+)** to the Relay's **COM** (Common) terminal.
2.  Connect the Relay's **NO** (Normally Open) terminal to one wire of the **Solenoid Valve**.
3.  Connect the other wire of the **Solenoid Valve** to the **24V Power Supply (- / GND)**.

> ⚠️ **SAFETY WARNING:** 
> NEVER connect the 24V power supply directly to the ESP32. The Relay module acts as an isolated switch. The ESP32 logic (3.3V) only talks to the Relay's signal pin.

---

## 7. 38-Pin ESP32-WROOM-32 Pinout Map (Visual Reference)

```text
                    ┌──────────────────┐
                    │   ESP32-WROOM-32 │
                    │    (38 Pin)      │
                    │    USB-C (CP2102)│
                    ├──────────────────┤
            3V3  ── │ 1            38 │ ── GND
             EN  ── │ 2            37 │ ── GPIO 23 (SD MOSI)
 FLOW → GPIO 36  ── │ 3            36 │ ── GPIO 22 (LCD SCL)
        GPIO 39  ── │ 4            35 │ ── GPIO 1  (TX0)
  TDS → GPIO 34  ── │ 5            34 │ ── GPIO 3  (RX0)
 TEMP → GPIO 35  ── │ 6            33 │ ── GPIO 21 (LCD SDA)
   pH → GPIO 32  ── │ 7            32 │ ── GND
 TURB → GPIO 33  ── │ 8            31 │ ── GPIO 19 (SD MISO)
        GPIO 25  ── │ 9            30 │ ── GPIO 18 (SD CLK)
        GPIO 26  ── │ 10           29 │ ── GPIO 5  (SD CS)
VALVE ← GPIO 27  ── │ 11           28 │ ── GPIO 17 (TX2)
        GPIO 14  ── │ 12           27 │ ── GPIO 16 (RX2)
        GPIO 12  ── │ 13           26 │ ── GPIO 4
            GND  ── │ 14           25 │ ── GPIO 0  (BOOT)
        GPIO 13  ── │ 15           24 │ ── GPIO 2  (onboard LED)
   SD2 / GPIO 9  ── │ 16           23 │ ── GPIO 15
   SD3 / GPIO 10 ── │ 17           22 │ ── SD1 / GPIO 8
   CMD / GPIO 11 ── │ 18           21 │ ── SD0 / GPIO 7
            5V   ── │ 19           20 │ ── CLK / GPIO 6
                    └──────────────────┘
```
*(Note: Always verify the physical silkscreen printed on your specific expansion board to ensure proper alignment!)*
