Colab instructions — NN meta-learner stacking

1) Open Google Colab (https://colab.research.google.com)
2) In Runtime > Change runtime type -> Hardware accelerator: GPU
3) Upload these files into Colab VM or mount Google Drive:
   - ML-Model/colab_nn_meta.py
   - ML-Model/balanced_water_potability_3000.csv
4) (Optional) In a notebook cell run to install deps:
   !pip install xgboost lightgbm scikit-learn tensorflow joblib
5) Run the script:
   !python colab_nn_meta.py

Notes:
- The script trains base learners with 5-fold OOF stacking, then trains a Keras NN meta-learner.
- Training may take 5-20 minutes depending on GPU and runtime.
- Results, logs and saved models appear in ML-Model/logs and ML-Model/models in the Colab VM; mount Drive if persistence required.
- If lightgbm isn't available in the environment, the script will continue using XGBoost + RF.

Suggested follow-ups after a successful run:
- Convert the NN meta-learner to a lightweight TensorFlow SavedModel and add an inference endpoint in backend.
- Run Optuna to tune the NN architecture or base model hyperparameters (Colab recommended).
