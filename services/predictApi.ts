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
  mode: string;
  n: number;
  prediction: number;
  predicted_glucose: number;
  last_glucose: number;
  confidence: "low" | "medium" | "high";
  delta?: number;
  features_used?: Record<string, any>;
  features_used_cols?: string[] | null;
};

// env varsa onu kullan; yoksa frontend hangi host’taysa onun 8000’i
const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || `http://${window.location.hostname}:8000`;

export async function predictGlucose(req: PredictRequest): Promise<PredictResponse> {
  const r = await fetch(`${API_BASE}/predict`, {
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
