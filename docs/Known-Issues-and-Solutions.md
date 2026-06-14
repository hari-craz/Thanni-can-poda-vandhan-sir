# Known Issues and Solutions — Hydronix

This document catalogs all identified risks in the Hydronix architecture and their mitigations.

---

## Issue 1: Device Management & Scale

### Problem
- No clear process for onboarding thousands of devices (how to generate/distribute API keys?)
- No firmware update strategy (devices stuck on buggy versions)
- No deregistration process (orphaned devices keep sending data)

### Solution
- **API Key Provisioning**: Implement device provisioning endpoint (`POST /devices/provision`) that:
  - Generates unique, cryptographically secure API keys
  - Returns QR code with `device_id` + key for easy setup portal scanning
  - Records key hash in database (never store plaintext)
  - Supports key expiry and rotation (default 90 days)
- **Firmware Updates**: Phase 2 feature (see Implementation-Roadmap.md)
  - Implement signed OTA via `POST /devices/:device_id/firmware`
  - Store current firmware version in `devices.firmware_version` field
  - Phase 1: manual updates via setup portal + USB
- **Device Deregistration**:
  - Add `is_active` boolean to `devices` table (soft delete)
  - Endpoint: `DELETE /devices/:device_id` marks `is_active = false`
  - Cleanup task: Archive inactive devices after 30 days
  - Devices can re-register via provisioning flow

---

## Issue 2: Data Consistency & Deduplication

### Problem
- `seq_no` counter wraps after ~2 billion messages (only 32-bit mentioned, schema uses 64-bit)
- ESP32 clock drifts (no NTP). Same reading appears multiple times with different timestamps
- SD queue corruption if power lost mid-write

### Solution
- **seq_no Strategy**:
  - Enforce 64-bit signed bigint (already in schema ✓)
  - Add device reset logic: when device reboots, firmware increments `device_reset_count` + resets `seq_no` to 0
  - Backend deduplicates on unique key: `(device_id, device_reset_count, seq_no)`
  - Store `device_reset_count` in `sensor_data` table
  - Max 2^63 resets = ~9 billion years per device before wrapping
  
- **Clock Drift Handling**:
  - Firmware: Implement NTP sync at boot and every 24 hours
  - Fallback: Use millis() since boot, backend adjusts timestamp based on server receive time
  - Add `received_at` (server timestamp) to `sensor_data` table
  - Deduplication window: same reading within ±5 minutes of last identical reading from same device = duplicate
  - Add `timestamp_source` field: `"device"`, `"server_adjusted"`, or `"server_only"`

- **SD Queue Integrity**:
  - Write queue file with transaction markers: `[START]`, `[JSON]`, `[CHECKSUM]`, `[END]`
  - On recovery, skip incomplete records (malformed JSON or missing checksum)
  - Use atomic file operations (write to temp, move to final)
  - Add queue file versioning to handle format changes

---

## Issue 3: Broker & Network Reliability

### Problem
- Single MQTT broker = single point of failure (complete blackout if crashes)
- Network partition: devices buffer forever if connection lost
- HTTP fallback unspecified (polling interval? backoff strategy?)

### Solution
- **MQTT Broker HA**:
  - **Recommended**: EMQX cluster with 3+ nodes (built-in clustering)
  - Load balancer (HAProxy/Nginx) in front with health checks
  - Each node stores persistent session state
  - Auto-failover: client reconnects to next broker in list (already supported by clients)
  - Implement broker health check: ESP32 pings broker every 30s, raises alert if no response for 2 minutes

- **Network Partition Handling**:
  - SD queue retention policy: cap queue size at 72 hours worth of readings
    - Config: `MAX_QUEUE_HOURS = 72`, `SAMPLE_INTERVAL_SEC = 60`
    - Max queue records: `(72 * 3600) / 60 = 4320 readings`
    - Max queue size: ~2-5 MB (manageable on SD)
  - If queue reaches 95% capacity: stop accepting new reads, enter alert state
  - Alert: `device_id` not synced in `RETENTION_HOURS` (72h)
  - Firmware garbage-collects oldest records if queue exceeds cap

