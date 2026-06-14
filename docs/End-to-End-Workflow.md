# End-to-End Workflow

## Runtime Flow (Happy Path)

1. ESP32 samples all 5 sensors at configured interval (default 60s)
2. Firmware applies calibration offsets + EMA smoothing filter
3. Validate sanity bounds; if out of range, skip and log error
4. Build JSON payload with UTC timestamp, seq_no, device_reset_count
5. Reading shown on local LCD/OLED display instantly
6. Payload sent to backend via MQTT (preferred) or HTTP (fallback)
7. If send succeeds (HTTP 200 or MQTT ACK):
   - Mark sent_at timestamp locally
   - Continue to next sampling interval
8. Backend authenticates request (API key validation)
9. Backend validates payload schema (strict validation)
10. Backend deduplicates: check unique key `(device_id, device_reset_count, seq_no)`
11. Backend stores raw reading in `sensor_data` table with trace_id
12. Backend marks device `status = online`, `last_seen = now()`
13. Processing engine computes quality score (rule-based)
14. Processing engine flags anomalies (out-of-range, stuck sensor, outlier)
15. If quality score < threshold, generate alert and insert into `alerts` table
16. If alert generated:
    - Check for duplicates (same device + condition active)
    - Apply cooldown (max 1 notification per 10 min)
    - Create notification record
    - Send email/SMS/Slack notification
17. Dashboard fetches latest data via WebSocket (real-time <2s) or HTTP polling
18. Operators view status, trends, and acknowledge alerts
19. On reconnect after offline period, ESP32 replays buffered records in order

## Failure Handling Scenarios

### Scenario 1: Device WiFi Drops (Offline for 5 minutes)

**Timeline:**
- T=0: WiFi drops, device offline
- T=0-10: Firmware keeps sampling (display shows reading)
- T=10: First MQTT publish fails (no connection)
- T=10: Payload appended to SD queue file
- T=10-300: Device attempts WiFi reconnect every 10-60 seconds (backoff)
- T=300: WiFi reconnects
- T=300: Device checks SD queue, finds buffered readings
- T=300-305: Replays 5 old readings (60s intervals) to backend
- T=305: Oldest buffered readings deleted from SD
- T=305+: Resume normal operation

**Backend behavior:**
- Readings arrive with original `timestamp` (device time)
- All 5 readings deduplicated (unique seq_no check)
- Alert rule re-evaluated for each historical reading
- If alert condition existed during offline period, alert triggered retroactively
- Device marked `status = online` after first reading received

**Dashboard:**
- Shows gap in chart during offline period
- When readings arrive, backfill chart with historical data
- Display: "Device reconnected, synced 5 readings"

---

### Scenario 2: Backend API Down (Server Restart)

**Timeline:**
- T=0: API service crashes
- T=0: Device attempts POST /data, connection refused
- T=0-5: Device retries (backoff: 10s, 10s, 30s)
- T=35: Fallback to HTTP: retry intervals shift to 60s
- T=95: Backend service restarts, readiness probe passes
- T=95: Device HTTP POST succeeds
- T=95: Device switches back to MQTT (primary protocol)

**Backend behavior:**
- Readings buffered during crash are lost (unless device also buffered to SD)
- On restart, check `last_seen` for all devices
- Devices offline for >120s marked `status = offline`
- Alert triggered: "Device HYDRO_001 offline for 2 minutes"

**Dashboard:**
- Shows device as offline (red badge)
- "Last seen: 2 minutes ago"
- Alert in feed: "HYDRO_001 went offline"

---

### Scenario 3: MQTT Broker Node Fails (Cluster Recovery)

**Setup:** EMQX cluster: 3 nodes (node-1, node-2, node-3)

**Timeline:**
- T=0: node-1 crashes (hardware failure)
- T=0: Device's MQTT connection (to node-1) drops
- T=0-5: Device attempts reconnect to node-1 (fails)
- T=5: Device tries next broker in list: node-2
- T=5: Connection succeeds (broker cluster maintains state)
- T=5-305: Device resumes normal operation
- T=305: node-1 reboots and rejoins cluster (auto-discovery)

**Backend behavior:**
- No data loss (cluster quorum maintained)
- Other devices connected to node-2/node-3 unaffected

**Dashboard:**
- No visible impact to operators
- Alert: "Broker node-1 offline" (infrastructure team)

---

### Scenario 4: Database Connection Lost (Replica Failover)

**Setup:** PostgreSQL primary + standby replica with automated failover

**Timeline:**
- T=0: Primary DB connection drops
- T=0-2: API service attempts reconnect (connection pool timeout)
- T=2: Database failover triggered (standby becomes new primary)
- T=2-5: API reconnects to new primary
- T=5: Normal operation resumes

**Backend behavior:**
- Readings during failover (2-5 sec): buffered in message queue or dropped
- After failover: catch-up reads from device (device has seq_no tracking)
- No data inconsistency (deduplication handles any re-sends)

**Dashboard:**
- Brief ~5 second delay in data updates
- Transparent to operators (automatic recovery)
- Alert: "Database failover completed" (infrastructure)

---

### Scenario 5: Device Sensor Fails (Stuck Reading)

**Symptoms:** pH sensor stuck at 7.2 for 24+ hours

