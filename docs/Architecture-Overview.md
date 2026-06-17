# Hydronix Architecture Overview

## High-Level Architecture

Hydronix has four layers:

1. Edge devices (ESP32 nodes with sensors and local persistence)
2. Transport (MQTT preferred, HTTP fallback)
3. Central backend (ingestion, storage, analytics, APIs)
4. Web dashboard (monitoring and insights)

## Component Breakdown

### 1. Edge Device Layer

Each ESP32 node includes:

1. Sensor acquisition module
2. Local display module
3. Network manager (WiFi + reconnect)
4. Transport client (MQTT/HTTP)
5. Local queue and SD writer
6. Sync worker for offline payload replay

### 2. Backend Layer

Backend services:

1. Ingestion API/MQTT consumer
2. Auth and validation middleware
3. Device registry and status tracker
4. Sensor data repository
5. Rule engine (score + anomaly detection)
6. Dashboard API service

### 3. Frontend Layer

Dashboard modules:

1. Device list and status cards
2. Device detail page
3. Real-time metrics panel
4. Historical chart views
5. Alerts feed
6. Comparison and filters

## Scalability Strategy

1. Decouple ingestion from processing via queue or stream.
2. Partition time-series data by date and device.
3. Add indexes for `device_id` and `timestamp`.
4. Use horizontal scaling for API and broker.

## Reliability Strategy

1. Offline-first device buffering.
2. Idempotent ingestion endpoint (avoid duplicate writes).
3. Retry with exponential backoff.
4. Health checks for server and broker.

## Security Strategy

1. Device-level API keys/tokens.
2. Signed device requests where feasible.
3. TLS for transport.
4. Input validation and request throttling.

## Data Flow Diagrams

### Normal Operation: Sensor Ingestion & Water Quality Monitoring

```
┌─────────────────────────────────────────────────────────────────┐
│ ESP32 Device (Edge Layer)                                       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ task_sensor_read (every 60 sec):                            │ │
│ │  - pH sensor     → 7.2                                      │ │
│ │  - Turbidity     → 3.1 NTU                                  │ │
│ │  - TDS           → 120 ppm                                  │ │
│ │  - Temperature   → 25.0°C                                   │ │
│ │  - Flow rate     → 10.5 L/min                               │ │
│ └─────────────────────────────────────────────────────────────┘ │
│              ↓                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ task_valve_control (every 5 sec):                           │ │
│ │  Evaluate thresholds:                                       │ │
│ │   pH 6.5-8.5 ✓ | Turbidity ≤5.0 ✓ | TDS ≤500 ✓             │ │
│ │   Temp 5-50°C ✓                                             │ │
│ │                                                             │ │
│ │  Decision: SAFE → Keep valve OPEN                           │ │
│ │  (Set valve_state = "open" in payload)                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│              ↓                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Telemetry Payload (JSON):                                   │ │
│ │ {                                                           │ │
│ │   "device_id": "HYDRO_001",                                │ │
│ │   "ph": 7.2, "turbidity": 3.1, "tds": 120,                │ │
│ │   "temperature": 25.0, "flow_rate": 10.5,                 │ │
│ │   "valve_state": "open",                  ← NEW             │ │
│ │   "valve_last_toggled": "2026-04-09T10:25:00Z", ← NEW      │ │
│ │   "timestamp": "2026-04-09T10:30:00Z"                      │ │
│ │ }                                                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│              ↓                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ task_uplink_sender (MQTT or HTTP):                          │ │
│ │  MQTT: Publish to hydronix/devices/HYDRO_001/data         │ │
│ │  HTTP: POST /ingest                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         ↓ MQTT / HTTP
┌─────────────────────────────────────────────────────────────────┐
│ Backend (Central Layer)                                         │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ POST /ingest (or MQTT Consumer)                             │ │
│ │  1. Validate API key & signature                            │ │
│ │  2. Parse sensor readings                                   │ │
│ │  3. Compute water quality score (0-100)                     │ │
│ │  4. Check ML anomaly detection (Phase 2+)                   │ │
│ │  5. Store SensorData row with valve_state                   │ │
│ │  6. Trigger rules engine                                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│              ↓                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Rules Engine:                                               │ │
│ │  - Evaluate quality_score vs alert thresholds               │ │
│ │  - If critical (quality < 30): ALERT                        │ │
│ │  - If warning (30-60): WARN                                 │ │
│ │  - If OK (60+): NO ALERT                                    │ │
│ │  - Log valve state change (if valve_state changed)         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│              ↓                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ WebSocket Broadcast:                                        │ │
│ │  Send to dashboard: {"device_id", "valve_state", "quality"} │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Frontend Dashboard (Display Layer)                              │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Device Detail Card:                                         │ │
│ │  Device: HYDRO_001 | Status: Online                         │ │
│ │  Water Quality: 75/100 ✓ GOOD                               │ │
│ │  Valve Status: OPEN | Last Toggled: 10:25 AM                │ │
│ │  [Manual Close] [Manual Open] [History]                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Automatic Safety Cutoff: Out-of-Threshold Response

```
┌──────────────────────────────────────────────────────────────────┐
│ ESP32 Device (Edge Layer) — Safety Triggered                    │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ task_sensor_read:  pH sensor reading 6.0 (BELOW 6.5 min)   │ │
│ └──────────────────────────────────────────────────────────────┘ │
│              ↓                                                    │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ task_valve_control (immediate):                              │ │
│ │  Check thresholds:                                           │ │
│ │   pH 6.0 < 6.5 ✗ VIOLATION!                                  │ │
│ │                                                              │ │
│ │  Action:                                                    │ │
│ │   1. Set valve_status = "closed"                            │ │
│ │   2. Set GPIO 27 = HIGH (energize relay)                    │ │
│ │   3. Log to SD: {action: "close", triggered_by:             │ │
│ │      "auto_safety_cutoff", reason: "pH too low (6.0)"}      │ │
│ │   4. Set valve_state = "closed" in next payload             │ │
│ │   5. Rate-limit next toggle to 2 seconds                    │ │
│ │   6. Start auto-reopen timer (check every 1 min)            │ │
│ └──────────────────────────────────────────────────────────────┘ │
│              ↓                                                    │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Next Telemetry Payload:                                      │ │
│ │ {                                                            │ │
│ │   "device_id": "HYDRO_001",                                │ │
│ │   "ph": 6.0, "turbidity": 3.1, "tds": 120,                │ │
│ │   "temperature": 25.0, "flow_rate": 0,                     │ │
│ │   "valve_state": "closed",         ← CHANGED                │ │
│ │   "valve_last_toggled": "2026-04-09T10:31:00Z", ← UPDATED  │ │
│ │   "timestamp": "2026-04-09T10:31:00Z"                      │ │
│ │ }                                                            │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
         ↓ MQTT / HTTP
