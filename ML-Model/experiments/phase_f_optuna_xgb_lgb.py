"""
Phase F: Optuna tuning for XGBoost and LightGBM (limited trials)
- Uses IterativeImputer + feature engineering
- Tunes XGBoost (n_trials) and LightGBM if available
- Saves best models/report
"""

import optuna
import pandas as pd
import numpy as np
import json
from pathlib import Path
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

from sklearn.experimental import enable_iterative_imputer
from sklearn.impute import IterativeImputer
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
import xgboost as xgb

try:
    import lightgbm as lgb
    HAS_LGB = True
except Exception:
    HAS_LGB = False

DATA_PATH = Path(__file__).parent / "balanced_water_potability_3000.csv"
LOGS_DIR = Path(__file__).parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)

np.random.seed(42)

# Feature engineering

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

    imp = IterativeImputer(random_state=42, max_iter=10, sample_posterior=True)
    X = pd.DataFrame(imp.fit_transform(X), columns=feature_cols)

    for col in feature_cols:
        Q1, Q3 = X[col].quantile([.25, .75])
        IQR = Q3 - Q1
        X[col] = X[col].clip(Q1 - 1.5*IQR, Q3 + 1.5*IQR)

    scaler = StandardScaler()
    X = pd.DataFrame(scaler.fit_transform(X), columns=feature_cols)
    return X, y


# Objective for XGB

def objective_xgb(trial, X, y):
    params = {
        'n_estimators': trial.suggest_categorical('n_estimators', [100, 200, 300]),
        'max_depth': trial.suggest_int('max_depth', 3, 8),
        'learning_rate': trial.suggest_loguniform('learning_rate', 0.01, 0.2),
        'subsample': trial.suggest_uniform('subsample', 0.6, 1.0),
        'colsample_bytree': trial.suggest_uniform('colsample_bytree', 0.6, 1.0),
        'gamma': trial.suggest_loguniform('gamma', 1e-8, 1.0),
        'reg_alpha': trial.suggest_loguniform('reg_alpha', 1e-8, 1.0),
        'reg_lambda': trial.suggest_loguniform('reg_lambda', 1e-8, 1.0),
        'random_state': 42,
        'use_label_encoder': False,
        'eval_metric': 'logloss'
    }
    model = xgb.XGBClassifier(**params)
    skf = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
    scores = cross_val_score(model, X, y, cv=skf, scoring='accuracy', n_jobs=-1)
    return float(np.mean(scores))


# Objective for LGB

def objective_lgb(trial, X, y):
    params = {
        'n_estimators': trial.suggest_categorical('n_estimators', [100, 200, 300]),
        'num_leaves': trial.suggest_int('num_leaves', 16, 64),
        'max_depth': trial.suggest_int('max_depth', 3, 12),
        'learning_rate': trial.suggest_loguniform('learning_rate', 0.01, 0.2),
        'subsample': trial.suggest_uniform('subsample', 0.6, 1.0),
        'colsample_bytree': trial.suggest_uniform('colsample_bytree', 0.6, 1.0),
        'random_state': 42
    }
    model = lgb.LGBMClassifier(**params)
    skf = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
    scores = cross_val_score(model, X, y, cv=skf, scoring='accuracy', n_jobs=-1)
    return float(np.mean(scores))


def run_tuning():
    X, y = load_preprocess()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    results = {'timestamp': datetime.utcnow().isoformat() + 'Z'}

    # XGBoost optuna
    study_xgb = optuna.create_study(direction='maximize', study_name='xgb_study')
    study_xgb.optimize(lambda tr: objective_xgb(tr, X_train, y_train), n_trials=100)
    best_xgb = xgb.XGBClassifier(**study_xgb.best_params, use_label_encoder=False, eval_metric='logloss', random_state=42)
    best_xgb.fit(X_train, y_train)
    pred = best_xgb.predict(X_test)
    proba = best_xgb.predict_proba(X_test)[:,1]

    results['xgb'] = {
        'best_params': study_xgb.best_params,
        'accuracy': float(accuracy_score(y_test, pred)),
        'precision': float(precision_score(y_test, pred)),
        'recall': float(recall_score(y_test, pred)),
        'f1': float(f1_score(y_test, pred)),
        'auc': float(roc_auc_score(y_test, proba))
    }

    # LightGBM optuna (if available)
    if HAS_LGB:
        study_lgb = optuna.create_study(direction='maximize', study_name='lgb_study')
        study_lgb.optimize(lambda tr: objective_lgb(tr, X_train, y_train), n_trials=80)
        best_lgb = lgb.LGBMClassifier(**study_lgb.best_params, random_state=42)
        best_lgb.fit(X_train, y_train)
        pred2 = best_lgb.predict(X_test)
        proba2 = best_lgb.predict_proba(X_test)[:,1]
        results['lgb'] = {
            'best_params': study_lgb.best_params,
            'accuracy': float(accuracy_score(y_test, pred2)),
            'precision': float(precision_score(y_test, pred2)),
            'recall': float(recall_score(y_test, pred2)),
            'f1': float(f1_score(y_test, pred2)),
            'auc': float(roc_auc_score(y_test, proba2))
        }

    path = LOGS_DIR / f"phase_f_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    with open(path, 'w') as f:
        json.dump(results, f, indent=2)

    print('=== PHASE F TUNING COMPLETE ===')
    print(json.dumps(results, indent=2))
    print('Report saved:', path)

if __name__ == '__main__':
    run_tuning()
