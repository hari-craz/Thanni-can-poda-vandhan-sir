# Hydronix IoT Platform Configuration & Architecture Specification

This document provides the definitive production-grade architecture, infrastructure audit, storage topology, communication protocol details, and security configuration for the **Hydronix Water Monitoring Platform**.

---

## 1. Infrastructure Audit

### Existing Service Stack Analysis

```mermaid
graph TD
    Client[Nginx Reverse Proxy] -->|Port 80| API[FastAPI Backend]
    Client -->|Port 80| WS[WebSocket Service]
    API -->|Port 5432| DB[(PostgreSQL DB)]
    API -->|Port 6379| Cache[(Redis Cache)]
    API -->|Port 8000| ML[ML Prediction Service]
    Bridge[MQTT Bridge] -->|TCP 1883| Broker[Mosquitto Broker]
    Broker -->|Pub/Sub| Bridge
```

1.  **Orchestration**: The system is fully containerized using Docker Compose. Development and monitoring stacks are split, which provides isolated namespaces for telemetry operations and monitoring tools.
2.  **API Layer**: Powered by FastAPI. Data ingestion, telemetry queries, and alert configurations run in a single process. It is highly responsive but requires process scaling (Uvicorn workers) for high telemetry loads.
3.  **ML Inference**: Managed by `ml-service` (FastAPI + XGBoost model). Features are loaded from pre-compiled joblib pipelines.
4.  **Telemetry Bridge**: Broker connectivity relies on Eclipse Mosquitto. Incoming topics are processed and bridged to the REST API via MQTT client routines.
5.  **State & Caching**: PostgreSQL handles core persistence (sensor logs, alerts, accounts), while Redis provides temporary rate-limit tracking and cached devices tables.

### Identified Gaps & Gaps Remedied
*   **Static In-Memory Authenticator (Resolved)**: Transitioned authentication from static configuration checks to database-driven user models.
*   **Case Sensitivity Loss in ML inputs (Resolved)**: Key capitalization normalization now prevents telemetry parameter values from being discarded and imputed by KNN models.
*   **Lack of S3 Object Store (Remedied)**: Configured a MinIO container to host exports, static report file generations, and offline logs.

---

## 2. Environment Variable Specification

