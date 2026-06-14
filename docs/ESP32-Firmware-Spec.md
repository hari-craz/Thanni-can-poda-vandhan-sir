# ESP32 Firmware Specification

## Purpose
Define firmware behavior for robust sensor sampling, local display, offline buffering, and reliable server sync.

## Device Identity and Config

Required persistent fields (stored in NVS/flash):

1. `device_id` — format: `HYDRO_###` (e.g. `HYDRO_001`), immutable after first config
2. `device_reset_count` — incremented on each reboot (prevents seq_no wrapping)
3. `wifi_ssid`
4. `wifi_password`
5. `server_host`
6. `server_port`
7. `protocol` — `mqtt` (preferred) or `http` (fallback)
8. `api_key` — must be stored securely, rotated every 90 days
9. `sample_interval_sec` — default 60 seconds
10. `timezone_offset` — for display only; all timestamps must be UTC
11. `last_ntp_sync` — timestamp of last NTP update
12. `mqtt_broker_url` — full URL with credentials if needed
13. `http_endpoint` — full POST URL for HTTP fallback

Store all config in NVS with CRC checksum for corruption detection. Provide reset option in setup portal (wipes all config).

## Sensor Pipeline

1. Read pH, turbidity, TDS, temperature, and flow rate at `sample_interval_sec` (default 60s).
2. Apply sensor calibration offsets (stored from calibration procedure).
3. Apply EMA smoothing filter: `smoothed = current * 0.3 + previous * 0.7`
4. Validate sanity bounds:
   - pH: 0 to 14
   - Turbidity: 0 to 1000 NTU
   - TDS: 0 to 10000 ppm
   - Temperature: -50°C to 150°C
   - Flow rate: 0 to 10000 L/min
5. If sanity check fails, skip this reading and log error
6. Store raw reading (pre-smoothing) for diagnostics
7. Build normalized JSON payload with UTC timestamp (via NTP sync)
8. Include `seq_no` (incremented per reading) and `device_reset_count`
9. Render latest values on local display (LCD/OLED)
10. Attempt to send via MQTT or HTTP

## Sensor Failure Detection (Firmware-Side)

1. **Stuck Sensor**: No value change for 24 hours → flag, display warning
2. **Out-of-Range**: Value beyond sanity bounds → skip reading, log error
3. **Rate-of-Change Violation**: Change >2 units per minute → likely sensor spikes, apply smoothing
4. Log all anomalies with timestamp for backend debugging

## Sensor Calibration Procedure

1. Setup portal: "Run Calibration" button
2. Display instructions: "Place pH sensor in pH 7.0 buffer solution"
3. Read sensor for 30 seconds, compute median
4. Store calibration point: `calibration_buffer_ph = 7.0`, `raw_reading = 124`
5. Compute calibration offset: `offset = true_value - raw_reading`
6. Store in NVS: `calibration_offsets = { "ph_offset": 0.2, ... }`
7. Display: "Calibration complete. pH 7.0 = raw value 124"
8. Update `last_calibration_at` timestamp in NVS
9. Next reading: apply correction: `true_ph = smoothed_ph + calibration_offset`
10. Backend will remind device to recalibrate every 30 days (via alert)

## Offline-First Data Handling

1. If network send succeeds, return to normal operation.
2. If send fails (MQTT unreachable OR HTTP POST fails):
   - Append payload to SD queue file: `/data/queue.jsonl`
   - Keep sequence ordering metadata: `seq_no`, `device_reset_count`, `timestamp`
3. On SD write failure (disk full): 
   - Stop writing, enter "low storage" mode
   - Attempt immediate sync to backend (flush buffer)
   - If sync succeeds, resume; if fails, keep retrying
   - Alert backend: device in low storage state
4. Queue retention policy:
   - Cap queue size: 72 hours worth of readings (4320 records @ 60s interval)
   - If queue > 95% capacity: stop accepting new reads, raise alert
   - Oldest records garbage-collected when capacity reached
5. On reconnect:
   - Send oldest buffered records first (preserve order)
   - Include original `seq_no` and `device_reset_count` (no resetting)
   - Backend deduplicates: unique key = `(device_id, device_reset_count, seq_no)`
   - Only remove records from SD **after** successful backend acknowledgement (HTTP 200 or MQTT ACK)
6. Transaction markers (for SD queue integrity):
   ```
   [START]
   {json payload}
   {checksum}
   [END]
   ```
   - On recovery, skip incomplete records (missing [END] or bad checksum)

## Connectivity and Reconnect

### WiFi

1. Auto-reconnect: if WiFi drops, attempt reconnect every 10 seconds (up to 30 attempts = 5 min)
2. After 30 failed attempts, enter "connecting" state and retry every 60 seconds
3. On reconnect: immediately attempt to send buffered data

### MQTT

1. Configure broker list: primary + fallback brokers (support broker failover)
2. Auto-reconnect: if MQTT drops, retry with exponential backoff:
   - Attempt 1: immediately
   - Attempt 2-3: 10s apart
   - Attempt 4-5: 30s apart
   - Attempt 6+: 60s (polling interval)
   - Reset backoff on successful reconnect
3. Publish heartbeat every 30 minutes (even if no new readings)
   ```json
   {
     "device_id": "HYDRO_001",
     "heartbeat": true,
     "uptime_seconds": 86400,
     "sd_usage_percent": 45,
     "signal_strength": -65,
     "firmware_version": "1.2.3"
   }
   ```

