# Copilot instructions — Hydronix (Thanni-can-poda-vandhan-sir)

**Purpose**: Provide concise guidance for future Copilot sessions working on this repository.

## 0) Repo layout and agent guidance

- This repo is primarily a Python/FastAPI backend with IoT firmware, ML model training, and a Docker Compose local dev stack.
- Use `backend/app/` for implementation details, `docs/` for API contracts and architecture, `ML-Model/` for model training and artifacts, `ml-service/` for runtime ML inference, and `firmware/` for ESP32 firmware.
- When changing backend APIs or schemas, update the relevant docs (`docs/Backend-Spec.md`, `docs/ER-Diagram.md`) and backend tests.
- Do not invent a new server framework for the backend; preserve FastAPI/SQLAlchemy and Docker Compose integration.

## 1) Build, test, and lint commands

### Backend (Python/FastAPI)
- **Setup**: `python -m venv .venv && .\.venv\Scripts\activate && pip install -r backend/requirements.txt`
- **Run locally**: `uvicorn backend.app.main:app --reload` (port 8000 by default)
  - Alternative: `python -m uvicorn backend.app.main:app --reload`
- **Run with Docker**: `docker-compose up --build`
  - Starts: backend (8000), db (5432), redis (6379), mqtt (1883), ml-service (8001), loki (3100), promtail

- **Run test suite (pytest)**:
  - Install test deps: `pip install -r backend/requirements.txt && pip install -r backend/requirements-test.txt`
  - Run all tests: `pytest -q backend/tests`
  - Run single test file: `pytest -q backend/tests/test_quality_score.py`
  - Run a single test case or test method: `pytest -q backend/tests/test_quality_score.py::TestQualityScoring::test_perfect_water_quality`
  - Run with coverage: `pytest --cov=backend backend/tests`

- **Standalone test runner** (quick validation): `python run_backend_tests.py`
  - Tests: module imports, authentication, quality scoring, database models, configuration, Pydantic schemas.
  - Used by maintainers and GitHub Actions in `.github/workflows/backend-ci.yml`.

- **Health check endpoint**: `curl http://localhost:8000/health` (returns JSON with status and timestamp)

- **Test single endpoint (manual)**:
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
      "timestamp": "2026-06-17T19:54:00Z",
      "seq_no": 1
    }'
  ```

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### ML Model (Python/scikit-learn/XGBoost)
- **Setup**: `pip install -r ML-Model/requirements.txt`
- **Run Phase C (best production model, ~68% accuracy)**: `python ML-Model/phase_c_stacking.py` (3-5 minutes)
  - Output: Phase C stacking report saved to `ML-Model/logs/phase_c_report_YYYYMMDD_HHMMSS.json`
- **Run Phase G (full hyperparameter tuning via Optuna)**:
  - Full tuning: `python ML-Model/phase_g_optuna_stack.py --trials_xgb 80 --trials_lgb 60` (20+ minutes)
  - Quick diagnostics: `python ML-Model/phase_g_optuna_stack.py --trials_xgb 20 --trials_lgb 15` (5 minutes)
- **Run NN meta-learner** (best on GPU): `python ML-Model/colab_nn_meta.py` (10-30 minutes)
- **View latest model report**: `python -c "import glob,json; print(open(sorted(glob.glob('ML-Model/logs/*phase_*.json'))[-1]).read())"`
- **Dataset location**: `ML-Model/balanced_water_potability_3000.csv` (3000 balanced samples, 9 features)
  - Do NOT commit large datasets; keep only balanced_water_potability_3000.csv in repo.
- **Model artifacts location**: `ML-Model/models/` contains:
  - `Preprocessor.pkl` (IterativeImputer + StandardScaler; **must load before prediction**)
  - `*_model.pkl` (individual base learners: RandomForest, XGBoost, GradientBoosting, IsolationForest)
  - `stacking_model.pkl` (final ensemble)

### Frontend (if/when implemented)
- **Setup**: `npm install` in frontend directory
- **Run**: `npm run dev` (development) or `npm start` (production)
- **Build**: `npm run build`
- **Test**: `npm test` (if added)

## 2) Docker & Deployment

### Quick Start with Docker Compose
```bash
# Start full stack (backend, db, redis, mqtt, ml-service, loki, promtail)
docker-compose up --build

