# Backend Specification

## Purpose
Ingest, authenticate, store, process, and serve water monitoring data from multiple devices.

## Recommended Stack

1. API: FastAPI (or Express)
2. Database: PostgreSQL
3. Broker: MQTT (Mosquitto/EMQX)
4. Deployment: Docker Compose

## Core Modules

1. `ingestion-service` for POST and MQTT data intake
2. `auth-service` for device API key validation
3. `processing-service` for score and alert generation
4. `query-service` for dashboard APIs

## API Contract

### POST /data

Purpose: Receive one or many sensor payloads.

Request body:

```json
{
  "device_id": "HYDRO_001",
  "ph": 7.2,
  "turbidity": 3.1,
  "tds": 120,
  "temperature": 25,
  "flow_rate": 10,
  "timestamp": "2026-04-09T10:30:00Z",
  "seq_no": 9821
}
```

Response:

```json
{
  "ok": true,
  "accepted": 1,
  "rejected": 0
}
```

### GET /devices
Returns all devices with metadata and health state.

### GET /data/:device_id
Returns readings for device filtered by optional `from`, `to`, and `limit`.

### GET /status
Returns backend and broker health plus active devices summary.

## Database Schema

### devices

1. `device_id` text primary key
2. `name` text
3. `location` text
4. `status` text check in (`online`, `offline`)
5. `last_seen` timestamptz
6. `api_key_hash` text
7. `created_at` timestamptz default now()

### sensor_data

1. `id` bigserial primary key
2. `device_id` text references devices(device_id)
3. `ph` double precision
4. `turbidity` double precision
5. `tds` double precision
6. `temperature` double precision
7. `flow_rate` double precision
8. `quality_score` integer
9. `anomaly_flags` jsonb
10. `timestamp` timestamptz
11. `seq_no` bigint
12. unique (`device_id`, `seq_no`)

### alerts

1. `id` bigserial primary key
2. `device_id` text references devices(device_id)
3. `severity` text
4. `message` text
5. `triggered_at` timestamptz
6. `reading_timestamp` timestamptz

Indexes:

1. `sensor_data(device_id, timestamp desc)`
2. `sensor_data(timestamp desc)`
3. `alerts(device_id, triggered_at desc)`

## Quality Score Logic (Rule-Based)

Example baseline thresholds:

1. Safe pH: 6.5 to 8.5
2. Safe turbidity: <= 5 NTU
3. Safe TDS: <= 300 ppm

Scoring strategy:

1. Start at 100.
2. Subtract weighted penalties for out-of-range values.
3. Clamp to 0 to 100.

## Device Status Logic

1. Mark `online` when data or heartbeat received within last 2 minutes.
2. Mark `offline` otherwise.

## Security Controls

1. API key in header (`x-api-key`) or JWT device token.
2. Validate payload schema strictly.
3. Rate limit by device ID and IP.
4. Enable HTTPS/TLS in deployment.

## Docker Services

1. `api`
2. `worker`
3. `postgres`
4. `mqtt`
5. `frontend`
