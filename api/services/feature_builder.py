# api/services/feature_builder.py
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
import numpy as np
import pandas as pd
import math
from datetime import datetime

def parse_ts(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None

# Modelin beklediği 28 kolon (sıra önemli değil ama biz sabit tutuyoruz)
EXPECTED_COLS = [
    "gl_lag_1","gl_lag_2","gl_lag_3","gl_lag_5","gl_lag_10","gl_lag_15","gl_lag_30","gl_lag_60","gl_lag_90","gl_lag_120",
    "gl_ema_10","gl_ema_30","gl_ema_60",
    "gl_slope_10","gl_slope_30","gl_slope_60",
    "hour_sin","hour_cos",
    "HR","METs","Calories (Activity)",
    "Meal Type",
    "Calories","Carbs","Protein","Fat","Fiber","Amount Consumed",
]

@dataclass
class FeatureBuildResult:
    mode: str  # "full" | "fallback" | "min"
    features: Dict[str, object]  # float + Meal Type (str)
    features_used_cols: List[str]
    mode_reason: Optional[str] = None  # debug: why fallback?

def _ema_last(x: np.ndarray, w: int) -> float:
    """Calculate EMA for the last w values."""
    if len(x) < 2:
        return 0.0
    seg = x[max(0, len(x)-w):]
    alpha = 2.0 / (w + 1.0)
    v = float(seg[0])
    for a in seg[1:]:
        v = alpha * float(a) + (1 - alpha) * v
    return float(v)

def _slope_last(x: np.ndarray, w: int) -> float:
    """Calculate slope for the last w values."""
    seg = x[max(0, len(x)-w):]
    if len(seg) < 2:
        return 0.0
    t = np.arange(len(seg), dtype=float)
    return float(np.polyfit(t, seg.astype(float), 1)[0])

def _hour_sin_cos(minute_of_day: int) -> Tuple[float, float]:
    """Convert minute of day to sin/cos encoding."""
    ang = 2.0 * np.pi * (minute_of_day / 1440.0)
    return float(np.sin(ang)), float(np.cos(ang))

def build_features(
    glucose_values: List[float],
    latest_ts: Optional[str] = None,
    timestamps: Optional[List[str]] = None,
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
    
    # glucose_values -> np array
    g_raw = np.array(glucose_values, dtype=float)
    
    # NaN temizle
    if np.any(~np.isfinite(g_raw)):
        s = pd.Series(g_raw).interpolate(limit_direction="both").bfill().ffill()
        g_raw = s.to_numpy(dtype=float)
    
    # ✅ training ile aynı dağılım: median-center
    med = float(np.nanmedian(g_raw)) if len(g_raw) else 0.0
    g = g_raw - med
    
    # lags (yoksa 0)
    def lag(L: int) -> float:
        return float(g[-L]) if n > L else 0.0
    
    features = {
        "gl_lag_1": lag(1),
        "gl_lag_2": lag(2),
        "gl_lag_3": lag(3),
        "gl_lag_5": lag(5),
        "gl_lag_10": lag(10),
        "gl_lag_15": lag(15),
        "gl_lag_30": lag(30),
        "gl_lag_60": lag(60),
        "gl_lag_90": lag(90),
        "gl_lag_120": lag(120),
        "gl_ema_10": _ema_last(g, 10),
        "gl_ema_30": _ema_last(g, 30),
        "gl_ema_60": _ema_last(g, 60),
        "gl_slope_10": _slope_last(g, 10),
        "gl_slope_30": _slope_last(g, 30),
        "gl_slope_60": _slope_last(g, 60),
    }
    
    # minute_of_day: latest_ts varsa oradan, yoksa 0
    minute_of_day = 0
    if latest_ts:
        try:
            ts = pd.to_datetime(latest_ts)
            minute_of_day = int(ts.hour * 60 + ts.minute)
        except Exception:
            minute_of_day = 0
    
    hs, hc = _hour_sin_cos(minute_of_day)
    features["hour_sin"] = hs
    features["hour_cos"] = hc
    
    # activity + meal + macros (yoksa 0)
    features["HR"] = float(hr or 0.0)
    features["METs"] = float(mets or 0.0)
    features["Calories (Activity)"] = float(calories_activity or 0.0)
    features["Meal Type"] = meal_type or "Unknown"
    
    features["Calories"] = float(calories or 0.0)
    features["Carbs"] = float(carbs or 0.0)
    features["Protein"] = float(protein or 0.0)
    features["Fat"] = float(fat or 0.0)
    features["Fiber"] = float(fiber or 0.0)
    features["Amount Consumed"] = float(amount_consumed or 0.0)
    
    # ✅ en kritik satır: tüm kolonlar var mı garanti et
    for c in EXPECTED_COLS:
        if c not in features:
            features[c] = 0.0
    
    # Mode determination
    mode = "full"
    mode_reason = None
    
    return FeatureBuildResult(
        mode=mode,
        features=features,
        features_used_cols=EXPECTED_COLS.copy(),
        mode_reason=mode_reason
    )