A template file [`.env.example`](file:///c:/Users/harik/OneDrive/Desktop/Git/Thanni-can-poda-vandhan-sir/.env.example) has been created in the workspace. Below is the production reference:

| Key | Description | Default / Recommended | Scope |
| :--- | :--- | :--- | :--- |
| `APP_NAME` | Name of the platform instance | `Hydronix` | System |
| `NODE_ENV` | Run environment flag | `production` | System |
| `SUPER_ADMIN_EMAIL` | Email for bootstrapping the root account | `superadmin@hydronix.com` | Security |
| `SUPER_ADMIN_PASSWORD` | Strong password for bootstrapping the admin | `[GENERATE_RANDOM]` | Security |
| `JWT_SECRET` | Signing key for API Bearer tokens | `[32-BYTE-CRYPTOGRAPHIC-HEX]`| Security |
| `POSTGRES_HOST` | Host of the PostgreSQL database | `db` | Database |
| `REDIS_HOST` | Host of the Redis cache | `redis` | Cache |
| `MINIO_ENDPOINT` | Host of the MinIO object store | `minio` | Storage |
| `MINIO_ACCESS_KEY` | Access key credentials for S3 bucket access | `[MINIO-USER]` | Storage |
| `MINIO_SECRET_KEY` | Secret credentials for S3 bucket access | `[MINIO-PASSWORD]` | Storage |
| `REPORTS_STORAGE` | Mount path for generated analytical PDFs | `/storage/hydronix/reports`| Storage |

---

## 3. Production Docker Architecture

The recommended multi-container production configuration is defined in the [docker-compose.yml](file:///c:/Users/harik/OneDrive/Desktop/Git/Thanni-can-poda-vandhan-sir/docker-compose.yml).

### Services Architecture

```yaml
version: '3.8'

services:
  hydronix-postgres:
    image: postgres:15-alpine
    container_name: hydronix-postgres
    restart: always
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - /storage/hydronix/postgres:/var/lib/postgresql/data
    networks:
      - hydronix-backend-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 5

  hydronix-redis:
    image: redis:7-alpine
    container_name: hydronix-redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - /storage/hydronix/redis:/data
    networks:
      - hydronix-backend-net
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  hydronix-minio:
    image: minio/minio:RELEASE.2023-09-07T01-49-47Z
    container_name: hydronix-minio
    restart: always
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    command: server /data --console-address ":9001"
    volumes:
      - /storage/hydronix/minio:/data
    networks:
      - hydronix-backend-net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 15s
      timeout: 5s
      retries: 3

  hydronix-api:
    build: ./backend
    container_name: hydronix-api
    restart: always
    environment:
      DATABASE_URL: postgresql+psycopg2://${POSTGRES_USER}:${POSTGRES_PASSWORD}@hydronix-postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@hydronix-redis:6379/0
      SUPER_ADMIN_EMAIL: ${SUPER_ADMIN_EMAIL}
      SUPER_ADMIN_PASSWORD: ${SUPER_ADMIN_PASSWORD}
      ML_SERVICE_ENABLED: "true"
      ML_SERVICE_URL: http://hydronix-ml-service:8000
      ML_SERVICE_API_KEY: "hydronix_local_key"
    volumes:
      - /storage/hydronix/uploads:/storage/hydronix/uploads
      - /storage/hydronix/reports:/storage/hydronix/reports
      - /storage/hydronix/logs:/storage/hydronix/logs
    depends_on:
      hydronix-postgres:
        condition: service_healthy
      hydronix-redis:
        condition: service_healthy
    networks:
      - hydronix-backend-net
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/health')\""]
      interval: 10s
      timeout: 5s
      retries: 3

  hydronix-mqtt-bridge:
    image: eclipse-mosquitto:2.0
    container_name: hydronix-mqtt-bridge
    restart: always
    ports:
      - "1883:1883"
    volumes:
      - ./mqtt/config:/mosquitto/config:ro
      - /storage/hydronix/mqtt:/mosquitto/data
    networks:
      - hydronix-backend-net

  hydronix-nginx:
    image: nginx:alpine
    container_name: hydronix-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /storage/hydronix/certs:/etc/nginx/certs:ro
    depends_on:
      - hydronix-api
    networks:
      - hydronix-backend-net

networks:
  hydronix-backend-net:
    driver: bridge
```

---

## 4. Storage Architecture

All persistent data structures are isolated inside a central root directory `/storage/hydronix/` on the Docker host:

```text
/storage/hydronix/
├── postgres/   # Raw PostgreSQL data files (Ext4/XFS filesystem)
├── redis/      # Redis Append-Only File (AOF) and snapshot (rdb) data
├── minio/      # Object storage data (buckets, raw files)
├── uploads/    # Firmware binaries (.bin files) uploaded for OTA
├── reports/    # Generated analytical report PDFs
├── backups/    # Daily database and settings backups
├── logs/       # Rotated application container log files
└── certs/      # TLS Certificates & Private keys for Nginx
```

### Retention Strategy
*   **Sensor Logs (`sensor_data` table)**: Keep detailed logs for 90 days. Aggregate hourly averages into historical trend tables and purge raw logs.
*   **Report PDFs**: Auto-prune reports older than 1 year from `/reports`.
*   **Application Logs**: Configured with Logrotate (maximum 7 daily segments, compressed).

### Backup & Restore Strategy
*   **Postgres Backup**: Run `pg_dump` daily. Compress, timestamp, and upload to `hydronix-backups` S3 bucket in MinIO.
*   **MinIO Sync**: Use `rclone sync` or custom cron job to replicate `/storage/hydronix/minio/` files to an off-site secondary cloud bucket.

---

## 5. Port Allocation Matrix

To maintain isolation, only the reverse proxy (Nginx) and MQTT broker are bound to external host interfaces. All other system components communicate privately within the internal Docker bridge network:

| Service Name | Internal Port | Host Binding Port | Access Scope | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `hydronix-nginx` | `80`, `443` | `80`, `443` | **Public** | Routes Client Traffic |
| `hydronix-mqtt-bridge` | `1883` | `1883` | **Public** | Broker interface for ESP32 nodes |
| `hydronix-api` | `8000` | None | Private | REST Backend endpoints |
| `hydronix-postgres` | `5432` | None | Private | Core SQL Database |
| `hydronix-redis` | `6379` | None | Private | Rate limits & Caching |
| `hydronix-minio` | `9000`, `9001`| None | Private | S3 Object store & Console |
| `hydronix-ml-service` | `8000` | None | Private | Machine learning scoring engine |

---

## 6. Authentication Bootstrap Strategy

1.  **Bootstrapper Run**: During application startup (`startup_event` hook), the system opens a transaction and queries:
    ```sql
    SELECT COUNT(*) FROM users;
    ```
2.  **Superadmin Seed**: If the query returns `0`, the application reads `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` environment variables. It creates the primary user with `role="superadmin"` and inserts the user into the database.
3.  **Bootstrap Termination**: Once a single record is inserted, the bootstrapper logic is permanently bypassed.
4.  **Admin Creation Protocol**: Regular `admin` users can only be provisioned by a logged-in `superadmin` posting to the user-management endpoints.

---

## 7. MQTT Architecture

### Topic Structure
*   **Sensor Data Ingest**: `hydronix/devices/{device_id}/telemetry`
*   **Heartbeat / Health**: `hydronix/devices/{device_id}/heartbeat`
*   **OTA Firmware Updates**: `hydronix/devices/{device_id}/ota`
*   **Key Rotation Commands**: `hydronix/devices/{device_id}/keys`

### Authentication & API Key Verification
1.  MQTT Broker requests authentication via local files or a webhook check.
2.  Each device is provisioned with an API key, passed during client handshakes.
3.  Telemetry messages received on `hydronix/devices/{device_id}/telemetry` are verified by comparing the message payload against the client metadata stored in PostgreSQL.

---

## 8. WebSocket Architecture

WebSocket server provides low-latency events broadcasting to admin dashboards.

### Connection Flow
1.  Client initiates WebSocket handshake: `ws://[host]/ws/updates`.
2.  FastAPI middleware authenticates the client using the JWT Bearer token passed in the `token` query parameter.
3.  If valid, the connection is accepted and registered to the active connections manager pool.

### Event Models

#### `device_status`
```json
{
  "type": "device_status",
  "device_id": "HYDRO_001",
  "status": "online",
  "timestamp": "2026-06-15T20:10:00Z"
}
```

#### `quality_score_updated`
```json
{
  "type": "reading",
  "device_id": "HYDRO_001",
  "quality_score": 96,
  "timestamp": "2026-06-15T20:10:05Z",
  "values": {
    "ph": 7.2,
    "turbidity": 2.1,
    "tds": 150.0,
    "temperature": 25.1,
    "flow_rate": 5.2
  }
}
```

---

## 9. API Standards

### JSON Error Formatting

All error payloads conform to a strict schema to ease parsing on the frontend:

```json
{
  "ok": false,
  "error": "Validation Error",
  "details": {
    "field": "ph",
    "reason": "pH value must be between 0.0 and 14.0",
    "value": 15.2
  }
}
```

### CORS Policies
Allowed origins are locked to matching local and production URLs (e.g. `https://dashboard.hydronix.com`). Credentials headers are enabled to allow cookie-based refresh tokens if needed.

---

## 10. Frontend Integration Contract

### Key Endpoint Matrix

| Method | Route | Auth Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/token` | Public | Logs user in, returns access JWT and user roles |
| `POST` | `/data` | Device | Device telemetry ingestion endpoint |
| `GET` | `/devices` | Admin/Super | Returns list of registered devices (supports paging) |
| `POST`| `/devices/provision` | Superadmin | Registers new device, returns generated API key |
| `GET` | `/alerts` | Admin/Super | Fetches triggered alerts list |
| `POST`| `/alerts/{id}/acknowledge`| Admin/Super | Acknowledges active critical alert |
| `GET` | `/anomalies` | Admin/Super | Retrieves detected telemetry anomalies |

---

## 11. Security Recommendations

1.  **Network Isolation**: Only Nginx (port 80/443) and Mosquitto Broker (port 1883/8883) should be exposed to public networks. Ensure database and cache volumes reside in a private Docker virtual network.
2.  **API Key Encrypted Storage**: Raw device API keys must never be stored in plain text in the database. Ensure hashes (e.g., PBKDF2/SHA256) are validated on telemetry ingestion.
3.  **TLS Encryption**: Enforce TLS 1.3 on Nginx. Secure the MQTT interface using port 8883 (MQTTS) with device client certificates.

---

## 12. Production Deployment Checklist

*   [ ] Configure production `.env` with strong keys and disable default passwords.
*   [ ] Provision Host Volumes under `/storage/hydronix/`.
*   [ ] Register domain certificates under `/storage/hydronix/certs/`.
*   [ ] Rebuild production containers: `docker compose -f docker-compose.yml up -d --build`.
*   [ ] Confirm superadmin user boots successfully on initial startup.
*   [ ] Verify ports bindings (check that Postgres, Redis, and MinIO ports are unexposed).
*   [ ] Run the test runner `python run_smoke_tests.py` to verify all services pass health checks.
