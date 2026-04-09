# ESP32 Firmware Specification

## Purpose
Define firmware behavior for robust sensor sampling, local display, offline buffering, and reliable server sync.

## Device Identity and Config

Required persistent fields:

1. `device_id`
2. `wifi_ssid`
3. `wifi_password`
4. `server_host`
5. `server_port`
6. `protocol` (`mqtt` or `http`)
7. `api_key` (optional)
8. `sample_interval_sec`

Store config in NVS/flash with reset option.

## Sensor Pipeline

1. Read pH, turbidity, TDS, temperature, and flow rate every sampling cycle.
2. Apply sensor calibration and sanity bounds.
3. Build normalized payload with UTC timestamp.
4. Render latest values on local display.

## Offline-First Data Handling

1. If network send fails, append payload to SD queue file.
2. Keep sequence ordering metadata (`seq_no`).
3. On reconnect, send oldest buffered records first.
4. Remove records from SD only after confirmed server acknowledgement.
5. Cap queue growth with retention policy and low-space behavior.

## Connectivity and Reconnect

1. Auto-reconnect WiFi.
2. Auto-reconnect MQTT broker or API endpoint.
3. Retry send with exponential backoff + jitter.
4. Publish heartbeat message every fixed interval.

## Local Setup Portal

In AP mode (`Hydronix_Setup`), provide web UI at `192.168.4.1`:

1. Configure WiFi and server settings.
2. Set `device_id` and optional key.
3. Show signal strength and server reachability.
4. Save + reboot.
5. Factory reset.
6. Optional OTA endpoint.

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
