Archive action performed: 20260615_120811

Kept:
- ML-Model/models/XGBoost.pkl  (best single-model per FINAL-RESULTS.md - 66.6% accuracy)
- ML-Model/models/Preprocessor.pkl (required for inference)

Archived:
- RandomForest.pkl
- GradientBoosting.pkl

Reason: keep the highest-performing single model and preserve preprocessor. Archived less-performing base learners to reduce repo clutter while keeping recovery instructions below.

Restore steps:
1. Move files from ML-Model/models/archived_20260615_120811/ back to ML-Model/models/.
   Example: mv ML-Model/models/archived_20260615_120811/RandomForest.pkl ML-Model/models/
2. Update any model-loading scripts to point to restored filenames if needed.
3. Commit the restore with message: "restore archived models from 20260615_120811"

Committed by automation.
