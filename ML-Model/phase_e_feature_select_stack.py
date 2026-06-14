"""
Phase E: Feature-selection + 5-fold stacking with LightGBM meta-learner
Expect: small but meaningful gain over 68.0% (target 70%+)
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
from sklearn.impute import KNNImputer
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
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

# Preprocessing and feature engineering (same as before)

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

    imputer = KNNImputer(n_neighbors=5)
    X = pd.DataFrame(imputer.fit_transform(X), columns=feature_cols)

    # IQR clipping
    for col in feature_cols:
        Q1, Q3 = X[col].quantile([.25, .75])
        IQR = Q3 - Q1
        X[col] = X[col].clip(Q1 - 1.5*IQR, Q3 + 1.5*IQR)

    scaler = StandardScaler()
    X = pd.DataFrame(scaler.fit_transform(X), columns=feature_cols)
    return X, y


def select_top_features(X, y, top_k=18):
    rf = RandomForestClassifier(n_estimators=300, random_state=42, n_jobs=-1, class_weight='balanced')
    rf.fit(X, y)
    importances = pd.Series(rf.feature_importances_, index=X.columns)
    top = importances.sort_values(ascending=False).head(top_k).index.tolist()
    return top, importances


def build_base_learners():
    learners = {
        'rf': RandomForestClassifier(n_estimators=300, max_depth=12, random_state=42, n_jobs=-1, class_weight='balanced'),
        'xgb': xgb.XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.03, use_label_encoder=False, eval_metric='logloss', random_state=42),
        'gb': RandomForestClassifier(n_estimators=300, random_state=42)  # placeholder for diversity (fast)
    }
    # Add LightGBM if available
    if HAS_LGB:
        learners['lgb'] = lgb.LGBMClassifier(n_estimators=200, max_depth=7, learning_rate=0.03, random_state=42)
    return learners


def cross_validated_meta_features(learners, X, y, n_splits=5):
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    meta_features = np.zeros((X.shape[0], len(learners)))
    i = 0
    for name, model in learners.items():
        print(f"[INFO] Building meta-features for {name} using {n_splits}-fold CV")
        if hasattr(model, 'predict_proba'):
            preds = cross_val_predict(model, X, y, cv=skf, method='predict_proba', n_jobs=-1)[:, 1]
        else:
            preds = cross_val_predict(model, X, y, cv=skf, method='predict', n_jobs=-1)
        meta_features[:, i] = preds
        i += 1
    return meta_features


def train_and_evaluate():
    X, y = load_and_preprocess()
    top_features, importances = select_top_features(X, y, top_k=18)
    X_sel = X[top_features]

    X_train, X_test, y_train, y_test = train_test_split(X_sel, y, test_size=0.2, random_state=42, stratify=y)

    learners = build_base_learners()

    # fit base learners on full training set
    for name, model in learners.items():
        model.fit(X_train, y_train)

    # Build meta-features using 5-fold CV on train set only
    meta_train = cross_validated_meta_features(learners, X_train, y_train, n_splits=5)
    # For test, predict probabilities directly from trained base learners
    meta_test = np.column_stack([model.predict_proba(X_test)[:, 1] if hasattr(model, 'predict_proba') else model.predict(X_test) for model in learners.values()])

    # Meta learner: LightGBM if available else XGBoost
    if HAS_LGB:
        meta = lgb.LGBMClassifier(n_estimators=300, learning_rate=0.03, random_state=42)
    else:
        meta = xgb.XGBClassifier(n_estimators=300, learning_rate=0.03, random_state=42, use_label_encoder=False, eval_metric='logloss')

    meta.fit(meta_train, y_train)
    y_pred = meta.predict(meta_test)
    if hasattr(meta, 'predict_proba'):
        y_proba = meta.predict_proba(meta_test)[:, 1]
    else:
        y_proba = y_pred

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)
    cm = confusion_matrix(y_test, y_pred).tolist()

    report = {
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'phase': 'E - FeatureSelect 5fold Stacking',
        'top_features': top_features,
        'metrics': {'accuracy': acc, 'precision': prec, 'recall': rec, 'f1': f1, 'auc': auc, 'confusion_matrix': cm},
        'importances': importances.sort_values(ascending=False).head(30).to_dict()
    }

    path = LOGS_DIR / f"phase_e_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    with open(path, 'w') as f:
        json.dump(report, f, indent=2)

    print('\n=== PHASE E RESULT ===')
    print(f"Accuracy: {acc:.4f}")
    print(f"Precision: {prec:.4f}")
    print(f"Recall: {rec:.4f}")
    print(f"F1: {f1:.4f}")
    print(f"AUC: {auc:.4f}")
    print(f"Report saved: {path}")
    return report

if __name__ == '__main__':
    report = train_and_evaluate()
    print('\nDone')
