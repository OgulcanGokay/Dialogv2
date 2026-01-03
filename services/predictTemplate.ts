// Dia-Log/services/predictTemplate.ts
import type { TemplateRow } from "./template2day";
import type { MealEvent } from "./mealLogTypes";
import { build720WindowFrom2DayTemplate } from "./windowBuilder";

// ============================================
// Meal params type
// ============================================
export type MealParams = {
  meal_type: string;
  carbs: number;
  calories: number;
  protein: number;
  fat: number;
  fiber: number;
  amount_consumed: number;
};

// ============================================
// Meal mapping helpers
// ============================================
function toNum(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapMealRowToMealParams(row: any): MealParams {
  return {
    meal_type: String(row?.["Meal Type"] ?? "Unknown"),
    carbs: toNum(row?.["Carbs"]),
    calories: toNum(row?.["Calories"]),
    protein: toNum(row?.["Protein"]),
    fat: toNum(row?.["Fat"]),
    fiber: toNum(row?.["Fiber"]),
    amount_consumed: toNum(row?.["Amount Consumed"]),
  };
}

export async function predictFromTemplate({
  baseUrl,
  horizonMin,
  templateRows,
  mealLog,
  mealOverride,
}: {
  baseUrl: string;
  horizonMin: 30 | 60 | 120;
  templateRows: TemplateRow[];
  mealLog: MealEvent[];
  mealOverride?: MealParams;
}) {
  // Build glucose window from template
  const windowData = build720WindowFrom2DayTemplate(templateRows, mealLog, 720);
  const glucosePoints = windowData.glucose;

  // Calculate anchor from the actual glucose points being sent
  const anchorTs = glucosePoints[glucosePoints.length - 1]?.ts;
  const anchorDate = anchorTs ? new Date(anchorTs) : null;
  const minuteOfDay = anchorDate ? (anchorDate.getHours() * 60 + anchorDate.getMinutes()) : 0;

  // ✅ Meal selection: override takes precedence
  const mealDefault = {
    meal_type: "Unknown",
    carbs: 0,
    calories: 0,
    protein: 0,
    fat: 0,
    fiber: 0,
    amount_consumed: 0,
  };
  // 1) override varsa onu kullan
  // 2) yoksa windowData.meal varsa onu map'le (SPACED keys -> MealParams)
  // 3) yoksa default
  const mealData = mealOverride
    ?? (windowData.meal ? mapMealRowToMealParams(windowData.meal) : mealDefault);

  const activity = windowData.activity ?? {
    hr: 0, mets: 0, calories_activity: 0,
  };

  const body = {
    glucose: glucosePoints,
    meal_type: mealData.meal_type,
    calories: mealData.calories,
    carbs: mealData.carbs,
    protein: mealData.protein ?? 0,
    fat: mealData.fat ?? 0,
    fiber: mealData.fiber ?? 0,
    amount_consumed: mealData.amount_consumed,

    hr: activity.hr ?? 0,
    mets: activity.mets ?? 0,
    calories_activity: activity.calories_activity ?? 0,
    steps: 0,
  };

  const res = await fetch(`${baseUrl}/predict?horizon_min=${horizonMin}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Predict failed ${res.status}: ${t}`);
  }

  return res.json();
}
