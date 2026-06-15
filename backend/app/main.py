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
        print('Loaded Preprocessor from models/Preprocessor.pkl')
    except Exception as e:
        app.state.preprocessor = None
        app.state.model_load_error = f'preprocessor load error: {e}'
        print(app.state.model_load_error)
    try:
        app.state.model = joblib.load('models/XGBoost.pkl')
        print('Loaded model from models/XGBoost.pkl')
    except Exception as e:
        app.state.model = None
        app.state.model_load_error = getattr(app.state, 'model_load_error', '') + f' | model load error: {e}'
        print(getattr(app.state, 'model_load_error'))


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
    if not getattr(app.state, 'model', None):
        raise HTTPException(status_code=503, detail='Model not available')
    try:
        # create single-row DataFrame from payload.data
        df = pd.DataFrame([payload.data])
        if getattr(app.state, 'preprocessor', None):
            X = app.state.preprocessor.transform(df)
        else:
            # Fallback: align to model's expected feature names and simple impute
            feature_names = getattr(app.state.model, 'feature_names_in_', None)
            if feature_names is None:
                raise HTTPException(status_code=503, detail='Model feature names unknown')
            row = {col: payload.data.get(col, np.nan) for col in feature_names}
            df2 = pd.DataFrame([row], columns=feature_names)
            # simple impute: fill numeric NaNs with 0
            df2 = df2.fillna(0)
            X = df2.values
        proba = app.state.model.predict_proba(X)
        score = float(proba[0, 1])
        pred = int(score >= 0.5)
        return {'prediction': pred, 'score': score}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/health')
def health():
    return JSONResponse({'status':'ok'})
