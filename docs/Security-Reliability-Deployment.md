# Security, Reliability, and Deployment

## Reliability Requirements

### Data Durability

1. **Offline Buffering**: ESP32 buffers to SD when network unavailable (72-hour retention)
2. **Deduplication**: Ordered replay with unique key `(device_id, device_reset_count, seq_no)` prevents duplicates
3. **Checksum Validation**: SD queue files validated with checksums; corrupt records skipped
4. **Retry Logic**: Exponential backoff with jitter; HTTP/MQTT automatic fallback
5. **Device Watchdog**: Auto-reboot if firmware hangs (hardware watchdog, 60s timeout)
6. **Backend Health Checks**: Automated restarts on failure; systemd or Docker health checks
7. **Database Backups**: Daily automated backups with 30-day retention; weekly backups kept 12 weeks; monthly backups kept 3 years
8. **Backup Testing**: Monthly restore test to ensure backups are valid and recoverable

### Availability (SLA Target: 99.9% uptime)

1. **MQTT Broker HA**: EMQX cluster with 3+ nodes + load balancer (device reconnects within 30s of node failure)
2. **API Redundancy**: Deploy 2+ API instances behind load balancer
3. **Database**: PostgreSQL with daily snapshots; read replicas in Phase 2+
4. **Monitoring**: Prometheus metrics + alerting on outages
5. **Incident Response**: On-call team, post-mortems for all P1 incidents

### Graceful Degradation

1. If MQTT broker fails: devices automatically fall back to HTTP
2. If backend API fails: devices buffer to SD, retry when service restores
3. If database fails: stale cache serves dashboards (read-only), devices keep buffering
4. If all services fail: devices display "Server Offline" on local display, continue sampling + storing locally

## Security Requirements

### Authentication & Authorization

1. **Device Authentication**:
   - API key per device (issued via `/devices/provision`)
   - Key hash stored in database (bcrypt salt 12)
   - Key expiry: 90 days default (configurable)
   - Key rotation: `/devices/:device_id/keys/rotate` revokes old key after 7-day grace period
   - Lost key recovery: re-provision device via admin API

2. **User Authentication**:
   - Password: bcrypt hash with salt 12
   - JWT token: expires in 24 hours, refresh token available
   - Optional 2FA (Phase 2)
   - Session invalidation on logout

3. **RBAC (Role-Based Access Control)**:
   - Roles: admin, operator, viewer
   - Device-level assignments: users can only see assigned devices
   - Endpoint enforcement: backend validates user role + device access

### Input Validation & Injection Prevention

1. **Payload Schema Validation** (reject 400 Bad Request if invalid):
   ```python
   {
     "device_id": {"type": "string", "pattern": "^HYDRO_\d{3}$"},
     "ph": {"type": "number", "minimum": 0, "maximum": 14},
     "turbidity": {"type": "number", "minimum": 0},
     "tds": {"type": "number", "minimum": 0},
     "temperature": {"type": "number", "minimum": -50, "maximum": 150},
     "flow_rate": {"type": "number", "minimum": 0},
     "timestamp": {"type": "string", "format": "date-time"}
   }
   ```