# Run specific service only
docker-compose up --build backend
docker-compose up --build db redis

# Stop all services
docker-compose down

# View logs
docker-compose logs -f backend
docker-compose logs -f ml-service

# Clean up volumes (WARNING: deletes data)
docker-compose down -v
```

### Service Dependencies & Ports
| Service | Port | Depends On | Purpose |
|---------|------|-----------|---------|
| **backend** | 8000 | db, redis, mqtt, ml-service | FastAPI ingestion & API |
| **db** | 5432 | — | PostgreSQL (sensor data, devices, alerts) |
| **redis** | 6379 | — | Rate limiting & caching |
| **mqtt** | 1883 | — | MQTT broker (Eclipse Mosquitto) |
| **ml-service** | 8001 | db | ML inference (anomaly detection) |
| **loki** | 3100 | — | Log aggregation (Grafana Loki) |
| **promtail** | — | loki | Log forwarder to Loki |

### Environment Configuration
See `backend/.env` or `.env.example`. Key variables:
- `DATABASE_URL`: PostgreSQL connection (Docker: `postgresql+psycopg2://hydronix:hydronix_pass@db:5432/hydronix_db`)
- `REDIS_URL`: Redis connection (Docker: `redis://redis:6379/0`)
- `MQTT_BROKER` / `MQTT_PORT`: MQTT broker (Docker: `mqtt:1883`)
- `ML_SERVICE_URL`: ML service endpoint (Docker: `http://ml-service:8000`)
- `ML_SERVICE_ENABLED`: Enable/disable ML enrichment (`true`/`false`)
- `JWT_SECRET_KEY`: For API token signing (change in production)
- `API_KEY_EXPIRY_DAYS`: API key expiration (default: 90)

## 3) High-level architecture

**Hydronix** is a 4-layer IoT water monitoring system with 3-phase implementation roadmap:

### System Layers
1. **Edge (ESP32 devices)**: Collect pH, temperature, turbidity, TDS, flow; host local WiFi setup portal (`Hydronix_Setup` at `192.168.4.1`); buffer data to SD card when offline. **NEW**: Control electric solenoid valve (open/close) based on local quality rules and remote commands.
2. **Backend (FastAPI + PostgreSQL)**: Ingest telemetry via MQTT (preferred) or HTTP POST `/ingest`; store sensor data; compute rule-based quality scores; serve REST APIs; send valve control commands to devices; log all valve operations for audit trail; integrate ML for anomaly detection (Phase 2+).
3. **Frontend (React/Next)**: Web dashboard showing real-time and historical charts, device status, water quality scores, alerts, and optional map view. **NEW**: Valve status display (open/closed), manual valve control buttons (with confirmation), valve operation audit logs.
4. **ML/Anomaly Detection**: Stacking ensemble (Phase C: 68% accuracy, Phase G tuning: TBD) for anomaly flagging. **Status**: Research phase; not ready for primary alerting yet. Use rule-based system as primary layer, ML as secondary enrichment.

### Integration Points
- **Device → Backend**: JSON payloads with `device_id` (format: `HYDRO_###`), timestamp (ISO 8601), and sensor readings (ph, turbidity, tds, temperature, flow_rate). **NEW**: Valve status (open/closed) and valve operation result included in payloads.
- **Backend → Device**: MQTT or HTTP POST for valve control commands. **NEW**: Command format: `{"device_id": "HYDRO_001", "valve_action": "open"|"close", "reason": "manual_control"|"auto_safety_cutoff", "timestamp": "ISO-8601"}`.
- **Backend → DB**: SQLAlchemy ORM; Devices table (device_id PK, name, location, status, last_seen, **valve_status**); Sensor Data table (id, device_id FK, all 5 readings, timestamp, **valve_state**); **NEW**: Valve Operations table (id, device_id FK, action, triggered_by, quality_score_at_trigger, timestamp).
- **Backend → Frontend**: WebSocket for real-time updates (including valve state changes); REST endpoints for historical queries and valve operation logs.
- **Backend → ML Service**: HTTP POST to ml-service:8000 with sensor vector; returns anomaly score + confidence.

