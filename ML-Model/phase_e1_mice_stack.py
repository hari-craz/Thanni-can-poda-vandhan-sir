"""
Phase E1: IterativeImputer (MICE) + 5-fold stacking with Logistic meta-learner
Goal: fix missing-value bias (Sulfate heavy) and retrain stacking; expected improvement
"""

import pandas as pd
import numpy as np
import json
from pathlib import Path
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_predict
from sklearn.experimental import enable_iterative_imputer
from sklearn.impute import IterativeImputer
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import AdaBoostClassifier
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

# Feature engineering function (same)

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
    # soft outlier removal
    df = df[(df['ph'] >= 4.5) & (df['ph'] <= 11)]
    df = df[df['Conductivity'] <= 4500]
    df = df.dropna(subset=['Potability'])
    df = create_features(df)
    feature_cols = [c for c in df.columns if c != 'Potability']
    X = df[feature_cols].copy()
    y = df['Potability'].copy()

    # Iterative Imputer (MICE)
    imp = IterativeImputer(random_state=42, max_iter=10, sample_posterior=True)
    X_imp = pd.DataFrame(imp.fit_transform(X), columns=feature_cols)

    # IQR clipping and scaling
    for col in feature_cols:
        Q1, Q3 = X_imp[col].quantile([.25, .75])
        IQR = Q3 - Q1
        X_imp[col] = X_imp[col].clip(Q1 - 1.5*IQR, Q3 + 1.5*IQR)

    scaler = StandardScaler()
    X_scaled = pd.DataFrame(scaler.fit_transform(X_imp), columns=feature_cols)
    return X_scaled, y


def build_learners():
    learners = {
        'rf': RandomForestClassifier(n_estimators=300, max_depth=12, random_state=42, n_jobs=-1, class_weight='balanced'),
        'xgb': xgb.XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.03, use_label_encoder=False, eval_metric='logloss', random_state=42),
        'gb': RandomForestClassifier(n_estimators=200, random_state=42),
        'ada': AdaBoostClassifier(n_estimators=200, learning_rate=0.1, random_state=42),
        'svm': SVC(kernel='rbf', probability=True, class_weight='balanced', random_state=42),
        'knn': KNeighborsClassifier(n_neighbors=7, weights='distance')
    }
    if HAS_LGB:
        learners['lgb'] = lgb.LGBMClassifier(n_estimators=200, max_depth=7, learning_rate=0.03, random_state=42)
    return learners


def build_meta_features(learners, X, y, n_splits=5):
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    meta = np.zeros((X.shape[0], len(learners)))
    i = 0
    for name, model in learners.items():
        print(f"[INFO] meta-features for {name}")
        if hasattr(model, 'predict_proba'):
            preds = cross_val_predict(model, X, y, cv=skf, method='predict_proba', n_jobs=-1)[:, 1]
        else:
            preds = cross_val_predict(model, X, y, cv=skf, method='predict', n_jobs=-1)
        meta[:, i] = preds
        i += 1
    return meta


def train_and_eval():
    X, y = load_and_preprocess()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    learners = build_learners()
    # Fit base learners on train
    for name, model in learners.items():
        print(f"[INFO] fitting {name}")
        model.fit(X_train, y_train)

    # meta features from train (5-fold)
    meta_train = build_meta_features(learners, X_train, y_train, n_splits=5)
    # meta-test from trained base learners
    meta_test = np.column_stack([model.predict_proba(X_test)[:,1] if hasattr(model,'predict_proba') else model.predict(X_test) for model in learners.values()])

    meta = LogisticRegression(max_iter=1000, class_weight='balanced')
    meta.fit(meta_train, y_train)
    y_pred = meta.predict(meta_test)
    y_proba = meta.predict_proba(meta_test)[:,1]

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)
    cm = confusion_matrix(y_test, y_pred).tolist()

    report = {
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'phase': 'E1 - MICE 5fold Stacking',
        'metrics': {'accuracy': acc, 'precision': prec, 'recall': rec, 'f1': f1, 'auc': auc, 'confusion_matrix': cm},
        'learners': list(learners.keys())
    }

    path = LOGS_DIR / f"phase_e1_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    with open(path, 'w') as f:
        json.dump(report, f, indent=2)

    print('\n=== PHASE E1 RESULT ===')
    print(f"Accuracy: {acc:.4f}")
    print(f"Precision: {prec:.4f}")
    print(f"Recall: {rec:.4f}")
    print(f"F1: {f1:.4f}")
    print(f"AUC: {auc:.4f}")
    print(f"Report saved: {path}")
    return report

if __name__ == '__main__':
    rpt = train_and_eval()
    print('\nDone')