- **HTTP Fallback Protocol**:
  - Primary: MQTT (preferred, lower latency)
  - Secondary: HTTP POST to `/data` every 60 seconds if MQTT unavailable
  - Fallback backoff strategy:
    ```
    Attempt 1: immediately
    Attempt 2-3: 10s apart
    Attempt 4-5: 30s apart
    Attempt 6+: 60s (polling interval, reset if successful)
    ```
  - Add `fallback_reason` field to track why HTTP is being used
  - Try return to MQTT every 10 HTTP polls

---

## Issue 4: Alerting & User Notifications

### Problem
- Alerts generated but no delivery mechanism (email, SMS, Slack unspecified)
- No deduplication: repeated alerts for same condition
- No escalation workflow for ignored alerts

### Solution
- **Notification Module**:
  - Add `notifications` table:
    ```sql
    CREATE TABLE notifications (
      id BIGSERIAL PRIMARY KEY,
      alert_id BIGINT REFERENCES alerts(id),
      user_id TEXT,
      channel TEXT CHECK (channel IN ('email', 'sms', 'slack', 'webhook')),
      status TEXT CHECK (status IN ('pending', 'sent', 'failed', 'read')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      sent_at TIMESTAMPTZ,
      read_at TIMESTAMPTZ
    );
    ```
  - Implement notification sender service (Phase 1: email via SMTP; Phase 2: SMS + Slack)
  - Endpoint: `POST /notifications/subscribe` — user adds email/phone/Slack webhook
  - User preferences table: quiet hours, severity thresholds, channel preferences

- **Alert Deduplication**:
  - Add to `alerts` table: `is_resolved BOOLEAN DEFAULT FALSE`
  - Don't create duplicate alert if same `device_id` + severity + condition active
  - Only notify if: (1) alert is new OR (2) alert escalated in severity
  - Implement cooldown: max 1 notification per device per 10 minutes per severity
  - SQL: `SELECT * FROM alerts WHERE device_id = ? AND is_resolved = FALSE` to check active

- **Escalation Workflow**:
  - Add `escalation_level` to alerts: 1 (warning), 2 (critical), 3 (emergency)
  - Escalation policy:
    ```
    Level 1 (5 min): notify primary user
    Level 2 (15 min): escalate to on-call if no ack
    Level 3 (30 min): escalate to manager + SMS emergency
    ```
  - Add `acknowledged_by` + `acknowledged_at` + `resolved_by` + `resolved_at` fields
  - Endpoint: `PATCH /alerts/:id/acknowledge` to mark read
  - Background job: escalate unacknowledged alerts at intervals

---

## Issue 5: Sensor Failure Detection

### Problem
- Stuck sensors report same value forever (water safety missed)
- Sensor drift over time (no calibration procedure)
- Power noise causes jitter

### Solution
- **Stuck Sensor Detection**:
  - Firmware: Apply exponential moving average (EMA) smoothing with α=0.3
    ```
    smoothed_value = (current_reading * 0.3) + (previous_smoothed * 0.7)
    ```
  - Backend rules: Flag reading as anomaly if:
    1. **Range check**: pH < 4.5 OR pH > 9.0 (dead sensor typical)
    2. **Rate-of-change check**: Reading unchanged for 24+ hours (stuck sensor)
    3. **Cross-device comparison**: Reading is >3σ from fleet median
    4. **Expected variance**: pH typically changes <0.5 per hour
  - Store anomaly flags in `sensor_data.anomaly_flags` JSONB:
    ```json
    {
      "out_of_range": true,
      "stuck": true,
      "outlier": false,
      "reasons": ["pH exceeded max (9.2)", "unchanged for 25 hours"]
    }
    ```

- **Calibration Procedure**:
  - Add calibration schedule to `devices` table: `last_calibration_at`, `calibration_interval_days`
  - Firmware: Display calibration reminder on local display every 30 days
  - Setup portal: "Run calibration" button that:
    1. Displays calibration instructions (e.g., "place pH sensor in pH 7.0 buffer")
    2. Reads sensor for 30 seconds, computes median
    3. Stores calibration point in NVS: `calibration_buffer_ph = 7.0, reading = 124`
    4. Next reading: apply linear correction: `true_value = (reading - offset) * slope`
  - Backend: Alert if device has no recent calibration

- **Power Noise Smoothing**:
  - Firmware: EMA filter (see above)
  - Add raw value to payload: `raw_ph`, `smoothed_ph` (for debugging)
  - Backend: Use `smoothed_ph` for scoring, log `raw_ph` for diagnostics

---

## Issue 6: Database & Performance