┌──────────────────────────────────────────────────────────────────┐
│ Backend (Central Layer) — Intake & Audit Logging               │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ POST /ingest:                                                │ │
│ │  1. Detect valve_state changed (closed)                      │ │
│ │  2. Log ValveOperation audit record:                         │ │
│ │     {device_id: "HYDRO_001",                                │ │
│ │      action: "close",                                       │ │
│ │      triggered_by: "auto_safety_cutoff",                    │ │
│ │      reason: "pH too low (6.0)",                            │ │
│ │      quality_score_at_trigger: 5,                           │ │
│ │      timestamp: <device-reported time>,                     │ │
│ │      received_at: <server time>}                            │ │
│ │  3. Update Device.valve_status = "closed"                   │ │
│ │  4. Create CRITICAL alert:                                  │ │
│ │     "Water pH 6.0 critical; solenoid valve auto-closed"     │ │
│ └──────────────────────────────────────────────────────────────┘ │
│              ↓                                                    │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ WebSocket Broadcast Alert:                                   │ │
│ │  {"device_id": "HYDRO_001",                                 │ │
│ │   "alert_type": "critical",                                 │ │
│ │   "message": "Valve auto-closed: pH too low (6.0)",         │ │
│ │   "valve_state": "closed",                                  │ │
│ │   "quality_score": 5}                                       │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────────┐
│ Frontend Dashboard (Display Layer) — Operator Alerted           │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Alerts Feed:                                                 │ │
│ │   🚨 CRITICAL [10:31 AM]                                    │ │
│ │   Device: HYDRO_001                                         │ │
│ │   Valve auto-closed: pH too low (6.0)                       │ │
│ │   Quality Score: 5/100 (CRITICAL)                           │ │
│ │   [Acknowledge] [View Device] [History]                     │ │
│ │                                                              │ │
│ │ Device Status Card:                                          │ │
│ │   HYDRO_001 | Status: ⚠️  ALARM                              │ │
│ │   Valve: CLOSED (auto-safety) | Last: 10:31 AM              │ │
│ │   pH: 6.0 ✗ [6.5-8.5] | Quality: 5/100                     │ │
│ │   [Manual Open] [Reset Alarm]                               │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Manual Valve Control: Operator-Initiated Command

