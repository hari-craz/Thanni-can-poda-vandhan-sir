import os
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.impute import KNNImputer
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

def train():
    # Set paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(base_dir, 'balanced_water_potability_3000.csv')
    
    # Load dataset
    print(f"Loading dataset from: {dataset_path}")
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found at {dataset_path}")
        
    df = pd.read_csv(dataset_path)
    print(f"Dataset shape: {df.shape}")
    
    # Split features and target
    feature_columns = ['ph', 'Hardness', 'Solids', 'Chloramines', 'Sulfate', 'Conductivity', 'Organic_carbon', 'Trihalomethanes', 'Turbidity']
    target_column = 'Potability'
    
    X = df[feature_columns]
    y = df[target_column]
    
    # Train test split for evaluation
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    # Preprocessor pipeline
    preprocessor = Pipeline([
        ('imputer', KNNImputer(n_neighbors=5)),
        ('scaler', StandardScaler())
    ])
    
    print("Fitting preprocessor on training split...")
    X_train_processed = preprocessor.fit_transform(X_train)
    X_train_processed_df = pd.DataFrame(X_train_processed, columns=feature_columns)
    
    X_test_processed = preprocessor.transform(X_test)
    X_test_processed_df = pd.DataFrame(X_test_processed, columns=feature_columns)
    
    # Train model
    print("Training XGBClassifier model...")
    model = XGBClassifier(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        random_state=42,
        eval_metric='logloss'
    )
    model.fit(X_train_processed_df, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test_processed_df)
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    
    print("\n--- Evaluation Metrics on Test Split ---")
    print(f"Accuracy:  {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall:    {recall:.4f}")
    print(f"F1-Score:  {f1:.4f}\n")
    
    # Fit on full dataset for production
    print("Fitting preprocessor and model on full 3000-sample dataset...")
    preprocessor_prod = Pipeline([
        ('imputer', KNNImputer(n_neighbors=5)),
        ('scaler', StandardScaler())
    ])
    X_processed = preprocessor_prod.fit_transform(X)
    X_processed_df = pd.DataFrame(X_processed, columns=feature_columns)
    
    model_prod = XGBClassifier(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        random_state=42,
        eval_metric='logloss'
    )
    model_prod.fit(X_processed_df, y)
    
    # Ensure target models directory exists in ml-service
    ml_models_dir = os.path.abspath(os.path.join(base_dir, '..', 'ml-service', 'models'))
    os.makedirs(ml_models_dir, exist_ok=True)
    
    # Save artifacts
    preprocessor_path = os.path.join(ml_models_dir, 'Preprocessor.pkl')
    model_path = os.path.join(ml_models_dir, 'XGBoost.pkl')
    
    print(f"Saving preprocessor to: {preprocessor_path}")
    joblib.dump(preprocessor_prod, preprocessor_path)
    
    print(f"Saving model to: {model_path}")
    joblib.dump(model_prod, model_path)
    
    # Also save to local ML-Model/models directory for backup/reference
    local_models_dir = os.path.join(base_dir, 'models')
    os.makedirs(local_models_dir, exist_ok=True)
    joblib.dump(preprocessor_prod, os.path.join(local_models_dir, 'Preprocessor.pkl'))
    joblib.dump(model_prod, os.path.join(local_models_dir, 'XGBoost.pkl'))
    
    print("\nModel training and deployment completed successfully!")

if __name__ == '__main__':
    train()
