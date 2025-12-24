// ============================================
// Dia-Log: Data Storage Service
// localStorage-based persistence layer
// ============================================

import {
    UserProfile,
    MealEntry,
    GlucoseEntry,
    ActivityEntry,
    MoodEntry,
    SleepEntry,
    AppData,
    DiabetesType
} from '../types';

// ============================================
// Storage Keys
// ============================================

const STORAGE_KEYS = {
    USER: 'dialog_user',
    MEALS: 'dialog_meals',
    GLUCOSE: 'dialog_glucose',
    ACTIVITIES: 'dialog_activities',
    MOODS: 'dialog_moods',
    SLEEP: 'dialog_sleep',
    SCHEMA_VERSION: 'dialog_schema_version',
    API_KEY: 'gemini_api_key'
} as const;

const CURRENT_SCHEMA_VERSION = 1;

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a unique ID
 */
export const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get current timestamp as ISO string
 */
export const getCurrentTimestamp = (): string => {
    return new Date().toISOString();
};

/**
 * Safely parse JSON from localStorage
 */
const safeJsonParse = <T>(json: string | null, defaultValue: T): T => {
    if (!json) return defaultValue;
    try {
        return JSON.parse(json) as T;
    } catch {
        console.error('Failed to parse JSON from localStorage');
        return defaultValue;
    }
};

/**
 * Check if a date is today
 */
export const isToday = (dateString: string): boolean => {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
};

/**
 * Check if a date is within the last N days
 */
export const isWithinDays = (dateString: string, days: number): boolean => {
    const date = new Date(dateString);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return date >= cutoff;
};

// ============================================
// Default Data
// ============================================

const createDefaultUser = (): UserProfile => ({
    id: generateId(),
    name: 'Guest User',
    diabetesType: 'Type 2' as DiabetesType,
    targetRange: {
        min: 70,
        max: 180
    },
    createdAt: getCurrentTimestamp(),
    updatedAt: getCurrentTimestamp()
});

// ============================================
// User Operations
// ============================================

export const loadUser = (): UserProfile => {
    const stored = localStorage.getItem(STORAGE_KEYS.USER);
    return safeJsonParse(stored, createDefaultUser());
};

export const saveUser = (user: UserProfile): void => {
    const updatedUser = {
        ...user,
        updatedAt: getCurrentTimestamp()
    };
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
};

export const updateUser = (updates: Partial<UserProfile>): UserProfile => {
    const current = loadUser();
    const updated = { ...current, ...updates, updatedAt: getCurrentTimestamp() };
    saveUser(updated);
    return updated;
};

// ============================================
// Meals Operations
// ============================================

export const loadMeals = (): MealEntry[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.MEALS);
    return safeJsonParse(stored, []);
};

export const saveMeals = (meals: MealEntry[]): void => {
    localStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(meals));
};

export const addMeal = (meal: Omit<MealEntry, 'id'>): MealEntry => {
    const meals = loadMeals();
    const newMeal: MealEntry = {
        ...meal,
        id: generateId()
    };
    meals.unshift(newMeal); // Add to beginning (most recent first)
    saveMeals(meals);
    return newMeal;
};

export const updateMeal = (id: string, updates: Partial<MealEntry>): MealEntry | null => {
    const meals = loadMeals();
    const index = meals.findIndex(m => m.id === id);
    if (index === -1) return null;

    meals[index] = { ...meals[index], ...updates };
    saveMeals(meals);
    return meals[index];
};

export const deleteMeal = (id: string): boolean => {
    const meals = loadMeals();
    const filtered = meals.filter(m => m.id !== id);
    if (filtered.length === meals.length) return false;

    saveMeals(filtered);
    return true;
};

export const getTodaysMeals = (): MealEntry[] => {
    return loadMeals().filter(m => isToday(m.timestamp));
};

// ============================================
// Glucose Operations
// ============================================

export const loadGlucose = (): GlucoseEntry[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.GLUCOSE);
    return safeJsonParse(stored, []);
};

export const saveGlucose = (readings: GlucoseEntry[]): void => {
    localStorage.setItem(STORAGE_KEYS.GLUCOSE, JSON.stringify(readings));
};

export const addGlucoseReading = (reading: Omit<GlucoseEntry, 'id'>): GlucoseEntry => {
    const readings = loadGlucose();
    const newReading: GlucoseEntry = {
        ...reading,
        id: generateId()
    };
    readings.unshift(newReading);
    saveGlucose(readings);
    return newReading;
};

export const getTodaysGlucose = (): GlucoseEntry[] => {
    return loadGlucose().filter(g => isToday(g.timestamp));
};

export const getRecentGlucose = (hours: number = 24): GlucoseEntry[] => {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    return loadGlucose().filter(g => new Date(g.timestamp) >= cutoff);
};

export const deleteGlucoseReading = (id: string): boolean => {
    const readings = loadGlucose();
    const filtered = readings.filter(r => r.id !== id);
    if (filtered.length === readings.length) return false;

    saveGlucose(filtered);
    return true;
};

// ============================================
// Activity Operations
// ============================================

export const loadActivities = (): ActivityEntry[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVITIES);
    return safeJsonParse(stored, []);
};

export const saveActivities = (activities: ActivityEntry[]): void => {
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));
};

export const addActivity = (activity: Omit<ActivityEntry, 'id'>): ActivityEntry => {
    const activities = loadActivities();
    const newActivity: ActivityEntry = {
        ...activity,
        id: generateId()
    };
    activities.unshift(newActivity);
    saveActivities(activities);
    return newActivity;
};