```
┌──────────────────────────────────────────────────────────────────┐
│ Frontend Dashboard (Display Layer)                              │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Device Detail: HYDRO_001                                    │ │
│ │  Valve Status: CLOSED (auto-safety)                          │ │
│ │  [Manual Open] ← User clicks                                │ │
│ │  Reason: [Required] "Conditions improving, manual restore"  │ │
│ │  [Confirm] [Cancel]                                         │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
         ↓ HTTP POST
┌──────────────────────────────────────────────────────────────────┐
│ Backend (Central Layer) — Manual Command Intake                 │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ POST /devices/HYDRO_001/valve/open                           │ │
│ │ Headers: Authorization: Bearer <token>                       │ │
│ │ Body: {reason: "Conditions improving, manual restore",       │ │
│ │        operator_id: "admin@hydronix.local"}                  │ │
│ │                                                              │ │
│ │ ValveController.execute_valve_action():                      │ │
│ │  1. Check rate limit (2-sec lockout) — PASS                 │ │
│ │  2. Verify device exists — PASS                             │ │
│ │  3. Execute toggle:                                          │ │
│ │     - Update Device.valve_status = "open"                   │ │
│ │     - Create ValveOperation audit record:                    │ │
│ │       {action: "open",                                      │ │
│ │        triggered_by: "manual_operator",                     │ │
│ │        reason: "Conditions improving, manual restore",      │ │
│ │        operator_id: "admin@hydronix.local",                 │ │
│ │        timestamp: now()}                                    │ │
│ │  4. Send MQTT remote command to device (async):             │ │
│ │     Topic: hydronix/devices/HYDRO_001/valve/command         │ │
│ │     Payload: {action: "open", operator_id: "admin@..."}     │ │
│ │  5. Return 200 response                                      │ │
│ └──────────────────────────────────────────────────────────────┘ │
│              ↓                                                    │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ WebSocket Broadcast:                                         │ │
│ │  {device_id: "HYDRO_001",                                   │ │
│ │   valve_status: "open",                                     │ │
│ │   triggered_by: "manual_operator",                          │ │
│ │   operator: "admin@hydronix.local",                         │ │
│ │   timestamp: "2026-04-09T10:35:00Z"}                        │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
         ↓ (async)
┌──────────────────────────────────────────────────────────────────┐
│ ESP32 Device (Edge Layer) — Remote Command Received            │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ MQTT Subscription: hydronix/devices/HYDRO_001/valve/command │ │
│ │ Message Received: {action: "open", operator_id: "admin..."}  │ │
│ │                                                              │ │
│ │ task_valve_control (next cycle):                             │ │
│ │  1. Validate command signature (HMAC)                        │ │
│ │  2. Execute toggle:                                          │ │
│ │     - Set GPIO 27 = LOW (de-energize relay)                 │ │
│ │     - Valve opens (normally-open failsafe)                  │ │
│ │     - Set valve_state = "open"                              │ │
│ │     - Log to SD queue                                        │ │
│ │  3. Publish confirmation:                                    │ │
│ │     Topic: hydronix/devices/HYDRO_001/valve/status          │ │
│ │     Payload: {valve_state: "open", timestamp: ...}          │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
         ↓ (next sensor read cycle)
         Next telemetry includes valve_state: "open" (syncs frontend state)
```

## Failure Scenarios & Recovery

| Scenario | Device Behavior | Backend Behavior | Dashboard Display |
|----------|-----------------|------------------|------------------|
| **Network Down (device offline)** | Buffers readings & valve ops to SD card | Marks device offline after heartbeat timeout | "Offline" badge, cached last state |
| **Valve GPIO Fails** | Logs error, retries up to 3x, alerts (valve_state stuck) | Detects no state change after cmd, escalates | "Valve Malfunction" alert |
| **Simultaneous Auto + Manual** | Auto-close wins (rate limit); manual queued | Merge both operations into audit log | Shows both in history timeline |
| **Power Loss** | Valve remains OPEN (normally-open failsafe) | N/A | "Valve Safe: Device Powered Off" |
| **Backend Valve API Down** | Device continues local auto-cutoff; stores remote cmd fails | Valve endpoint 500; alert user | Manual control disabled (API down indicator) |
| **Rate Limit Exceeded** | Action rejected, queued for next window | API returns 429 Too Many Requests | Toast: "Command rate limited, try in 2s" |