### Data Flow
```
ESP32 (sensor readings)
  ↓ MQTT / HTTP POST
Backend /ingest endpoint
  ↓ Insert + Rule-based scoring
PostgreSQL (devices, sensor_data tables)
  ↓ Query + ML enrichment
ML Service (Phase C stacking model)
  ↓ Return anomaly flags + confidence
Dashboard WebSocket/REST
  ↓ Visualize
User (charts, alerts, status)
```

### Offline-First Design
- ESP32 stores readings on SD card (72-hour buffer).
- On reconnection, device syncs buffered data (no loss).
- Backend stores all data; dashboard shows "offline" status for unreachable devices.

## 4) Key conventions and repository-specific patterns

### Device Identity & Telemetry
- **Device ID format**: `HYDRO_###` (e.g., `HYDRO_001`, `HYDRO_042`). Keep device_id stable and unique; used as primary key in Devices table.
- **Telemetry JSON payload**:
  ```json
  {
    "device_id": "HYDRO_001",
    "ph": 7.2,
    "turbidity": 3.1,
    "tds": 120,
    "temperature": 25.0,
    "flow_rate": 10.5,
    "timestamp": "2026-04-09T10:30:00Z"
  }
  ```
- **All timestamps** must be ISO 8601 (UTC preferred).

### Communication & Retry Strategy
- **Primary transport**: MQTT (HiveMQ broker at broker.hivemq.com:1883 or on-prem EMQX cluster).
- **Fallback transport**: HTTP POST to `/ingest` endpoint.
- **Retry/Backoff**: Exponential backoff (max 30s). If MQTT unavailable, switch to HTTP. Buffer on SD card if both fail.
- **Authentication**: API key per device (stored in backend, validated on POST).

### Backend Code Structure
- `backend/app/main.py` — FastAPI app, route definitions.
- `backend/app/database.py` — SQLAlchemy setup, connection pooling.
- `backend/app/schemas.py` — Pydantic models for request/response validation.
- `backend/app/ingest.py` — MQTT subscriber + HTTP handler logic.
- `backend/app/config.py` — Environment config (DATABASE_URL, MQTT_BROKER, etc.).
- `backend/requirements.txt` — Python dependencies (FastAPI, SQLAlchemy, psycopg2, paho-mqtt, scikit-learn, xgboost, joblib, numpy, pandas).

### ML Model Artifacts & Naming
- **Models directory**: `ML-Model/models/` contains `.pkl` files (RandomForest, XGBoost, GradientBoosting, IsolationForest, Preprocessor).
- **Log naming**: `phase_*_report_YYYYMMDD_HHMMSS.json` (timestamps help identify runs).
- **Dataset**: `ML-Model/balanced_water_potability_3000.csv` (3000 balanced samples, 9 features, binary target).
- **Preprocessor**: Always stored in `models/Preprocessor.pkl` (handles feature scaling + imputation; load before prediction).
- **Randomness**: Scripts use `RANDOM_STATE=42` constant; avoid passing it twice to XGBoost.
- **Imputation method**: IterativeImputer (MICE) is default; KNNImputer used in alternatives.

### Database Schema
- **Devices table**: `device_id` (PK), `name`, `location`, `status` (online/offline), `last_seen`, `created_at`.
- **Sensor Data table**: `id` (PK), `device_id` (FK), `ph`, `turbidity`, `tds`, `temperature`, `flow_rate`, `timestamp`, `quality_score`, `anomaly_flags` (JSONB, Phase 2+).
- **ML Anomalies table** (optional, Phase 2+): `id`, `device_id`, `timestamp`, `ml_score`, `confidence`, `reasoning`.
- See docs/ER-Diagram.md for detailed schema.

## 5) ML Model Status & When to Use

### Current State (as of 2026-06-14)
- **Best accuracy**: 68.0% (Phase C stacking ensemble, 7 base learners).
- **Use case**: Research, offline analysis, enriching rule-based alerts (not primary alerting).
- **Status**: Below 85% target; not production-ready for autonomous safety-critical decisions.