### Problem
- Time-series data explosion (1000 devices = 7.2M rows/day = 2.6B rows/year)
- Unclear if Postgres or InfluxDB preferred
- Backup strategy vague (to where? restore time? retention?)

### Solution
- **Data Partitioning**:
  - Use PostgreSQL with time-based partitioning (already recommended)
  - Partition `sensor_data` by month:
    ```sql
    CREATE TABLE sensor_data_2026_06 PARTITION OF sensor_data
      FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
    ```
  - Add indexes per partition:
    ```sql
    CREATE INDEX idx_sensor_data_2026_06_device_timestamp 
      ON sensor_data_2026_06 (device_id, timestamp DESC);
    CREATE INDEX idx_sensor_data_2026_06_timestamp 
      ON sensor_data_2026_06 (timestamp DESC);
    ```
  - Retention policy: auto-delete partitions older than 12 months (configurable)

- **Database Selection**:
  - **Phase 1**: PostgreSQL (you know it, transactional consistency, simpler deployment)
  - **Phase 2**: Consider TimescaleDB extension (PostgreSQL + time-series optimization) or InfluxDB
  - Decision: TimescaleDB if you need sub-second query latency; InfluxDB if you need distributed setup

- **Backup Strategy**:
  - **RPO (Recovery Point Objective)**: 1 hour (lose max 1 hour of data)
  - **RTO (Recovery Time Objective)**: 30 minutes (restore within 30 min)
  - **Retention**: 
    - Daily backups: keep 30 days
    - Weekly backups: keep 12 weeks
    - Monthly backups: keep 3 years
  - **Execution**:
    ```bash
    # Daily backup script
    pg_dump hydronix_db | gzip > /backups/hydronix_$(date +%Y%m%d).sql.gz
    
    # Upload to S3 with retention
    aws s3 cp /backups/hydronix_$(date +%Y%m%d).sql.gz s3://hydronix-backups/daily/
    
    # Cleanup old backups (keep 30 days)
    aws s3 rm s3://hydronix-backups/daily/ --recursive \
      --exclude "*" --include "*.sql.gz" \
      --older-than 30
    ```
  - Test restore quarterly: restore backup to test DB, verify data integrity

---

## Issue 7: Real-Time Performance

### Problem
- "Real-time" dashboard latency unspecified (5 minutes old ≠ real-time)
- Cold start: first page load might fetch 1 year of historical data (slow)

### Solution
- **Latency Targets**:
  - Sensor reading to dashboard: **<2 seconds** (via WebSocket)
  - Alert notification: **<1 minute** (via email/SMS, <10s via app)
  - Dashboard page load: **<3 seconds** (95th percentile)
  - Historical chart render: **<5 seconds** (full 12-month view)

- **Real-Time Transport**:
  - Primary: **WebSocket** for <2s latency
    - Backend broadcasts new readings to connected clients: `ws://backend:8080/updates`
    - Client subscribes: `{ "subscribe": ["device_1", "device_2"] }`
    - Payload: `{ "device_id": "HYDRO_001", "ph": 7.2, "timestamp": "...", "quality_score": 85 }`
  - Fallback: **HTTP polling** every 5-10 seconds (if WebSocket fails)
    - Endpoint: `GET /devices/:device_id/latest?since=<timestamp>`
    - Cache with 5s TTL to reduce DB load

- **Cold Start Optimization**:
  - Dashboard default view: **last 7 days** (not 1 year)
  - Endpoint: `GET /data/:device_id?limit=10080&days=7` (10080 = 7 days × 1440 min)
  - Add pagination: `GET /data/:device_id?before=<timestamp>&limit=100`
  - Lazy-load older data on scroll
  - Cache latest 7 days in Redis (1-minute TTL)

---

## Issue 8: Security Gaps

### Problem
- API key rotation unspecified
- Rate limiting details missing
- Schema validation behavior unclear
- No authentication/authorization (dashboard public?)
- CORS/OAuth missing

### Solution
- **API Key Rotation**:
  - Add `keys` table:
    ```sql
    CREATE TABLE api_keys (
      id BIGSERIAL PRIMARY KEY,
      device_id TEXT REFERENCES devices(device_id),
      key_hash TEXT NOT NULL UNIQUE,
      name TEXT,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,
      is_active BOOLEAN DEFAULT TRUE
    );
    ```
  - Key expiry: **90 days default** (configurable per device)
  - Endpoint: `POST /devices/:device_id/keys/rotate` generates new key, revokes old
  - Old key valid for 7 days grace period (for in-flight requests)
  - Endpoint: `DELETE /devices/:device_id/keys/:key_id` revokes immediately

