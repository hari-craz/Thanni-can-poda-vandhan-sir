# Hydronix AI Intelligence Platform – Production Roadmap Analysis

This document analyzes the 9-Phase Production ML Roadmap provided by the user. 

> [!TIP]
> **Agent Analysis: An Elegant Solution**
> This roadmap perfectly answers the "labeled data" problem we hit earlier. By shifting the AI Anomaly Detection (Phase 4) from a supervised `XGBClassifier` to an unsupervised `Isolation Forest`, the system no longer relies on humans to manually label water as "safe" or "unsafe" for training. The model will autonomously learn the baseline of the water chemistry and flag deviations.

---

## Architectural Alignment & Feasibility

### 1. Decision Hierarchy (The Core Principle)
Your hierarchy (`Rule Engine` -> `WQI` -> `AI` -> `Predictive`) is the gold standard for industrial IoT systems. AI is powerful but non-deterministic. By making the **Rule Engine the Source of Truth**, you guarantee life-safety compliance (e.g., if pH hits 3.0, the valve shuts off immediately without waiting for an AI inference).

### 2. Phase 1–3: The Foundation
**Status:** Highly Feasible / Mostly Implmented.
- We already have PostgreSQL storing the telemetry (`ph`, `tds`, `turbidity`, etc.).
- The `QualityScorer` in `backend/app/quality_score.py` already implements Phase 2 (Rules) and Phase 3 (WQI 0-100 scoring).

### 3. Phase 4: AI Anomaly Detection (Isolation Forest)
**Status:** Requires Migration.
- **Current State:** The system uses an `XGBClassifier` trained on a static dataset (`balanced_water_potability_3000.csv`).
- **Required Work:** We will need to replace `train_production_model.py` with an `IsolationForest` pipeline from `scikit-learn`.

### 4. Phase 5 & 6: Predictive Maintenance & Filter Life
**Status:** Future Implementation.
- To achieve this, we will need to aggregate moving averages and standard deviations over time.
- Filter life estimation can be modeled using a degradation curve (e.g., measuring how fast TDS climbs back up after a cleaning cycle).

### 5. Phase 7: Nightly Intelligence Pipeline (12:00 AM IST)
**Status:** Ready to Build.
- **Data Window:** Fetching a rolling 90-day dataset ensures the model adapts to seasonal changes (e.g., summer vs. monsoon water characteristics) without forgetting long-term baselines.
- **Implementation:** We will use `APScheduler` inside the ML-Service to trigger at `00:00 Asia/Kolkata`.
- **Validation Gate:** Training an Isolation Forest produces an "anomaly score". We can evaluate the new model against a hidden validation set of known anomalies to ensure it performs better before swapping it into production.

---

## Next Steps for Implementation (When Ready)

When you are ready to begin implementation, we will tackle this in two distinct PRs:

1. **The Model Swap:** Rewrite `train_production_model.py` to use `IsolationForest` and drop the dependency on the static CSV file in favor of querying the PostgreSQL `sensor_data` table.
2. **The Cron Scheduler:** Implement the APScheduler in `ml-service/main.py` to run the Nightly Pipeline, applying the 90-day rolling window logic.

*No code changes have been made yet, as requested.*