### Why Not Use for Primary Alerts
- 32% error rate = 1 in 3 decisions wrong; false negatives (missing real issues) pose safety risks in water monitoring.
- Recommended approach: **Hybrid system**.
  - **Primary layer**: Rule-based anomaly detection (pH, turbidity, TDS thresholds).
  - **Secondary layer**: ML model flags suspicious patterns, enriches alerts with confidence scores.
  - **Action threshold**: Escalate only when rule violation + ML confidence (>80%) + optionally cross-device consensus.

### Improvement Roadmap (4-8 weeks to 85%+)
- **Phase A (Quick wins, 2-3 days)**: KNN imputation (+2-5%), feature engineering (+5-10%), outlier removal (+2-3%). Target: 70-75%.
- **Phase B (Optimization, 1 week)**: GridSearchCV tuning (+3-5%), feature selection (+1-3%), new algorithms (MLP, SVM, +5-10%). Target: 75-80%.
- **Phase C (Production, 2 weeks)**: Collect 500-1000 real production samples, get domain expert labels, retrain, validate. Target: 85%+.

### Running ML Experiments
1. **For quick feedback loop**: Run Phase C stacking (3-5 min, ~68% accuracy).
2. **For hyperparameter tuning**: Run Phase G with smaller trials (`--trials_xgb 20 --trials_lgb 15`, 5 min).
3. **For heavy experiments**: Run on Colab GPU (Phase G full: 20+ min, or NN meta-learner).
4. **For diagnosing accuracy plateaus**: Check SHAP importance, run sulfate ablation test.

### Integrating ML into Backend
- Import and initialize `MLPredictor` class from `complete_model.py` or best-performing phase script.
- Call `.predict(sensor_vector)` → returns `{"is_anomaly": bool, "confidence": float, "reasoning": str}`.
- Load preprocessor first: `joblib.load('models/Preprocessor.pkl')`.
- Don't forget to validate all 9 features are present in input.

## 6) Useful documentation pointers

### Quick Reads (for current work)
- **README.md** — One-line pitch, system overview, use cases.
- **PROJECT-STATUS.md** — Current completion status, ML metrics, team next steps.
- **docs/Implementation-Roadmap.md** — 3-phase timeline (MVP/Phase 1, Production/Phase 2, Scale/Phase 3).

### Architecture & Design
- **docs/Architecture-Overview.md** — 4-layer system design, data flow, failure modes.
- **docs/Backend-Spec.md** — 11 API endpoints, database schema, security (API keys, rate limiting, OAuth2).
- **docs/Frontend-Spec.md** — 6 dashboard screens, WebSocket real-time, RBAC roles.
- **docs/ESP32-Firmware-Spec.md** — 7 FreeRTOS tasks, setup portal, offline buffering, OTA updates.

### Data & ML
- **docs/ER-Diagram.md** — Full database schema with column types and constraints.
- **docs/Data-Flow-Diagram.md** — System data flows and failure scenarios.
- **ML-Model/README.md** — ML overview, dataset, model performance metrics.
- **ML-Model/TRAINING-RESULTS.md** — Detailed training analysis, improvement path.
- **ML-Model/ML-INTEGRATION-GUIDE.md** — How to integrate ML into backend, API contract.

### Critical Decisions & Issue Resolution
- **docs/Known-Issues-and-Solutions.md** — All 12 critical issues identified and solutions applied.
- **docs/Security-Reliability-Deployment.md** — HA, backups, compliance, SLA requirements.
- **docs/End-to-End-Workflow.md** — 9 failure scenarios and system response.

## 7) When working as Copilot in this repo

1. **For API/schema changes**: Read `Backend-Spec.md` first; ensure payloads match telemetry JSON format.
2. **For database changes**: Consult `ER-Diagram.md` and ensure Devices + Sensor Data tables match spec.
3. **For ML integration**: Review `ML-Model/ML-INTEGRATION-GUIDE.md`; use preprocessor before calling model.
4. **For frontend work**: Start with `Frontend-Spec.md` (6 screens, WebSocket, RBAC, responsive design).
5. **For firmware work**: See `ESP32-Firmware-Spec.md` (7 FreeRTOS tasks, WiFi setup, SD buffering).
6. **Adding new code**: Update README.md (or relevant spec file) with new endpoints/features so future sessions find the contract.

## 8) Repository conventions (key)

