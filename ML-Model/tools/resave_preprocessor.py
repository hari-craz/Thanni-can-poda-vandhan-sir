import joblib
import pandas as pd
import numpy as np
from sklearn.impute import KNNImputer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from pathlib import Path

DATA_CSV = Path(__file__).parent.parent / 'balanced_water_potability_3000.csv'
OUT_PATH = Path(__file__).parent.parent / 'models' / 'Preprocessor.pkl'

FEATURE_NAMES = ['ph','Hardness','Solids','Chloramines','Sulfate','Conductivity','Organic_carbon','Trihalomethanes','Turbidity']

print('Loading data from', DATA_CSV)
df = pd.read_csv(DATA_CSV)
# Keep only rows with target present
if 'Potability' in df.columns:
    df = df.dropna(subset=['Potability'])

X = df[FEATURE_NAMES].copy()
print('Shape before impute:', X.shape)

imputer = KNNImputer(n_neighbors=5)
scaler = StandardScaler()

# Fit imputer then scaler
X_imp = imputer.fit_transform(X)
scaler.fit(X_imp)

pipeline = Pipeline([
    ('imputer', imputer),
    ('scaler', scaler)
])

OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
joblib.dump(pipeline, OUT_PATH)
print('Saved Preprocessor to', OUT_PATH)
