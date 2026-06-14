"""
Colab-ready script: NN meta-learner stacking
- Run on Google Colab (enable GPU runtime) for best speed
- Installs dependencies if run in a fresh env

Workflow:
1. Load data and feature-engineer
2. Impute (IterativeImputer) and scale
3. Train base learners with StratifiedKFold to create OOF meta-features
4. Train a Keras NN meta-learner on OOF features
5. Evaluate on holdout test set and save models + report

Usage in Colab:
- Upload this file + balanced_water_potability_3000.csv to the VM (or mount Drive)
- Run: python colab_nn_meta.py

"""

import os
import json
from pathlib import Path
from datetime import datetime
import numpy as np
import pandas as pd

# Install note: on Colab run these before executing the script if packages missing:
# !pip install xgboost lightgbm scikit-learn tensorflow joblib

from sklearn.experimental import enable_iterative_imputer
from sklearn.impute import IterativeImputer
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.ensemble import RandomForestClassifier
import xgboost as xgb

try:
    import lightgbm as lgb
    HAS_LGB = True
except Exception:
    HAS_LGB = False

from sklearn.base import clone
import joblib

# Keras
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

DATA_PATH = Path(__file__).parent / "balanced_water_potability_3000.csv"
LOGS_DIR = Path(__file__).parent / "logs"
MODELS_DIR = Path(__file__).parent / "models"
LOGS_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)

RANDOM_STATE = 42

# Feature engineering (same as prior experiments)
def create_features(df):
    df = df.copy()
    df['ph_neutral_distance'] = np.abs(df['ph'] - 7.0)
    df['ph_squared'] = df['ph'] ** 2
    df['is_acidic'] = (df['ph'] < 7).astype(int)
    df['is_alkaline'] = (df['ph'] > 7).astype(int)
    df['hardness_log'] = np.log1p(df['Hardness'])
    df['hardness_high'] = (df['Hardness'] > 200).astype(int)
    df['solids_log'] = np.log1p(df['Solids'])
    df['solids_high'] = (df['Solids'] > 20000).astype(int)
    df['conductivity_log'] = np.log1p(df['Conductivity'])
    df['cond_to_hardness'] = df['Conductivity'] / (df['Hardness'] + 1)
    df['cond_to_solids'] = df['Conductivity'] / (df['Solids'] + 1)
    df['turbidity_log'] = np.log1p(df['Turbidity'])
    df['turbidity_high'] = (df['Turbidity'] > 5).astype(int)
    df['chloramines_high'] = (df['Chloramines'] > 7).astype(int)
    df['chloramines_to_solids'] = df['Chloramines'] / (df['Solids'] + 1)
    df['organic_carbon_log'] = np.log1p(df['Organic_carbon'])
    df['thm_high'] = (df['Trihalomethanes'] > 70).astype(int)
    df['thm_to_chloramines'] = df['Trihalomethanes'] / (df['Chloramines'] + 1)
    df['ph_conductivity_interaction'] = df['ph'] * df['Conductivity']
    df['sulfate_chloramines_interaction'] = df['Sulfate'] * df['Chloramines']
    df['feature_sum'] = (df['ph'] + df['Hardness']/100 + df['Solids']/10000 + 
                         df['Chloramines'] + df['Conductivity']/100 + 
                         df['Organic_carbon'] + df['Trihalomethanes']/10 + df['Turbidity'])
    return df


def load_and_preprocess():
    df = pd.read_csv(DATA_PATH)
    # basic cleaning consistent with earlier phases
    df = df[(df['ph'] >= 4.5) & (df['ph'] <= 11)]
    df = df[df['Conductivity'] <= 4500]
    df = df.dropna(subset=['Potability'])
    df = create_features(df)
    feature_cols = [c for c in df.columns if c != 'Potability']
    X = df[feature_cols].copy()
    y = df['Potability'].copy()

    imp = IterativeImputer(random_state=RANDOM_STATE, max_iter=10, sample_posterior=True)
    X_imp = pd.DataFrame(imp.fit_transform(X), columns=feature_cols)

    # IQR clipping
    for col in feature_cols:
        Q1, Q3 = X_imp[col].quantile([.25, .75])
        IQR = Q3 - Q1
        X_imp[col] = X_imp[col].clip(Q1 - 1.5*IQR, Q3 + 1.5*IQR)

    scaler = StandardScaler()
    X_scaled = pd.DataFrame(scaler.fit_transform(X_imp), columns=feature_cols)

    return X_scaled, y, feature_cols, scaler, imp


