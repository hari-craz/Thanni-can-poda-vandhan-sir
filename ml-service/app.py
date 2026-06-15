from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
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

# exporter & backup metrics
EXPORTED_ROWS = Counter('ml_exported_rows_total', 'Total rows exported to central DB')
EXPORT_RUNS = Counter('ml_export_runs_total', 'Total export runs attempted')
EXPORT_SUCCESS = Counter('ml_export_success_total', 'Total successful export runs')
EXPORT_FAILURE = Counter('ml_export_failure_total', 'Total failed export runs')
EXPORT_LAST_DURATION = Gauge('ml_export_last_duration_seconds', 'Duration of last export run (s)')

BACKUP_SUCCESS = Counter('ml_backup_success_total', 'Successful backup count')
BACKUP_FAILURE = Counter('ml_backup_failure_total', 'Failed backup count')

MODEL_LOADED.set(1 if model is not None else 0)
PREPROCESSOR_LOADED.set(1 if preprocessor is not None else 0)

from fastapi import Request
import sqlite3
from datetime import datetime
import threading
import time
import shutil
import psycopg2

# Initialize persisted feedback DB with richer schema
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'feedback.db'))
BACKUP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'backups'))

# Export settings (to central Postgres)
DATABASE_URL = os.environ.get('DATABASE_URL')  # e.g. postgresql://user:pass@host:5432/db
EXPORT_INTERVAL_SECONDS = int(os.environ.get('EXPORT_INTERVAL_SECONDS', str(60*60)))  # default 1h
EXPORT_BATCH_SIZE = int(os.environ.get('EXPORT_BATCH_SIZE', '500'))
RETENTION_DAYS = int(os.environ.get('FEEDBACK_BACKUP_RETENTION_DAYS', '7'))

try:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    os.makedirs(BACKUP_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    cur = conn.cursor()
    cur.execute('''CREATE TABLE IF NOT EXISTS feedback (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    device_id TEXT,
                    timestamp TEXT,
                    prediction INTEGER,
                    true_label INTEGER,
                    user_id TEXT,
                    label_source TEXT,
                    confidence REAL,
                    created_at TEXT,
                    exported INTEGER DEFAULT 0,
                    exported_at TEXT,
                    UNIQUE(device_id, timestamp)
                )''')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_feedback_exported ON feedback(exported)')
    conn.commit()
    print('ML service: feedback DB initialized at', DB_PATH)
except Exception as e:
    conn = None
    print('ML service: feedback DB init error:', e)

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
            if preprocessor is not None:
                # ensure columns are in the same order model expects
                feature_names = getattr(model, 'feature_names_in_', None)
                if feature_names is not None:
                    df = df.reindex(columns=list(feature_names))
                X = preprocessor.transform(df)
            else:
                feature_names = getattr(model, 'feature_names_in_', None)
                if feature_names is None:
                    raise HTTPException(status_code=503, detail='Model feature names unknown')
                row = {col: payload.data.get(col, np.nan) for col in feature_names}
                df2 = pd.DataFrame([row], columns=feature_names)
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

@app.post('/feedback')
async def feedback(item: Dict[str, Any], request: Request):
    """Accepts feedback payload and stores it with dedup. Supports optional user_id, label_source, confidence.
    Example payload: {device_id, timestamp, prediction, true_label, user_id?, label_source?, confidence?}
    """
    # auth
    if ML_API_KEY:
        key = request.headers.get('x-api-key', '')
        if key != ML_API_KEY:
            raise HTTPException(status_code=401, detail='Unauthorized')
    # validate payload
    try:
        device_id = str(item.get('device_id'))
        timestamp = str(item.get('timestamp')) if item.get('timestamp') is not None else datetime.utcnow().isoformat()
        prediction = int(item.get('prediction'))
        true_label = int(item.get('true_label'))
        user_id = item.get('user_id')
        label_source = item.get('label_source')
        confidence = float(item.get('confidence')) if item.get('confidence') is not None else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=f'Invalid payload: {e}')

    # persist with dedup (UNIQUE(device_id,timestamp))
    FEEDBACK_TOTAL.inc()
    if prediction == true_label:
        FEEDBACK_CORRECT.inc()

    if conn is None:
        return {'status': 'ok', 'persisted': False}
    try:
        cur = conn.cursor()
        cur.execute('INSERT OR IGNORE INTO feedback (device_id, timestamp, prediction, true_label, user_id, label_source, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    (device_id, timestamp, prediction, true_label, user_id, label_source, confidence, datetime.utcnow().isoformat()))
        inserted = cur.rowcount
        conn.commit()
        if inserted == 0:
            return {'status': 'duplicate', 'persisted': False}
        return {'status': 'ok', 'persisted': True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/feedback/query')
async def query_feedback(device_id: Optional[str] = None, only_unexported: bool = False, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
    """Query historical feedback stored locally. Filters: device_id, only_unexported, pagination."""
    if conn is None:
        raise HTTPException(status_code=503, detail='Feedback DB not available')
    sql = 'SELECT id, device_id, timestamp, prediction, true_label, user_id, label_source, confidence, created_at, exported, exported_at FROM feedback'
    params = []
    where = []
    if device_id:
        where.append('device_id = ?')
        params.append(device_id)
    if only_unexported:
        where.append('exported = 0')
    if where:
        sql += ' WHERE ' + ' AND '.join(where)
    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?'
    params.extend([limit, offset])
    cur = conn.cursor()
    cur.execute(sql, params)
    rows = cur.fetchall()
    cols = ['id','device_id','timestamp','prediction','true_label','user_id','label_source','confidence','created_at','exported','exported_at']
    results = [dict(zip(cols, r)) for r in rows]
    return results

@app.post('/feedback/export')
async def export_feedback_manual(request: Request):
    """Manual trigger to export unexported feedback to central Postgres."""
    if ML_API_KEY:
        key = request.headers.get('x-api-key','')
        if key != ML_API_KEY:
            raise HTTPException(status_code=401, detail='Unauthorized')
    success, msg = export_to_postgres()
    if not success:
        raise HTTPException(status_code=500, detail=msg)
    return {'status':'ok', 'message': msg}

@app.get('/metrics')
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get('/health')
def health():
    return {'status': 'ok', 'model_loaded': model is not None, 'preprocessor_loaded': preprocessor is not None}

# Export and backup utilities

def export_to_postgres() -> (bool, str):
    """Export unexported rows in batches to central Postgres. Marks exported rows in sqlite on success and reports Prometheus metrics."""
    start = time.time()
    EXPORT_RUNS.inc()
    if DATABASE_URL is None:
        EXPORT_FAILURE.inc()
        EXPORT_LAST_DURATION.set(time.time() - start)
        return False, 'DATABASE_URL not configured'
    if conn is None:
        EXPORT_FAILURE.inc()
        EXPORT_LAST_DURATION.set(time.time() - start)
        return False, 'Local feedback DB not available'
    try:
        # connect to Postgres
        pg = psycopg2.connect(DATABASE_URL)
        pg.autocommit = True
        pgcur = pg.cursor()
        pgcur.execute('''CREATE TABLE IF NOT EXISTS feedback_archive (
                            id SERIAL PRIMARY KEY,
                            device_id TEXT,
                            timestamp TEXT,
                            prediction INTEGER,
                            true_label INTEGER,
                            user_id TEXT,
                            label_source TEXT,
                            confidence REAL,
                            created_at TEXT,
                            source TEXT,
                            UNIQUE(device_id, timestamp)
                        )''')
        # fetch a batch
        local_cur = conn.cursor()
        local_cur.execute('SELECT id, device_id, timestamp, prediction, true_label, user_id, label_source, confidence, created_at FROM feedback WHERE exported = 0 ORDER BY id ASC LIMIT ?', (EXPORT_BATCH_SIZE,))
        rows = local_cur.fetchall()
        if not rows:
            EXPORT_SUCCESS.inc()
            EXPORT_LAST_DURATION.set(time.time() - start)
            return True, 'No rows to export'
        inserted = 0
        for r in rows:
            lid, device_id, ts, pred, true_label, user_id, label_source, confidence, created_at = r
            try:
                pgcur.execute('''INSERT INTO feedback_archive (device_id, timestamp, prediction, true_label, user_id, label_source, confidence, created_at, source) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (device_id,timestamp) DO NOTHING''',
                              (device_id, ts, pred, true_label, user_id, label_source, confidence, created_at, 'ml-service'))
                if pgcur.rowcount > 0:
                    inserted += 1
                # mark exported regardless of conflict to avoid retry loops
                local_cur.execute('UPDATE feedback SET exported = 1, exported_at = ? WHERE id = ?', (datetime.utcnow().isoformat(), lid))
            except Exception as ie:
                print('error inserting row to pg', ie)
                # skip marking exported so it can be retried
        conn.commit()
        pg.close()
        # metrics
        if inserted > 0:
            EXPORTED_ROWS.inc(inserted)
        EXPORT_SUCCESS.inc()
        EXPORT_LAST_DURATION.set(time.time() - start)
        return True, f'Exported {inserted} rows (marked others as exported).'
    except Exception as e:
        EXPORT_FAILURE.inc()
        EXPORT_LAST_DURATION.set(time.time() - start)
        return False, str(e)


def backup_db():
    try:
        if not os.path.exists(DB_PATH):
            return
        ts = datetime.utcnow().strftime('%Y%m%d%H%M%S')
        dest = os.path.join(BACKUP_DIR, f'feedback-{ts}.db')
        shutil.copy2(DB_PATH, dest)
        BACKUP_SUCCESS.inc()
        # prune old backups
        now = time.time()
        for fname in os.listdir(BACKUP_DIR):
            path = os.path.join(BACKUP_DIR, fname)
            if not os.path.isfile(path):
                continue
            mtime = os.path.getmtime(path)
            age_days = (now - mtime) / (60*60*24)
            if age_days > RETENTION_DAYS:
                try:
                    os.remove(path)
                except Exception:
                    pass
    except Exception as e:
        BACKUP_FAILURE.inc()
        print('backup_db error', e)


def _background_loop():
    print('Starting ml-service background exporter thread, interval', EXPORT_INTERVAL_SECONDS)
    while True:
        try:
            ok, msg = export_to_postgres()
            print('export_to_postgres:', ok, msg)
        except Exception as e:
            print('export exception', e)
        try:
            backup_db()
        except Exception as e:
            print('backup exception', e)
        time.sleep(EXPORT_INTERVAL_SECONDS)

# start background thread
try:
    t = threading.Thread(target=_background_loop, daemon=True)
    t.start()
except Exception as e:
    print('failed to start background exporter thread', e)
