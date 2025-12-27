from __future__ import annotations
import os
import joblib
import pandas as pd
from typing import Dict, Any

_MODEL = None

def load_model(model_path: str):
    global _MODEL
    if _MODEL is None:
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found at: {model_path}")
        _MODEL = joblib.load(model_path)
    return _MODEL

def predict_from_features(model, features: Dict[str, Any]) -> float:
    X = pd.DataFrame([features])
    y = model.predict(X)
    return float(y[0])
