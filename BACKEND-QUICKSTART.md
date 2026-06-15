# Backend Quick Start Guide

## Prerequisites
- Python 3.9+
- Docker & Docker Compose (or PostgreSQL + Redis installed locally)
- Git

## Step 1: Set Up Virtual Environment

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate it
# On Windows:
.\.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate
```

## Step 2: Install Dependencies

```bash
pip install -r requirements.txt
```

## Step 3: Create Environment File

Create `backend/.env`:

```env
# Database
DATABASE_URL=postgresql+psycopg2://hydronix:hydronix_pass@localhost:5432/hydronix_db

# MQTT
MQTT_BROKER=broker.hivemq.com
MQTT_PORT=1883
MQTT_USE_TLS=false

# Redis
REDIS_URL=redis://localhost:6379/0

# API
API_HOST=0.0.0.0
API_PORT=8000
ENVIRONMENT=development

# Security
JWT_SECRET_KEY=your-secret-key-change-in-production
API_KEY_EXPIRY_DAYS=90

# ML (Phase 2)
ML_SERVICE_ENABLED=false
```

## Step 4: Start Database & Cache Services

### Option A: Using Docker Compose (Recommended)

```bash
# From repo root
docker-compose up -d db redis

# Verify services are running
docker-compose ps
```

### Option B: Local Installations

**PostgreSQL**:
- macOS: `brew install postgresql@14`
- Windows: Download from https://www.postgresql.org/download/windows/
- Linux: `apt-get install postgresql`

**Redis**:
- macOS: `brew install redis`
- Windows: Use Windows Subsystem for Linux (WSL2) or Docker
- Linux: `apt-get install redis-server`

Start services:
```bash
# PostgreSQL (background)
pg_ctl -D /usr/local/var/postgres start

# Redis (background)
redis-server &
```

## Step 5: Run Backend

```bash
cd backend

# Development mode (with auto-reload)
uvicorn app.main:app --reload --port 8000

# Production mode
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

## Step 6: Verify Backend is Running

```bash
# Health check
curl http://localhost:8000/health

# Should return:
# {"status":"healthy","timestamp":"2026-06-15T..."}
```

## Step 7: Test API Endpoints

### Create a Device

```bash
curl -X POST http://localhost:8000/devices/provision \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "HYDRO_001",
    "name": "Test Device",
    "location": "Laboratory"
  }'
```

**Response** (save the `api_key`):
```json
{
  "device_id": "HYDRO_001",
  "api_key": "hydro_HYDRO_001_...",
  "qr_code": "data:image/png;base64,...",
  "setup_url": "http://192.168.4.1?key=..."
}
```

### Send Sensor Data

Replace `<API_KEY>` with the key from above:

```bash
curl -X POST http://localhost:8000/data \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <API_KEY>" \
  -d '{
    "device_id": "HYDRO_001",
    "ph": 7.2,
    "turbidity": 3.1,
    "tds": 120,
    "temperature": 25.0,
    "flow_rate": 10.5,
    "timestamp": "2026-06-15T13:30:00Z",
    "seq_no": 1
  }'
```

**Response**:
```json
{
  "ok": true,
  "accepted": 1,
  "rejected": 0
}
```

### Query Device Data

```bash
curl http://localhost:8000/data/HYDRO_001
```

**Response**:
```json
{
  "device_id": "HYDRO_001",
  "readings": [
    {
      "id": 1,
      "device_id": "HYDRO_001",
      "ph": 7.2,
      "turbidity": 3.1,
      "tds": 120,
      "temperature": 25.0,
      "flow_rate": 10.5,
      "timestamp": "2026-06-15T13:30:00Z",
      "received_at": "2026-06-15T13:35:00Z",
      "quality_score": 100,
      "anomaly_flags": null
    }
  ],
  "total": 1
}
```

### List All Devices

```bash
curl http://localhost:8000/devices
```

### View API Documentation

**Swagger UI**:
http://localhost:8000/docs

**ReDoc**:
http://localhost:8000/redoc

## Step 8: Test Quality Scoring

Send data with pH out of range:

```bash
curl -X POST http://localhost:8000/data \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <API_KEY>" \
  -d '{
    "device_id": "HYDRO_001",
    "ph": 9.2,
    "turbidity": 8.0,
    "tds": 450,
    "temperature": 50.0,
    "flow_rate": 10.0,
    "timestamp": "2026-06-15T13:35:00Z",
    "seq_no": 2
  }'
```

Query the data:
```bash
curl "http://localhost:8000/data/HYDRO_001?limit=10"
```

You'll see:
- Reduced `quality_score` (due to out-of-range pH, turbidity, TDS, temperature)
- `anomaly_flags` marked with reasons

View alerts:
```bash
curl "http://localhost:8000/alerts"
```

## Troubleshooting

### Port 8000 Already in Use

```bash
# Find process using port 8000
# On Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# On macOS/Linux:
lsof -i :8000
kill -9 <PID>
```

### Database Connection Error

```
Error: could not connect to server: Connection refused
```

**Solution**: Ensure PostgreSQL is running:
```bash
# Check if service is running
# Windows:
sqlcmd -S localhost -U hydronix

# macOS/Linux:
psql -U postgres
```

### Redis Connection Error

```
Error: connection pool exhausted
```

**Solution**: Ensure Redis is running:
```bash
# Check if service is running
# macOS:
brew services list | grep redis

# Windows (in WSL):
sudo service redis-server status

# Linux:
sudo systemctl status redis-server
```

## Development Tips

### Enable Debug Logging

In `backend/.env`:
```env
LOG_LEVEL=DEBUG
```

### Use Postman for API Testing

1. Download [Postman](https://www.postman.com/downloads/)
2. Import `backend/postman_collection.json` (create this file with all endpoints)
3. Set variable: `api_key = <your_api_key>`
4. Run tests

### Hot Reload

The `--reload` flag watches for code changes:
```bash
uvicorn app.main:app --reload
```

Just save a file and it will auto-restart!

### Database Inspection

```bash
# Connect to PostgreSQL
psql -U hydronix -d hydronix_db

# View tables
\dt

# View devices
SELECT * FROM devices;

# View sensor data
SELECT device_id, ph, turbidity, quality_score FROM sensor_data LIMIT 10;
```

## Next Steps

1. ✅ **Backend running locally** → Test with curl/Postman
2. 🔜 **Implement MQTT integration** (2-3 hours) → Connect real devices
3. 🔜 **Create frontend** (3-4 weeks) → React dashboard
4. 🔜 **Deploy to production** → Docker + Kubernetes

## Support

- **API Docs**: http://localhost:8000/docs (Swagger)
- **Backend Spec**: `docs/Backend-Spec.md`
- **Database Schema**: `docs/ER-Diagram.md`
- **Issues**: Open GitHub issue in repository