**Timeline:**
- T=0-86400: Firmware detects no change in pH for 24h
- T=86400: Flag in anomaly detector: `"stuck": true`
- T=86400: Reading sent with `anomaly_flags = {"stuck": true}`
- T=86400: Backend receives, computes quality score (deducts 25 points)
- T=86400: Alert triggered: "pH sensor may be stuck"
- T=86400: Notification sent to operator
- T=86400: Display shows: "⚠️ pH SENSOR WARNING"

**Operator action:**
- View device detail in dashboard
- See alert: "pH sensor may be stuck (unchanged for 24h)"
- Navigate to calibration section
- Run calibration procedure (confirms sensor is stuck or restores it)
- Acknowledge alert in dashboard

**Backend:**
- Keep alert active until operator resolves
- Next normal reading resets the stuck flag

---

### Scenario 6: SD Card Full (Offline Queue Overflow)

**Symptoms:** Device accumulates 72+ hours without network

**Timeline:**
- T=0: Device WiFi/MQTT unavailable, starts buffering to SD
- T=259200 (72h): SD queue reaches 4320 readings (72h × 60s)
- T=259200: Queue at capacity, oldest readings start aging out
- T=259200: Firmware enters "low storage" alert state
- T=259200: Display shows: "Storage Full | Attempting Sync"
- T=259201: Firmware attempts aggressive reconnect
- T=259210: WiFi reconnects (attempted as priority)
- T=259210: Device syncs oldest buffered readings
- T=259250: All queued readings sent
- T=259250: Device clears "low storage" state

**Backend:**
- Alert: "Device HYDRO_001 low storage - may have lost recent data"
- Backend notifies: "Device recovered from storage limit"

**Data loss:** Yes, if offline period > 72h, oldest readings are discarded
- Mitigation: Admin adjusts queue retention or adds larger SD card

---

### Scenario 7: Clock Drift (NTP Fails, Timestamp Wrong)

**Symptoms:** Device NTP sync fails, internal clock drifts

**Timeline:**
- T=0: Device boots, attempts NTP sync (fails - no internet yet)
- T=60: Device falls back to using milliseconds since boot
- T=3600: User connects WiFi via setup portal
- T=3600: NTP sync succeeds, clock corrected
- T=3600+: Readings use UTC
- Readings during T=60-3600: `timestamp_source = "server_only"` (backend substitutes receive time)

**Backend:**
- Receives reading with `timestamp_source = "server_adjusted"`
- Uses `received_at` (server time) instead of device `timestamp`
- Log: "Timestamp adjusted for device HYDRO_001 (clock drift detected)"

**Impact:** Historical charts for first hour show server times (may be offset)

---

### Scenario 8: Duplicate Reading (Network Retry)

**Timeline:**
- T=0: Device sends reading (seq_no=1000) via HTTP
- T=0-5: Request hangs (network timeout)
- T=5: Device retries (same seq_no=1000)
- T=5: Backend receives **two identical readings**

**Backend deduplication:**
- First reading: insert into DB, success
- Second reading: unique key check fails (`device_id, device_reset_count, seq_no` already exists)
- Second reading: rejected with unique constraint violation
- Response: HTTP 409 Conflict or silently rejected (depending on implementation)
- Result: **No duplicate data in database**

---

### Scenario 9: Rate Limiting (Too Many Requests)

**Symptoms:** Device misconfigured, sends data every 1 second instead of 60s

**Timeline:**
- T=0-60: Device sends 60 readings (instead of 1)
- Reading 1-100: accepted
- Reading 101+: HTTP 429 Too Many Requests
- Device receives 429, backs off (stops sending)
- Backend alert: "Device HYDRO_001 exceeded rate limit (100 req/min)"

**Dashboard:**
- Alert visible to operator
- Operator investigates device logs via setup portal
- Discovers sample interval = 1s (should be 60s)
- Corrects device config, restarts

---

## Data Lifecycle

1. **Creation**: Sensor reading created at edge (device timestamp)
2. **Serialization**: JSON with UTC timestamp, seq_no, device_reset_count
3. **Transport**: MQTT or HTTP POST to backend
4. **Ingestion**: Backend validates, stores in `sensor_data` table
5. **Processing**: Quality score + anomaly flags computed (trace_id logged)
6. **Alerting**: If threshold breached, alert generated + notification sent
7. **Exposure**: API `/data/:device_id` serves data to dashboard
8. **Retention**: Raw data kept 12 months; older data archived/deleted per policy
9. **Audit Trail**: All data access logged with user_id + timestamp

## Failure Mode Summary

| Failure | Impact | Recovery Time | Data Loss |
|---------|--------|----------------|-----------|
| WiFi drop (5m) | Device offline | 5m + sync | 0% (SD buffer) |
| WiFi drop (>72h) | Device offline | 72h+ | Yes (oldest readings) |
| MQTT broker node down | Broker failover | 30s | 0% (cluster quorum) |
| API service down | Request retry | 5 min (backoff) | 0% (device buffers) |
| Database down | Failover | 2-5 min | 0% (dedup) |
| Sensor stuck | Alert | Immediate | No (detected) |
| SD card full | Limited buffering | Recovery sync | Yes (after 72h) |
| Clock drift | Timestamp offset | NTP sync | No (backend adjusts) |
| Rate limit | Backoff | 1-5 min | 0% (device queues) |

**Overall:** System is designed for **zero data loss during normal network outages** (72-hour window). Long-term offline (>72h) loses oldest buffered readings.
