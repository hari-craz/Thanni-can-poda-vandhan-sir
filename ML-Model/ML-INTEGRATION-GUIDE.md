# 🤖 ML Integration Guide for Hydronix

## Overview

**Status**: ML model added as **Phase 2+ feature** (secondary anomaly detection)

**Your Dataset**: 3000 water potability samples with 9 features
- Features: pH, Hardness, Solids, Chloramines, Sulfate, Conductivity, Organic Carbon, Trihalomethanes, Turbidity
- Target: Binary (Potable=1 / Non-Potable=0)
- Use: Detect water quality anomalies that rule-based system might miss

---

## How ML Fits into Hydronix Architecture

### Phase 1 (MVP) — Rule-Based Only ✅
```
Sensor Reading → Rule Engine → Quality Score (0-100) → Alert
  └─ Transparent, deterministic scoring
  └─ Fast (<50ms), no dependencies
  └─ Safe for production
```

### Phase 2 (Production) — Rule-Based + ML Secondary Signal ⭐ CURRENT
```
Sensor Reading → Rule Engine → Quality Score
                              ↓
                        Score ≥ threshold?
                        ↓           ↓
                      YES          NO → Check ML Signal
                        ↓             ↓
                    Generate Alert   ML Anomaly?
                    (rule-based)     ├─ YES → Generate Alert (ML-flagged)
                                     └─ NO  → No alert
```

**Key Principle**: ML is NEVER the primary alerting mechanism. It's a **secondary signal** to catch anomalies rule-based system misses.

### Phase 3 (Scale) — Multi-Signal Ensemble (Optional)
```
Sensor Reading → Rule Score + ML Score + Historical Trend + Domain Rules
                 └─ Weighted ensemble decision
                 └─ Audit trail showing which signal triggered alert
```

---

## What Your Model Does

### Input
A sensor reading with 9 water quality parameters:
```python
reading = {
    "device_id": "HYDRO_001",
    "ph": 7.2,
    "hardness": 120,
    "solids": 18000,
    "chloramines": 8.5,
    "sulfate": 361,
    "conductivity": 348,
    "organic_carbon": 8.5,
    "trihalomethanes": 49,
    "turbidity": 4.7,
    "timestamp": "2026-06-14T21:43:00Z"
}
```

### Output
Anomaly prediction with confidence:
```python
{
    "device_id": "HYDRO_001",
    "is_anomaly": False,           # True = water quality concern
    "confidence": 0.78,            # 0-1 (higher = more certain)
    "ml_score": 0,                 # 0 = normal, 1 = anomaly
    "timestamp": "2026-06-14T21:43:00Z",
    "model_version": "v1.0",
    "decision_reason": "Reading is normal (confidence: 0.78)"
}
```

### Decision Logic
```
IF ml_score == 1 AND confidence >= 0.65:
    is_anomaly = True
    → Backend can generate alert or log for review
ELSE:
    is_anomaly = False
    → No ML alert, but rule-based system still active
```

---

## Model Architecture

### Four Complementary Models (Ensemble Approach)

1. **Random Forest** (100 trees)
   - Good baseline, robust to outliers
   - Handles non-linear relationships

2. **XGBoost** (100 rounds)
   - Often best for tabular data
   - Gradient boosting → higher accuracy

3. **Gradient Boosting** (100 rounds)
   - Sequential tree improvement
   - Different regularization than XGBoost

4. **Isolation Forest** (unsupervised)
   - Detects statistical anomalies
   - Catches edge cases supervised models miss
   - No target needed (identifies weird readings)

### Ensemble Decision
- **Voting**: If ≥2 models flag anomaly → ensemble says "anomaly"
- **Confidence**: Average probability across models
- **Final Filter**: `is_anomaly = (ml_score == 1) AND (confidence ≥ 0.65)`

This approach:
- ✅ Reduces false positives (confidence threshold)
- ✅ Catches complex patterns (ensemble diversity)
- ✅ Detects statistical outliers (Isolation Forest)
- ✅ Production-safe (confidence requirement)

---

## Current Accuracy Status

