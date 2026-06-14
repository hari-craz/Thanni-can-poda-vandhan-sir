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

### POST /devices/:device_id/heartbeat

Purpose: Device sends periodic heartbeat to indicate it's alive.

Request body:
```json
{
  "device_id": "HYDRO_001",
  "status": "online",
  "signal_strength": -65,
  "sd_usage_percent": 45,
  "uptime_seconds": 864000,
  "firmware_version": "1.2.3",
  "last_reading_at": "2026-06-14T21:00:00Z"
}
```

Response:
```json
{
  "ok": true,
  "server_timestamp": "2026-06-14T21:00:15Z"
}
```

### POST /devices/provision

Purpose: Provision a new device (create API key, return QR code).

Request: Admin token required
Response:
```json
{
  "device_id": "HYDRO_001",
  "api_key": "hydro_1a2b3c4d5e6f...",
  "qr_code": "data:image/png;base64,iVBORw0KGgo...",
  "setup_url": "http://192.168.4.1?key=hydro_1a2b3c4d5e6f..."
}
```

### POST /alerts/:id/acknowledge

Purpose: Mark an alert as acknowledged by user.

Request body:
```json
{
  "user_id": "user_123",
  "acknowledgement_message": "Checking the device now"
}
```

Response:
```json
{
  "ok": true,
  "acknowledged_at": "2026-06-14T21:00:00Z"
}
```

### GET /alerts?escalation_level=2&status=pending

Purpose: Get alerts by severity/status (for escalation workflow).

Response:
```json
{
  "alerts": [
    {
      "id": 1,
      "device_id": "HYDRO_001",
      "severity": "critical",
      "escalation_level": 2,
      "message": "pH out of safe range (9.2)",
      "triggered_at": "2026-06-14T20:00:00Z",
      "acknowledged_by": null,
      "minutes_unacknowledged": 45
    }
  ]
}
```

### POST /devices/:device_id/keys/rotate

Purpose: Rotate device API key (revoke old, issue new).

Request: Admin token required
Response:
```json
{
  "new_key": "hydro_...",
  "old_key_revoked_in": 7,
  "old_key_expires_at": "2026-06-21T21:00:00Z"
}
```

### GET /anomalies?device_id=HYDRO_001&limit=100

Purpose: Get readings flagged as anomalous by rule engine or ML.

Response:
```json
{
  "anomalies": [
    {
      "id": 123,
      "device_id": "HYDRO_001",
      "timestamp": "2026-06-14T21:00:00Z",
      "values": {"ph": 9.2, "turbidity": 15},
      "anomaly_flags": {
        "out_of_range": true,
        "stuck": false,
        "outlier": true,
        "ml_score": 0.87,
        "reasons": ["pH exceeded max", "3σ outlier from fleet"]
      }
    }
  ]
}
```

### GET /devices/:device_id/calibration-status

Purpose: Check if device needs calibration.

Response:
```json
{
  "device_id": "HYDRO_001",
  "last_calibration_at": "2026-05-14T10:00:00Z",
  "calibration_due_in_days": 16,
  "needs_calibration": false,
  "calibration_overdue": false
}
```

### POST /predict (Phase 2+: ML Anomaly Detection)

**Status**: Research phase (62.5% accuracy, production-ready pending improvement)  
**When to use**: Secondary signal for anomaly flagging (not primary alerts)

Purpose: Predict if a sensor reading is anomalous using ML ensemble.

Request body:
```json
{
  "device_id": "HYDRO_001",
  "ph": 7.2,
  "hardness": 120,
  "solids": 18000,
  "chloramines": 8.5,
  "sulfate": 361,
  "conductivity": 348,
  "organic_carbon": 8.5,
  "trihalomethanes": 49,
  "turbidity": 4.7
}
```

Response (confidence ≥ 65% required for action):
```json
{
  "device_id": "HYDRO_001",
  "is_anomaly": false,
  "confidence": 0.78,
  "ml_score": 0,
  "timestamp": "2026-06-14T21:43:00Z",
  "model_version": "v1.0",
  "decision_reason": "Reading is normal (confidence: 0.78)"
}
```

**Field Definitions**:
- `is_anomaly` (bool): True if anomaly detected AND confidence ≥ 0.65
- `confidence` (0-1): Prediction confidence (higher = more certain)
- `ml_score` (0|1): Raw ensemble prediction (0=normal, 1=anomaly)
- `model_version`: Which ML model version made prediction

**Integration Notes**:
- Call after rule-based scoring (not instead of)
- Only flag if `is_anomaly == true` (confidence threshold already applied)
- Log all predictions to `ml_anomalies` table for monitoring
- Update `/anomalies` endpoint to include `ml_score` and `ml_confidence`

**Current Limitations**:
- 62.5% accuracy (pending feature engineering improvements)
- Requires 9 water quality features (pH, hardness, solids, chloramines, sulfate, conductivity, organic carbon, trihalomethanes, turbidity)
- Works for research/offline analysis; defer to Phase 3 for production alerts



### Schema Validation

