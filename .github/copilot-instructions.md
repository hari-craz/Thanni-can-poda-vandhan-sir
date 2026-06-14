# Copilot instructions — Hydronix (Thanni-can-poda-vandhan-sir)

Purpose
- Provide concise guidance for future Copilot sessions working on this repository.

1) Build / test / lint commands
- No explicit build/test/lint scripts or manifests (package.json, pyproject.toml, Makefile, etc.) were found in the repo root.
- The repo contains design and implementation specs only. When implementing a backend or frontend, prefer these common commands as appropriate:
  - Node backend (if chosen): `npm install`, `npm run dev` (or `node index.js`), `npm test` (or `npm run test`), `npm run lint` if added.
  - Python backend (if chosen): `python -m venv .venv && .\.venv\Scripts\activate`, `pip install -r requirements.txt`, `pytest -k <pattern>`.
  - Frontend (React/Next): `npm install`, `npm run dev`, `npm run build`, `npm run test`.
- If you add project manifests (package.json, pyproject.toml, Makefile), add explicit commands here so Copilot can use them.

2) High-level architecture (short)
- Three main components documented under /docs:
  1. Edge (ESP32 devices): collects pH, temperature, turbidity, TDS, flow; hosts a local WiFi setup portal (`Hydronix_Setup`) and buffers to SD when offline.
  2. Backend Server: ingests telemetry (MQTT preferred, HTTP fallback), persists sensor data (Postgres or InfluxDB suggested), provides REST APIs for devices and dashboard.
  3. Frontend Dashboard: web UI (React/Next recommended) showing real-time and historical charts, device status, alerts and maps.
- Key integration points: MQTT broker or HTTP POST /data endpoint; devices include device_id and timestamp in JSON payloads; backend exposes `/devices`, `/data/:device_id`, `/status` as described in docs/Backend-Spec.md.
- See docs/Architecture-Overview.md, Backend-Spec.md, Frontend-Spec.md, and ESP32-Firmware-Spec.md for API shapes, ER diagram, and flows.

3) Key conventions and repository-specific patterns
- Device identity: device IDs use the HYDRO_### pattern (example: `HYDRO_001`). Keep device_id stable and unique.
- Telemetry format: JSON with a `timestamp` string in ISO 8601 and numeric fields for `ph`, `turbidity`, `tds`, `temperature`, `flow_rate`. Example in docs/Architecture-Overview.md.
- Communication preference: MQTT is the preferred transport; HTTP is allowed as fallback. Implement retry/backoff and offline buffering on the device side (SD card) — sync buffered data when connection restored.
- Security: Devices may use an API key per device for authentication. Protect ingestion endpoints and validate device identity server-side.
- Local device setup: ESP32 acts as hotspot named `Hydronix_Setup` and exposes a config portal at `192.168.4.1` for WiFi, server, port, device_id, API key.
- Data modeling: Docs recommend a Devices table and a Sensor Data table (device_id, timestamp, ph, turbidity, tds, temperature, flow_rate). Consult docs/ER-Diagram.md and Backend-Spec.md for column names and constraints.

4) Useful doc locations (quick pointers)
- README.md — project overview and one-line pitch
- docs/Architecture-Overview.md — system diagrams and component interactions
- docs/Backend-Spec.md — API endpoints, payload examples, DB suggestions
- docs/ESP32-Firmware-Spec.md — device firmware responsibilities and setup portal details
- docs/Frontend-Spec.md — dashboard features and UI expectations
- docs/ER-Diagram.md, docs/Data-Flow-Diagram.md — DB and flow diagrams

