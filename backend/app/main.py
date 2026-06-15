from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from . import database, ingest
from .schemas import SensorPayload, IngestResponse
from sqlalchemy.orm import Session
import joblib
import pandas as pd
import numpy as np
from typing import Any

app = FastAPI(title='Hydronix Ingest')

@app.on_event('startup')
def startup_event():
    database.init_db()
    ingest.start_in_background()
    # ML service URL for forwarding predictions
    import os
    app.state.ml_service_url = os.environ.get('ML_SERVICE_URL', 'http://ml-service:8000')
    print('ML service URL:', app.state.ml_service_url)
    # keep backward-compatible model load attempt (optional)
    try:
        app.state.preprocessor = joblib.load('models/Preprocessor.pkl')
        print('Loaded Preprocessor from models/Preprocessor.pkl')
    except Exception as e:
        app.state.preprocessor = None
        print('preprocessor load error:', e)
    try:
        app.state.model = joblib.load('models/XGBoost.pkl')
        print('Loaded model from models/XGBoost.pkl')
    except Exception as e:
        app.state.model = None
        print('model load error:', e)


@app.post('/ingest', response_model=IngestResponse)
def ingest_http(payload: SensorPayload):
    try:
        db = database.SessionLocal()
        sd = database.SensorData(device_id=payload.device_id, raw={'timestamp': str(payload.timestamp), 'data': payload.data})
        db.add(sd)
        db.commit()
        db.refresh(sd)
        db.close()
        return IngestResponse(status='ok', id=sd.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/predict')
async def predict(payload: SensorPayload):
    # Forward prediction request to ML microservice
    import httpx
    ml_url = app.state.ml_service_url if hasattr(app.state, 'ml_service_url') else 'http://ml-service:8000'
    try:
        async with httpx.AsyncClient() as client:
            # pydantic model may have datetime; serialize safely
            body = payload.dict()
            if isinstance(body.get('timestamp', None), (bytes, bytearray)):
                body['timestamp'] = str(body['timestamp'])
            elif body.get('timestamp', None) is not None:
                body['timestamp'] = str(body['timestamp'])
            resp = await client.post(f"{ml_url}/predict", json=body)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        status = e.response.status_code if e.response is not None else 500
        raise HTTPException(status_code=status, detail=f'ML service error: {e.response.text if e.response is not None else str(e)}')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/health')
def health():
    return JSONResponse({'status':'ok'})
