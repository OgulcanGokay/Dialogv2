from __future__ import annotations

from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os, csv

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.feature_builder import build_features
from services.model_service import load_model, predict_from_features
from services.meal_response_service import predict_meal_response

MODEL_PATHS = {
    30: "models/ridge_pipe_global_delta_h30_scaled.joblib",
    60: "models/ridge_pipe_global_delta_h60_scaled.joblib",
    120: "models/ridge_pipe_global_delta_h120_scaled.joblib",
}
DEFAULT_HORIZON_MIN = 30
MEAL_MODEL_PATH = str(Path(__file__).resolve().parent / "models" / "meal_response_rf.joblib")


app = FastAPI(title="Dia-Log Glucose API", version="0.1.0")

# Dataset folder: env var -> fallback to api/data
DATA_DIR = Path(os.getenv("CGMACROS_DIR", str(Path(__file__).parent / "data"))).resolve()

# ---- CORS ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.0.16:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://192.168.0.16:5173",
    ],
    allow_origin_regex=r"^http://192\.168\.\d+\.\d+:(3000|5173)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ---- Request Models ----
class GlucosePoint(BaseModel):
    ts: Optional[str] = None
    value: float

class PredictRequest(BaseModel):
    user_id: Optional[str] = None
    glucose: List[GlucosePoint] = Field(default_factory=list)

    # optional extra features
    meal_type: Optional[str] = None
    hr: Optional[float] = None
    mets: Optional[float] = None
    steps: Optional[float] = None
    calories_activity: Optional[float] = None

    calories: Optional[float] = None
    carbs: Optional[float] = None
    protein: Optional[float] = None
    fat: Optional[float] = None
    fiber: Optional[float] = None
    amount_consumed: Optional[float] = None


class MealResponsePredictRequest(BaseModel):
    glucose_values: List[float]
    timestamps: Optional[List[str]] = None   # varsa daha iyi
    latest_ts: Optional[str] = None          # yoksa timestamps[-1] denenir

    carbs: Optional[float] = 0.0
    protein: Optional[float] = 0.0
    fat: Optional[float] = 0.0
    fiber: Optional[float] = 0.0
    calories: Optional[float] = 0.0
    amount_consumed: Optional[float] = 0.0
    meal_type: Optional[str] = "Unknown"


# ---- Helpers ----
def parse_ts(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None

def confidence_label(mode: Optional[str], n: int) -> str:
    m = (mode or "").lower()
    if ("fallback" in m) or n < 10:
        return "low"
    if n < 20:
        return "medium"
    return "high"


# ---- Demo helpers ----
def _parse_ts(s: str) -> datetime:
    # CGMacros format: "2020-05-01 10:30:00"
    dt = datetime.strptime(s.strip(), "%Y-%m-%d %H:%M:%S")
    return dt.replace(tzinfo=timezone.utc)


# ---- Demo endpoints ----
@app.get("/demo/users")
def demo_users():
    if not DATA_DIR.exists():
        raise HTTPException(status_code=500, detail=f"DATA_DIR not found: {DATA_DIR}")
    files = sorted(DATA_DIR.glob("CGMacros-*.csv"))
    return {"data_dir": str(DATA_DIR), "users": [f.stem.split("-")[1] for f in files]}


@app.get("/demo/glucose")
def demo_glucose(
    user: str = Query("001"),
    minutes: int = Query(240, ge=30, le=24*60),
    limit: int = Query(2000, ge=10, le=5000),
):
    path = DATA_DIR / f"CGMacros-{user}.csv"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"CSV not found: {path.name} in {DATA_DIR}")

    rows = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        # glucose column: Libre GL
        for r in reader:
            ts_raw = r.get("Timestamp")
            gl_raw = r.get("Libre GL")
            if not ts_raw or not gl_raw:
                continue
            try:
                ts = _parse_ts(ts_raw)
                val = float(gl_raw)
            except Exception:
                continue
            rows.append((ts, val))

    if not rows:
        return {"user": user, "minutes": minutes, "glucose": []}

    rows.sort(key=lambda x: x[0])
    last_ts = rows[-1][0]
    start_ts = last_ts - timedelta(minutes=minutes)

    window = [(ts, v) for (ts, v) in rows if ts >= start_ts]
    window = window[-limit:]

    return {
        "user": user,
        "minutes": minutes,
        "glucose": [{"ts": ts.isoformat().replace("+00:00", "Z"), "value": v} for ts, v in window],
    }


# ---- Endpoint ----
@app.post("/predict")
def predict(req: PredictRequest, horizon_min: int = Query(DEFAULT_HORIZON_MIN)):
    if not req.glucose:
        raise HTTPException(status_code=400, detail="glucose list is empty")

    points = [p for p in req.glucose if p.value is not None]
    if not points:
        raise HTTPException(status_code=400, detail="glucose points have no numeric values")

    min_aware = datetime.min.replace(tzinfo=timezone.utc)
    points.sort(key=lambda p: parse_ts(p.ts) or min_aware)
    
    # DEBUG: Check first/last points
    print("DBG /predict received points:", len(points))
    if len(points) >= 2:
        print("DBG first point ts:", points[0].ts, "value:", points[0].value)
        print("DBG last point ts:", points[-1].ts, "value:", points[-1].value)

    values = [float(p.value) for p in points]
    timestamps = [p.ts for p in points]
    latest_ts = points[-1].ts if points else None

    fb = build_features(
        glucose_values=values,
        latest_ts=latest_ts,
        timestamps=timestamps,  # pass timestamps for time-based features
        meal_type=req.meal_type,
        hr=req.hr,
        mets=req.mets,
        steps=req.steps,
        calories_activity=req.calories_activity,
        calories=req.calories,
        carbs=req.carbs,
        protein=req.protein,
        fat=req.fat,
        fiber=req.fiber,
        amount_consumed=req.amount_consumed,
    )

    if horizon_min not in MODEL_PATHS:
        raise HTTPException(status_code=400, detail="horizon_min must be one of 30, 60, 120")

    try:
        model = load_model(MODEL_PATHS[horizon_min])
        yhat = float(predict_from_features(model, fb.features))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

    last_val = float(values[-1])

    resp = {
        "horizon_min": horizon_min,
        "mode": fb.mode,
        "mode_reason": fb.mode_reason,
        "n": len(values),
        "prediction": yhat,
        "last_glucose": last_val,
        "confidence": confidence_label(fb.mode, len(values)),
        "features_used": fb.features,
        "features_used_cols": getattr(fb, "features_used_cols", None),
    }

    # This model predicts DELTA (Δ) by design
    resp["delta"] = yhat
    resp["predicted_glucose"] = float(last_val + yhat)
    resp["model_output"] = "delta"  # explicit model output type

    return resp


@app.post("/predict_meal_response")
def predict_meal_response_endpoint(req: MealResponsePredictRequest):
    out = predict_meal_response(req.model_dump(), model_path=MEAL_MODEL_PATH)
    return out