| Metric | Target | Your Current Model |
|--------|--------|-------------------|
| **Ensemble Accuracy** | ≥85% | 🔄 TBD (run training) |
| **Precision** (minimize false alerts) | ≥80% | 🔄 TBD |
| **Recall** (catch real anomalies) | ≥80% | 🔄 TBD |
| **Confidence Threshold** | 65% | 65% ✅ |

**What this means**:
- If accuracy ≥85%: **Ready for Phase 2 deployment** ✅
- If accuracy 70-84%: **Usable but with caution** (consider feature engineering)
- If accuracy <70%: **Research required** (class imbalance? feature quality?)

---

## How to Run Training

### 1. Install Dependencies
```bash
pip install pandas numpy scikit-learn xgboost matplotlib seaborn
```

### 2. Train the Model
```bash
cd ML-Model
python complete_model.py
```

**Output**:
- ✅ Trained model files saved to `ML-Model/models/`
  - `RandomForest.pkl`
  - `XGBoost.pkl`
  - `GradientBoosting.pkl`
  - `IsolationForest.pkl`
  - `Preprocessor.pkl` (handles scaling + imputation)
- ✅ Training report: `ML-Model/logs/training_report_*.json`
- ✅ Console output with accuracy metrics

### 3. Expected Output
```
[2026-06-14T21:43:42Z] INFO: Dataset loaded: 3000 rows, 10 columns
[2026-06-14T21:43:43Z] INFO: === DATA EXPLORATION ===
[2026-06-14T21:43:43Z] INFO: Shape: (3000, 10)
[2026-06-14T21:43:43Z] INFO: Missing values: ...
[2026-06-14T21:43:43Z] INFO: Target distribution: ...
...
[2026-06-14T21:43:45Z] INFO: === MODEL EVALUATION ===
[2026-06-14T21:43:45Z] INFO: RandomForest Results:
[2026-06-14T21:43:45Z] INFO:   Accuracy:  0.8234
[2026-06-14T21:43:45Z] INFO:   Precision: 0.7891
[2026-06-14T21:43:45Z] INFO:   Recall:    0.8156
...
[2026-06-14T21:43:48Z] INFO: === ENSEMBLE EVALUATION ===
[2026-06-14T21:43:48Z] INFO: Ensemble Accuracy:  0.8567  ← TARGET
[2026-06-14T21:43:48Z] INFO: Ensemble Precision: 0.8234
[2026-06-14T21:43:48Z] INFO: Ensemble Recall:    0.8401
[2026-06-14T21:43:48Z] INFO: Ensemble F1-Score:  0.8316
```

---

## Backend Integration (Phase 2)

### Option 1: In-Process (Simple)
```python
# backend/services/ml_service.py
from ML_Model.complete_model import MLPredictor

class AnomalyDetectionService:
    def __init__(self):
        self.ml_predictor = MLPredictor()  # Loads trained models
    
    def check_anomaly(self, reading: dict) -> dict:
        """Check if reading is anomaly"""
        ml_result = self.ml_predictor.predict(reading)
        return ml_result

# Usage in ingestion API
@app.post("/data")
async def ingest_data(payload: dict):
    # 1. Store reading
    db.sensor_data.insert(payload)
    
    # 2. Rule-based quality score
    quality_score = compute_quality_score(payload)
    
    # 3. ML secondary signal (Phase 2)
    ml_result = anomaly_service.check_anomaly(payload)
    
    # 4. Log for monitoring
    if ml_result["is_anomaly"]:
        log(f"ML ALERT: {payload['device_id']} - {ml_result['decision_reason']}")
        db.ml_alerts.insert(ml_result)
    
    return {"status": "ok"}
```

### Option 2: Separate Microservice (Scalable)
```python
# ml-service/app.py (FastAPI microservice)
from fastapi import FastAPI
from complete_model import MLPredictor

app = FastAPI()
predictor = MLPredictor()

@app.post("/predict")
async def predict_anomaly(reading: dict):
    """ML prediction endpoint"""
    result = predictor.predict(reading)
    return result

# Usage in backend
import httpx

class MLServiceClient:
    def __init__(self, url: str = "http://ml-service:8000"):
        self.url = url
    
    async def check_anomaly(self, reading: dict) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self.url}/predict", json=reading)
            return resp.json()
```

