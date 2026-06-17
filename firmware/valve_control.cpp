/**
 * Solenoid Valve Control Implementation
 */

#include "valve_control.h"
#include <SD.h>
#include <FS.h>
#include <cstring>
#include <cstdio>

// Global instance
ValveController valve_controller;

ValveController::ValveController()
  : current_state(VALVE_OPEN),
    desired_state(VALVE_OPEN),
    last_toggle_time(0),
    closed_since_time(0) {
  memset(close_reason, 0, sizeof(close_reason));
  strcpy(close_reason, ""); // Empty initially
}

ValveController::~ValveController() {}

void ValveController::begin() {
  pinMode(VALVE_GPIO_PIN, OUTPUT);
  
  // Set initial state based on failsafe mode
  // LOW = de-energized = open (for normally-open solenoid)
  if (VALVE_NORMALLY_OPEN) {
    digitalWrite(VALVE_GPIO_PIN, LOW);
    current_state = VALVE_OPEN;
  } else {
    digitalWrite(VALVE_GPIO_PIN, HIGH);
    current_state = VALVE_CLOSED;
  }
  
  last_toggle_time = time(NULL);
  Serial.println("[VALVE] Controller initialized - Normally Open Failsafe");
}

bool ValveController::isQualitySafe(float ph, float turbidity, float tds, float temperature) {
  if (ph < QUALITY_PH_MIN || ph > QUALITY_PH_MAX) return false;
  if (turbidity > QUALITY_TURBIDITY_MAX) return false;
  if (tds > QUALITY_TDS_MAX) return false;
  if (temperature < QUALITY_TEMP_MIN || temperature > QUALITY_TEMP_MAX) return false;
  return true;
}

bool ValveController::getUnsafeReason(float ph, float turbidity, float tds, 
                                      float temperature, char* buf) {
  if (ph < QUALITY_PH_MIN) {
    snprintf(buf, 256, "pH too low (%.1f)", ph);
    return true;
  }
  if (ph > QUALITY_PH_MAX) {
    snprintf(buf, 256, "pH too high (%.1f)", ph);
    return true;
  }
  if (turbidity > QUALITY_TURBIDITY_MAX) {
    snprintf(buf, 256, "Turbidity too high (%.1f NTU)", turbidity);
    return true;
  }
  if (tds > QUALITY_TDS_MAX) {
    snprintf(buf, 256, "TDS too high (%.0f ppm)", tds);
    return true;
  }
  if (temperature < QUALITY_TEMP_MIN) {
    snprintf(buf, 256, "Temperature too low (%.1f°C)", temperature);
    return true;
  }
  if (temperature > QUALITY_TEMP_MAX) {
    snprintf(buf, 256, "Temperature too high (%.1f°C)", temperature);
    return true;
  }
  return false;
}

bool ValveController::processSensorReading(float ph, float turbidity, float tds, 
                                           float temperature, int quality_score) {
  bool safe = isQualitySafe(ph, turbidity, tds, temperature);
  
  bool state_changed = false;
  
  // Quality unsafe but valve open -> close it
  if (!safe && current_state == VALVE_OPEN) {
    char reason[256];
    getUnsafeReason(ph, turbidity, tds, temperature, reason);
    
    state_changed = executeStateChange(VALVE_CLOSED, TRIGGER_AUTO_SAFETY, reason);
    Serial.printf("[VALVE] Auto-closed: %s\n", reason);
  }
  
  // Quality safe but valve closed -> try to re-open
  if (safe && current_state == VALVE_CLOSED) {
    state_changed = executeStateChange(VALVE_OPEN, TRIGGER_AUTO_SAFETY, 
                                       "Conditions improved, re-opening valve");
    Serial.println("[VALVE] Auto-opened: conditions improved");
  }
  
  return state_changed;
}

