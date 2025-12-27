# api/services/feature_builder.py
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
import numpy as np
import math
from datetime import datetime

# Modelin beklediği 28 kolon (sıra önemli değil ama biz sabit tutuyoruz)
EXPECTED_COLS = [
    "gl_lag_1", "gl_lag_2", "gl_lag_3", "gl_lag_5", "gl_lag_10", "gl_lag_15", "gl_lag_30",
    "gl_slope_5", "gl_slope_15",
    "gl_rm_5", "gl_rs_5", "gl_rm_15", "gl_rs_15", "gl_rm_30", "gl_rs_30",
    "tod_sin", "tod_cos",
    "HR", "METs",
    "Calories (Activity)", "Calories", "Carbs", "Protein", "Fat", "Fiber",
    "Amount Consumed", "Meal Type", "Steps"
]

@dataclass
class FeatureBuildResult:
    mode: str  # "full" | "fallback" | "min"
    features: Dict[str, object]  # float + Meal Type (str)
    features_used_cols: List[str]

def _safe_std(x: np.ndarray) -> float:
    return float(x.std(ddof=0)) if len(x) > 0 else 0.0

def _slope_last_k(arr: np.ndarray, k: int) -> float:
    """Basit lineer eğim (index'e göre)."""
    if len(arr) < k:
        return 0.0
    y = arr[-k:]
    x = np.arange(k, dtype=float)
    # slope = cov(x,y)/var(x)
    vx = x.var()
    if vx == 0:
        return 0.0
    return float(((x - x.mean()) * (y - y.mean())).mean() / vx)

def _tod_sin_cos(ts_iso: Optional[str]) -> Tuple[float, float]:
    """
    ISO timestamp varsa gün içi sin/cos üret.
    Yoksa 0/0 döner (fallback).
    """
    if not ts_iso:
        return 0.0, 0.0
    try:
        dt = datetime.fromisoformat(ts_iso.replace("Z", "+00:00"))
        seconds = dt.hour * 3600 + dt.minute * 60 + dt.second
        angle = 2.0 * math.pi * (seconds / 86400.0)
        return float(math.sin(angle)), float(math.cos(angle))
    except Exception:
        return 0.0, 0.0

def build_features(
    glucose_values: List[float],
    latest_ts: Optional[str] = None,
    meal_type: Optional[str] = None,
    hr: Optional[float] = None,
    mets: Optional[float] = None,
    steps: Optional[float] = None,
    calories_activity: Optional[float] = None,
    calories: Optional[float] = None,
    carbs: Optional[float] = None,
    protein: Optional[float] = None,
    fat: Optional[float] = None,
    fiber: Optional[float] = None,
    amount_consumed: Optional[float] = None,
) -> FeatureBuildResult:
    """
    Her zaman 28 kolonu döndürür.
    Eksik / bilinmeyenleri 0.0 (veya Meal Type için 'Unknown') yapar.
    """

    n = len(glucose_values)
    if n == 0:
        # boş gelmesin zaten endpoint kontrol ediyor ama yine de
        features = {c: 0.0 for c in EXPECTED_COLS}
        features["Meal Type"] = meal_type or "Unknown"
        used = [
            "gl_lag_1","gl_rm_5","gl_slope_5",
            "tod_sin","tod_cos",
            "Calories","Carbs","Steps","Meal Type"
        ]
        return FeatureBuildResult(mode="min", features=features, features_used_cols=used)

    arr = np.array(glucose_values, dtype=float)

    # mode kararı (senin prototip kararı)
    if n >= 30:
        mode = "full"
    elif n >= 10:
        mode = "fallback"
    else:
        mode = "min"

    # Default row
    features: Dict[str, object] = {c: 0.0 for c in EXPECTED_COLS}

    # LAG'ler (yoksa 0 kalır)
    def lag(i: int) -> float:
        return float(arr[-1 - i]) if n > i else 0.0

    features["gl_lag_1"]  = lag(1)
    features["gl_lag_2"]  = lag(2)
    features["gl_lag_3"]  = lag(3)
    features["gl_lag_5"]  = lag(5)
    features["gl_lag_10"] = lag(10)
    features["gl_lag_15"] = lag(15)
    features["gl_lag_30"] = lag(30)

    # Rolling mean/std (kadar varsa hesapla, yoksa 0 kalır)
    def tail(k: int) -> np.ndarray:
        return arr[-k:] if n >= k else np.array([], dtype=float)

    t5  = tail(5)
    t15 = tail(15)
    t30 = tail(30)

    features["gl_rm_5"]  = float(t5.mean())  if len(t5)  else 0.0
    features["gl_rs_5"]  = _safe_std(t5)
    features["gl_rm_15"] = float(t15.mean()) if len(t15) else 0.0
    features["gl_rs_15"] = _safe_std(t15)
    features["gl_rm_30"] = float(t30.mean()) if len(t30) else 0.0
    features["gl_rs_30"] = _safe_std(t30)

    # Slope (5 ve 15) - require at least 2 points
    features["gl_slope_5"]  = _slope_last_k(arr, 5)  if n >= 2 else 0.0
    features["gl_slope_15"] = _slope_last_k(arr, 15) if n >= 2 else 0.0

    # Time-of-day sin/cos
    tod_sin, tod_cos = _tod_sin_cos(latest_ts)
    features["tod_sin"] = tod_sin
    features["tod_cos"] = tod_cos

    # Dış kaynak feature’ları (yoksa 0)
    features["HR"] = float(hr) if hr is not None else 0.0
    features["METs"] = float(mets) if mets is not None else 0.0
    features["Steps"] = float(steps) if steps is not None else 0.0
    features["Calories (Activity)"] = float(calories_activity) if calories_activity is not None else 0.0

    # Makrolar (yoksa 0)
    features["Calories"] = float(calories) if calories is not None else 0.0
    features["Carbs"] = float(carbs) if carbs is not None else 0.0
    features["Protein"] = float(protein) if protein is not None else 0.0
    features["Fat"] = float(fat) if fat is not None else 0.0
    features["Fiber"] = float(fiber) if fiber is not None else 0.0
    features["Amount Consumed"] = float(amount_consumed) if amount_consumed is not None else 0.0

    # Categorical
    features["Meal Type"] = meal_type or "Unknown"

    # Determine which columns were effectively used depending on mode
    if mode == "full":
        used = EXPECTED_COLS.copy()
    elif mode == "fallback":
        used = [
            "gl_lag_1","gl_lag_2","gl_lag_3","gl_lag_5","gl_lag_10","gl_lag_15",
            "gl_slope_5","gl_slope_15",
            "gl_rm_5","gl_rs_5","gl_rm_15","gl_rs_15",
            "tod_sin","tod_cos",
            "HR","METs","Steps","Calories (Activity)",
            "Calories","Carbs","Protein","Fat","Fiber",
            "Amount Consumed","Meal Type"
        ]
    else:  # min
        used = [
            "gl_lag_1","gl_rm_5","gl_slope_5",
            "tod_sin","tod_cos",
            "Calories","Carbs","Steps","Meal Type"
        ]

    return FeatureBuildResult(mode=mode, features=features, features_used_cols=used)