### Option 3: Batch Processing (Cost-Effective)
```python
# backend/tasks/ml_batch_processor.py
# Run ML inference once daily on all readings from previous 24h
# Cheaper than per-request, still catches anomalies

from celery import shared_task

@shared_task
def batch_ml_check():
    """Run ML anomaly detection on last 24h readings"""
    yesterday = datetime.utcnow() - timedelta(days=1)
    readings = db.sensor_data.find(
        {"timestamp": {"$gte": yesterday}}
    )
    
    for reading in readings:
        ml_result = ml_predictor.predict(reading)
        if ml_result["is_anomaly"]:
            db.ml_alerts.insert({
                "reading_id": reading["_id"],
                **ml_result
            })
```

---

## Database Schema Changes

### Add `ml_anomalies` table to Backend (Phase 2)
```sql
CREATE TABLE ml_anomalies (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT NOT NULL,
    reading_id BIGINT NOT NULL REFERENCES sensor_data(id),
    
    -- ML prediction result
    ml_score INT,                    -- 0 = normal, 1 = anomaly
    confidence DOUBLE PRECISION,     -- 0-1 (higher = more certain)
    model_version TEXT,              -- v1.0, v1.1, etc.
    
    -- Features that triggered anomaly
    anomaly_reason JSONB,            -- {features: [...], outlier_scores: {...}}
    
    -- Alert generation
    alert_triggered BOOLEAN,         -- Did this trigger an alert?
    alert_id BIGINT REFERENCES alerts(id),
    
    -- Audit trail
    prediction_timestamp TIMESTAMPZ,
    created_at TIMESTAMPZ DEFAULT NOW()
);

CREATE INDEX ml_anomalies_device_id ON ml_anomalies(device_id);
CREATE INDEX ml_anomalies_confidence ON ml_anomalies(confidence);
```

### Update `anomaly_flags` in `sensor_data` table
```sql
ALTER TABLE sensor_data ADD COLUMN ml_score INT DEFAULT 0;
ALTER TABLE sensor_data ADD COLUMN ml_confidence DOUBLE PRECISION DEFAULT 0.0;
```

---

## Monitoring & Alert Rules

### Rule 1: ML Anomaly → Escalate
```
IF ml_score == 1 AND confidence >= 0.65:
    severity = "warning"
    message = f"ML anomaly detected: {ml_result['decision_reason']}"
    alert_type = "ml_secondary"
THEN
    Generate alert (human review recommended)
    Log to ml_anomalies table
    Send notification if configured
```

### Rule 2: High Confidence Anomalies → Priority Review
```
IF ml_score == 1 AND confidence >= 0.85:
    severity = "critical"
    priority = "high"
THEN
    Alert operators immediately
    Flag for incident response team
```

### Rule 3: Monitor ML Model Performance
```
DAILY:
  - Compare ML predictions vs ground truth (if available)
  - Track precision/recall on recent data
  - Alert if accuracy drops <80%
  - Trigger retraining if needed

WEEKLY:
  - Review all "ML alert" cases
  - Validate which were true anomalies
  - Collect feedback for model improvement
```

---

## Improving Model Accuracy (if < 85%)

### If Current Accuracy 70-84%:

1. **Investigate Class Imbalance**
   ```python
   from sklearn.metrics import classification_report
   print(classification_report(y_test, y_pred))
   # Check: are precision/recall balanced?
   # If recall << precision: model is too conservative
   ```

2. **Feature Engineering**
   - Add derived features:
     - `pH_deviation` = |pH - 7.0| (alkalinity/acidity deviation)
     - `conductivity_ratio` = conductivity / hardness
     - `turbidity_to_solids` = turbidity / solids (correlation check)
   - Remove low-importance features (check `feature_importances_`)