bool ValveController::closeValveRemote(const char* reason) {
  if (isRateLimited()) {
    Serial.println("[VALVE] Rate limited - cannot close valve yet");
    return false;
  }
  
  const char* actual_reason = reason ? reason : "Remote command from operator";
  return executeStateChange(VALVE_CLOSED, TRIGGER_REMOTE_CMD, actual_reason);
}

bool ValveController::openValveRemote(const char* reason) {
  if (isRateLimited()) {
    Serial.println("[VALVE] Rate limited - cannot open valve yet");
    return false;
  }
  
  const char* actual_reason = reason ? reason : "Remote command from operator";
  return executeStateChange(VALVE_OPEN, TRIGGER_REMOTE_CMD, actual_reason);
}

uint32_t ValveController::getSecondsSinceLastToggle() const {
  time_t now = time(NULL);
  if (last_toggle_time == 0) return 0;
  return (uint32_t)(now - last_toggle_time);
}

bool ValveController::isRateLimited() const {
  return getSecondsSinceLastToggle() < (VALVE_DEBOUNCE_MS / 1000);
}

void ValveController::setGPIOState(ValveState state) {
  if (VALVE_NORMALLY_OPEN) {
    // LOW = de-energized = open (failsafe)
    // HIGH = energized = closed
    digitalWrite(VALVE_GPIO_PIN, state == VALVE_CLOSED ? HIGH : LOW);
  } else {
    // Reverse for normally-closed solenoid
    digitalWrite(VALVE_GPIO_PIN, state == VALVE_CLOSED ? LOW : HIGH);
  }
}

bool ValveController::executeStateChange(ValveState new_state, ValveTrigger trigger, 
                                         const char* reason) {
  // Check rate limiting
  if (isRateLimited()) {
    Serial.printf("[VALVE] Rate limited (%u ms remaining)\n", 
                  VALVE_DEBOUNCE_MS - (getSecondsSinceLastToggle() * 1000));
    return false;
  }
  
  // Set GPIO
  setGPIOState(new_state);
  
  // Update state
  current_state = new_state;
  last_toggle_time = time(NULL);
  
  // Store reason if closing
  if (new_state == VALVE_CLOSED) {
    strncpy(close_reason, reason ? reason : "", sizeof(close_reason) - 1);
    close_reason[sizeof(close_reason) - 1] = '\0';
    closed_since_time = last_toggle_time;
  } else {
    memset(close_reason, 0, sizeof(close_reason));
    closed_since_time = 0;
  }
  
  Serial.printf("[VALVE] State changed to %s (trigger: %u, reason: %s)\n", 
                new_state == VALVE_OPEN ? "OPEN" : "CLOSED", 
                trigger, 
                reason ? reason : "N/A");
  
  // Log to SD for offline sync
  // TODO: Implement SD logging
  // ValveOperation op;
  // op.timestamp = last_toggle_time;
  // op.action = new_state;
  // op.triggered_by = trigger;
  // strncpy(op.reason, reason, sizeof(op.reason) - 1);
  // logOperationToSD(op);
  
  return true;
}

void ValveController::logOperationToSD(const ValveOperation& op) {
  // TODO: Implement SD card logging
  // Format: JSON record to queue file on SD
  // Example: {"ts": 1234567890, "action": 0, "trigger": 0, "reason": "..."}
  // This allows offline buffering when device is disconnected
}

void ValveController::periodicCheck() {
  // Called periodically (e.g., every 5 seconds from FreeRTOS task)
  // If valve closed for >VALVE_STAY_CLOSED_MIN, alert backend (via next telemetry)
  // If conditions now safe, re-open valve
  
  if (current_state == VALVE_CLOSED && closed_since_time > 0) {
    time_t now = time(NULL);
    uint32_t closed_sec = (uint32_t)(now - closed_since_time);
    uint32_t closed_min = closed_sec / 60;
    
    if (closed_min >= VALVE_STAY_CLOSED_MIN) {
      // TODO: Set a flag to alert backend on next telemetry
      Serial.printf("[VALVE] WARNING: Valve closed for %u minutes\n", closed_min);
    }
  }
}
