from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
import joblib
import numpy as np
import pandas as pd

# Prometheus
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response

class SensorPayload(BaseModel):
    device_id: str
    timestamp: Optional[str]
    data: Dict[str, Any]

app = FastAPI(title='Hydronix ML Service')

# load artifacts
model = None
preprocessor = None
model_version = 'v1.0'

import os
ML_API_KEY = os.environ.get('ML_SERVICE_API_KEY', '')
try:
    preprocessor = joblib.load('models/Preprocessor.pkl')
    print('ML service: Loaded Preprocessor')
except Exception as e:
    preprocessor = None
    print('ML service: preprocessor load error:', e)

try:
    model = joblib.load('models/XGBoost.pkl')
    print('ML service: Loaded XGBoost model')
except Exception as e:
    model = None
    print('ML service: model load error:', e)

# Prometheus metrics
REQUEST_COUNT = Counter('ml_requests_total', 'Total prediction requests')
REQUEST_LATENCY = Histogram('ml_request_latency_seconds', 'Prediction request latency seconds')
MODEL_LOADED = Gauge('ml_model_loaded', '1 if model loaded else 0')
PREPROCESSOR_LOADED = Gauge('ml_preprocessor_loaded', '1 if preprocessor loaded else 0')
FEEDBACK_TOTAL = Counter('ml_feedback_total', 'Total feedback entries')
FEEDBACK_CORRECT = Counter('ml_feedback_correct', 'Correct predictions from feedback')

MODEL_LOADED.set(1 if model is not None else 0)
PREPROCESSOR_LOADED.set(1 if preprocessor is not None else 0)

from fastapi import Request

# simple API key auth dependency
async def require_api_key(request: Request):
    key = request.headers.get('x-api-key', '')
    if ML_API_KEY and key != ML_API_KEY:
        raise HTTPException(status_code=401, detail='Unauthorized')

@app.post('/predict')
async def predict(payload: SensorPayload, request: Request):
    if model is None:
        raise HTTPException(status_code=503, detail='Model not available')
    # auth
    if ML_API_KEY:
        key = request.headers.get('x-api-key', '')
        if key != ML_API_KEY:
            raise HTTPException(status_code=401, detail='Unauthorized')
    REQUEST_COUNT.inc()
    with REQUEST_LATENCY.time():
        try:
            df = pd.DataFrame([payload.data])
            print('ml-service request columns:', df.columns.tolist())
            print('model.feature_names_in_:', getattr(model, 'feature_names_in_', None))
            if preprocessor is not None:
                # ensure columns are in the same order model expects
                feature_names = getattr(model, 'feature_names_in_', None)
                if feature_names is not None:
                    df = df.reindex(columns=list(feature_names))
                X = preprocessor.transform(df)
                print('preprocessor produced array shape', getattr(X,'shape',None))
            else:
                feature_names = getattr(model, 'feature_names_in_', None)
                if feature_names is None:
                    raise HTTPException(status_code=503, detail='Model feature names unknown')
                row = {col: payload.data.get(col, np.nan) for col in feature_names}
                df2 = pd.DataFrame([row], columns=feature_names)
                # simple impute: fill numeric NaNs with median-like 0
                df2 = df2.fillna(0)
                X = df2.values
                print('fallback produced array shape', getattr(X,'shape',None))
            proba = model.predict_proba(X)
            score = float(proba[0, 1])
            pred = int(score >= 0.5)
            return {
                'device_id': payload.device_id,
                'prediction': pred,
                'score': score,
                'model_version': model_version
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.post('/feedback')
async def feedback(item: Dict[str, Any], request: Request):
    """Accepts {'device_id','timestamp','prediction','true_label'} to log accuracy."""
    # optional auth
    if ML_API_KEY:
        key = request.headers.get('x-api-key', '')
        if key != ML_API_KEY:
            raise HTTPException(status_code=401, detail='Unauthorized')
    try:
        pred = int(item.get('prediction'))
        true = int(item.get('true_label'))
        FEEDBACK_TOTAL.inc()
        if pred == true:
            FEEDBACK_CORRECT.inc()
        return {'status': 'ok'}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get('/metrics')
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get('/health')
def health():
    return {'status': 'ok', 'model_loaded': model is not None, 'preprocessor_loaded': preprocessor is not None}
