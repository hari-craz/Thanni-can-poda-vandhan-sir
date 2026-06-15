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
    # Load ML artifacts if present
    try:
        app.state.preprocessor = joblib.load('models/Preprocessor.pkl')
    except Exception:
        app.state.preprocessor = None
    try:
        app.state.model = joblib.load('models/XGBoost.pkl')
    except Exception:
        app.state.model = None


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
def predict(payload: SensorPayload):
    # Require model loaded
    if not getattr(app.state, 'model', None) or not getattr(app.state, 'preprocessor', None):
        raise HTTPException(status_code=503, detail='Model not available')
    try:
        # create single-row DataFrame from payload.data
        df = pd.DataFrame([payload.data])
        # Ensure column order and missing columns handled by preprocessor
        X = app.state.preprocessor.transform(df)
        proba = app.state.model.predict_proba(X)
        score = float(proba[0, 1])
        pred = int(score >= 0.5)
        return {'prediction': pred, 'score': score}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/health')
def health():
    return JSONResponse({'status':'ok'})