- **ML data location**: `ML-Model/balanced_water_potability_3000.csv` (keep larger datasets out of git).
- **Docker setup**: `docker-compose up --build` runs: db (Postgres), ml-service (port 8001), backend (port 8000).
- **Environment variables**: See `backend/app/config.py` for DATABASE_URL, MQTT_BROKER, MQTT_PORT, ML_SERVICE_URL.
- **Development workflow**: Edit code → rebuild container → test via curl/Postman → commit.
- **Offline testing**: Use `--offline` flag in device simulators if added; test SD card sync logic.

## 9) Testing Infrastructure & Patterns

### Unit Testing (pytest)
- **Test discovery**: All tests in `backend/tests/` with `test_*.py` naming convention
- **Test fixtures** (in `conftest.py`): 
  - `engine`: Session-scoped SQLite in-memory database for all tests
  - `db_session`: Function-scoped fresh session for each test
  - `override_session_local`: Patches global SessionLocal with test database
- **Running specific test filters**:
  - By marker: `pytest -q backend/tests -m slow` (if markers defined)
  - By keyword: `pytest -q backend/tests -k "quality"` (runs tests matching "quality")
  - By file and method: `pytest -q backend/tests/test_quality_score.py::TestQualityScoring`

### Test Coverage & Reporting
- **Generate coverage report**: `pytest --cov=backend --cov-report=html backend/tests`
- **View HTML coverage**: `open htmlcov/index.html` (or open in browser)

### CI/CD Pipeline
- **GitHub Actions workflow**: `.github/workflows/backend-ci.yml`
  - Triggers on: push to `backend/` or pull requests touching `backend/`
  - Steps: Python 3.11 setup → install deps → quick import test → full pytest suite
  - Env: `PYTHONPATH=backend` is set for proper module discovery

### Smoke Tests
- **Smoke test runner**: `python run_smoke_tests.py` (if exists; validates critical paths)
- **Manual integration test**:
  1. Start backend: `uvicorn backend.app.main:app --reload`
  2. POST test data via curl (see Backend section above)
  3. Query data: `curl http://localhost:8000/data/HYDRO_001`
  4. Check quality score in response (should be numeric 0-100)

## 10) API & Schema Patterns

### Request/Response Validation (Pydantic)
- All request bodies validated with `SensorDataIngestionRequest` schema
- Device IDs must match pattern `HYDRO_\d{3}` (e.g., `HYDRO_001`, `HYDRO_042`)
- Timestamps must be ISO 8601 UTC format: `2026-06-17T19:54:00Z`
- All 5 sensor readings required: pH, turbidity, TDS, temperature, flow_rate
- See `backend/app/schemas.py` for all Pydantic models

### Authentication & Authorization
- **Device API Key**: Generated on device provisioning; format `hydro_HYDRO_###_<random>`
- **API Key validation**: Each request with sensor data must include `X-API-Key` header
- **Hashing**: API keys are hashed (bcrypt) before storage; never log raw keys
- **JWT tokens** (Phase 2+): For user dashboard authentication (not yet in Phase 1)

### Error Handling
- Failed validation returns 422 Unprocessable Entity with detailed error messages
- Missing API key returns 401 Unauthorized
- Invalid API key returns 403 Forbidden
- Server errors return 500 with error message (avoid exposing stack traces in production)

## 11) Electric Solenoid Valve Control

### Hardware Specifications
- **Type**: 12V/24V DC electric solenoid valve (normally-open failsafe, spring-return)
- **Connection**: GPIO pin on ESP32 via 5V relay module or N-channel MOSFET for 12V solenoid
- **Recommended GPIO**: GPIO27 (or configurable via firmware constants)
- **Failsafe Behavior**: Normally-open (water flows freely if power lost or connection drops)
- **Typical specs**:
  - Power consumption: 5-12W when energized
  - Switching time: 50-100ms
  - Flow rate: 0.1-1.0 L/min typical for monitoring applications

### Control Logic (Hybrid Approach)

#### 1. **Automatic Local Safety Cutoff (ESP32)**
- **Trigger**: When ANY sensor reading falls below safe threshold:
  - pH < 6.5 or pH > 8.5
  - Turbidity > 5.0 NTU
  - TDS > 500 ppm
  - Temperature > 50°C or < 5°C
