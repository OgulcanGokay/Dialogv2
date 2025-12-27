from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import math

import numpy as np
import pandas as pd
import joblib


_MEAL_OBJ = None


def _base_dir() -> Path:
    # api/ klasörü
    return Path(__file__).resolve().parents[1]


def load_meal_model(model_path: Optional[str] = None):
    global _MEAL_OBJ
    if _MEAL_OBJ is not None:
        return _MEAL_OBJ

    if model_path is None:
        model_path = str(_base_dir() / "models" / "meal_response_rf.joblib")

    _MEAL_OBJ = joblib.load(model_path)
    return _MEAL_OBJ


def _tod_sin_cos(ts: pd.Timestamp) -> Tuple[float, float]:
    minutes = ts.hour * 60 + ts.minute
    angle = 2 * math.pi * (minutes / (24 * 60))
    return float(math.sin(angle)), float(math.cos(angle))


def _baseline_and_slope(
    glucose_values: List[float],
    timestamps: Optional[List[str]] = None,
    baseline_minutes: int = 15,
) -> Tuple[float, float]:
    """
    Baseline: pre-meal son 15 dk ortalama
    Slope: pre-meal son 15 dk lineer eğim (mg/dL per min)
    timestamps yoksa 5 dk sampling varsayımıyla yaklaşık hesaplar.
    """
    g = pd.to_numeric(pd.Series(glucose_values), errors="coerce").dropna().to_numpy()
    if len(g) == 0:
        return 0.0, 0.0

    # timestamps varsa son 15 dk'yı gerçekten seç
    if timestamps:
        ts = pd.to_datetime(pd.Series(timestamps), errors="coerce")
        ok = ts.notna()
        ts = ts[ok].reset_index(drop=True)
        g2 = pd.Series(glucose_values)[ok].astype(float).to_numpy()
        if len(ts) >= 3:
            t_last = ts.iloc[-1]
            w_mask = (ts >= (t_last - pd.Timedelta(minutes=baseline_minutes))) & (ts < t_last)
            w_idx = np.where(w_mask.to_numpy())[0]
            if len(w_idx) >= 3:
                gw = g2[w_idx]
                # baseline
                base = float(np.mean(gw))
                # slope
                tmin = (ts.iloc[w_idx] - ts.iloc[w_idx[0]]).dt.total_seconds().to_numpy() / 60.0
                slope = float(np.polyfit(tmin, gw, 1)[0])
                return base, slope

    # timestamps yok: 5 dk aralık varsay (15 dk ~ son 4 nokta)
    k = min(len(g), 4)
    gw = g[-k:]
    base = float(np.mean(gw))

    # slope için t = [0,5,10,15] veya k'ya göre
    tmin = np.arange(k) * 5.0
    if k >= 3:
        slope = float(np.polyfit(tmin, gw, 1)[0])  # mg/dL per min
    else:
        slope = 0.0
    return base, slope


def predict_meal_response(
    payload: Dict[str, Any],
    model_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    payload beklenen alanlar:
      - glucose_values: List[float]  (pre-meal history için)
      - timestamps: Optional[List[str]] (varsa daha iyi)
      - latest_ts: Optional[str] (yoksa timestamps[-1] kullanılmaya çalışılır)
      - carbs/protein/fat/fiber/calories/amount_consumed/meal_type
    """
    obj = load_meal_model(model_path)
    pipe = obj["pipeline"]

    glucose_values = payload.get("glucose_values") or []
    timestamps = payload.get("timestamps")  # optional

    base, slope = _baseline_and_slope(glucose_values, timestamps=timestamps, baseline_minutes=15)

    # zaman
    latest_ts = payload.get("latest_ts")
    if latest_ts:
        t0 = pd.to_datetime(latest_ts, errors="coerce")
    elif timestamps:
        t0 = pd.to_datetime(timestamps[-1], errors="coerce")
    else:
        t0 = pd.Timestamp.now()

    if pd.isna(t0):
        t0 = pd.Timestamp.now()

    tod_sin, tod_cos = _tod_sin_cos(t0)

    feats = {
        "carbs": float(payload.get("carbs", 0.0) or 0.0),
        "protein": float(payload.get("protein", 0.0) or 0.0),
        "fat": float(payload.get("fat", 0.0) or 0.0),
        "fiber": float(payload.get("fiber", 0.0) or 0.0),
        "calories": float(payload.get("calories", 0.0) or 0.0),
        "amount_consumed": float(payload.get("amount_consumed", 0.0) or 0.0),
        "meal_type": str(payload.get("meal_type", "Unknown") or "Unknown"),
        "baseline_glucose": float(base),
        "premeal_slope": float(slope),
        "tod_sin": float(tod_sin),
        "tod_cos": float(tod_cos),
    }

    X = pd.DataFrame([feats])
    pred = pipe.predict(X)[0]  # [d_peak, t_peak, auc_0_120, decay_slope]

    d_peak = float(pred[0])
    t_peak = float(pred[1])
    auc = float(pred[2])
    decay = float(pred[3])

    # basit confidence: veri azsa düşük
    n = len(glucose_values)
    confidence = "high" if n >= 12 else ("medium" if n >= 6 else "low")

    return {
        "mode": "meal_response",
        "baseline_glucose": float(base),
        "premeal_slope": float(slope),
        "d_peak": d_peak,
        "t_peak": t_peak,
        "auc_0_120": auc,
        "decay_slope": decay,
        "predicted_peak_glucose": float(base + max(d_peak, 0.0)),
        "confidence": confidence,
    }