All POST /data payloads must match this schema (reject 400 if invalid):

```json
{
  "type": "object",
  "required": ["device_id", "timestamp", "ph", "turbidity", "tds", "temperature", "flow_rate"],
  "properties": {
    "device_id": {"type": "string", "pattern": "^HYDRO_[0-9]{3}$"},
    "ph": {"type": "number", "minimum": 0, "maximum": 14},
    "turbidity": {"type": "number", "minimum": 0, "maximum": 1000},
    "tds": {"type": "number", "minimum": 0, "maximum": 10000},
    "temperature": {"type": "number", "minimum": -50, "maximum": 150},
    "flow_rate": {"type": "number", "minimum": 0, "maximum": 10000},
    "timestamp": {"type": "string", "format": "date-time"},
    "seq_no": {"type": "integer", "minimum": 0},
    "raw_ph": {"type": "number"}
  }
}
```

Validation response on error:
```json
{
  "ok": false,
  "error": "Validation error",
  "details": {
    "field": "ph",
    "reason": "ph must be between 0 and 14",
    "value": 15.5
  }
}
```

### Rate Limiting

- **Per-device**: 100 requests/minute (429 if exceeded)
- **Per-IP**: 10,000 requests/hour (429 if exceeded)
- Response headers:
  ```
  RateLimit-Limit: 100
  RateLimit-Remaining: 42
  RateLimit-Reset: 1687123215
  ```

### Authentication

Header: `Authorization: Bearer <JWT>` OR `X-API-Key: <api_key>`

Validation:
- JWT: verify signature + expiry
- API key: lookup in `api_keys` table, check `is_active` and `expires_at`
- Return 401 if invalid/expired

### CORS

- Allowed origins: `https://dashboard.hydronix.local` (configurable)
- Allowed methods: GET, POST, PATCH, DELETE
- Allowed headers: Content-Type, Authorization, X-API-Key
- Credentials: true (for dashboard session cookies)

## Quality Score Logic (Rule-Based)

Example baseline thresholds:

1. Safe pH: 6.5 to 8.5
2. Safe turbidity: <= 5 NTU
3. Safe TDS: <= 300 ppm
4. Safe temperature: 5°C to 45°C
5. Safe flow rate: 0 to 100 L/min

Scoring strategy:

1. Start at 100.
2. Range penalties:
   - pH <6.5: -20 points/0.5 below (min -40)
   - pH >8.5: -20 points/0.5 above (min -40)
   - Turbidity >5: -30 points (more critical than pH)
   - TDS >300: -15 points
3. Anomaly penalties:
   - Out-of-range reading: -10 points
   - Stuck sensor (no change 24h): -25 points
   - Statistical outlier (>3σ): -20 points
4. Clamp result to 0-100.

Alert triggers:
- Score < 50: WARNING alert
- Score < 30: CRITICAL alert
- Score < 10: EMERGENCY alert

## Device Status Logic

1. Mark `online` when data or heartbeat received within last 120 seconds.
2. Mark `offline` if no data/heartbeat for 120+ seconds.
3. Alert escalation:
   - Device offline for 5 minutes: notify primary user
   - Offline for 15 minutes: escalate to operator
   - Offline for 60 minutes: escalate to admin

## Security Controls

1. **API Key Strategy**:
   - Store only key hash (bcrypt with salt 12)
   - Issue new keys via `/devices/provision` (admin only)
   - Keys expire after 90 days (or custom interval)
   - Key rotation: `/devices/:device_id/keys/rotate` — old key valid 7 days grace
   - Revocation: `/devices/:device_id/keys/:key_id` DELETE

2. **Request Validation**:
   - Strict schema validation (reject 400 if invalid type/format)
   - Never coerce types or silently drop fields
   - Log all rejections with device_id + timestamp
   - Alert if single device rejects >10 payloads in 1 hour

3. **Rate Limiting**:
   - Per-device: 100 req/minute
   - Per-IP: 10k req/hour
   - Implementation: Redis sliding window counter
   - Return 429 Too Many Requests + Retry-After header

4. **Transport Security**:
   - HTTPS/TLS required for production
   - Certificate pinning on devices (optional Phase 2)
   - MQTT: TLS on port 8883, MQTT unencrypted on port 1883 (local networks only)

5. **Authorization**:
   - Devices can only access their own data (POST /data, GET /data/:device_id where device matches JWT)
   - Dashboard users filtered by role + device assignments (RBAC)
   - Admin: all access
   - Operator: read all, acknowledge alerts
   - Viewer: read-only

6. **Audit Logging**:
   - Log all auth failures + invalid payloads
   - Log all key rotations, device registrations, alert acknowledgements
   - Table: `audit_logs(user_id, action, resource_type, resource_id, created_at)`

## Docker Services

1. `api` — FastAPI/Express server (port 8000)
2. `worker` — Async job processor (score calculation, alerts, notifications)
3. `postgres` — Time-series database (port 5432)
4. `mqtt` — EMQX broker cluster (port 1883, 8883)
5. `redis` — Cache + rate limiting (port 6379)
6. `frontend` — React/Vite dashboard (port 3000)
7. `prometheus` — Metrics (Phase 2, port 9090)
8. `loki` — Log aggregation (Phase 2, port 3100)

