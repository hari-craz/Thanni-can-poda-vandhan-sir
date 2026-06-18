/**
 * Solenoid Valve Control Module for Hydronix ESP32 Firmware
 * 
 * Handles:
 * - GPIO control for 12V/24V solenoid valve
 * - Automatic safety cutoff on bad water quality
 * - Manual remote control via MQTT/HTTP commands
 * - State machine with debounce and retry logic
 * - SD card logging of all valve operations
 */

#ifndef VALVE_CONTROL_H
#define VALVE_CONTROL_H

#include <Arduino.h>
#include <time.h>

// ─── HARDWARE CONFIGURATION ──────────────────────────────────────────────────
#define VALVE_GPIO_PIN           27      // GPIO pin connected to relay/MOSFET
#define VALVE_NORMALLY_OPEN      false   // Failsafe: valve closed when de-energized
#define VALVE_DEBOUNCE_MS        2000    // 2-second lockout after toggle
#define VALVE_RETRY_INTERVAL_MIN 1       // Check conditions every minute
#define VALVE_STAY_CLOSED_MIN    5       // Alert backend if bad conditions >5 min

// ─── QUALITY THRESHOLDS FOR AUTO-CUTOFF ──────────────────────────────────────
#define QUALITY_PH_MIN           6.5
#define QUALITY_PH_MAX           8.5
#define QUALITY_TURBIDITY_MAX    5.0     // NTU
#define QUALITY_TDS_MAX          500.0   // ppm
#define QUALITY_TEMP_MIN         5.0     // Celsius
#define QUALITY_TEMP_MAX         50.0    // Celsius

// ─── VALVE STATE MACHINE ─────────────────────────────────────────────────────
enum ValveState {
  VALVE_OPEN   = 0,
  VALVE_CLOSED = 1
};

enum ValveTrigger {
  TRIGGER_AUTO_SAFETY = 0,
  TRIGGER_MANUAL_OP   = 1,
  TRIGGER_REMOTE_CMD  = 2
};

struct ValveOperation {
  time_t timestamp;
  ValveState action;           // VALVE_OPEN or VALVE_CLOSED
  ValveTrigger triggered_by;
  float quality_score;
  char reason[256];            // e.g., "pH out of range (6.2)"
  char operator_id[100];       // User email if manual
};

// ─── VALVE CONTROLLER CLASS ──────────────────────────────────────────────────
class ValveController {
public:
  ValveController();
  ~ValveController();
  
  /**
   * Initialize valve GPIO and state machine.
   * Must be called once during setup().
   */
  void begin();
  
  /**
   * Check if water quality is safe.
   * Returns: true if safe, false if unsafe (valve should close)
   */
  bool isQualitySafe(float ph, float turbidity, float tds, float temperature);
  
  /**
   * Get detailed reason if quality is unsafe.
   * buf: char array to store reason (min 256 bytes)
   * Returns: true if unsafe, false if safe
   */
  bool getUnsafeReason(float ph, float turbidity, float tds, float temperature, char* buf);
  
  /**
   * Process incoming sensor reading.
   * Checks if valve state change is needed.
   * Logs operation to SD if state changed.
   * Returns: true if valve state changed, false otherwise
   */
  bool processSensorReading(float ph, float turbidity, float tds, float temperature, int quality_score);
  
  /**
   * Manually close valve from remote command (HTTP/MQTT).
   * reason: Optional reason string (can be NULL)
   * Returns: true if successful
   */
  bool closeValveRemote(const char* reason = NULL);
  
  /**
   * Manually open valve from remote command (HTTP/MQTT).
   * reason: Optional reason string (can be NULL)
   * Returns: true if successful
   */
  bool openValveRemote(const char* reason = NULL);
  
  /**
   * Get current valve state.
   * Returns: VALVE_OPEN or VALVE_CLOSED
   */
  ValveState getCurrentState() const { return current_state; }
  
  /**
   * Get last operation timestamp.
   */
  time_t getLastToggleTime() const { return last_toggle_time; }
  
  /**
   * Get seconds since last toggle.
   */
  uint32_t getSecondsSinceLastToggle() const;
  
  /**
   * Log valve operation to SD card.
   * For offline sync when device comes online.
   */
  void logOperationToSD(const ValveOperation& op);
  
  /**
   * Get last close reason (if currently closed).
   */
  const char* getCloseReason() const { return close_reason; }
  
  /**
   * Check if valve is in rate-limited state (too soon after last toggle).
   */
  bool isRateLimited() const;
  
  /**
   * Periodic task to check if conditions improved (called from FreeRTOS task).
   * If valve closed for >VALVE_STAY_CLOSED_MIN and conditions now safe, re-opens.
   */
  void periodicCheck();
  
private:
  ValveState current_state;
  ValveState desired_state;
  time_t last_toggle_time;
  time_t closed_since_time;          // When valve was last closed
  char close_reason[256];            // Stored reason for current closure
  
  /**
   * Actually set GPIO state.
   * HIGH = energized = valve closed (solenoid pulls)
   * LOW = de-energized = valve open (spring return)
   */
  void setGPIOState(ValveState state);
  
  /**
   * Execute the valve state change with safety checks.
   */
  bool executeStateChange(ValveState new_state, ValveTrigger trigger, const char* reason);
};

// ─── GLOBAL INSTANCE ─────────────────────────────────────────────────────────
extern ValveController valve_controller;

#endif // VALVE_CONTROL_H
