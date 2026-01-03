// Dia-Log/services/template2day.ts
export type TemplateRow = {
  day: 1 | 2;
  time: string;              // "HH:MM"
  minute_index: number;      // 0..2879
  minute_of_day: number;     // 0..1439
  glucose: number;

  // opsiyonel kolonlar (varsa)
  HR?: number | null;
  METs?: number | null;
  "Calories (Activity)"?: number | null;

  "Meal Type"?: string | null;
  Calories?: number | null;
  Carbs?: number | null;
  Protein?: number | null;
  Fat?: number | null;
  "Amount Consumed"?: number | null;
  "Image path"?: string | null;
};

function toNum(x: string): number | null {
  const v = (x ?? "").trim();
  if (!v || v.toLowerCase() === "nan") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toStr(x: string): string | null {
  const v = (x ?? "").trim();
  if (!v || v.toLowerCase() === "nan") return null;
  return v;
}

// Bu dataset virgül içinde quote vs. kullanmıyor diye varsayıyoruz (sende öyle)
function parseCsv(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  return lines.map(l => l.split(","));
}

export async function loadTemplate2Day(): Promise<TemplateRow[]> {
  // services/ dosyasından src/assets'e gidiyoruz:
  const url = new URL("../src/assets/template_2day.csv", import.meta.url).toString();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Template fetch failed: ${res.status}`);

  const text = await res.text();
  const rows = parseCsv(text);
  const header = rows[0].map(h => h.trim());
  const body = rows.slice(1);

  const idx = (name: string) => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`Missing column: ${name}`);
    return i;
  };

  const iDay = idx("day");
  const iTime = idx("time");
  const iMinIdx = idx("minute_index");
  const iMinOfDay = idx("minute_of_day");
  const iGl = idx("glucose");

  const getIndex = (name: string) => header.indexOf(name);

  const iHR = getIndex("HR");
  const iMETs = getIndex("METs");
  const iCalAct = getIndex("Calories (Activity)");

  const iMealType = getIndex("Meal Type");
  const iCalories = getIndex("Calories");
  const iCarbs = getIndex("Carbs");
  const iProtein = getIndex("Protein");
  const iFat = getIndex("Fat");
  const iAmt = getIndex("Amount Consumed");
  const iImg = getIndex("Image path");

  const out: TemplateRow[] = body.map(r => ({
    day: Number(r[iDay]) as 1 | 2,
    time: r[iTime],
    minute_index: Number(r[iMinIdx]),
    minute_of_day: Number(r[iMinOfDay]),
    glucose: Number(r[iGl]),

    HR: iHR >= 0 ? toNum(r[iHR]) : null,
    METs: iMETs >= 0 ? toNum(r[iMETs]) : null,
    "Calories (Activity)": iCalAct >= 0 ? toNum(r[iCalAct]) : null,

    "Meal Type": iMealType >= 0 ? toStr(r[iMealType]) : null,
    Calories: iCalories >= 0 ? toNum(r[iCalories]) : null,
    Carbs: iCarbs >= 0 ? toNum(r[iCarbs]) : null,
    Protein: iProtein >= 0 ? toNum(r[iProtein]) : null,
    Fat: iFat >= 0 ? toNum(r[iFat]) : null,
    "Amount Consumed": iAmt >= 0 ? toNum(r[iAmt]) : null,
    "Image path": iImg >= 0 ? toStr(r[iImg]) : null,
  }));

  out.sort((a, b) => a.minute_index - b.minute_index);
  return out;
}
