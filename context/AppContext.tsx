// ============================================
// Dia-Log: Application Context
// Centralized state management for all health data
// ============================================

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import Papa from "papaparse";
import {
    UserProfile,
    MealEntry,
    GlucoseEntry,
    GlucoseTrend,
    ActivityEntry,
    MoodEntry,
    SleepEntry,
    DailyLog,
    MealAnalysis,
    MealFilter,
    MealType
} from '../types';
import * as dataService from '../services/dataService';
import { predictGlucose, predictMealResponse } from '../services/predictApi';
import { loadTemplate2Day } from '../services/template2day';
import { build24hSeriesFrom2DayTemplate, build24hSeriesFrom2DayTemplateFull } from '../services/windowBuilder';
import type { TemplateRow } from '../services/template2day';
import type { MealEvent } from '../services/mealLogTypes';
import { predictFromTemplate } from '../services/predictTemplate';

const API_BASE = import.meta.env.VITE_API_BASE;
if (!API_BASE) {
    throw new Error("VITE_API_BASE is not configured");
}

// ============================================
// Expected Feature Columns (matches backend's 28 columns)
// ============================================
const EXPECTED_COLS = [
    "gl_lag_1","gl_lag_2","gl_lag_3","gl_lag_5","gl_lag_10","gl_lag_15","gl_lag_30",
    "gl_slope_5","gl_slope_15",
    "gl_rm_5","gl_rs_5","gl_rm_15","gl_rs_15","gl_rm_30","gl_rs_30",
    "tod_sin","tod_cos",
    "HR","METs","Calories (Activity)",
    "Calories","Carbs","Protein","Fat","Fiber","Amount Consumed","Meal Type","Steps"
];

function validateCols(gotCols: string[], tag: string) {
    const expectedSet = new Set(EXPECTED_COLS);
    const gotSet = new Set(gotCols);

    const missing = EXPECTED_COLS.filter(c => !gotSet.has(c));
    const extra = gotCols.filter(c => !expectedSet.has(c));

    if (missing.length || extra.length) {
        console.warn(`${tag} ⚠️ COLS MISMATCH`, { missing, extra });
    } else {
        console.log(`${tag} ✅ COLS OK`);
    }
}

// ============================================
// Context Types
// ============================================

type DemoPoint = { ts: string; value: number };

interface AppContextType {
    // State
    user: UserProfile;
    meals: MealEntry[];
    glucose: GlucoseEntry[];
    activities: ActivityEntry[];
    moods: MoodEntry[];
    sleep: SleepEntry[];
    isLoading: boolean;
    apiKey: string;
    templateRows: TemplateRow[];
    mealLog: MealEvent[];

    // User Actions
    updateUser: (updates: Partial<UserProfile>) => void;
    setApiKey: (key: string) => void;

    // Meal Actions
    addMeal: (meal: Omit<MealEntry, 'id'>) => MealEntry;
    logMealFromAnalysis: (analysis: MealAnalysis, imageBase64?: string, notes?: string, mealType?: MealType) => MealEntry;
    deleteMeal: (id: string) => void;
    getFilteredMeals: (filter: MealFilter) => MealEntry[];

    // Glucose Actions
    addGlucoseReading: (reading: Omit<GlucoseEntry, 'id'>) => GlucoseEntry;
    deleteGlucoseReading: (id: string) => void;

    // Activity Actions
    addActivity: (activity: Omit<ActivityEntry, 'id'>) => ActivityEntry;
    deleteActivity: (id: string) => void;

    // Mood Actions
    addMood: (mood: Omit<MoodEntry, 'id'>) => MoodEntry;
    deleteMood: (id: string) => void;

    // Sleep Actions
    addSleep: (sleep: Omit<SleepEntry, 'id'>) => SleepEntry;
    deleteSleep: (id: string) => void;

    // Utilities
    getTodaysMeals: () => MealEntry[];
    getTodaysGlucose: () => GlucoseEntry[];
    getRecentGlucosePoints: (count?: number) => { ts?: string; value: number }[];
    getRecentLogs: (limit?: number) => DailyLog[];
    getCurrentGlucose: () => GlucoseEntry | null;
    getDailyStats: () => {
        averageGlucose: number;
        timeInRange: number;
        highReadings: number;
        lowReadings: number;
        totalCarbs: number;
        mealsLogged: number;
    };