export const getTodaysActivities = (): ActivityEntry[] => {
    return loadActivities().filter(a => isToday(a.timestamp));
};

export const deleteActivity = (id: string): boolean => {
    const activities = loadActivities();
    const filtered = activities.filter(a => a.id !== id);
    if (filtered.length === activities.length) return false;

    saveActivities(filtered);
    return true;
};

// ============================================
// Mood Operations
// ============================================

export const loadMoods = (): MoodEntry[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.MOODS);
    return safeJsonParse(stored, []);
};

export const saveMoods = (moods: MoodEntry[]): void => {
    localStorage.setItem(STORAGE_KEYS.MOODS, JSON.stringify(moods));
};

export const addMood = (mood: Omit<MoodEntry, 'id'>): MoodEntry => {
    const moods = loadMoods();
    const newMood: MoodEntry = {
        ...mood,
        id: generateId()
    };
    moods.unshift(newMood);
    saveMoods(moods);
    return newMood;
};

export const getTodaysMoods = (): MoodEntry[] => {
    return loadMoods().filter(m => isToday(m.timestamp));
};

export const getLatestMood = (): MoodEntry | null => {
    const moods = loadMoods();
    return moods.length > 0 ? moods[0] : null;
};

export const deleteMood = (id: string): boolean => {
    const moods = loadMoods();
    const filtered = moods.filter(m => m.id !== id);
    if (filtered.length === moods.length) return false;

    saveMoods(filtered);
    return true;
};

// ============================================
// Sleep Operations
// ============================================

export const loadSleep = (): SleepEntry[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.SLEEP);
    return safeJsonParse(stored, []);
};

export const saveSleep = (entries: SleepEntry[]): void => {
    localStorage.setItem(STORAGE_KEYS.SLEEP, JSON.stringify(entries));
};

export const addSleep = (sleep: Omit<SleepEntry, 'id'>): SleepEntry => {
    const entries = loadSleep();
    const newSleep: SleepEntry = {
        ...sleep,
        id: generateId()
    };
    entries.unshift(newSleep);
    saveSleep(entries);
    return newSleep;
};

export const getTodaysSleep = (): SleepEntry | null => {
    const entries = loadSleep().filter(s => isToday(s.timestamp));
    return entries.length > 0 ? entries[0] : null;
};

export const getRecentSleep = (days: number = 7): SleepEntry[] => {
    return loadSleep().filter(s => isWithinDays(s.timestamp, days));
};

export const deleteSleep = (id: string): boolean => {
    const entries = loadSleep();
    const filtered = entries.filter(s => s.id !== id);
    if (filtered.length === entries.length) return false;

    saveSleep(filtered);
    return true;
};

// ============================================
// Load All Data
// ============================================

export const loadAllData = (): AppData => {
    return {
        user: loadUser(),
        meals: loadMeals(),
        glucose: loadGlucose(),
        activities: loadActivities(),
        moods: loadMoods(),
        sleep: loadSleep()
    };
};

// ============================================
// Export / Import
// ============================================

export const exportAllData = (): string => {
    const data = {
        version: CURRENT_SCHEMA_VERSION,
        exportedAt: getCurrentTimestamp(),
        data: loadAllData()
    };
    return JSON.stringify(data, null, 2);
};

export const importData = (jsonString: string): boolean => {
    try {
        const imported = JSON.parse(jsonString);

        if (!imported.data) {
            console.error('Invalid import format: missing data field');
            return false;
        }

        const { user, meals, glucose, activities, moods, sleep } = imported.data;

        if (user) saveUser(user);
        if (meals) saveMeals(meals);
        if (glucose) saveGlucose(glucose);
        if (activities) saveActivities(activities);
        if (moods) saveMoods(moods);
        if (sleep) saveSleep(sleep);

        return true;
    } catch (error) {
        console.error('Failed to import data:', error);
        return false;
    }
};

// ============================================
// Clear Data
// ============================================

export const clearAllData = (): void => {
    Object.values(STORAGE_KEYS).forEach(key => {
        if (key !== STORAGE_KEYS.API_KEY) { // Preserve API key
            localStorage.removeItem(key);
        }
    });
};

// ============================================
// Statistics
// ============================================

export const calculateDailyStats = () => {
    const todaysGlucose = getTodaysGlucose();
    const todaysMeals = getTodaysMeals();
    const user = loadUser();

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
};

// ============================================
// Demo Data Generation
// ============================================

export const generateDemoGlucoseData = (): GlucoseEntry[] => {
    const entries: GlucoseEntry[] = [];
    const now = new Date();

    // Generate 24 hours of simulated CGM data
    for (let i = 23; i >= 0; i--) {
        const timestamp = new Date(now);
        timestamp.setHours(now.getHours() - i);

        let value = 110;
        const hour = timestamp.getHours();

        // Simulate meal spikes
        if (hour >= 8 && hour <= 10) value += 60;   // Breakfast
        if (hour >= 13 && hour <= 15) value += 40;  // Lunch
        if (hour >= 19 && hour <= 21) value += 50;  // Dinner
        if (hour >= 2 && hour <= 5) value -= 20;    // Night drop

        // Add noise
        value += Math.floor(Math.random() * 20) - 10;
        value = Math.max(50, Math.min(250, value));

        entries.push({
            id: generateId(),
            timestamp: timestamp.toISOString(),
            value,
            source: 'simulated',
            trend: 'stable'
        });
    }

    return entries;
};

export const initializeDemoData = (): void => {
    // Only initialize if no glucose data exists
    if (loadGlucose().length === 0) {
        const demoGlucose = generateDemoGlucoseData();
        saveGlucose(demoGlucose);
    }
};
