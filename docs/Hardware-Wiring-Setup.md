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

| Sensor | Wire Color (Typical) | ESP32 Silkscreen Label | ESP32 GPIO | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **pH Sensor** | Yellow / Signal | **P32** | GPIO 32 | Connect VCC to 5V, GND to Common GND. |
| **Turbidity Sensor**| Orange / Signal | **P33** | GPIO 33 | Connect VCC to 5V, GND to Common GND. |
| **TDS Sensor** | Blue / Signal | **P34** | GPIO 34 | Connect VCC to 3.3V, GND to Common GND. |
| **Temperature** | Green / Data | **P35** | GPIO 35 | Add 4.7kΩ pull-up resistor between Data & 3.3V. |

---

## 3. Flow Sensor (SAIER HW21WA - Pulse Based)

Because this is a pulse-based sensor (Hall effect), it must be connected to a pin capable of handling interrupts.

| Flow Sensor | ESP32 Silkscreen Label | ESP32 GPIO | Notes |
| :--- | :--- | :--- | :--- |
| Signal (Yellow/White) | **SUP** | GPIO 36 (VP) | VCC to 5V, GND to Common GND. The firmware uses hardware interrupts to count pulses on this pin. |

---

## 4. I2C Display (20x4 LCD with I2C Backpack)

The ESP32 uses default I2C pins.

| LCD Module | ESP32 Silkscreen Label | ESP32 GPIO | Notes |
| :--- | :--- | :--- | :--- |
| SDA | **P21** | GPIO 21 | Data line. |
| SCL | **P22** | GPIO 22 | Clock line. |
| VCC | **5V** | — | The LCD requires 5V for the backlight to function properly. |
| GND | **GND** | — | Common GND. |

---

## 5. Micro SD Card Reader Module (SPI)

The module uses the default VSPI bus on the ESP32.

| SD Module | ESP32 Silkscreen Label | ESP32 GPIO | Notes |
| :--- | :--- | :--- | :--- |
| CS | **P5** | GPIO 5 | Chip Select. |
| MOSI | **P23** | GPIO 23 | Master Out Slave In. |
| MISO | **P19** | GPIO 19 | Master In Slave Out. |
| SCK / CLK | **P18** | GPIO 18 | Serial Clock. |
| VCC | **3V3** or **5V** | — | Check module specs; most accept 5V. |
| GND | **GND** | — | Common GND. |

---

## 6. Solenoid Valve Control (Relay Module)

You are using a **Normally Closed 24V DC 1/2" Solenoid Valve**. 
*Normally Closed means the valve blocks water flow when it has no power. It opens when 24V is applied.*

**ESP32 to Relay:**
| Relay Module | ESP32 Silkscreen Label | ESP32 GPIO / Power |
| :--- | :--- | :--- |
| IN / Signal | **P27** | GPIO 27 |
| VCC | **5V** | 5V |
| GND | **GND** | GND |

**Relay to Valve (24V Circuit):**
1.  Connect **24V Power Supply (+)** to the Relay's **COM** (Common) terminal.
2.  Connect the Relay's **NO** (Normally Open) terminal to one wire of the **Solenoid Valve**.
3.  Connect the other wire of the **Solenoid Valve** to the **24V Power Supply (- / GND)**.

> ⚠️ **SAFETY WARNING:** 
> NEVER connect the 24V power supply directly to the ESP32. The Relay module acts as an isolated switch. The ESP32 logic (3.3V) only talks to the Relay's signal pin.

---

## 7. Status LEDs (Traffic Light & Dual RGBs)

The system uses three separate LED modules to indicate status across three categories: Network, Sensor Health, and Valve State. 
*Note: Because some ESP32 pins are used for bootstrapping (GPIO 2, 12, 15), you **must use Common Cathode** LEDs where the common pin connects to GND.*

**Module 1: Traffic Light (Network & Server Status)**
| Color | Status Indicator | ESP32 Silkscreen | ESP32 GPIO |
| :--- | :--- | :--- | :--- |
| Red | Offline / Server Disconnected | **P14** | GPIO 14 |
| Yellow | Booting / WiFi Setup Mode | **P25** | GPIO 25 |
| Green | Online & Server Connected | **P26** | GPIO 26 |

**Module 2: RGB LED 1 (Sensor & System Health)**
| Color | Status Indicator | ESP32 Silkscreen | ESP32 GPIO |
| :--- | :--- | :--- | :--- |
| Red | Sensor Error / SD Error | **P4** | GPIO 4 |
| Green | Sensors Healthy | **P16** | GPIO 16 |
| Blue | Calibrating / Standby | **P17** | GPIO 17 |

**Module 3: RGB LED 2 (Relay & Valve Status)**
| Color | Status Indicator | ESP32 Silkscreen | ESP32 GPIO |
| :--- | :--- | :--- | :--- |
| Red | Valve Closed | **P13** | GPIO 13 |
| Green | Valve Open | **P12** | GPIO 12 |
| Blue | Manual Override / Reserved | **P2** | GPIO 2 |

---

## 8. 38-Pin ESP32-WROOM-32 Pinout Map (Visual Reference)

This diagram corresponds exactly to the physical silkscreen labels on the back of your **NodeMCU ESP-32S** board:

```text
                     ┌────────────────────────────────┐
                     │       ESP32 NODEMCU-32S        │
                     │            (38 Pin)            │
                     │         USB-C Connector        │
                     ├────────────────────────────────┤
            3V3  ── │ 1                            38 │ ── GND
             EN  ── │ 2                            37 │ ── P23 (GPIO 23 / SD MOSI)
  FLOW →    SUP  ── │ 3                            36 │ ── P22 (GPIO 22 / LCD SCL)
            SUN  ── │ 4                            35 │ ── TX  (GPIO 1  / TX0)
   TDS →    P34  ── │ 5                            34 │ ── RX  (GPIO 3  / RX0)
  TEMP →    P35  ── │ 6                            33 │ ── GND
    pH →    P32  ── │ 7                            32 │ ── P21 (GPIO 21 / LCD SDA)
  TURB →    P33  ── │ 8                            31 │ ── P19 (GPIO 19 / SD MISO)
 M1(Y) ←    P25  ── │ 9                            30 │ ── P18 (GPIO 18 / SD SCK)
 M1(G) ←    P26  ── │ 10                           29 │ ── P5  (GPIO 5  / SD CS)
 VALVE ←    P27  ── │ 11                           28 │ ── P17 (GPIO 17)       → M2(B)
 M1(R) ←    P14  ── │ 12                           27 │ ── P16 (GPIO 16)       → M2(G)
 M3(G) ←    P12  ── │ 13                           26 │ ── P4  (GPIO 4)        → M2(R)
            GND  ── │ 14                           25 │ ── P0  (GPIO 0  / BOOT)
 M3(R) ←    P13  ── │ 15                           24 │ ── P2  (GPIO 2)        → M3(B)
            SD2  ── │ 16                           23 │ ── P15 (GPIO 15)
            SD3  ── │ 17                           22 │ ── SD1 (GPIO 8)
            GND  ── │ 18                           21 │ ── SD0 (GPIO 7)
             5V  ── │ 19                           20 │ ── CLK (GPIO 6)
                     └────────────────────────────────┘
```
*(Note: Always verify the physical silkscreen printed on your board before connecting wires. Note that on this NodeMCU ESP-32S board, GPIO 21 (P21) and the adjacent GND are swapped compared to standard 38-pin ESP-WROOM-32 dev kits).*
