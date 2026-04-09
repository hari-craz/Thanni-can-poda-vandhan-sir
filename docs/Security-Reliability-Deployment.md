# Security, Reliability, and Deployment

## Reliability Requirements

1. Edge buffering on SD card during outages.
2. Ordered replay with deduplication via (`device_id`, `seq_no`).
3. Retry with backoff for transport failures.
4. Device watchdog and automatic reboot recovery.
5. Backend health checks and restart policies.

## Security Requirements

1. Unique credential per device.
2. API key hashing in database.
3. TLS for API and MQTT where possible.
4. Strict payload schema validation.
5. Request rate limits and abuse protection.
6. Audit logging for auth failures and invalid payloads.

## Deployment Targets

1. Home server deployment (Docker Compose)
2. Cloud VM deployment (Docker Compose or Kubernetes)

## Minimal Production Topology

1. Reverse proxy (Nginx/Caddy)
2. Backend API service
3. Processing worker
4. PostgreSQL with backups
5. MQTT broker
6. Frontend static app or SSR app

## Backup and Retention

1. Daily PostgreSQL backups
2. Retain raw sensor data by policy (for example 12 months)
3. Archive older data if long-term analytics is required

## Observability

1. Centralized logs for API and worker
2. Device heartbeat metrics
3. Alerting for offline devices and server failures
4. Endpoint latency and ingestion throughput metrics