5) When working as Copilot in this repo
- Prefer reading docs/* before making API or data-modeling changes.
- If adding code, update README and the relevant spec file in docs/ so future sessions can find the contract.
- Add manifest files (package.json / pyproject.toml / Makefile) at repo root and update this Copilot instructions file with exact commands.

6) Other AI assistant configs
- No CLAUDE.md, AGENTS.md, .cursorrules, .windsurfrules, or AIDER/CLINE conventions detected. If such files are added, merge important directives into this file.

7) ML Anomaly Detection (Phase 2 — Future Enhancement)
- **Status**: Planned for future implementation. Current exploratory work shows ~65% accuracy on 30k sample dataset using XGBoost and other models.
- **Why 65% is not ready**: For a safety-critical water monitoring system, this accuracy is insufficient for autonomous alerting (35% error rate = 1 in 3 decisions wrong). False negatives (missing real issues) pose health/safety risks.
- **Recommended approach**: Hybrid system where ML complements, not replaces, the rule-based logic (see Backend-Spec.md, Quality Score Logic section).
  - **Primary layer**: Deterministic rule-based anomaly detection (pH, turbidity, TDS thresholds).
  - **Secondary layer**: ML model flags suspicious patterns, enriches alerts with confidence scores.
  - **Action threshold**: Only escalate alerts when rule violation + ML confidence (>80%) + optionally cross-device consensus.
- **Before Phase 2 implementation**:
  1. Improve accuracy to 85%+ on validation set. Investigate: data quality, class imbalance, feature engineering (rate-of-change, cross-sensor correlation), time-series context (LSTM/Temporal CNN).
  2. Use unsupervised methods first (Isolation Forest, Local Outlier Factor) for outlier detection — less accuracy risk.
  3. Add `anomaly_flags` JSONB field in `sensor_data` table (already in schema) to store model confidence and reasoning.
  4. Update Backend-Spec.md with `/anomalies` endpoint returning ML scores alongside rule-based flags.
- **Dataset considerations**: Document train/val/test split, label methodology, sensor failure handling, and retraining strategy for model drift.

Maintainers: add any missing commands or conventions directly to this file to help future Copilot sessions.

---

(Generated: 2026-06-14)
(Updated: 2026-06-14 — ML anomaly detection Phase 2 guidance)

---
Addendum — actionable commands & repository-specific run notes

1) Build / install / run (local)
- Install Python deps for ML folder: python -m pip install -r ML-Model/requirements.txt
- Run full Phase G (long): python ML-Model/phase_g_optuna_stack.py --trials_xgb 80 --trials_lgb 60
- Quick Phase G (diagnostic): python ML-Model/phase_g_optuna_stack.py --trials_xgb 20 --trials_lgb 15
- Run stacking-only (phase C): python ML-Model/phase_c_stacking.py
- Run NN meta (Colab/local CPU/GPU): python ML-Model/colab_nn_meta.py

2) Colab notes
- Open ML-Model/Run_PhaseG_Colab.ipynb or Run_NN_Meta_Colab.ipynb. Set Runtime -> GPU (T4), upload ML-Model/* files or mount Drive and copy files into /content/ML-Model.
- Notebooks move uploaded files into ML-Model automatically and show latest logs in ML-Model/logs.

3) Logs, models and artifacts
- Reports: ML-Model/logs/*phase_*.json (phase_g_report_YYYYMMDD_HHMMSS.json is final Phase G output).
- Models: ML-Model/models/*.pkl — canonical inference artifacts live here. Archived artifacts: ML-Model/models/archived_YYYYMMDD_HHMMSS/
- To view latest report: python -c "import glob,json; print(open(sorted(glob.glob('ML-Model/logs/*phase_g_report*.json') )[-1]).read())"

4) Quick diagnostics (when accuracy stalls)
- Run SHAP importance: add shap TreeExplainer on RandomForest/XGBoost models saved in ML-Model/models, inspect top 10 features.
- Sulfate ablation: run phase_e1_mice_stack.py with Sulfate column removed or imputed differently; compare ML-Model/logs outputs.

5) Repository conventions (key)
- DATA location: ML-Model/balanced_water_potability_3000.csv used for experiments. Keep raw datasets out of git for larger sets.
- Logs naming: phase_*_report_YYYYMMDD_HHMMSS.json — use timestamp to find runs.
- Randomness: scripts use RANDOM_STATE=42 constant; avoid passing random_state twice into XGB (patch applied).
- Imputation: IterativeImputer (MICE) is default; KNNImputer used in alternatives. Preprocessor stored in models/Preprocessor.pkl.

6) Patches & notes for Copilot sessions
- Patched: phase_g_optuna_stack.py removed duplicate random_state injection; see commit when modifying.
- Patched: colab_nn_meta.py replaced joblib.dumps/loads with sklearn.clone to support minimal joblib distributions.
- Heavy experiments: run in Colab GPU for NN meta; use quick/local runs for tuning/debug.

7) AI assistant configs
- No CLAUDE.md, AGENTS.md, .cursorrules, .windsurfrules, or AIDER/CLINE conventions present. Add to this file if introduced.

---
Checklist — restoring archived models & safe Phase G runs

- Restore archived models (if needed):
  1. Confirm archive folder: ML-Model/models/archived_YYYYMMDD_HHMMSS
  2. Move desired files back to models/: Move-Item ML-Model\models\archived_YYYYMMDD_HHMMSS\* ML-Model\models\
  3. Verify preprocessor and model load: python -c "import joblib; print(joblib.load('ML-Model/models/Preprocessor.pkl'))"

- Safe Phase G run checklist (minimize wasted compute):
  1. Ensure ML-Model/logs exists and is writable: mkdir -Force ML-Model\logs
  2. Confirm dataset present: ML-Model/balanced_water_potability_3000.csv
  3. For long runs use GPU/Colab for NN meta; for base-model Optuna tuning CPU is fine.
  4. Run quick diagnostic first: python ML-Model/phase_g_optuna_stack.py --trials_xgb 20 --trials_lgb 15
  5. If diagnostic succeeds, run full: python ML-Model/phase_g_optuna_stack.py --trials_xgb 80 --trials_lgb 60
  6. After completion, inspect report: ML-Model/logs/phase_g_report_YYYYMMDD_HHMMSS.json

(End of checklist)
