// Dia-Log/services/windowBuilder.ts
import type { TemplateRow } from "./template2day";
import type { MealEvent } from "./mealLogTypes";
import { mergeMealsAtMinute } from "./mealLogTypes";

export type GlucosePoint = { ts: string; value: number };

export function minuteOfDayNow(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// Local date + HH:MM -> ISO with explicit +03:00 offset (Turkey).
// Bu, "local clock" bilgisini bozmadan backend'e doğru şekilde taşır.
function isoLocalWithTROffset(base: Date, hh: number, mm: number): string {
  const y = base.getFullYear();
  const m = pad2(base.getMonth() + 1);
  const d = pad2(base.getDate());
  return `${y}-${m}-${d}T${pad2(hh)}:${pad2(mm)}:00+03:00`;
}

type MealPayload = {
  meal_type: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  amount_consumed: number;
};

export function build720WindowFrom2DayTemplate(
  rows: TemplateRow[],
  mealLog: MealEvent[],
  windowN = 720,
  // ✅ default: template meal'lerini asla kullanma (mealLog yoksa meal=0)
  useTemplateMeals = false
) {
  const minNow = minuteOfDayNow();

  // Anchor her zaman Day2 içinde
  const anchorIndex = 1440 + minNow; // 1440..2879
  const start = anchorIndex - (windowN - 1);
  const end = anchorIndex;

  const slice = rows.slice(start, end + 1);
  if (slice.length !== windowN) {
    throw new Error(`Window slice mismatch: got=${slice.length} expected=${windowN}`);
  }

  const today = new Date();
  const baseToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const baseYesterday = new Date(baseToday);
  baseYesterday.setDate(baseToday.getDate() - 1);

  const glucose: GlucosePoint[] = slice.map((r) => {
    const [hhS, mmS] = r.time.split(":");
    const hh = Number(hhS);
    const mm = Number(mmS);

    const base = r.minute_index < 1440 ? baseYesterday : baseToday;
    return { ts: isoLocalWithTROffset(base, hh, mm), value: r.glucose };
  });

  const anchorRow = rows[anchorIndex];

  const mergedNow = mergeMealsAtMinute(mealLog, minNow);

  const emptyMeal: MealPayload = {
    meal_type: "Unknown",
    calories: 0,
    carbs: 0,
    protein: 0,
    fat: 0,
    amount_consumed: 0,
  };

  const templateMeal: MealPayload = {
    meal_type: ((anchorRow["Meal Type"] ?? "Unknown") as string) || "Unknown",
    calories: anchorRow.Calories ?? 0,
    carbs: anchorRow.Carbs ?? 0,
    protein: anchorRow.Protein ?? 0,
    fat: anchorRow.Fat ?? 0,
    // ⚠️ 0 daha mantıklı (meal yoksa tüketim de yok)
    amount_consumed: (anchorRow["Amount Consumed"] ?? 0) as number,
  };

  const meal: MealPayload = mergedNow
    ? {
        meal_type: mergedNow.meal_type === "Snack" ? "Snacks" : mergedNow.meal_type,
        calories: mergedNow.calories,
        carbs: mergedNow.carbs,
        protein: mergedNow.protein,
        fat: mergedNow.fat,
        amount_consumed: mergedNow.amount_consumed,
      }
    : (useTemplateMeals ? templateMeal : emptyMeal);

  const activity = {
    hr: anchorRow.HR ?? undefined,
    mets: anchorRow.METs ?? undefined,
    calories_activity: anchorRow["Calories (Activity)"] ?? undefined,
  };

  return { glucose, meal, activity, anchor: { minute_of_day: minNow, anchorIndex } };
}

// Day2 (24h) -> ISO(+03:00) + glucose series
export function build24hSeriesFrom2DayTemplate(
  rows: TemplateRow[],
  downsampleEveryMin = 5
): GlucosePoint[] {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");

  const day2 = rows.filter(r => r.minute_index >= 1440 && r.minute_index < 2880);

  const series = day2.map(r => ({
    ts: `${y}-${m}-${d}T${r.time}:00+03:00`,
    value: r.glucose,
  }));

  // 5 dk gibi downsample (performans)
  return series.filter((_, i) => i % downsampleEveryMin === 0);
}

// Day2 (24h) Full - without downsampling, 1440 points
export function build24hSeriesFrom2DayTemplateFull(rows: TemplateRow[]): GlucosePoint[] {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");

  const day2 = rows.filter(r => r.minute_index >= 1440 && r.minute_index < 2880);

  return day2.map(r => ({
    ts: `${y}-${m}-${d}T${r.time}:00+03:00`,
    value: r.glucose,
  }));
}

// Downsample glucose series by taking every Nth point
export function downsampleEvery(series: GlucosePoint[], everyMin = 5): GlucosePoint[] {
  return series.filter((_, i) => i % everyMin === 0);
}