- **Rate Limiting**:
  - **Per-device**: 100 requests/minute (can send ~2 readings/sec)
  - **Per-IP**: 10,000 requests/hour (to catch bot attacks)
  - Implementation: Redis-backed sliding window counter
    ```python
    key = f"rate_limit:{device_id}"
    count = redis.incr(key)
    redis.expire(key, 60)  # 1 minute window
    if count > 100:
      return 429 Too Many Requests
    ```
  - Response headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`

- **Schema Validation**:
  - Reject invalid payloads with **400 Bad Request** (never coerce)
  - Required fields: `device_id`, `timestamp`, `ph`, `turbidity`, `tds`, `temperature`, `flow_rate`
  - Validation rules:
    ```python
    {
      "device_id": {"type": "string", "pattern": "^HYDRO_\d{3}$"},
      "ph": {"type": "number", "minimum": 0, "maximum": 14},
      "turbidity": {"type": "number", "minimum": 0},
      "tds": {"type": "number", "minimum": 0},
      "temperature": {"type": "number", "minimum": -50, "maximum": 150},
      "flow_rate": {"type": "number", "minimum": 0},
      "timestamp": {"type": "string", "format": "date-time"},
      "seq_no": {"type": "integer", "minimum": 0}
    }
    ```
  - Log all rejections: `{ "rejected_payload": {...}, "reason": "ph out of range", "device_id": "...", "timestamp": "..." }`
  - Alert if single device rejects >10 payloads in 1 hour (firmware bug?)

- **Dashboard Authentication**:
  - Implement **OAuth2 / JWT** for dashboard access
  - Endpoint: `POST /auth/login` — returns JWT with claims: `{ "user_id", "devices": [...], "role": "admin|operator|viewer" }`
  - All API endpoints require `Authorization: Bearer <JWT>` header
  - RBAC roles:
    - **admin**: manage users, keys, settings
    - **operator**: view all data, acknowledge alerts
    - **viewer**: read-only access
  - Add `users` table with device assignments

- **CORS / Cross-Origin**:
  - Frontend must authenticate via HTTPS only (no HTTP)
  - Set CORS headers: `Access-Control-Allow-Origin: https://dashboard.hydronix.local`
  - Disable credentials in CORS for public APIs (only /data requires auth)

---

## Issue 9: Geographic & Regional Deployment

