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
