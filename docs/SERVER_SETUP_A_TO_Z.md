# Hydronix Server Configuration: A-to-Z Guide

This guide provides a comprehensive, step-by-step walkthrough to configure, deploy, and verify the Hydronix server stack from scratch. The system is designed to run via Docker Compose and uses an HTTPS-only architecture (via Cloudflare Tunnels).

---

## Step 1: System Prerequisites

Before starting, ensure your host server (Linux, Windows, or TrueNAS SCALE) has the following installed:
1. **Docker Engine & Docker Compose**: The entire stack is containerized.
2. **Git**: To clone the repository.
3. **Python 3.11+** (Optional but recommended): For running the local test scripts.

---

## Step 2: Clone the Repository

Clone the project to your host machine and navigate to the root directory:

```bash
git clone https://github.com/hari-craz/Thanni-can-poda-vandhan-sir.git
cd Thanni-can-poda-vandhan-sir
```

---

## Step 3: Configure Environment Variables

The system relies heavily on a `.env` file to securely pass credentials and paths to the Docker containers.

1. Create your `.env` file by copying the example:
   ```bash
   cp .env.example .env
   ```

2. Open the `.env` file and configure the critical sections:

### 🔑 Security Secrets
- `JWT_SECRET`: Change this to a random 32-byte hex string. This is used to sign authentication tokens.
- `SUPER_ADMIN_PASSWORD`: Change the default admin password (`admin`).

### 🗄️ Database Credentials
Update the PostgreSQL and Redis passwords to ensure the databases cannot be accessed with default credentials:
- `POSTGRES_PASSWORD=your_secure_db_password`
- `REDIS_PASSWORD=your_secure_redis_password`

### 📂 Persistent Storage Paths
The backend API needs physical directories on your host server to save files (reports, logs, uploads, backups). 
- If you are on **TrueNAS SCALE / Linux**, point these to your mounted datasets (e.g., `/mnt/tank/docker-data/hydronix/reports`).
- If you are testing locally on **Windows**, point them to a local path (e.g., `D:\Hydronix\reports`).

> [!WARNING]
> If you are running the backend inside Docker, remember that the backend container operates on Linux paths (e.g., `/app/data`). Ensure you map your host volumes correctly in `docker-compose.yml` if you change default storage behaviors!

---

## Step 4: Build and Deploy the Docker Stack

Hydronix uses a multi-container architecture containing:
- **db**: PostgreSQL 13
- **redis**: Redis 7
- **ml-service**: Python API for Water Quality ML predictions
- **backend**: FastAPI core backend
- **loki & promtail**: Log aggregation

To build the images and start the entire stack in the background, run:

```bash
docker compose up -d --build
```

Docker will pull the necessary base images, build the custom Python images for the ML Service and Backend, and start the network.

---

## Step 5: Verify the Deployment

Once the containers say "Started", verify that everything is healthy using the built-in test suites.

1. **Unit Tests (Backend Integrity):**
   ```bash
   python tests/run_backend_tests.py
   ```
   *This checks database connections, Pydantic schemas, and the quality scoring logic.*

2. **Smoke Tests (API & Network Integrity):**
   ```bash
   python tests/run_smoke_tests.py
   ```
   *This fires 98 tests across the network to simulate real ESP32 telemetry ingestion, ML prediction endpoints, and database caching.*

> [!TIP]
> If a container crashes, you can view its exact error logs by running: `docker compose logs backend --tail=50`

---

## Step 6: Configure Cloudflare Tunnels (HTTPS-Only Transport)

Since version 2.0.0, Hydronix explicitly enforces HTTPS-only transport and has deprecated MQTT. To expose your local Docker containers securely to the public internet (so the ESP32 can send data), you must set up a Cloudflare Tunnel.

1. Go to your **Cloudflare Dashboard** -> **Zero Trust** -> **Networks** -> **Tunnels**.
2. Create a new tunnel and install the `cloudflared` connector on your server.
3. Configure the **Public Hostnames** in Cloudflare:
   - Map `api.yourdomain.com` -> `http://localhost:10020` (The Backend FastAPI service).
   - Map `dashboard.yourdomain.com` -> `http://localhost:3000` (The Frontend React service).
4. In your `.env` file, update the Cloudflare settings:
   ```env
   CLOUDFLARE_TUNNEL_ENABLED=true
   CLOUDFLARE_TUNNEL_URL=https://api.yourdomain.com
   HTTPS_ONLY=true
   ```

---

## Step 7: Connecting the ESP32 Devices

With the server running and securely exposed via Cloudflare:
1. Log in to your Hydronix Backend Admin dashboard.
2. Provision a new device (e.g., `HYDRO_001`).
3. The server will provide an **API Key**.
4. Enter your Cloudflare URL (`https://api.yourdomain.com/v2`) and the **API Key** into the ESP32's captive WiFi portal (`hydro-001-setup`).

The device will immediately begin pushing secure JSON payloads to the backend!

---

## Maintenance & Monitoring

- **To update the server** after pulling new code from GitHub:
  ```bash
  docker compose up -d --build
  ```
- **To view live logs** across all services:
  ```bash
  docker compose logs -f
  ```
- **To shut down** the server (while keeping data safe):
  ```bash
  docker compose down
  ```
