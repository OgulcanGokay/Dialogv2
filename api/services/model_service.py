from __future__ import annotations
from functools import lru_cache
from pathlib import Path
import joblib
import pandas as pd
from typing import Dict, Any

@lru_cache(maxsize=8)
def load_model(model_path: str):
    p = Path(model_path)
    if not p.exists():
        raise FileNotFoundError(f"Model not found at: {p}")
    return joblib.load(p)

def predict_from_features(model, features: Dict[str, Any]) -> float:
    X = pd.DataFrame([features])
    y = model.predict(X)
    return float(y[0])