### Problem
- Single-region only (no multi-region failover)
- No data residency support (can't deploy in EU/Asia with compliance)

### Solution
- **Phase 1**: Single region deployment (home server or single cloud region)
- **Phase 2**: Multi-region deployment:
  - Deploy backend in multiple regions (us-east, eu-west, ap-southeast)
  - Each region has own MQTT broker, PostgreSQL, frontend
  - Global load balancer routes device traffic to nearest region
  - Device config: `server_host = "hydronix-global.example.com"` (DNS resolves to closest region)
  - Devices post data to regional backend, regional backend syncs to central analytics DB
  
- **Data Residency**:
  - Add `deployment_region` field to `devices` table
  - Config: which regions to store data in (`default: "us-east"`)
  - Backend: enforce data locality (EU device data never leaves EU)
  - GDPR compliance: add data deletion endpoint `DELETE /devices/:device_id/data?before=<date>`

---

## Issue 10: Observability & Debugging

### Problem
- No heartbeat tracking (only know device offline when data stops)
- No request tracing (impossible to debug "where did my reading go?")
- Logging format/destination unspecified

### Solution
- **Device Heartbeat**:
  - Separate heartbeat endpoint: `POST /devices/:device_id/heartbeat`
  - Firmware sends heartbeat every 30 minutes (even if no new readings)
  - Payload:
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
  - Backend marks device offline if no heartbeat for 120 minutes

- **Request Tracing**:
  - Add UUID `trace_id` header to all requests (generated by device or backend)
  - Propagate through all services: API → database → worker → alert service
  - Log every step with `trace_id` for audit trail
  - Endpoint: `GET /traces/:trace_id` to debug single reading's journey

- **Structured Logging**:
  - JSON format, fields: `timestamp`, `level`, `service`, `trace_id`, `device_id`, `message`, `error`, `metadata`
  - Example:
    ```json
    {
      "timestamp": "2026-06-14T21:00:00.123Z",
      "level": "INFO",
      "service": "ingestion-api",
      "trace_id": "abc-123-def",
      "device_id": "HYDRO_001",
      "message": "Reading ingested",
      "status_code": 200,
      "processing_time_ms": 45
    }
    ```
  - Centralize logs: ELK Stack (Elasticsearch + Logstash + Kibana) or Loki
  - Retention: 30 days for info/debug, 90 days for error/warn

---

## Issue 11: Edge Cases

### Problem
- Daylight saving time breaks timestamps
- WiFi AP name conflicts (multiple devices all broadcast same name)
- SD card full — device crashes, loses data
- MQTT retained messages cause stale data replays

### Solution
- **UTC Enforcement**:
  - **Firmware contract**: All timestamps in UTC (ISO 8601), no local time
  - Add validation: reject any reading with non-UTC timestamp
  - Backend: Convert timestamp to UTC on receive if needed (log warning)
  - No DST conversions anywhere in system

- **WiFi AP Naming**:
  - Device broadcasts: `Hydronix_Setup_<DEVICE_ID>` (e.g., `Hydronix_Setup_HYDRO_001`)
  - Include first 3 octets of MAC: `Hydronix_<MAC_LAST_3>` (e.g., `Hydronix_A1B2C3`)
  - Document in setup portal: "Look for AP name matching your device ID"

- **SD Card Full Handling**:
  - Add low-space check: if SD usage > 95%, enter "low storage" mode
  - Action: stop writing new readings to SD, attempt immediate sync to backend
  - Alert: `device_id` in low storage state
  - Graceful degradation: if sync succeeds, resume normal operation; if fails, keep retrying
  - Fail-safe: implement circular buffer (overwrite oldest) as last resort (after alerting)

- **MQTT Retained Messages**:
  - Backend policy: **do not use retained messages** (can cause stale data)
  - Devices do not publish with `retain=true` flag
  - If accidentally retained, backend filters: only accept readings newer than `last_sync_at`
  - Test: verify broker doesn't replay old messages on reconnect

---

## Issue 12: Cost & Sustainability

### Problem
- No cost model (surprise bills)
- No maintenance plan (who maintains in year 2?)

### Solution
- **Cost Modeling** (per 1000 devices, 1 reading/minute):
  - MQTT Broker: EMQX Cloud ~$500/month (or self-hosted Docker ~$50/month VM)
  - PostgreSQL: AWS RDS ~$300/month (or self-hosted ~$50/month)
  - Backend compute: ~$200/month (API + worker)
  - Backup storage (S3): ~$10/month
  - **Total: ~$1000-1500/month** (or ~$150-250/month self-hosted)
  - Per-device cost: $1-1.50/month (cloud) or $0.15-0.25/month (self-hosted)

- **Maintenance SLA**:
  - **Security patches**: 24-hour response time, 7-day deployment
  - **Critical bugs**: 4-hour response, 24-hour fix
  - **Feature requests**: prioritized in quarterly roadmap
  - **Firmware updates**: monthly cadence (security patches + bug fixes)
  - **Database backups**: daily automated, restore tested monthly
  - **Monitoring**: 99.9% uptime SLA target (8.7 hours downtime allowed/year)
  - **Support**: email support for non-production issues, on-call 24/7 for critical

---

## Summary: Implementation Checklist

- [ ] Issue 1: Add device provisioning API + OTA framework
- [ ] Issue 2: Implement seq_no + reset_count + NTP sync
- [ ] Issue 3: Deploy MQTT cluster + HTTP fallback + queue retention
- [ ] Issue 4: Build notification module + alert deduplication + escalation
- [ ] Issue 5: Add sensor anomaly detection + calibration UI + EMA smoothing
- [ ] Issue 6: Partition time-series data + backup automation + restore testing
- [ ] Issue 7: Implement WebSocket real-time + pagination + Redis caching
- [ ] Issue 8: Add key rotation + rate limiting + OAuth2 + CORS
- [ ] Issue 9: Plan multi-region architecture (Phase 2)
- [ ] Issue 10: Implement heartbeat + trace_id logging + ELK stack
- [ ] Issue 11: Enforce UTC + AP naming + SD full handling
- [ ] Issue 12: Document cost model + maintenance SLA
