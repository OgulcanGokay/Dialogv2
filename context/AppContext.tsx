// ============================================
// Dia-Log: Application Context
// Centralized state management for all health data
// ============================================

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
    UserProfile,
    MealEntry,
    GlucoseEntry,
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

// ============================================
// Context Types
// ============================================

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
    predictionResult: null | {
        mode: "full" | "fallback" | "min";
        delta: number;
        predicted: number;
        last: number;
        n: number;
        confidence?: "low" | "medium" | "high";
    };
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

    // Prediction UI state
    const [predictionResult, setPredictionResult] = useState<null | {
        mode: "full" | "fallback" | "min";
        delta: number;
        predicted: number;
        last: number;
        n: number;
        confidence?: "low" | "medium" | "high";
    }>(null);
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

    // ============================================
    // Initial Data Load
    // ============================================

    useEffect(() => {
        const loadData = () => {
            setIsLoading(true);
            try {
                // Initialize demo data if needed
                dataService.initializeDemoData();

                // Load all data
                const data = dataService.loadAllData();
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

            // 1) sort by timestamp (safe) + take last 30
            const sorted = [...glucose].sort(
                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            const recent = sorted.slice(-30);

            if (recent.length < 1) {
                setPredictionLoading(false);
                setPredictionError('No glucose data to predict.');
                return;
            }

            const payload = {
                user_id: user?.id ?? '001',
                meal_type: 'Lunch',
                glucose: recent.map((g) => ({ ts: g.timestamp, value: g.value })),
            };

            const r = await predictGlucose(payload);

            const last = r.last_glucose ?? recent[recent.length - 1].value;
            const predicted = r.predicted_glucose ?? (last + r.prediction);

            console.log("Predict response r:", r);
            console.log("computed last/predicted:", { last, predicted });

            setPredictionResult({
                mode: r.mode,
                delta: r.prediction,
                predicted,
                last,
                n: r.n,
                confidence: r.confidence,
            });

            setPredictionLoading(false);
        } catch (e: any) {
            setPredictionLoading(false);
            setPredictionError(e?.message ?? 'Prediction failed');
        }
    }, [glucose, user]);

    const runMealResponsePrediction = useCallback(async () => {
        try {
            setMealResponseLoading(true);
            setMealResponseError(null);

            // aynı şekilde son 30 glukoz noktası
            const sorted = [...glucose].sort(
                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            const recent = sorted.slice(-30);

            if (recent.length < 3) {
                setMealResponseLoading(false);
                setMealResponseError('Not enough glucose data (need at least 3 points).');
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