2. **No Silent Coercion**: Reject invalid types (don't convert strings to numbers)
3. **SQL Injection Prevention**: Use parameterized queries (ORM or prepared statements)
4. **Command Injection Prevention**: Never shell-exec user input
5. **XSS Prevention**: Sanitize all user-generated output; use template escaping
6. **CSRF Protection**: SameSite cookie attribute; CSRF tokens for state-changing requests

### Transport Security

1. **HTTPS/TLS**:
   - Required for production (enforce via redirect HTTP → HTTPS)
   - TLS 1.2+ only
   - Certificate pinning on devices (optional Phase 2)

2. **MQTT Security**:
   - TLS on port 8883 (production)
   - Username/password or certificate-based auth
   - Topics scoped by device (each device only publishes to its topic)

3. **WebSocket Security**:
   - WSS (secure WebSocket) over TLS
   - Auth token required in handshake

### API Security

1. **Rate Limiting**:
   - Per-device: 100 requests/minute
   - Per-IP: 10,000 requests/hour
   - Implementation: Redis sliding window counter
   - Return 429 Too Many Requests with Retry-After header

2. **CORS Configuration**:
   - Allowed origins: `https://dashboard.hydronix.local` (configurable per environment)
   - Allowed methods: GET, POST, PATCH, DELETE
   - Allowed headers: Content-Type, Authorization, X-API-Key
   - Credentials: true (for session cookies)

3. **API Key Rotation**:
   - Automatic expiry: 90 days
   - Manual rotation: `/devices/:device_id/keys/rotate`
   - Grace period: 7 days for old key (support in-flight requests)
   - Revocation: immediate via DELETE endpoint

4. **Payload Size Limits**:
   - POST /data: max 10 KB (1 reading max ~500 bytes)
   - Return 413 Payload Too Large if exceeded

### Data Protection

1. **Encryption at Rest**:
   - Database: TDE (PostgreSQL pg_tde plugin) or full-disk encryption
   - API keys: hashed (never plaintext)
   - Passwords: bcrypt hashed

2. **Sensitive Data Handling**:
   - API keys: never log, never return in responses (only during creation)
   - Passwords: never log, never store plaintext
   - Audit log: track all key rotations, device registrations, user privilege changes

3. **Data Residency** (Phase 3):
   - EU devices: data stored in EU region only
   - Add `deployment_region` field to devices table
   - Backend enforces locality: EU device requests routed to EU backend

### Audit & Compliance

1. **Audit Logging**:
   - Log all auth failures, invalid payloads, rate limit violations
   - Table: `audit_logs(user_id, action, resource_type, resource_id, created_at, details)`
   - Retention: 2 years
   - Immutable: write once, no deletes

2. **Access Control Logging**:
   - Track who accessed what data, when, from where
   - Log device API key usage (which key, how many requests)

3. **Compliance Readiness** (Phase 3):
   - GDPR: `/devices/:device_id/data?before=<date>` endpoint for data deletion
   - SOC2: centralized logging, encryption, access controls
   - ISO 27001: information security management

## Deployment Architecture

### Phase 1: Home Server (Single Region)

```
┌─────────────────────────────────────────────┐
│ Home Server (Docker Compose)               │
├─────────────────────────────────────────────┤
│ Reverse Proxy (Nginx)                      │
│  ├── HTTP → HTTPS redirect                 │
│  └── /api → backend:8000                   │
│      /ws → backend:8000                    │
│      / → frontend:3000                     │
├─────────────────────────────────────────────┤
│ Backend (FastAPI/Express) :8000            │
│  ├── Ingestion API                         │
│  ├── Query API                             │
│  └── Auth service                          │
├─────────────────────────────────────────────┤
│ MQTT Broker (Mosquitto)                    │
│  ├── Port 1883 (local networks)            │
│  └── Port 8883 (TLS, optional)             │
├─────────────────────────────────────────────┤
│ PostgreSQL                                 │
│  └── Data + backups to external storage    │
├─────────────────────────────────────────────┤
│ Frontend (React/Vite) :3000                │
└─────────────────────────────────────────────┘
```

### Phase 2: Production (Single Region with HA)

```
┌──────────────────────────────────────────────────────────┐
│ Cloud or Data Center                                     │
├──────────────────────────────────────────────────────────┤
│ Load Balancer (HAProxy/AWS ALB)                          │
│  ├── Health checks: /status every 30s                    │
│  └── Failover: redirect to healthy backend               │
├──────────────────────────────────────────────────────────┤
│ Reverse Proxy Cluster (2+ Nginx instances)               │
│  ├── TLS termination                                     │
│  └── Request routing                                     │
├──────────────────────────────────────────────────────────┤
│ API Backend Cluster (2+ FastAPI/Express)                 │
│  ├── Stateless (auth via JWT)                            │
│  └── Replicated behind load balancer                     │
├──────────────────────────────────────────────────────────┤
│ MQTT Broker Cluster (EMQX 3+ nodes)                      │
│  ├── Built-in clustering + persistence                  │
│  ├── Health checks for failover                          │
│  └── Internal DNS for node discovery                     │
├──────────────────────────────────────────────────────────┤
│ Data Layer                                               │
│  ├── PostgreSQL Primary + Standby Replica                │
│  ├── Automated backups to S3                             │
│  └── Restore testing (monthly)                           │
├──────────────────────────────────────────────────────────┤
│ Redis Cluster (for caching + rate limiting)              │
│  ├── 3+ nodes (high availability)                        │
│  └── Automatic failover                                  │
├──────────────────────────────────────────────────────────┤
│ Frontend CDN (CloudFront/Cloudflare)                     │
│  ├── Distributed edge caches                            │
│  └── DDoS protection                                     │
├──────────────────────────────────────────────────────────┤
│ Observability Stack                                      │
│  ├── Prometheus (metrics)                                │
│  ├── Loki (logs)                                         │
│  ├── Grafana (dashboards)                                │
│  └── AlertManager (alerts)                               │
└──────────────────────────────────────────────────────────┘
```

### Phase 3: Global (Multi-Region)

```
┌─────────────────────────────────────────────┐
│ Global Load Balancer (Route 53 / Cloudflare)│
├─────────────────────────────────────────────┤
│ Geographic Routing:                         │
│ - US Traffic → US Region                    │
│ - EU Traffic → EU Region (GDPR)             │
│ - Asia Traffic → Asia Region                │
├─────────────────────────────────────────────┤
│ US Region (N. Virginia) - Like Phase 2      │
│ EU Region (Ireland) - Like Phase 2          │
│ Asia Region (Singapore) - Like Phase 2      │
└─────────────────────────────────────────────┘

Cross-Region Sync:
- Central analytics database (read replicas in each region)
- Message queue (SQS/RabbitMQ) for cross-region events
- Regional databases have data residency enforcement
```

## Backup and Retention Policy

### PostgreSQL Backups

**Frequency:**
- Daily: 24-hour snapshot (S3)
- Weekly: 7-day snapshot (S3) on Sundays
- Monthly: 30-day snapshot (Glacier) on 1st of month

**Retention:**
- Daily: keep 30 days
- Weekly: keep 12 weeks
- Monthly: keep 3 years

**Execution (Docker container):**
```bash
#!/bin/bash
BACKUP_DATE=$(date +%Y%m%d)
pg_dump hydronix_db | gzip > /tmp/hydronix_$BACKUP_DATE.sql.gz
aws s3 cp /tmp/hydronix_$BACKUP_DATE.sql.gz s3://hydronix-backups/daily/
# Cleanup old backups (keep 30 days)
aws s3 rm s3://hydronix-backups/daily/ --recursive \
  --exclude "*" --include "*.sql.gz" --older-than 30
```

**Restore Testing:**
- Automated: restore to test database monthly
- Manual: document restore procedure, test quarterly
- Restore SLA: 30 minutes from backup to operational

### Data Retention Policy

**Sensor Data:**
- Raw readings: 12 months (configurable)
- Archived (to Glacier): 3 years
- Automatic cleanup: delete older than 12 months via background job

**Alerts:**
- Keep 2 years
- Searchable via dashboard (with date filters)

**Audit Logs:**
- Keep 2 years (compliance requirement)
- Immutable storage (no deletes)

**Device Configuration:**
- Soft delete: set `is_active = false` (never hard delete)
- Retain history: 5 years (for audit trail)

## Observability & Monitoring

### Structured Logging

**Format:** JSON with fields:
```json
{
  "timestamp": "2026-06-14T21:00:00.123Z",
  "level": "INFO",
  "service": "ingestion-api",
  "trace_id": "abc-123-def",
  "device_id": "HYDRO_001",
  "message": "Reading ingested",
  "status_code": 200,
  "processing_time_ms": 45,
  "user_id": "user_123"
}
```

**Centralization:**
- ELK Stack (Elasticsearch + Logstash + Kibana) OR Loki
- Retention: 30 days for info/debug, 90 days for error/warn
- Searchable indices: service, level, trace_id, device_id

### Metrics (Prometheus)

1. **Ingestion**:
   - `hydronix_readings_ingested_total` — counter (device_id label)
   - `hydronix_ingestion_duration_ms` — histogram
   - `hydronix_queue_size_bytes` — gauge (device_id label)

2. **API Performance**:
   - `hydronix_http_request_duration_ms` — histogram (endpoint label)
   - `hydronix_http_requests_total` — counter (status code label)

3. **Database**:
   - `hydronix_query_duration_ms` — histogram
   - `hydronix_db_connection_pool_size` — gauge

4. **Device Health**:
   - `hydronix_devices_online` — gauge
   - `hydronix_devices_offline` — gauge
   - `hydronix_alerts_active` — gauge

5. **System**:
   - CPU, memory, disk usage
   - Network I/O

### Alerting Rules (AlertManager)

1. **Backend Offline**: if no ingestion for 5 minutes → page on-call
2. **MQTT Broker Down**: if broker unavailable for 2 minutes → page on-call
3. **Database Latency**: if p95 query time > 1s → warning (dial in if > 5s)
4. **High Error Rate**: if error rate > 1% → warning
5. **Low Disk Space**: if disk > 90% → warning
6. **Backup Failed**: if daily backup missing → warning (check logs)

### Dashboard (Grafana)

- System health: CPU, memory, disk, network
- Ingestion metrics: readings/sec, queue size, latency
- Device overview: online count, offline alerts
- Alert volume: alerts/hour, unacknowledged count
- Error rates: HTTP 4xx/5xx, MQTT disconnects

## Testing Strategy

### Unit Tests
- Sensor data validation logic
- Quality score calculations
- Anomaly detection rules
- Authentication token validation

### Integration Tests
- Device API key auth flow
- Data ingestion (device → backend → database)
- Alert generation on out-of-range values
- Offline buffering + sync

### End-to-End Tests (Staging)
- Simulate device: send readings via MQTT/HTTP
- Verify dashboard displays data <2s
- Trigger alert, verify notification delivery
- Device offline: verify buffer + sync

### Load Testing (Staging)
- 1000 devices sending 1 reading/min = 16.7 readings/sec
- Target: <200ms ingestion latency, 99th percentile
- Broker load: 16.7k connections sustained

### Chaos Testing (Phase 2+)
- Kill broker node: device reconnects within 30s
- Kill API instance: requests redirected to healthy instance
- Database failover: automatic switchover <2 min
- Network partition: devices buffer to SD, sync on recovery

## Incident Response

### On-Call Rotation
- 1 on-call engineer per week
- Escalation: P1 (immediate page), P2 (within 1 hour), P3 (next business day)

### P1 Incidents (Immediate)
- Entire backend offline (no readings ingested for >5 min)
- MQTT broker cluster down (devices can't send data)
- Data loss or corruption detected
- Response time: 15 minutes to incident response team
- RTO: 30 minutes to restore service

### P2 Incidents (Within 1 hour)
- Single device offline >1 hour (likely device failure, not infrastructure)
- High alert rate (>100 alerts/min, likely rules misconfigured)
- Dashboard slowness (>10s page load)

### P3 Incidents (Next business day)
- Minor UI issues
- Non-critical feature broken
- Low-priority documentation issues

### Post-Mortem Process
- After every P1 incident: postmortem within 48 hours
- Document: timeline, root cause, action items
- Share learnings with team