## Database Schema

### devices

1. `device_id` text primary key (pattern: `HYDRO_\d{3}`)
2. `name` text
3. `location` text
4. `status` text check in (`online`, `offline`)
5. `last_seen` timestamptz
6. `last_heartbeat` timestamptz
7. `last_calibration_at` timestamptz
8. `calibration_interval_days` integer default 30
9. `is_active` boolean default true (soft delete)
10. `firmware_version` text
11. `device_reset_count` integer default 0 (for seq_no wrapping)
12. `created_at` timestamptz default now()
13. `updated_at` timestamptz default now()

### api_keys

1. `id` bigserial primary key
2. `device_id` text references devices(device_id)
3. `key_hash` text unique not null
4. `name` text
5. `expires_at` timestamptz (default 90 days from creation)
6. `created_at` timestamptz default now()
7. `revoked_at` timestamptz
8. `is_active` boolean default true

### sensor_data

1. `id` bigserial primary key
2. `device_id` text references devices(device_id)
3. `device_reset_count` integer (for deduplication with seq_no)
4. `ph` double precision
5. `turbidity` double precision
6. `tds` double precision
7. `temperature` double precision
8. `flow_rate` double precision
9. `raw_ph` double precision (unsmoothed firmware reading for diagnostics)
10. `quality_score` integer (0-100)
11. `anomaly_flags` jsonb (e.g. `{"out_of_range": true, "stuck": false, "outlier": true}`)
12. `timestamp` timestamptz (device UTC timestamp)
13. `received_at` timestamptz (server receive time)
14. `timestamp_source` text check in (`device`, `server_adjusted`, `server_only`)
15. `seq_no` bigint
16. `trace_id` uuid (for debugging request flow)
17. unique (`device_id`, `device_reset_count`, `seq_no`)

### alerts

1. `id` bigserial primary key
2. `device_id` text references devices(device_id)
3. `severity` text check in (`warning`, `critical`, `emergency`)
4. `message` text
5. `triggered_at` timestamptz default now()
6. `reading_timestamp` timestamptz
7. `is_resolved` boolean default false
8. `acknowledged_by` text (user_id who acknowledged)
9. `acknowledged_at` timestamptz
10. `resolved_by` text
11. `resolved_at` timestamptz
12. `escalation_level` integer default 1 (1=warning, 2=critical, 3=emergency)

### notifications

1. `id` bigserial primary key
2. `alert_id` bigint references alerts(id)
3. `user_id` text
4. `channel` text check in (`email`, `sms`, `slack`, `webhook`)
5. `status` text check in (`pending`, `sent`, `failed`, `read`)
6. `message_body` text
7. `created_at` timestamptz default now()
8. `sent_at` timestamptz
9. `read_at` timestamptz

### users

1. `id` text primary key (UUID)
2. `email` text unique
3. `name` text
4. `role` text check in (`admin`, `operator`, `viewer`)
5. `password_hash` text
6. `is_active` boolean default true
7. `created_at` timestamptz default now()
8. `last_login_at` timestamptz

### device_access

1. `user_id` text references users(id)
2. `device_id` text references devices(device_id)
3. `primary key (user_id, device_id)`

### audit_logs

1. `id` bigserial primary key
2. `user_id` text references users(id)
3. `action` text (e.g. "key_rotated", "alert_acknowledged", "device_deregistered")
4. `resource_type` text (e.g. "device", "alert", "api_key")
5. `resource_id` text
6. `details` jsonb
7. `created_at` timestamptz default now()

### ml_anomalies (Phase 2+: ML Prediction Tracking)

1. `id` bigserial primary key
2. `device_id` text references devices(device_id)
3. `reading_id` bigint references sensor_data(id)
4. `ml_score` integer (0=normal, 1=anomaly)
5. `confidence` double precision (0-1, higher = more certain)
6. `model_version` text (e.g. "v1.0")
7. `anomaly_reason` jsonb (e.g. `{"features": ["pH_deviation", "conductivity"], "outlier_scores": {...}}`)
8. `alert_triggered` boolean (did this generate an alert?)
9. `alert_id` bigint references alerts(id)
10. `prediction_timestamp` timestamptz
11. `created_at` timestamptz default now()

**Purpose**: Audit trail for ML predictions, monitor model accuracy

Indexes:

1. `sensor_data(device_id, timestamp desc)`
2. `sensor_data(timestamp desc)`
3. `sensor_data(device_id, device_reset_count, seq_no)` — unique key
4. `sensor_data(received_at desc)` — for pagination
5. `alerts(device_id, triggered_at desc)`
6. `alerts(escalation_level, acknowledged_at)` — for escalation workflow
7. `notifications(alert_id, status)`
8. `api_keys(key_hash)` — for auth lookup
9. `audit_logs(user_id, created_at)` — compliance auditing

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
