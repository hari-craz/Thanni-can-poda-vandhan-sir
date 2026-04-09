# End-to-End Workflow

## Runtime Flow

1. ESP32 samples all sensors at configured interval.
2. Firmware validates/calibrates readings.
3. Reading shown on local display instantly.
4. Payload sent to backend via MQTT or HTTP.
5. If send fails, payload appended to SD queue.
6. Backend authenticates and validates payload.
7. Backend stores raw reading in database.
8. Processing engine computes quality score and anomalies.
9. Alerts generated for unsafe conditions.
10. Dashboard fetches latest and historical data.
11. Operators view status, trends, and alerts.
12. On reconnect, ESP32 replays buffered records in order.

## Data Lifecycle

1. Sensor reading created at edge.
2. Serialized to JSON with UTC timestamp and sequence number.
3. Ingested to backend and deduplicated.
4. Persisted with derived fields (score, flags).
5. Exposed through API to dashboard.
6. Archived/retained according to policy.

## Failure Handling Path

1. WiFi drop: device keeps sampling and stores locally.
2. Broker/API down: retries and queueing continue.
3. Power event: battery backup + resume queue replay.
4. Duplicate replay: backend unique constraint drops duplicates.