    // Prediction state/actions
    predictionResult: null | Array<{
        horizon_min: number;
        mode: "full" | "fallback" | "min";
        delta: number;  // Legacy: delta_meal for backward compat
        predicted: number;  // Legacy: predicted_total for backward compat
        last: number;
        n: number;
        confidence?: "low" | "medium" | "high";
        // ✅ NEW: Meal effect decomposition
        delta_total: number;
        delta_base: number;
        delta_meal: number;
        predicted_total: number;
        predicted_base: number;
        predicted_meal: number;
    }>;
    predictionLoading: boolean;
    predictionError: string | null;
    runPrediction: () => Promise<void>;

    mealResponseResult: null | {
        mode: "meal_response";
        baseline_glucose: number;
        premeal_slope: number;
        d_peak: number;
        t_peak: number;
        auc_0_120: number;
        decay_slope: number;
        predicted_peak_glucose: number;
        confidence?: "low" | "medium" | "high";
    };
    mealResponseLoading: boolean;
    mealResponseError: string | null;
    runMealResponsePrediction: () => Promise<void>;

    // Data Management
    refreshData: () => void;
    exportData: () => string;
    importData: (json: string) => boolean;
    clearAllData: () => void;
}

// ============================================
// Context Creation
// ============================================

const AppContext = createContext<AppContextType | undefined>(undefined);

// ============================================
// Provider Component
// ============================================

interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    const [user, setUser] = useState<UserProfile>(dataService.loadUser());
    const [meals, setMeals] = useState<MealEntry[]>([]);
    const [glucose, setGlucose] = useState<GlucoseEntry[]>([]);
    const [activities, setActivities] = useState<ActivityEntry[]>([]);
    const [moods, setMoods] = useState<MoodEntry[]>([]);
    const [sleep, setSleep] = useState<SleepEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [apiKey, setApiKeyState] = useState<string>(
        localStorage.getItem('gemini_api_key') || ''
    );
    const [templateRows, setTemplateRows] = useState<TemplateRow[]>([]);
    const [mealLog, setMealLog] = useState<MealEvent[]>([]);

    // Prediction UI state
    const [predictionResult, setPredictionResult] = useState<null | Array<{
        horizon_min: number;
        mode: "full" | "fallback" | "min";
        delta: number;
        predicted: number;
        last: number;
        n: number;
        confidence?: "low" | "medium" | "high";
    }>>(null);
    const [predictionLoading, setPredictionLoading] = useState<boolean>(false);
    const [predictionError, setPredictionError] = useState<string | null>(null);

    const [mealResponseResult, setMealResponseResult] = useState<null | {
        mode: "meal_response";
        baseline_glucose: number;
        premeal_slope: number;
        d_peak: number;
        t_peak: number;
        auc_0_120: number;
        decay_slope: number;
        predicted_peak_glucose: number;
        confidence?: "low" | "medium" | "high";
    }>(null);

    const [mealResponseLoading, setMealResponseLoading] = useState<boolean>(false);
    const [mealResponseError, setMealResponseError] = useState<string | null>(null);

    // Utility functions
    function minuteOfDayNow(): number {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    }


    // ============================================
    // Initial Data Load
    // ============================================

    useEffect(() => {
        const loadData = () => {
            setIsLoading(true);
            try {
                // Load all data
                const data = dataService.loadAllData();
                console.log("[CTX] source=manual", "len=", data.glucose.length, "sample=", data.glucose[0]);
                setUser(data.user);
                setMeals(data.meals);
                setGlucose(data.glucose);
                setActivities(data.activities);
                setMoods(data.moods);
                setSleep(data.sleep);
            } catch (error) {
                console.error('Failed to load data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, []);

    // Load template on startup
    useEffect(() => {
        loadTemplate2Day().then(setTemplateRows).catch(console.error);
    }, []);

    // Generate glucose from templateRows (Full Day2 - 1440 points, no downsampling)
    useEffect(() => {
        if (!templateRows || templateRows.length === 0) return;

        const full = build24hSeriesFrom2DayTemplateFull(templateRows);
        const entries: GlucoseEntry[] = full.map((p: any, i: number) => ({
            id: `tmpl-day2-${i}`,
            timestamp: p.ts,
            value: p.value,
            source: "simulated",
            trend: "stable" as GlucoseTrend,
        }));
        
        setGlucose(entries);

        const minNow = minuteOfDayNow();
        console.log("[DBG] minNow=", minNow);
        console.log("[DBG] should match predict last:", full[minNow]?.ts, full[minNow]?.value);
        console.log("[CTX] source=template full", "len=", entries.length, "sample=", entries[0]);

        // ============================================
        // 30-second validation: Detect worst 1-min drop
        // ============================================
        const sorted = [...entries].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const values = sorted.map(x => x.value);
        const minV = Math.min(...values);
        const maxV = Math.max(...values);
        let worstDrop = { drop: 0, at: 0 };

        for (let i = 1; i < values.length; i++) {
            const drop = values[i - 1] - values[i];
            if (drop > worstDrop.drop) worstDrop = { drop, at: i };
        }

        console.log("[DAY2] min/max:", minV, maxV);
        console.log("[DAY2] worst 1-min drop:", worstDrop.drop,
            "from", sorted[worstDrop.at - 1].timestamp, values[worstDrop.at - 1],
            "to", sorted[worstDrop.at].timestamp, values[worstDrop.at]
        );

        if (worstDrop.drop > 50) {
            console.warn("[DAY2-WARNING] Large drop detected (>50 mg/dL in 1 min) - likely sensor artifact");
        } else if (worstDrop.drop > 20) {
            console.info("[DAY2-INFO] Moderate drop detected (" + worstDrop.drop + " mg/dL in 1 min)");
        }
        // ============================================
    }, [templateRows]);

    // ============================================
    // User Actions
    // ============================================

    const updateUser = useCallback((updates: Partial<UserProfile>) => {
        const updated = dataService.updateUser(updates);
        setUser(updated);
    }, []);

    const setApiKey = useCallback((key: string) => {
        localStorage.setItem('gemini_api_key', key);
        setApiKeyState(key);
    }, []);

    // ============================================
    // Meal Actions
    // ============================================

    const addMeal = useCallback((meal: Omit<MealEntry, 'id'>): MealEntry => {
        const newMeal = dataService.addMeal(meal);
        setMeals(prev => [newMeal, ...prev]);
        return newMeal;
    }, []);

    const logMealFromAnalysis = useCallback((
        analysis: MealAnalysis,
        imageBase64?: string,
        notes?: string,
        mealType?: MealType
    ): MealEntry => {
        const meal: Omit<MealEntry, 'id'> = {
            timestamp: dataService.getCurrentTimestamp(),
            analysis,
            imageBase64,
            notes,
            mealType
        };
        return addMeal(meal);
    }, [addMeal]);

    const deleteMeal = useCallback((id: string) => {
        if (dataService.deleteMeal(id)) {
            setMeals(prev => prev.filter(m => m.id !== id));
        }
    }, []);

    const getFilteredMeals = useCallback((filter: MealFilter): MealEntry[] => {
        return meals.filter(meal => {
            if (filter.mealType && meal.mealType !== filter.mealType) return false;
            if (filter.glycemicIndex && meal.analysis.glycemicIndex !== filter.glycemicIndex) return false;
            if (filter.searchTerm && !meal.analysis.foodName.toLowerCase().includes(filter.searchTerm.toLowerCase())) return false;
            if (filter.dateRange) {
                const mealDate = new Date(meal.timestamp);
                if (mealDate < filter.dateRange.start || mealDate > filter.dateRange.end) return false;
            }
            return true;
        });
    }, [meals]);

    // ============================================
    // Glucose Actions
    // ============================================

    const addGlucoseReading = useCallback((reading: Omit<GlucoseEntry, 'id'>): GlucoseEntry => {
        const newReading = dataService.addGlucoseReading(reading);
        setGlucose(prev => [newReading, ...prev]);
        return newReading;
    }, []);

    const deleteGlucoseReading = useCallback((id: string) => {
        if (dataService.deleteGlucoseReading(id)) {
            setGlucose(prev => prev.filter(g => g.id !== id));
        }
    }, []);

    // ============================================
    // Activity Actions
    // ============================================

    const addActivity = useCallback((activity: Omit<ActivityEntry, 'id'>): ActivityEntry => {
        const newActivity = dataService.addActivity(activity);
        setActivities(prev => [newActivity, ...prev]);
        return newActivity;
    }, []);

    const deleteActivity = useCallback((id: string) => {
        if (dataService.deleteActivity(id)) {
            setActivities(prev => prev.filter(a => a.id !== id));
        }
    }, []);

    // ============================================
    // Mood Actions
    // ============================================

    const addMood = useCallback((mood: Omit<MoodEntry, 'id'>): MoodEntry => {
        const newMood = dataService.addMood(mood);
        setMoods(prev => [newMood, ...prev]);
        return newMood;
    }, []);

    const deleteMood = useCallback((id: string) => {
        if (dataService.deleteMood(id)) {
            setMoods(prev => prev.filter(m => m.id !== id));
        }
    }, []);

    // ============================================
    // Sleep Actions
    // ============================================

    const addSleep = useCallback((sleepEntry: Omit<SleepEntry, 'id'>): SleepEntry => {
        const newSleep = dataService.addSleep(sleepEntry);
        setSleep(prev => [newSleep, ...prev]);
        return newSleep;
    }, []);

    const deleteSleep = useCallback((id: string) => {
        if (dataService.deleteSleep(id)) {
            setSleep(prev => prev.filter(s => s.id !== id));
        }
    }, []);

    // ============================================
    // Utility Functions
    // ============================================

    const getTodaysMeals = useCallback((): MealEntry[] => {
        return meals.filter(m => dataService.isToday(m.timestamp));
    }, [meals]);

    const getTodaysGlucose = useCallback((): GlucoseEntry[] => {
        return glucose.filter(g => dataService.isToday(g.timestamp));
    }, [glucose]);

    // newest-first glucose[] -> last N points as {ts,value} oldest->newest
    const getRecentGlucosePoints = useCallback((count: number = 30) => {
        return glucose
            .filter(g => typeof g.value === "number" && !Number.isNaN(g.value))
            .slice(0, count)            // newest-first
            .reverse()                  // oldest -> newest
            .map(g => ({
                ts: (g as any).timestamp ?? (g as any).ts,
                value: Number(g.value),
            }));
    }, [glucose]);

    const getCurrentGlucose = useCallback((): GlucoseEntry | null => {
        return glucose.length > 0 ? glucose[0] : null;
    }, [glucose]);

    const getRecentLogs = useCallback((limit: number = 10): DailyLog[] => {
        const allLogs: DailyLog[] = [];

        // Add meals
        meals.slice(0, limit).forEach(meal => {
            allLogs.push({
                id: meal.id,
                type: 'meal',
                timestamp: meal.timestamp,
                details: `${meal.analysis.foodName} - ${meal.analysis.estimatedCarbs}g carbs`,
                data: meal
            });
        });

        // Add activities
        activities.slice(0, limit).forEach(activity => {
            allLogs.push({
                id: activity.id,
                type: 'activity',
                timestamp: activity.timestamp,
                details: `${activity.type} - ${activity.duration} min (${activity.intensity})`,
                data: activity
            });
        });

        // Add moods
        moods.slice(0, limit).forEach(mood => {
            allLogs.push({
                id: mood.id,
                type: 'mood',
                timestamp: mood.timestamp,
                details: `Mood: ${mood.level}/10, Stress: ${mood.stressLevel}/10`,
                data: mood
            });
        });

        // Add sleep
        sleep.slice(0, limit).forEach(sleepEntry => {
            allLogs.push({
                id: sleepEntry.id,
                type: 'sleep',
                timestamp: sleepEntry.timestamp,
                details: `${sleepEntry.duration}h sleep (${sleepEntry.quality})`,
                data: sleepEntry
            });
        });

        // Sort by timestamp (most recent first) and limit
        return allLogs
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    }, [meals, activities, moods, sleep]);

    const getDailyStats = useCallback(() => {
        const todaysGlucose = getTodaysGlucose();
        const todaysMeals = getTodaysMeals();

        const glucoseValues = todaysGlucose.map(g => g.value);
        const averageGlucose = glucoseValues.length > 0
            ? Math.round(glucoseValues.reduce((a, b) => a + b, 0) / glucoseValues.length)
            : 0;

        const inRangeCount = glucoseValues.filter(
            v => v >= user.targetRange.min && v <= user.targetRange.max
        ).length;

        const timeInRange = glucoseValues.length > 0
            ? Math.round((inRangeCount / glucoseValues.length) * 100)
            : 0;

        const totalCarbs = todaysMeals.reduce(
            (sum, meal) => sum + (meal.analysis?.estimatedCarbs || 0),
            0
        );

        return {
            averageGlucose,
            timeInRange,
            highReadings: glucoseValues.filter(v => v > user.targetRange.max).length,
            lowReadings: glucoseValues.filter(v => v < user.targetRange.min).length,
            totalCarbs,
            mealsLogged: todaysMeals.length
        };
    }, [getTodaysGlucose, getTodaysMeals, user.targetRange]);

    // ============================================
    // Data Management
    // ============================================

    const refreshData = useCallback(() => {
        const data = dataService.loadAllData();
        setUser(data.user);
        setMeals(data.meals);
        setGlucose(data.glucose);
        setActivities(data.activities);
        setMoods(data.moods);
        setSleep(data.sleep);
    }, []);

    const exportData = useCallback((): string => {
        return dataService.exportAllData();
    }, []);

    const importData = useCallback((json: string): boolean => {
        const success = dataService.importData(json);
        if (success) {
            refreshData();
        }
        return success;
    }, [refreshData]);

    const clearAllData = useCallback(() => {
        dataService.clearAllData();
        // Reset to defaults
        setUser(dataService.loadUser());
        setMeals([]);
        setGlucose([]);
        setActivities([]);
        setMoods([]);
        setSleep([]);
        // Re-initialize demo data
        dataService.initializeDemoData();
        refreshData();
    }, [refreshData]);

    // ============================================
    // Prediction action
    // ============================================
    const runPrediction = useCallback(async () => {
        try {
            setPredictionLoading(true);
            setPredictionError(null);

            console.log("[Predict] Using TEMPLATE as primary source (photo optional).");

            // ✅ TEMPLATE FLOW
            if (templateRows.length > 0) {
                const common = {
                    baseUrl: API_BASE,
                    templateRows,
                    mealLog,
                };

                const MEAL_ZERO = {
                    meal_type: "Unknown",
                    carbs: 0,
                    calories: 0,
                    protein: 0,
                    fat: 0,
                    fiber: 0,
                    amount_consumed: 0,
                };

                // 6 calls: TOTAL (3 horizons) + BASELINE (3 horizons)
                const [r30, r60, r120, b30, b60, b120] = await Promise.all([
                    // TOTAL
                    predictFromTemplate({ ...common, horizonMin: 30 }),
                    predictFromTemplate({ ...common, horizonMin: 60 }),
                    predictFromTemplate({ ...common, horizonMin: 120 }),

                    // BASELINE (meal=0)
                    predictFromTemplate({ ...common, horizonMin: 30, mealOverride: MEAL_ZERO }),
                    predictFromTemplate({ ...common, horizonMin: 60, mealOverride: MEAL_ZERO }),
                    predictFromTemplate({ ...common, horizonMin: 120, mealOverride: MEAL_ZERO }),
                ]);

                const d = (x: any) => Number(x?.delta ?? x?.prediction ?? 0);

                console.log("[MealEffect] h30", { total: d(r30), base: d(b30), meal: d(r30) - d(b30) });
                console.log("[MealEffect] h60", { total: d(r60), base: d(b60), meal: d(r60) - d(b60) });
                console.log("[MealEffect] h120", { total: d(r120), base: d(b120), meal: d(r120) - d(b120) });

                // Helper functions
                const getDelta = (resp: any) => Number(resp.delta ?? resp.prediction ?? 0);
                const getLast = (resp: any) => Number(resp.last_glucose ?? resp.last ?? 0);

                const totals = [r30, r60, r120];
                const bases = [b30, b60, b120];
                const horizons = [30, 60, 120];

                // Calculate meal effect for each horizon
                const results = horizons.map((h, i) => {
                    const total = totals[i];
                    const base = bases[i];

                    const last = getLast(total) || getLast(base);
                    const delta_total = getDelta(total);
                    const delta_base = getDelta(base);
                    const delta_meal = delta_total - delta_base;

                    return {
                        horizon_min: total.horizon_min ?? h,
                        mode: (total.mode ?? "full") as "full" | "fallback" | "min",
                        confidence: total.confidence ?? "low",
                        n: total.n ?? 720,
                        last,
                        delta_total,
                        delta_base,
                        delta_meal,
                        predicted_total: last + delta_total,
                        predicted_base: last + delta_base,
                        predicted_meal: last + delta_meal,
                    };
                });

                // Keep legacy fields for backward compatibility
                const legacyResults = results.map((r: any) => ({
                    ...r,
                    delta: r.delta_meal,  // For UI backward compat
                    predicted: r.predicted_total,  // For UI backward compat
                }));

                setPredictionResult(legacyResults as any);
                setPredictionLoading(false);
                return;
            }

            // Template not loaded fallback
            setPredictionLoading(false);
            setPredictionError("Template not loaded yet.");
        } catch (e: any) {
            setPredictionLoading(false);
            setPredictionError(e?.message ?? "Prediction failed");
        }
    }, [templateRows, mealLog]);

    const runMealResponsePrediction = useCallback(async () => {
        try {
            setMealResponseLoading(true);
            setMealResponseError(null);

            // aynı şekilde son 720 glukoz noktası (12 saat)
            const sorted = [...glucose].sort(
                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            const recent = sorted.slice(-720);
            console.log("[MealResp] glucose state len:", glucose.length, "sorted len:", sorted.length, "recent len:", recent.length);
            if (recent.length < 120) {
                setMealResponseLoading(false);
                setMealResponseError('Not enough glucose points (need >= 120).');
                return;
            }

            // meal macro’ları: en mantıklısı son loglanan meal (yoksa 0)
            const lastMeal = meals.length > 0 ? meals[0] : null;

            const payload = {
                glucose: recent.map((g) => ({ ts: g.timestamp, value: Number(g.value) })),
                latest_ts: recent[recent.length - 1].timestamp,
                meal_type: (lastMeal?.mealType as any) ?? "Unknown",
                calories: lastMeal?.analysis?.estimatedCalories ?? 0,
                carbs: lastMeal?.analysis?.estimatedCarbs ?? 0,
                protein: lastMeal?.analysis?.estimatedProtein ?? 0,
                fat: lastMeal?.analysis?.estimatedFat ?? 0,
                fiber: lastMeal?.analysis?.estimatedFiber ?? 0,
                amount_consumed: 1,
            };
            console.log("[MealResp] recent oldest/newest:", recent[0], recent[recent.length - 1]);
            console.table(payload.glucose.slice(0, 10));

            const r = await predictMealResponse(payload);

            setMealResponseResult({
                mode: r.mode,
                baseline_glucose: r.baseline_glucose,
                premeal_slope: r.premeal_slope,
                d_peak: r.d_peak,
                t_peak: r.t_peak,
                auc_0_120: r.auc_0_120,
                decay_slope: r.decay_slope,
                predicted_peak_glucose: r.predicted_peak_glucose,
                confidence: r.confidence,
            });

            setMealResponseLoading(false);
        } catch (e: any) {
            setMealResponseLoading(false);
            setMealResponseError(e?.message ?? 'Meal-response prediction failed');
        }
    }, [glucose, meals]);

    // ============================================
    // Context Value
    // ============================================

    const value: AppContextType = {
        // State
        user,
        meals,
        glucose,
        activities,
        moods,
        sleep,
        isLoading,
        apiKey,
        templateRows,
        mealLog,

        // User Actions
        updateUser,
        setApiKey,

        // Meal Actions
        addMeal,
        logMealFromAnalysis,
        deleteMeal,
        getFilteredMeals,

        // Glucose Actions
        addGlucoseReading,
        deleteGlucoseReading,

        // Activity Actions
        addActivity,
        deleteActivity,

        // Mood Actions
        addMood,
        deleteMood,

        // Sleep Actions
        addSleep,
        deleteSleep,

        // Utilities
        getTodaysMeals,
        getTodaysGlucose,
        getRecentGlucosePoints,
        getRecentLogs,
        getCurrentGlucose,
        getDailyStats,

        // Data Management
        refreshData,
        exportData,
        importData,
        clearAllData
        ,
        // Prediction
        predictionResult,
        predictionLoading,
        predictionError,
        runPrediction
        ,
        mealResponseResult,
        mealResponseLoading,
        mealResponseError,
        runMealResponsePrediction
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

// ============================================
// Custom Hook
// ============================================

export const useApp = (): AppContextType => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};

export default AppContext;
