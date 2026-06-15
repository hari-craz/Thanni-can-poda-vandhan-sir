from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
import joblib
import numpy as np
import pandas as pd

class SensorPayload(BaseModel):
    device_id: str
    timestamp: Optional[str]
    data: Dict[str, Any]

app = FastAPI(title='Hydronix ML Service')

# load artifacts
model = None
preprocessor = None
model_version = 'v1.0'

try:
    model = joblib.load('models/XGBoost.pkl')
    print('ML service: Loaded XGBoost model')
except Exception as e:
    print('ML service: model load error:', e)

import os
ML_API_KEY = os.environ.get('ML_SERVICE_API_KEY', '')
try:
    preprocessor = joblib.load('models/Preprocessor.pkl')
    print('ML service: Loaded Preprocessor')
except Exception as e:
    preprocessor = None
    print('ML service: preprocessor load error:', e)

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
    try:
        df = pd.DataFrame([payload.data])
        if preprocessor is not None:
            X = preprocessor.transform(df)
        else:
            feature_names = getattr(model, 'feature_names_in_', None)
            if feature_names is None:
                raise HTTPException(status_code=503, detail='Model feature names unknown')
            row = {col: payload.data.get(col, np.nan) for col in feature_names}
            df2 = pd.DataFrame([row], columns=feature_names)
            # simple impute: fill numeric NaNs with median-like 0
            df2 = df2.fillna(0)
            X = df2.values
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

@app.get('/health')
def health():
    return {'status': 'ok', 'model_loaded': model is not None, 'preprocessor_loaded': preprocessor is not None}
