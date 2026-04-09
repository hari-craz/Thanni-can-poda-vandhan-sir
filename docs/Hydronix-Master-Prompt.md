# Hydronix - Improved Project Prompt

## Project Title
Hydronix - Smart Water Monitoring and Management Platform

## One-Line Pitch
Hydronix is a scalable smart water monitoring platform that connects multiple ESP32 sensor devices to a central system, providing real-time and historical water quality insights with reliable offline support.

## Objective
Design and build a production-ready, full-stack IoT platform that:

1. Ingests water quality data from multiple ESP32 field devices.
2. Stores and processes time-series sensor data reliably.
3. Provides real-time and historical monitoring through a modern web dashboard.
4. Supports intermittent connectivity through offline buffering and delayed sync.
5. Enables secure multi-device operations at scale.

## Core Components

1. Edge Layer: ESP32 device firmware and local config portal.
2. Communication Layer: MQTT preferred (HTTP fallback).
3. Backend Layer: API, ingestion, processing, status tracking, and storage.
4. Frontend Layer: Web dashboard for operations and analytics.

## Functional Requirements

### A. Edge Device (ESP32)

Each device must:

1. Read sensors at fixed intervals.
2. Display live readings on LCD/OLED.
3. Send data to server when online.
4. Save payloads to SD card when offline.
5. Auto-sync buffered data after reconnect.
6. Include unique `device_id` (for example, `HYDRO_001`).
7. Optionally include per-device API key.

Sensors:

1. pH
2. Temperature
3. Turbidity
4. TDS
5. Flow rate

Hardware support:

1. SD card module
2. Battery backup
3. Display module

### B. Device Configuration Portal

The ESP32 must expose a setup portal via AP mode:

1. AP SSID: `Hydronix_Setup`
2. Local setup page on `192.168.4.1`

Configurable fields:

1. WiFi SSID and password
2. Server host or domain
3. Server port
4. Protocol mode (MQTT/HTTP)
5. Device ID
6. API key (optional)

Portal features:

1. Connection status
2. Signal strength indicator
3. Save and restart
4. Factory reset
5. Optional OTA update

### C. Communication Rules

1. JSON payload format.
2. ISO-8601 timestamp in every payload.
3. Retry with backoff for failed sends.
4. Reconnect automatically to WiFi and broker/server.
5. Preserve payload ordering during offline sync.

Reference payload:

```json
{
  "device_id": "HYDRO_001",
  "ph": 7.2,
  "turbidity": 3.1,
  "tds": 120,
  "temperature": 25,
  "flow_rate": 10,
  "timestamp": "2026-04-09T10:30:00Z"
}
```

### D. Backend Responsibilities

1. Accept and validate data from many devices.
2. Authenticate devices.
3. Store raw and processed metrics.
4. Track live status (`online`/`offline`) and `last_seen`.
5. Compute quality score and anomaly flags.
6. Provide APIs for dashboard consumption.

Minimum APIs:

1. `POST /data`
2. `GET /devices`
3. `GET /data/:device_id`
4. `GET /status`

Suggested stack:

1. FastAPI or Express
2. PostgreSQL (or InfluxDB for high-scale time-series)
3. Docker + Docker Compose

### E. Data Intelligence

1. Compute water quality score per reading.
2. Detect unsafe ranges for pH, turbidity, and TDS.
3. Generate alerts and expose alert feed.

Optional:

1. Trend forecasting
2. Flow-based usage pattern analysis

### F. Frontend Dashboard

1. Multi-device overview cards.
2. Device health and online status.
3. Live readings.
4. Historical charts.
5. Quality score visualization.
6. Alert panel.
7. Time-range filters.
8. Compare devices.
9. Mobile-first responsive behavior.

Visual direction:

1. Blue and cyan water-tech palette.
2. Clean card grid.
3. Clear hierarchy and status indicators.

### G. Reliability and Security

Reliability:

1. ESP32 local buffering with SD card.
2. Automatic reconnect and resend.
3. Graceful handling of intermittent network failures.

Security:

1. API key or token auth per device.
2. Request validation and rate limiting.
3. Optional HTTPS and TLS.

### H. Deployment

1. Field-deployed ESP32 devices.
2. Central backend on cloud or home server.
3. Dashboard served via browser.
4. Containerized deployment pipeline.

## Expected Deliverables

1. ESP32 firmware with sensor ingestion, AP setup portal, offline buffering, and sync.
2. Backend services with APIs, storage, processing, and alerting.
3. Frontend dashboard with real-time + historical monitoring.
4. End-to-end validated flow from sensor to visualization.