- **Action**: Solenoid valve closes (de-energized) immediately
- **Logging**: Store valve close event locally on SD card with timestamp and trigger reason
- **Retry**: Once per minute, check if conditions improved; if safe, re-open valve

#### 2. **Manual Remote Control (Backend → Device)**
- **Dashboard buttons**: "Close Valve" (operator confirmation required) and "Open Valve"
- **Command format** (via MQTT or HTTP):
  ```json
  {
    "device_id": "HYDRO_001",
    "action": "close",
    "reason": "manual_operator_request",
    "timestamp": "2026-06-17T20:05:00Z"
  }
  ```
- **Device response**: Executes command, returns status with valve state and confirmation

#### 3. **Valve Status Reporting**
- **Every telemetry payload includes**:
  ```json
  {
    "device_id": "HYDRO_001",
    "valve_state": "open",
    "valve_last_toggled": "2026-06-17T19:54:32Z",
    "valve_close_reason": null,
    ...sensor readings...
  }
  ```
- **Real-time updates**: WebSocket sends valve state changes to dashboard subscribers instantly

### Backend Implementation

#### New API Endpoints
- `POST /devices/{device_id}/valve/close` — Manually close valve (requires operator auth)
- `POST /devices/{device_id}/valve/open` — Manually open valve (requires operator auth)
- `GET /devices/{device_id}/valve/status` — Get current valve state and last action
- `GET /devices/{device_id}/valve/history` — Get valve operation audit log with timestamps and reasons
- `POST /devices/{device_id}/valve/logs?limit=100` — Fetch valve operation logs

#### Database Schema (New Table: `valve_operations`)
```sql
CREATE TABLE valve_operations (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL REFERENCES devices(device_id),
  action VARCHAR(10) NOT NULL CHECK (action IN ('open', 'close')),
  triggered_by VARCHAR(50) NOT NULL CHECK (triggered_by IN ('auto_safety_cutoff', 'manual_operator', 'remote_command')),
  quality_score_at_trigger INT,
  reason TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  received_at TIMESTAMP DEFAULT NOW(),
  INDEX (device_id, timestamp DESC)
);
```

### Frontend Dashboard Features
1. **Valve Status Card**: Shows open/closed state with timestamp of last change and reason
2. **Valve Control Buttons**: 
   - "Close Valve" — Opens confirmation modal (reason required)
   - "Open Valve" — Direct action with confirmation
3. **Valve Operation History**: Table showing last 50 operations with:
   - Timestamp
   - Action (open/close)
   - Trigger reason (auto/manual/remote)
   - Quality score at time of trigger
   - Operator name (if manual)
4. **Real-time Alerts**: Toast notification when valve auto-closes due to unsafe water

### Firmware Implementation (ESP32)
- **GPIO Control**: Simple HIGH/LOW on GPIO pin
  - HIGH = energized = valve closed
  - LOW = de-energized = valve open
- **Debounce/Lockout**: 2-second lockout after any valve toggle to prevent chattering
- **Retry Logic**: If quality conditions persist for >5 minutes, stay closed (alert backend)
- **SD Card Logging**: Every valve state change logged with reason and quality readings at time
- **OTA Update**: Valve control logic must be updateable without full device reset

### Safety Considerations
- **Normally-open design ensures** water flow continues if device crashes or loses power
- **Rate limiting**: Valve cannot toggle more than once per 5 seconds (prevent solenoid burnout)
- **Backend double-check**: Dashboard shows operator confirmation when manual close initiated
- **Audit trail**: Every action logged with operator ID, timestamp, and reason (compliance)
- **Emergency open**: If quality reading is unavailable for >30 sec, valve auto-opens (fail-open)

## 10) Other AI assistant configs

No CLAUDE.md, AGENTS.md, .cursorrules, .windsurfrules, CONVENTIONS.md, or .clinerules detected. If such files are added, important directives will be merged into this file.

---

**Generated**: 2026-06-15  
**Last Updated**: 2026-06-17 — Added solenoid valve feature (hybrid auto + manual control, failsafe design), valve control API endpoints, database schema, frontend dashboard features, and comprehensive safety/compliance details  
**Maintainers**: Add any missing commands or conventions directly to this file.
