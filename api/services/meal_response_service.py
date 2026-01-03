from __future__ import annotations

from typing import Any
from pathlib import Path
import numpy as np
import joblib
import pandas as pd


# api klasöründen çalışınca "models/..." doğru resolve olur
MODEL_PATH = Path("models/meal_response_rf.joblib")

_MODEL = None


def _load():
    global _MODEL
    if _MODEL is None:
        obj = joblib.load(MODEL_PATH)
        # bizim script {"pipeline": pipe, "calib": ...} kaydetti
        _MODEL = obj["pipeline"] if isinstance(obj, dict) and "pipeline" in obj else obj
    return _MODEL


def _safe_float(x: Any, default: float = 0.0) -> float:
    try:
        if x is None:
            return default
        return float(x)
    except Exception:
        return default


def _tod_feats(ts_iso: str | None) -> tuple[float, float]:
    """
    Timestamp varsa time-of-day sin/cos üret.
    Yoksa 0 döner (Unknown).
    """
    if not ts_iso:
        return 0.0, 0.0
    try:
        # ISO parse: "2025-12-28T00:22:..." gibi
        import datetime as dt
        t = dt.datetime.fromisoformat(ts_iso.replace("Z", "+00:00"))
        minutes = t.hour * 60 + t.minute
        angle = 2.0 * np.pi * (minutes / (24.0 * 60.0))
        return float(np.sin(angle)), float(np.cos(angle))
    except Exception:
        return 0.0, 0.0


def _build_curve(delta_peak: float, t_peak_min: float, decay_slope: float, max_min: int = 120, step: int = 5):
    """
    Basit ama stabil bir curve generator:
    - 0..t_peak: yükseliş
    - t_peak..t_peak+15: plato
    - sonrası: decay (exp)
    decay_slope'ı doğrudan exp katsayısına çevirmek yerine clampleyip kullanıyoruz.
    """
    t_peak = float(np.clip(t_peak_min, 20.0, 200.0))
    t_tail = t_peak + 15.0

    # decay_slope ölçeği belirsiz olabildiği için güvenli clamp
    k = float(np.clip(abs(decay_slope), 0.05, 1.5))

    curve = []
    for t in range(0, max_min + 1, step):
        tf = float(t)
        if tf <= t_peak:
            x = tf / max(1e-6, t_peak)
            delta = delta_peak * (x ** 1.6)
        elif tf <= t_tail:
            delta = delta_peak
        else:
            # peak'ten sonra sıfıra doğru sön (daha sonra settle ekleyebiliriz)
            delta = delta_peak * np.exp(-k * (tf - t_tail) / 60.0)
        curve.append({"t_min": int(t), "delta": float(delta)})
    return curve


def predict_meal_response(req: dict[str, Any]) -> dict[str, Any]:
    """
    Input: frontend PredictRequest benzeri
    Çıkış: curve + metrics
    """
    model = _load()

    glucose = req.get("glucose") or []
    if not glucose:
        raise ValueError("glucose[] is required")

    # last glucose + timestamp
    last = glucose[-1]
    last_val = float(last.get("value"))
    last_ts = last.get("ts")

    # dataset feature setine uygun alanlar
    meal_type = req.get("meal_type") or "Unknown"
    tod_sin, tod_cos = _tod_feats(last_ts)

    X = [{
        "carbs": _safe_float(req.get("carbs")),
        "protein": _safe_float(req.get("protein")),
        "fat": _safe_float(req.get("fat")),
        "fiber": _safe_float(req.get("fiber")),
        "calories": _safe_float(req.get("calories")),
        "amount_consumed": _safe_float(req.get("amount_consumed")),
        "baseline_glucose": last_val,
        "premeal_slope": 0.0,  # şimdilik 0; istersen backend'de hesaplarız
        "tod_sin": tod_sin,
        "tod_cos": tod_cos,
        "meal_type": meal_type,
    }]

    y = model.predict(pd.DataFrame(X))  # pipeline DataFrame bekliyor
    # çıktı sırası train scriptte: d_peak, t_peak, auc_0_120, decay_slope
    d_peak, t_peak, auc_0_120, decay_slope = [float(v) for v in y[0]]

    curve = _build_curve(d_peak, t_peak, decay_slope, max_min=120, step=5)
    curve_glucose = [{"t_min": p["t_min"], "delta": p["delta"], "glucose": float(last_val + p["delta"])} for p in curve]

    metrics = {
        "delta_peak": d_peak,
        "t_peak_min": t_peak,
        "auc_0_120": auc_0_120,
        "decay_slope": decay_slope,
        "predicted_peak_glucose": float(last_val + d_peak),
    }

    return {
        "mode": "meal_response",
        "baseline_glucose": float(last_val),
        "premeal_slope": 0.0,
        "d_peak": float(d_peak),
        "t_peak": float(t_peak),
        "auc_0_120": float(auc_0_120),
        "decay_slope": float(decay_slope),
        "predicted_peak_glucose": float(last_val + d_peak),
        "confidence": "low",
        "curve": curve_glucose,
        "metrics": metrics,
    }
