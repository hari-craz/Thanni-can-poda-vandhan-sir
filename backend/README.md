Hydronix Backend — Ingest Service

What this scaffold provides:
- FastAPI HTTP endpoint /ingest to accept JSON sensor payloads
- MQTT subscriber (background thread) subscribing to topic defined in config
- SQLAlchemy model storing raw payloads into Postgres sensor_data table
- Dockerfile for containerizing the service and docker-compose.yml for local DB + service

Quick start (local):
1. docker-compose up --build
2. POST JSON to http://localhost:8000/ingest with body: {"device_id":"HYDRO_001","data":{...}}

Notes:
- Update .env or environment variables as needed (DATABASE_URL, MQTT_BROKER, MQTT_PORT)
- This is a minimal scaffold; add auth, validation, and schema mapping before production