def create_oof_meta(X, y, base_models, n_splits=5):
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=RANDOM_STATE)
    n_samples = X.shape[0]
    meta_train = np.zeros((n_samples, len(base_models)))

    # holdout test in stacking normally done separately; here we'll return meta_train and later create a holdout test
    for idx, (name, model) in enumerate(base_models):
        oof = np.zeros(n_samples)
        for train_idx, val_idx in skf.split(X, y):
            X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
            y_tr = y.iloc[train_idx]
            model_clone = clone(model)  # clone estimator for fold
            model_clone.fit(X_tr, y_tr)
            oof[val_idx] = model_clone.predict_proba(X_val)[:,1]
        meta_train[:, idx] = oof
        print(f"Base model {name} OOF done")
    return meta_train


def train_base_models_full(X, y, base_models):
    trained = []
    for name, model in base_models:
        print('Training full model:', name)
        model.fit(X, y)
        trained.append((name, model))
        # save
        joblib.dump(model, MODELS_DIR / f"{name}_full.pkl")
    return trained


def train_nn_meta(X_meta, y_meta, X_meta_test=None, y_meta_test=None, epochs=50, batch_size=32):
    inp = layers.Input(shape=(X_meta.shape[1],))
    x = layers.Dense(64, activation='relu')(inp)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(32, activation='relu')(x)
    x = layers.Dropout(0.2)(x)
    out = layers.Dense(1, activation='sigmoid')(x)

    model = keras.Model(inp, out)
    model.compile(optimizer=keras.optimizers.Adam(1e-3), loss='binary_crossentropy', metrics=['AUC'])

    callbacks = [keras.callbacks.EarlyStopping(patience=6, restore_best_weights=True)]
    history = model.fit(X_meta, y_meta, validation_split=0.1, epochs=epochs, batch_size=batch_size, callbacks=callbacks, verbose=2)

    if X_meta_test is not None:
        preds = model.predict(X_meta_test).ravel()
        return model, history, preds
    return model, history, None


def evaluate_and_save(y_true, y_pred_proba, prefix='nn_meta'):
    y_pred = (y_pred_proba >= 0.5).astype(int)
    report = {
        'accuracy': float(accuracy_score(y_true, y_pred)),
        'precision': float(precision_score(y_true, y_pred)),
        'recall': float(recall_score(y_true, y_pred)),
        'f1': float(f1_score(y_true, y_pred)),
        'auc': float(roc_auc_score(y_true, y_pred_proba))
    }
    path = LOGS_DIR / f"{prefix}_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    with open(path, 'w') as f:
        json.dump(report, f, indent=2)
    print('Saved report:', path)
    print(json.dumps(report, indent=2))
    return report


def main():
    X, y, feature_cols, scaler, imp = load_and_preprocess()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE)

    base_models = [
        ('xgb', xgb.XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.05, use_label_encoder=False, eval_metric='logloss', random_state=RANDOM_STATE)),
        ('rf', RandomForestClassifier(n_estimators=200, random_state=RANDOM_STATE, n_jobs=-1)),
    ]
    if HAS_LGB:
        base_models.append(('lgb', lgb.LGBMClassifier(n_estimators=200, num_leaves=31, learning_rate=0.05, random_state=RANDOM_STATE)))

    print('Creating OOF meta-features (this will train base models multiple times)')
    meta_train = create_oof_meta(X_train, y_train, base_models, n_splits=5)

    # create meta-test by training base models on full train and predicting test
    trained_full = train_base_models_full(X_train, y_train, base_models)
    meta_test = np.zeros((X_test.shape[0], len(base_models)))
    for idx, (name, model) in enumerate(trained_full):
        meta_test[:, idx] = model.predict_proba(X_test)[:,1]

    print('Training NN meta-learner')
    nn_meta, history, preds_test = train_nn_meta(meta_train, y_train.values, X_meta_test=meta_test, y_meta_test=y_test.values, epochs=100)
    nn_meta.save(MODELS_DIR / 'nn_meta.h5')
    # save scaler & imputers
    joblib.dump(scaler, MODELS_DIR / 'scaler.pkl')
    joblib.dump(imp, MODELS_DIR / 'imputer.pkl')

    report = evaluate_and_save(y_test.values, preds_test, prefix='nn_meta')
    # save meta training history
    hist_path = LOGS_DIR / f"nn_meta_history_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    with open(hist_path, 'w') as f:
        json.dump({k: [float(x) for x in v] for k, v in history.history.items()}, f)
    print('Done')

if __name__ == '__main__':
    main()
