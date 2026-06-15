# Copilot instructions — Hydronix (Thanni-can-poda-vandhan-sir)

**Purpose**: Provide concise guidance for future Copilot sessions working on this repository.

## 1) Build, test, and lint commands

### Backend (Python/FastAPI)
- **Setup**: `python -m venv .venv && .\.venv\Scripts\activate && pip install -r backend/requirements.txt`
- **Run locally**: `uvicorn backend.app.main:app --reload` (or `python -m uvicorn backend.app.main:app --reload`)
- **Run with Docker**: `docker-compose up --build` (starts backend, db, ml-service)
- **Test single endpoint**: `curl -X POST http://localhost:8000/ingest -H "Content-Type: application/json" -d '{"device_id":"HYDRO_001","data":{"ph":7.2,"turbidity":3.1}}'`

### ML Model (Python/scikit-learn/XGBoost)
- **Setup**: `pip install -r ML-Model/requirements.txt`
- **Run Phase C (best model, ~68% accuracy)**: `python ML-Model/phase_c_stacking.py` (3-5 minutes)
- **Run Phase G (full tuning)**: `python ML-Model/phase_g_optuna_stack.py --trials_xgb 80 --trials_lgb 60` (20+ minutes)
- **Quick diagnostics**: `python ML-Model/phase_g_optuna_stack.py --trials_xgb 20 --trials_lgb 15` (5 minutes)
- **Run NN meta-learner**: `python ML-Model/colab_nn_meta.py` (best on Colab GPU)
- **View latest report**: `python -c "import glob,json; print(open(sorted(glob.glob('ML-Model/logs/*phase_*.json') )[-1]).read())"`

### Frontend (if/when implemented)
- **Setup**: `npm install` in frontend directory
- **Run**: `npm run dev` (development) or `npm start` (production)
- **Build**: `npm run build`
- **Test**: `npm test` (if added)

## 2) High-level architecture

**Hydronix** is a 4-layer IoT water monitoring system with 3-phase implementation roadmap:

### System Layers
1. **Edge (ESP32 devices)**: Collect pH, temperature, turbidity, TDS, flow; host local WiFi setup portal (`Hydronix_Setup` at `192.168.4.1`); buffer data to SD card when offline.
2. **Backend (FastAPI + PostgreSQL)**: Ingest telemetry via MQTT (preferred) or HTTP POST `/ingest`; store sensor data; compute rule-based quality scores; serve REST APIs; integrate ML for anomaly detection (Phase 2+).
3. **Frontend (React/Next)**: Web dashboard showing real-time and historical charts, device status, water quality scores, alerts, and optional map view.
4. **ML/Anomaly Detection**: Stacking ensemble (Phase C: 68% accuracy, Phase G tuning: TBD) for anomaly flagging. **Status**: Research phase; not ready for primary alerting yet. Use rule-based system as primary layer, ML as secondary enrichment.

### Integration Points
- **Device → Backend**: JSON payloads with `device_id` (format: `HYDRO_###`), timestamp (ISO 8601), and sensor readings (ph, turbidity, tds, temperature, flow_rate).
- **Backend → DB**: SQLAlchemy ORM; Devices table (device_id PK, name, location, status, last_seen); Sensor Data table (id, device_id FK, all 5 readings, timestamp).
- **Backend → Frontend**: WebSocket for real-time updates; REST endpoints for historical queries.
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

## 3) Key conventions and repository-specific patterns

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

## 4) ML Model Status & When to Use

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

## 5) Useful documentation pointers

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

## 6) When working as Copilot in this repo

1. **For API/schema changes**: Read `Backend-Spec.md` first; ensure payloads match telemetry JSON format.
2. **For database changes**: Consult `ER-Diagram.md` and ensure Devices + Sensor Data tables match spec.
3. **For ML integration**: Review `ML-Model/ML-INTEGRATION-GUIDE.md`; use preprocessor before calling model.
4. **For frontend work**: Start with `Frontend-Spec.md` (6 screens, WebSocket, RBAC, responsive design).
5. **For firmware work**: See `ESP32-Firmware-Spec.md` (7 FreeRTOS tasks, WiFi setup, SD buffering).
6. **Adding new code**: Update README.md (or relevant spec file) with new endpoints/features so future sessions find the contract.

## 7) Repository conventions (key)

- **ML data location**: `ML-Model/balanced_water_potability_3000.csv` (keep larger datasets out of git).
- **Docker setup**: `docker-compose up --build` runs: db (Postgres), ml-service (port 8001), backend (port 8000).
- **Environment variables**: See `backend/app/config.py` for DATABASE_URL, MQTT_BROKER, MQTT_PORT, ML_SERVICE_URL.
- **Development workflow**: Edit code → rebuild container → test via curl/Postman → commit.
- **Offline testing**: Use `--offline` flag in device simulators if added; test SD card sync logic.

## 8) Other AI assistant configs

No CLAUDE.md, AGENTS.md, .cursorrules, .windsurfrules, CONVENTIONS.md, or .clinerules detected. If such files are added, important directives will be merged into this file.

---

**Generated**: 2026-06-15  
**Last Updated**: 2026-06-15 — Comprehensive build commands, ML status, and architecture clarity added  
**Maintainers**: Add any missing commands or conventions directly to this file.