3. **Hyperparameter Tuning**
   ```python
   from sklearn.model_selection import GridSearchCV
   
   param_grid = {
       'max_depth': [5, 7, 10, 15],
       'min_samples_split': [3, 5, 7],
       'n_estimators': [100, 200, 300]
   }
   
   grid = GridSearchCV(RandomForestClassifier(), param_grid, cv=5)
   grid.fit(X_train, y_train)
   print(f"Best params: {grid.best_params_}")
   print(f"Best accuracy: {grid.best_score_:.4f}")
   ```

4. **Try Different Models**
   - Neural Network (MLP) for non-linear relationships
   - SVM with RBF kernel for decision boundary complexity
   - LightGBM (faster than XGBoost, similar accuracy)

5. **Collect More Data**
   - 3000 samples is good, but 10,000+ is better
   - Focus on edge cases (borderline potable/non-potable)

### If Accuracy Stays <70%:

**Possible Issues**:
- Class imbalance (more potable than non-potable or vice versa)
- Feature quality (missing important parameters)
- Data quality (duplicates, mislabeling)
- Problem difficulty (potability not determined by these 9 features alone)

**Solution Path**:
1. Switch to **unsupervised approach only** (Isolation Forest)
   - Detects statistical outliers without needing labels
   - Good for Phase 2 (catches unusual readings)
2. Use as **advisory signal** only (confidence threshold = 0.8+)
   - Only trigger alerts when very confident
3. Collect human-labeled ground truth
   - Deploy system, collect 1000+ real-world examples
   - Retrain in Phase 3 with production data

---

## Deployment Checklist

- [ ] Run `complete_model.py` and verify accuracy ≥ 80%
- [ ] Review training report (`logs/training_report_*.json`)
- [ ] Verify model files saved to `models/` directory
- [ ] Test prediction API with sample readings
- [ ] Add `ml_anomalies` table to database schema
- [ ] Update `sensor_data` schema (add `ml_score`, `ml_confidence`)
- [ ] Integrate MLPredictor into backend ingestion service
- [ ] Write unit tests for ML prediction
- [ ] Setup monitoring for anomalies (Prometheus metrics)
- [ ] Document alert rules in Backend-Spec.md
- [ ] Plan gradual rollout (1% of traffic → 10% → 100%)

---

## Next Steps (Phase 2)

1. **This Week**: Train model, verify accuracy
2. **Next Week**: Integrate into backend (in-process or microservice)
3. **Week After**: Deploy to staging, validate end-to-end
4. **Production**: Gradual rollout with monitoring

---

## FAQ

**Q: Will this model work with your ESP32 device data?**
A: Your dataset uses water potability classification (potable/non-potable). Your device measures raw parameters (pH, turbidity, etc.). The model will flag unusual **combinations** of readings (e.g., very high pH + very high turbidity), which is useful for detecting sensor failures or contamination events.

**Q: Should I use ML for primary alerting?**
A: **No**. Keep rule-based system as primary (safe, transparent). Use ML as secondary signal to catch edge cases.

**Q: How often should I retrain?**
A: 
- Phase 2: Monthly (collect production feedback)
- Phase 3: Weekly or when accuracy drops <80%

**Q: What if accuracy doesn't reach 85%?**
A: That's okay. Use as advisory signal with high confidence threshold (0.8+). Real-world data will likely improve accuracy over time.

**Q: Can I use this for production now?**
A: After verification:
- ✅ Accuracy ≥ 80%: Yes, as secondary signal
- ⚠️ Accuracy 70-79%: Only with human review
- ❌ Accuracy < 70%: Research phase only

---

## References

- Training script: `ML-Model/complete_model.py`
- Dataset: `ML-Model/balanced_water_potability_3000.csv`
- Model files: `ML-Model/models/*.pkl`
- Logs: `ML-Model/logs/*.json`

**Integration Points**:
- Backend: `docs/Backend-Spec.md` → Add ML endpoints
- Alerts: `docs/Known-Issues-and-Solutions.md` → Issue #5 (sensor failure detection)
- Monitoring: `docs/Security-Reliability-Deployment.md` → Add ML metrics

