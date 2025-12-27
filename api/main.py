from __future__ import annotations

from typing import List, Optional
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.feature_builder import build_features
from services.model_service import load_model, predict_from_features
from services.meal_response_service import predict_meal_response

MODEL_PATH = "models/ridge_pipe_global_delta_scaled.joblib"
MEAL_MODEL_PATH = str(Path(__file__).resolve().parent / "models" / "meal_response_rf.joblib")


app = FastAPI(title="Dia-Log Glucose API", version="0.1.0")

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


# ---- Endpoint ----
@app.post("/predict")
def predict(req: PredictRequest):
    if not req.glucose:
        raise HTTPException(status_code=400, detail="glucose list is empty")

    points = [p for p in req.glucose if p.value is not None]
    if not points:
        raise HTTPException(status_code=400, detail="glucose points have no numeric values")

    min_aware = datetime.min.replace(tzinfo=timezone.utc)
    points.sort(key=lambda p: parse_ts(p.ts) or min_aware)

    values = [float(p.value) for p in points]
    latest_ts = points[-1].ts if points else None

    fb = build_features(
        glucose_values=values,
        latest_ts=latest_ts,
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

    try:
        model = load_model(MODEL_PATH)
        yhat = float(predict_from_features(model, fb.features))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

    last_val = float(values[-1])

    resp = {
        "mode": fb.mode,
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

