"""
Phase G: Optuna tuning for base learners + stacking/meta
- Designed to run on Colab (fast with GPU for NN meta but base model tuning is CPU-bound)
- Tunes XGBoost and LightGBM (separate studies) then builds stacking with best params
- Trains both Logistic meta and a small Keras NN meta and compares performance
- Saves models and JSON report to ML-Model/logs

Usage: python phase_g_optuna_stack.py --trials_xgb 80 --trials_lgb 60 --trials_meta 40
"""

import optuna
import argparse
import json
from pathlib import Path
from datetime import datetime
import numpy as np
import pandas as pd
import warnings
warnings.filterwarnings('ignore')

from sklearn.experimental import enable_iterative_imputer
from sklearn.impute import IterativeImputer
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import StratifiedKFold, train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.base import clone

import xgboost as xgb

try:
    import lightgbm as lgb
    HAS_LGB = True
except Exception:
    HAS_LGB = False

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


def load_preprocess():
    df = pd.read_csv(DATA_PATH)
    df = df[(df['ph'] >= 4.5) & (df['ph'] <= 11)]
    df = df[df['Conductivity'] <= 4500]
    df = df.dropna(subset=['Potability'])
    df = create_features(df)
    feature_cols = [c for c in df.columns if c != 'Potability']
    X = df[feature_cols].copy()
    y = df['Potability'].copy()

    imp = IterativeImputer(random_state=RANDOM_STATE, max_iter=10, sample_posterior=True)
    X = pd.DataFrame(imp.fit_transform(X), columns=feature_cols)

    for col in feature_cols:
        Q1, Q3 = X[col].quantile([.25, .75])
        IQR = Q3 - Q1
        X[col] = X[col].clip(Q1 - 1.5*IQR, Q3 + 1.5*IQR)

    scaler = StandardScaler()
    X = pd.DataFrame(scaler.fit_transform(X), columns=feature_cols)
    return X, y, scaler, imp

# Optuna objectives

def objective_xgb(trial, X, y):
    params = {
        'n_estimators': trial.suggest_categorical('n_estimators', [100,200,300]),
        'max_depth': trial.suggest_int('max_depth', 3, 8),
        'learning_rate': trial.suggest_loguniform('learning_rate', 0.01, 0.2),
        'subsample': trial.suggest_uniform('subsample', 0.6, 1.0),
        'colsample_bytree': trial.suggest_uniform('colsample_bytree', 0.6, 1.0),
        'gamma': trial.suggest_loguniform('gamma', 1e-8, 1.0),
        'reg_alpha': trial.suggest_loguniform('reg_alpha', 1e-8, 1.0),
        'reg_lambda': trial.suggest_loguniform('reg_lambda', 1e-8, 1.0),
        'random_state': RANDOM_STATE,
        'use_label_encoder': False,
        'eval_metric': 'logloss'
    }
    model = xgb.XGBClassifier(**params)
    skf = StratifiedKFold(n_splits=3, shuffle=True, random_state=RANDOM_STATE)
    scores = cross_val_score(model, X, y, cv=skf, scoring='accuracy', n_jobs=-1)
    return float(np.mean(scores))


def objective_lgb(trial, X, y):
    params = {
        'n_estimators': trial.suggest_categorical('n_estimators', [100,200,300]),
        'num_leaves': trial.suggest_int('num_leaves', 16, 64),
        'max_depth': trial.suggest_int('max_depth', 3, 12),
        'learning_rate': trial.suggest_loguniform('learning_rate', 0.01, 0.2),
        'subsample': trial.suggest_uniform('subsample', 0.6, 1.0),
        'colsample_bytree': trial.suggest_uniform('colsample_bytree', 0.6, 1.0),
        'random_state': RANDOM_STATE
    }
    model = lgb.LGBMClassifier(**params)
    skf = StratifiedKFold(n_splits=3, shuffle=True, random_state=RANDOM_STATE)
    scores = cross_val_score(model, X, y, cv=skf, scoring='accuracy', n_jobs=-1)
    return float(np.mean(scores))


