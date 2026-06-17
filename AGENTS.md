# AGENTS — Hydronix

## Purpose
Provide concise, agent-friendly guidance for working on the Hydronix repository.

## Key project areas
- `backend/`: Python FastAPI backend and API routes.
- `firmware/`: ESP32 firmware source.
- `ML-Model/`: model training, metrics, and artifacts.
- `ml-service/`: runtime ML inference service.
- `docs/`: design docs, API contracts, and architecture.

## Agent rules
- Prefer existing repo conventions over new patterns. The backend uses FastAPI + SQLAlchemy + Pydantic.
- Always consult `docs/Backend-Spec.md` for API contracts and `docs/ER-Diagram.md` for schema decisions.
- Use `backend/README.md` and `.github/copilot-instructions.md` for build/test commands.
- Do not add untested production changes to the firmware or backend without updating tests.

## Recommended entry points
- Backend API: `backend/app/main.py`
- Schema definitions: `backend/app/schemas.py`
- Valve control routes: `backend/app/valve_routes.py`
- Device ingestion and MQTT logic: `backend/app/ingest.py`
- ML training and model artifacts: `ML-Model/`
- Local startup: `docker-compose.yml`

## Testing guidance
- Run backend tests with `pytest -q backend/tests`
- Use `python run_backend_tests.py` for a quick import and smoke check
- Keep model training work isolated to `ML-Model/` and avoid breaking backend dependencies

## Documentation links
- `README.md`
- `backend/README.md`
- `docs/Backend-Spec.md`
- `docs/ER-Diagram.md`
- `docs/ESP32-Firmware-Spec.md`
- `ML-Model/ML-INTEGRATION-GUIDE.md`