### HTTP Fallback

1. If MQTT unavailable: switch to HTTP POST every 60 seconds
2. Backoff strategy:
   - Attempt 1: immediately
   - Attempt 2-3: 10s apart
   - Attempt 4-5: 30s apart
   - Attempt 6+: 60s (polling interval, reset if successful)
3. Add `fallback_reason` field to payload when using HTTP:
   ```json
   {
     "device_id": "HYDRO_001",
     "fallback_reason": "mqtt_unreachable",
     "fallback_duration_seconds": 300,
     ...
   }
   ```
4. Try to return to MQTT every 10 HTTP polls (every ~10 minutes)

### NTP Synchronization

1. Sync device clock on boot (attempt 5 times with 10s timeout)
2. Sync every 24 hours thereafter
3. Use public NTP servers: `pool.ntp.org` with fallback to `time.nist.gov`
4. Store `last_ntp_sync` timestamp in NVS
5. If NTP fails and device clock uninitialized: use server timestamp as fallback (backend will adjust)

### UTC Timestamp Enforcement

- **All timestamps must be UTC ISO 8601 format**: `2026-06-14T21:00:00Z`
- No local time conversions, no DST
- If NTP sync fails: fallback to seconds since boot, backend will convert
- Payload `timestamp_source` field indicates source (for backend debugging)

## Local Setup Portal

In AP mode (`Hydronix_Setup_<DEVICE_ID>`), provide web UI at `192.168.4.1`:

### WiFi Configuration
1. Select/enter SSID
2. Enter WiFi password
3. Test connection (show signal strength)
4. Save and reconnect to WiFi

### Server Configuration
1. Enter server hostname or IP
2. Enter server port (default 1883 for MQTT, 8000 for HTTP)
3. Select protocol: MQTT or HTTP
4. Test connectivity to backend
5. Show status: "Connected" or "Failed: connection refused"

### Device Configuration
1. Set `device_id` (format validation: `HYDRO_###`)
2. Generate or paste API key
3. Display: "Device ID: HYDRO_001 | Key: hydro_1a2b3c... (check QR)"

### Calibration
1. "Run Calibration" button (pH 7.0 buffer)
2. Display calibration status, last calibration date

### Status Display
1. Current signal strength (dBm)
2. Server reachability (ping latency)
3. SD card usage (%)
4. Firmware version
5. Uptime
6. Last successful data send

### Maintenance
1. "Factory Reset" button (warns before clearing all config)
2. "OTA Update" button (checks for firmware updates via backend)
3. Reboot button

### Advanced (Optional Phase 2)
1. Manual time/date setting (if NTP fails)
2. Custom MQTT topic configuration
3. Debug log download (via USB download link)
4. Sensor calibration points viewer

## OTA Firmware Update (Phase 2)

1. Firmware periodic check: `GET /devices/:device_id/firmware/latest`
2. Backend returns: version, URL, SHA256 checksum, release notes
3. If new version available:
   - Display on setup portal: "Update available: v1.2.4"
   - Option to auto-update or manual trigger
4. Download firmware in chunks, verify SHA256
5. Validate signature (public key stored in firmware)
6. If validation fails, reject update
7. Atomic update: write to secondary partition, mark as active on success
8. Rollback: if new firmware fails to boot (watchdog timeout), revert to previous partition
9. Report back: `POST /devices/:device_id/firmware/status` with success/failure + version

## Local Display Updates

Firmware FreeRTOS tasks:

1. `task_sensor_read` — reads all 5 sensors at interval, applies calibration + smoothing
2. `task_display_update` — renders latest values on LCD/OLED, shows connection status, anomalies
3. `task_network_manager` — handles WiFi reconnects, broker failover, NTP sync
4. `task_uplink_sender` — sends readings via MQTT/HTTP, implements backoff
5. `task_offline_sync` — replays SD queue when connection restored
6. `task_calibration_monitor` — tracks calibration expiry, displays reminder
7. `task_ota_checker` — periodically checks for firmware updates (Phase 2)

Display layout (LCD 16x2 or 20x4 recommended):
```
Line 1: Device: HYDRO_001 | pH: 7.2
Line 2: Turb: 3.1 NTU | Temp: 25°C
Line 3: Status: Online | Signal: -65dBm
Line 4: Queue: 0 | SD: 45% | Sync: 30s ago
```

If anomaly detected:
```
Line 1: ⚠️  ALERT: pH OUT OF RANGE
Line 2: pH: 9.2 (safe: 6.5-8.5) ⚠️
```

## Configuration Validation

Firmware must validate on startup:
- Device ID matches pattern `HYDRO_\d{3}`
- Server URL is valid hostname or IP
- Sample interval >= 30 seconds (prevent floods)
- API key exists and is non-empty
- Warn if calibration older than 30 days

## Suggested Firmware Task Split (FreeRTOS)

1. `task_sensor_read`
2. `task_display_update`
3. `task_network_manager`
4. `task_uplink_sender`
5. `task_offline_sync`
6. `task_health_heartbeat`

## Message Contract

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

## Acceptance Criteria

1. Device continues sampling while offline.
2. Buffered payloads are synced in order after reconnect.
3. No data loss during short power interruptions (with battery backup).
4. Config portal can reconfigure network without reflashing firmware.
