export type GlucosePoint = { ts?: string; value: number };

export type PredictRequest = {
  user_id?: string;
  meal_type?: string;
  glucose: GlucosePoint[];

  hr?: number;
  mets?: number;
  steps?: number;
  calories_activity?: number;

  calories?: number;
  carbs?: number;
  protein?: number;
  fat?: number;
  fiber?: number;
  amount_consumed?: number;
};

export type PredictResponse = {
  horizon_min?: number;
  mode: string;
  mode_reason?: string | null;
  n: number;
  prediction: number;
  predicted_glucose: number;
  last_glucose: number;
  confidence: "low" | "medium" | "high";
  delta?: number;
  features_used?: Record<string, any>;
  features_used_cols?: string[] | null;
};

// API base is env-only to keep a single source of truth
const API_BASE = import.meta.env.VITE_API_BASE;
if (!API_BASE) throw new Error("VITE_API_BASE is not configured");

export async function predictGlucose(req: PredictRequest, horizonMin: number = 30): Promise<PredictResponse> {
  const r = await fetch(`${API_BASE}/predict?horizon_min=${horizonMin}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`/predict failed: ${r.status} ${t}`);
  }
  return r.json();
}

export async function predictMealResponse(req: any): Promise<any> {
  const r = await fetch(`${API_BASE}/predict_meal_response`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`/predict_meal_response failed: ${r.status} ${t}`);
  }
  return r.json();
}
