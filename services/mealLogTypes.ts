// Dia-Log/services/mealLogTypes.ts
export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Mixed";

export type MealEvent = {
  id: string;
  minute_of_day: number; // 0..1439 (Day2 üzerinde uygulanacak)
  meal_type: MealType;

  calories: number;
  carbs: number;
  protein: number;
  fat: number;

  amount_consumed: number; // 0..1
  source: "photo" | "manual";
  image_path?: string | null;
};

// Aynı dakikaya çakışan meal'leri SUM + Mixed
export function mergeMealsAtMinute(meals: MealEvent[], minute: number): MealEvent | null {
  const at = meals.filter(m => m.minute_of_day === minute);
  if (at.length === 0) return null;
  if (at.length === 1) return at[0];

  const sum = (k: keyof MealEvent) =>
    at.reduce((acc, m) => acc + (typeof m[k] === "number" ? (m[k] as number) : 0), 0);

  return {
    id: `merged-${minute}`,
    minute_of_day: minute,
    meal_type: "Mixed",
    calories: sum("calories"),
    carbs: sum("carbs"),
    protein: sum("protein"),
    fat: sum("fat"),
    amount_consumed: Math.min(1, sum("amount_consumed")),
    source: "manual",
    image_path: null,
  };
}
