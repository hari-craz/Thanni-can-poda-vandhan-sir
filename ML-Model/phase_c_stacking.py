"""
Hydronix ML Model - PHASE C: STACKING META-LEARNER
===================================================
Stack weak learners + meta-learner (Logistic Regression) for best results

Expected: 66.6% → 70-75%+
"""

import pandas as pd
import numpy as np
import warnings
from datetime import datetime
from pathlib import Path
import json

from sklearn.model_selection import train_test_split, cross_val_predict
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.impute import KNNImputer
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, AdaBoostClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
import xgboost as xgb

try:
    import lightgbm as lgb
    HAS_LGB = True
except:
    HAS_LGB = False

warnings.filterwarnings('ignore')

class Config:
    DATA_PATH = Path(__file__).parent / "balanced_water_potability_3000.csv"
    LOGS_DIR = Path(__file__).parent / "logs"
    
    def __post_init__(self):
        self.LOGS_DIR.mkdir(parents=True, exist_ok=True)

config = Config()

def log(msg: str):
    print(f"[{datetime.utcnow().isoformat()}Z] {msg}")

class StackingEnsemble:
    def __init__(self):
        self.scaler = StandardScaler()
        self.robust_scaler = RobustScaler()
        self.imputer = KNNImputer(n_neighbors=5)
        self.results = {}
    
    def load_and_process(self):
        df = pd.read_csv(config.DATA_PATH)
        log(f"Loaded: {df.shape[0]} rows")
        
        # Soft outlier removal
        initial = len(df)
        df = df[(df['ph'] >= 4.5) & (df['ph'] <= 11)]
        df = df[df['Conductivity'] <= 4500]
        df = df.dropna(subset=['Potability'])
        log(f"After outlier removal: {len(df)} rows ({100*(initial-len(df))/initial:.1f}% removed)")
        
        # 25+ features
        df = self._create_features(df)
        
        feature_cols = [c for c in df.columns if c != 'Potability']
        X = df[feature_cols].copy()
        y = df['Potability'].copy()
        
        # KNN imputation
        X = pd.DataFrame(self.imputer.fit_transform(X), columns=feature_cols)
        
        # IQR clipping
        for col in feature_cols:
            Q1, Q3 = X[col].quantile([0.25, 0.75])
            IQR = Q3 - Q1
            X[col] = X[col].clip(Q1 - 1.5*IQR, Q3 + 1.5*IQR)
        
        X_scaled = pd.DataFrame(self.scaler.fit_transform(X), columns=feature_cols)
        log(f"Final: {X_scaled.shape[0]} x {X_scaled.shape[1]}")
        
        return X_scaled, y
    
    def _create_features(self, df):
        """25+ domain features"""
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
    
    def train_base_learners(self, X_train, y_train):
        """Train all base learners"""
        log("\n=== TRAINING BASE LEARNERS ===")
        
        # 1. Random Forest
        rf = RandomForestClassifier(n_estimators=300, max_depth=12, min_samples_split=2,
                                     class_weight='balanced', random_state=42, n_jobs=-1)
        rf.fit(X_train, y_train)
        log("RF trained")
        
        # 2. XGBoost (tuned from Phase B)
        xgb_model = xgb.XGBClassifier(n_estimators=150, max_depth=6, learning_rate=0.03,
                                       subsample=0.9, colsample_bytree=0.8, 
                                       class_weight='balanced', random_state=42, 
                                       eval_metric='logloss')
        xgb_model.fit(X_train, y_train)
        log("XGBoost trained")
        
        # 3. Gradient Boosting
        gb = GradientBoostingClassifier(n_estimators=300, max_depth=6, learning_rate=0.05,
                                        min_samples_split=2, subsample=0.9, random_state=42)
        gb.fit(X_train, y_train)
        log("GB trained")
        
        # 4. AdaBoost
        ada = AdaBoostClassifier(n_estimators=200, learning_rate=0.1, random_state=42)
        ada.fit(X_train, y_train)
        log("AdaBoost trained")
        
        # 5. LightGBM (tuned from Phase B)
        if HAS_LGB:
            lgb_model = lgb.LGBMClassifier(n_estimators=150, max_depth=6, learning_rate=0.03,
                                           num_leaves=31, subsample=0.8, class_weight='balanced',
                                           random_state=42, verbose=-1)
            lgb_model.fit(X_train, y_train)
            log("LightGBM trained")
        else:
            lgb_model = None
        
        # 6. SVM
        svm = SVC(kernel='rbf', probability=True, random_state=42, class_weight='balanced')
        svm.fit(X_train, y_train)
        log("SVM trained")
        
        # 7. KNN
        knn = KNeighborsClassifier(n_neighbors=7, weights='distance', n_jobs=-1)
        knn.fit(X_train, y_train)
        log("KNN trained")
        
        return [rf, xgb_model, gb, ada, (lgb_model if lgb_model else gb), svm, knn]
    
    def create_meta_features(self, learners, X, y):
        """Create meta-features using cross-val predictions"""
        log("\n=== CREATING META-FEATURES ===")
        
        meta_features = []
        for i, learner in enumerate(learners):
            if learner is None:
                continue
            # Cross-validation predictions for meta-learner training
            cv_pred = cross_val_predict(learner, X, y, cv=3, method='predict_proba')[:, 1]
            meta_features.append(cv_pred)
            log(f"Learner {i+1} meta-features created")
        
        meta_X = np.column_stack(meta_features)
        log(f"Meta-features shape: {meta_X.shape}")
        return meta_X
    
    def train_meta_learner(self, meta_X_train, y_train, X_test, learners):
        """Train meta-learner on base learner predictions"""
        log("\n=== TRAINING META-LEARNER ===")
        
        # Generate test meta-features
        meta_X_test = []
        for learner in learners:
            if learner is None:
                continue
            proba = learner.predict_proba(X_test)[:, 1]
            meta_X_test.append(proba)
        meta_X_test = np.column_stack(meta_X_test)
        
        # Train meta-learner (Logistic Regression)
        meta_learner = LogisticRegression(max_iter=1000, random_state=42)
        meta_learner.fit(meta_X_train, y_train)
        
        # Predictions
        y_pred_meta = meta_learner.predict(meta_X_test)
        y_proba_meta = meta_learner.predict_proba(meta_X_test)[:, 1]
        
        log("Meta-learner trained")
        
        return y_pred_meta, y_proba_meta
    
    def run(self):
        log("=== PHASE C: STACKING META-LEARNER ===\n")
        
        X, y = self.load_and_process()
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        log(f"\nTrain: {X_train.shape}, Test: {X_test.shape}")
        
        # Train base learners
        learners = self.train_base_learners(X_train, y_train)
        
        # Create meta-features
        meta_X_train = self.create_meta_features(learners, X_train, y_train)
        
        # Train meta-learner
        y_pred_stack, y_proba_stack = self.train_meta_learner(meta_X_train, y_train, X_test, learners)
        
        # Evaluate stacking ensemble
        log("\n=== STACKING ENSEMBLE RESULTS ===")
        
        acc_stack = accuracy_score(y_test, y_pred_stack)
        prec_stack = precision_score(y_test, y_pred_stack)
        rec_stack = recall_score(y_test, y_pred_stack)
        f1_stack = f1_score(y_test, y_pred_stack)
        auc_stack = roc_auc_score(y_test, y_proba_stack)
        conf_stack = confusion_matrix(y_test, y_pred_stack)
        
        log(f"Accuracy: {acc_stack:.4f}")
        log(f"Precision: {prec_stack:.4f}")
        log(f"Recall: {rec_stack:.4f}")
        log(f"F1-Score: {f1_stack:.4f}")
        log(f"AUC-ROC: {auc_stack:.4f}")
        log(f"Confusion Matrix:\n{conf_stack}")
        
        # Compare with best single model (XGBoost at 66.6%)
        improvement = acc_stack - 0.666
        total_improvement = acc_stack - 0.625
        
        log(f"\n{'='*70}")
        log(f"BASELINE (62.5%) -> ADVANCED (66.6%) -> STACKED ({acc_stack*100:.1f}%)")
        log(f"Phase gain: +{improvement*100:.1f}%")
        log(f"Total improvement: +{total_improvement*100:.1f}%")
        log(f"Progress: {acc_stack*100:.1f}% / 85% target")
        log(f"{'='*70}")
        
        # Save report
        report = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'phase': 'C - Stacking Meta-Learner',
            'approach': [
                '7 diverse base learners (RF, XGB, GB, AdaBoost, LGB, SVM, KNN)',
                'Cross-validation for meta-feature generation',
                'Logistic Regression meta-learner'
            ],
            'base_learners': ['RandomForest', 'XGBoost', 'GradientBoosting', 'AdaBoost', 'LightGBM', 'SVM', 'KNN'],
            'results': {
                'accuracy': float(acc_stack),
                'precision': float(prec_stack),
                'recall': float(rec_stack),
                'f1': float(f1_stack),
                'auc_roc': float(auc_stack),
                'confusion_matrix': conf_stack.tolist()
            },
            'improvements': {
                'baseline': 0.625,
                'phase_a': 0.666,
                'phase_c_stacking': float(acc_stack),
                'improvement_from_baseline': float(total_improvement),
                'improvement_from_phase_a': float(improvement)
            },
            'progress': f"{acc_stack*100:.1f}% / 85% target ({(acc_stack/0.85)*100:.0f}% toward goal)"
        }
        
        path = config.LOGS_DIR / f"phase_c_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        with open(path, 'w') as f:
            json.dump(report, f, indent=2)
        
        log(f"\nReport: {path}")
        
        return acc_stack

if __name__ == "__main__":
    ensemble = StackingEnsemble()
    final_acc = ensemble.run()