def train_stack_and_meta(X_train, y_train, X_test, y_test, best_xgb_params, best_lgb_params):
    base_models = []
    # prepare xgb params without duplicate random_state
    xgb_params = dict(best_xgb_params) if best_xgb_params else {}
    xgb_params.setdefault('random_state', RANDOM_STATE)
    # ensure XGBoost-specific kwargs are present in params, not passed twice
    xgb_params.update({'use_label_encoder': False, 'eval_metric': 'logloss'})
    base_models.append(('xgb', xgb.XGBClassifier(**xgb_params)))
    base_models.append(('rf', RandomForestClassifier(n_estimators=200, random_state=RANDOM_STATE, n_jobs=-1)))
    if HAS_LGB:
        lgb_params = dict(best_lgb_params) if best_lgb_params else {}
        lgb_params.setdefault('random_state', RANDOM_STATE)
        base_models.append(('lgb', lgb.LGBMClassifier(**lgb_params)))

    # OOF meta-features
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    meta_train = np.zeros((X_train.shape[0], len(base_models)))
    for idx, (name, model) in enumerate(base_models):
        oof = np.zeros(X_train.shape[0])
        for train_idx, val_idx in skf.split(X_train, y_train):
            m = clone(model)
            m.fit(X_train.iloc[train_idx], y_train.iloc[train_idx])
            oof[val_idx] = m.predict_proba(X_train.iloc[val_idx])[:,1]
        meta_train[:, idx] = oof

    # meta test
    trained = []
    for name, model in base_models:
        model.fit(X_train, y_train)
        trained.append((name, model))

    meta_test = np.column_stack([m.predict_proba(X_test)[:,1] for _, m in trained])

    # Logistic meta
    log = LogisticRegression(max_iter=1000)
    log.fit(meta_train, y_train)
    p_log = log.predict_proba(meta_test)[:,1]

    # NN meta
    inp = layers.Input(shape=(meta_train.shape[1],))
    x = layers.Dense(64, activation='relu')(inp)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(32, activation='relu')(x)
    out = layers.Dense(1, activation='sigmoid')(x)
    nn = keras.Model(inp, out)
    nn.compile(optimizer='adam', loss='binary_crossentropy')
    nn.fit(meta_train, y_train, epochs=60, batch_size=32, validation_split=0.1, callbacks=[keras.callbacks.EarlyStopping(patience=6, restore_best_weights=True)], verbose=0)
    p_nn = nn.predict(meta_test).ravel()

    # Evaluate
    def report(y_true, probs):
        preds = (probs >= 0.5).astype(int)
        return {
            'accuracy': float(accuracy_score(y_true, preds)),
            'precision': float(precision_score(y_true, preds)),
            'recall': float(recall_score(y_true, preds)),
            'f1': float(f1_score(y_true, preds)),
            'auc': float(roc_auc_score(y_true, probs))
        }
    return {'logistic_meta': report(y_test, p_log), 'nn_meta': report(y_test, p_nn)}


def main(trials_xgb=80, trials_lgb=60):
    X, y, scaler, imp = load_preprocess()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE)

    results = {'timestamp': datetime.utcnow().isoformat() + 'Z'}

    # XGB study
    study_xgb = optuna.create_study(direction='maximize', study_name='xgb_study')
    study_xgb.optimize(lambda tr: objective_xgb(tr, X_train, y_train), n_trials=trials_xgb)
    results['xgb_best_params'] = study_xgb.best_params

    # LGB study
    if HAS_LGB:
        study_lgb = optuna.create_study(direction='maximize', study_name='lgb_study')
        study_lgb.optimize(lambda tr: objective_lgb(tr, X_train, y_train), n_trials=trials_lgb)
        results['lgb_best_params'] = study_lgb.best_params
    else:
        results['lgb_best_params'] = None

    # Train stacking + meta
    best_xgb_params = dict(results['xgb_best_params'])
    # ensure single random_state entry
    if 'random_state' in best_xgb_params:
        best_xgb_params.pop('random_state')
    best_xgb_params['random_state'] = RANDOM_STATE
    best_lgb_params = dict(results['lgb_best_params']) if results['lgb_best_params'] else {}
    stack_report = train_stack_and_meta(X_train, y_train, X_test, y_test, best_xgb_params, best_lgb_params)
    results['stack_report'] = stack_report

    # Save report
    path = LOGS_DIR / f"phase_g_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    with open(path, 'w') as f:
        json.dump(results, f, indent=2)
    print('Saved report:', path)
    print(json.dumps(results, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--trials_xgb', type=int, default=80)
    parser.add_argument('--trials_lgb', type=int, default=60)
    args = parser.parse_args()
    main(args.trials_xgb, args.trials_lgb)
