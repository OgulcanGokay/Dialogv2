// ============================================
// Dia-Log: AI Diabetes Analysis Agent Service
// Multi-factor health analysis for personalized predictions
// ============================================

import { GoogleGenAI } from "@google/genai";
import {
    HealthContext,
    SleepContext,
    MoodContext,
    ActivityContext,
    MealHistoryContext,
    MealAnalysis,
    EnhancedMealPrediction,
    DailyInsight,
    RiskLevel,
    ImpactLevel,
    SleepEntry,
    MoodEntry,
    ActivityEntry,
    MealEntry,
    UserProfile,
    SleepQuality,
    Intensity
} from "../types";
import { predictGlucose } from "./predictApi";
import { isToday, isWithinDays } from "./dataService";

// ============================================
// Health Context Builder
// ============================================

/**
 * Analyze sleep data and determine its impact on glucose
 */
export const analyzeSleepContext = (sleepEntries: SleepEntry[]): SleepContext | null => {
    // Get last night's sleep (most recent entry from today)
    const todaysSleep = sleepEntries.find(s => isToday(s.timestamp));
    const recentSleep = todaysSleep || sleepEntries[0];

    if (!recentSleep) return null;

    const qualityScore: Record<SleepQuality, number> = {
        'poor': 1,
        'fair': 2,
        'good': 3,
        'excellent': 4
    };

    let impact: ImpactLevel;
    let description: string;

    if (recentSleep.duration >= 7 && qualityScore[recentSleep.quality] >= 3) {
        impact = 'positive';
        description = `Good sleep (${recentSleep.duration}h, ${recentSleep.quality}) - supports stable glucose`;
    } else if (recentSleep.duration < 5 || recentSleep.quality === 'poor') {
        impact = 'negative';
        description = `Poor sleep (${recentSleep.duration}h, ${recentSleep.quality}) - may increase insulin resistance`;
    } else {
        impact = 'neutral';
        description = `Moderate sleep (${recentSleep.duration}h, ${recentSleep.quality})`;
    }

    return {
        duration: recentSleep.duration,
        quality: recentSleep.quality,
        impact,
        description
    };
};

/**
 * Analyze mood/stress data and determine its impact on glucose
 */
export const analyzeMoodContext = (moodEntries: MoodEntry[]): MoodContext | null => {
    // Get most recent mood entry from today
    const todaysMood = moodEntries.find(m => isToday(m.timestamp));
    const recentMood = todaysMood || moodEntries[0];

    if (!recentMood) return null;

    let impact: ImpactLevel;
    let description: string;

    if (recentMood.stressLevel <= 3 && recentMood.level >= 7) {
        impact = 'positive';
        description = `Low stress (${recentMood.stressLevel}/10), good mood - favorable for glucose control`;
    } else if (recentMood.stressLevel >= 7) {
        impact = 'negative';
        description = `High stress (${recentMood.stressLevel}/10) - may elevate baseline glucose`;
    } else {
        impact = 'neutral';
        description = `Moderate stress level (${recentMood.stressLevel}/10)`;
    }

    return {
        level: recentMood.level,
        stressLevel: recentMood.stressLevel,
        emotions: recentMood.emotions,
        impact,
        description
    };
};

/**
 * Analyze activity data and determine its impact on glucose
 */
export const analyzeActivityContext = (activityEntries: ActivityEntry[]): ActivityContext | null => {
    // Get activities from last 24 hours
    const recentActivities = activityEntries.filter(a => isWithinDays(a.timestamp, 1));

    if (recentActivities.length === 0) return null;

    const totalMinutes = recentActivities.reduce((sum, a) => sum + a.duration, 0);
    const intensityScore: Record<Intensity, number> = {
        'low': 1,
        'moderate': 2,
        'high': 3
    };
    const avgIntensityScore = recentActivities.reduce((sum, a) => sum + intensityScore[a.intensity], 0) / recentActivities.length;
    const averageIntensity: Intensity = avgIntensityScore >= 2.5 ? 'high' : avgIntensityScore >= 1.5 ? 'moderate' : 'low';

    let impact: ImpactLevel;
    let description: string;

    if (totalMinutes >= 30) {
        impact = 'positive';
        description = `Good activity (${totalMinutes} min) - improves insulin sensitivity`;
    } else if (totalMinutes === 0) {
        impact = 'negative';
        description = `No recent activity - may reduce glucose utilization`;
    } else {
        impact = 'neutral';
        description = `Light activity (${totalMinutes} min)`;
    }

    return {
        totalMinutes,
        averageIntensity,
        activities: recentActivities.map(a => a.type),
        impact,
        description
    };
};

/**
 * Analyze meal history for context
 */
export const analyzeMealHistory = (mealEntries: MealEntry[]): MealHistoryContext => {
    const todaysMeals = mealEntries.filter(m => isToday(m.timestamp));

    const totalCarbs = todaysMeals.reduce((sum, m) => sum + (m.analysis?.estimatedCarbs || 0), 0);
    const avgHealthScore = todaysMeals.length > 0
        ? todaysMeals.reduce((sum, m) => sum + (m.analysis?.healthScore || 5), 0) / todaysMeals.length
        : 0;

    return {
        totalCarbs,
        mealCount: todaysMeals.length,
        lastMealTime: todaysMeals[0]?.timestamp || null,
        averageHealthScore: Math.round(avgHealthScore * 10) / 10
    };
};

/**
 * Build comprehensive health context from all data
 */
export const buildHealthContext = (
    user: UserProfile,
    sleepEntries: SleepEntry[],
    moodEntries: MoodEntry[],
    activityEntries: ActivityEntry[],
    mealEntries: MealEntry[]
): HealthContext => {
    const sleep = analyzeSleepContext(sleepEntries);
    const mood = analyzeMoodContext(moodEntries);
    const activity = analyzeActivityContext(activityEntries);
    const mealHistory = analyzeMealHistory(mealEntries);

    // Calculate risk factors
    const riskFactors: string[] = [];
    const protectiveFactors: string[] = [];

    if (sleep?.impact === 'negative') riskFactors.push(sleep.description);
    if (sleep?.impact === 'positive') protectiveFactors.push(sleep.description);

    if (mood?.impact === 'negative') riskFactors.push(mood.description);
    if (mood?.impact === 'positive') protectiveFactors.push(mood.description);

    if (activity?.impact === 'negative') riskFactors.push(activity.description);
    if (activity?.impact === 'positive') protectiveFactors.push(activity.description);

    if (mealHistory.totalCarbs > 150) {
        riskFactors.push(`High carb intake today (${mealHistory.totalCarbs}g)`);
    }

    // Determine overall risk
    let overallRisk: RiskLevel;
    if (riskFactors.length >= 2) {
        overallRisk = 'high';
    } else if (riskFactors.length === 1) {
        overallRisk = 'moderate';
    } else {
        overallRisk = 'low';
    }

    return {
        sleep,
        mood,
        activity,
        mealHistory,
        overallRisk,
        riskFactors,
        protectiveFactors,
        diabetesType: user.diabetesType,
        targetRange: user.targetRange
    };
};

// ============================================
// AI-Powered Analysis
// ============================================

/**
 * Generate enhanced meal prediction using AI with health context
 */
export const generateEnhancedPrediction = async (
        apiKey: string,
        mealAnalysis: MealAnalysis,
        healthContext: HealthContext,
        opts?: {
            userId?: string;
            mealType?: string; // "Breakfast"|"Lunch"|...
            recentGlucose?: { ts?: string; value: number }[]; // 🔥 10–30 nokta
        }
): Promise<EnhancedMealPrediction> => {
        // 0) ML (FastAPI /predict) - Gemini'den bağımsız dene
        let mlResult: any = null;

        try {
            const recent = opts?.recentGlucose || [];
            if (recent.length >= 2) {
                mlResult = await predictGlucose({
                    user_id: opts?.userId || "001",
                    meal_type: opts?.mealType || "Lunch",
                    glucose: recent,

                    calories: mealAnalysis.estimatedCalories || undefined,
                    carbs: mealAnalysis.estimatedCarbs || undefined,
                    protein: mealAnalysis.estimatedProtein || undefined,
                    fat: mealAnalysis.estimatedFat || undefined,
                    fiber: mealAnalysis.estimatedFiber || undefined,
                });
            }
        } catch (e) {
            console.warn("ML /predict failed, continuing:", e);
        }

        if (!apiKey) {
                const basic = createBasicPrediction(mealAnalysis, healthContext);
                return mlResult
                    ? {
                            ...basic,
                            ml: {
                                predicted_glucose: mlResult.predicted_glucose,
                                confidence: mlResult.confidence,
                                mode: mlResult.mode,
                                n: mlResult.n,
                                delta: mlResult.delta,
                            },
                        }
                    : basic;
        }

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `You are an expert diabetes health AI assistant. Analyze how this meal will affect the patient's glucose considering their current health context.

PATIENT PROFILE:
- Diabetes Type: ${healthContext.diabetesType}
- Target Range: ${healthContext.targetRange.min}-${healthContext.targetRange.max} mg/dL

CURRENT HEALTH CONTEXT:
${healthContext.sleep ? `- Sleep: ${healthContext.sleep.description}` : '- Sleep: No data'}
${healthContext.mood ? `- Stress/Mood: ${healthContext.mood.description}` : '- Stress/Mood: No data'}
${healthContext.activity ? `- Activity: ${healthContext.activity.description}` : '- Activity: No data'}
- Today's carb intake so far: ${healthContext.mealHistory.totalCarbs}g across ${healthContext.mealHistory.mealCount} meals
- Current risk factors: ${healthContext.riskFactors.length > 0 ? healthContext.riskFactors.join(', ') : 'None identified'}

MEAL TO ANALYZE:
- Food: ${mealAnalysis.foodName}
- Carbs: ${mealAnalysis.estimatedCarbs}g
- Glycemic Index: ${mealAnalysis.glycemicIndex}
- Base Health Score: ${mealAnalysis.healthScore}/10

Provide a JSON response with:
{
  "adjustedRisk": "low" | "moderate" | "high",
  "contextualPrediction": "2-3 sentences explaining how THIS SPECIFIC meal combined with their current health factors will affect glucose",
  "expectedPeakGlucose": number (estimated peak mg/dL above baseline, e.g., 40 means +40 mg/dL),
  "peakTimeMinutes": number (when peak occurs after eating),
  "returnToBaselineMinutes": number (how long until glucose returns to normal),
  "recommendations": ["array of 2-3 specific actionable tips to minimize glucose spike"],
  "warnings": ["array of warnings if any risk factors are concerning, empty if none"]
}

IMPORTANT: Return ONLY valid JSON, no markdown.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        let text = response.text?.trim() || '';

        // Clean up response
        if (text.startsWith("```json")) text = text.slice(7);
        if (text.startsWith("```")) text = text.slice(3);
        if (text.endsWith("```")) text = text.slice(0, -3);
        text = text.trim();

        const aiResult = JSON.parse(text);

        // Build factors list
        const factors: EnhancedMealPrediction['factors'] = [];

        if (healthContext.sleep) {
            factors.push({
                name: 'Sleep',
                impact: healthContext.sleep.impact,
                description: healthContext.sleep.description
            });
        }

        if (healthContext.mood) {
            factors.push({
                name: 'Stress/Mood',
                impact: healthContext.mood.impact,
                description: healthContext.mood.description
            });
        }

        if (healthContext.activity) {
            factors.push({
                name: 'Physical Activity',
                impact: healthContext.activity.impact,
                description: healthContext.activity.description
            });
        }

                const result: EnhancedMealPrediction = {
                        basePrediction: mealAnalysis,
                        adjustedRisk: aiResult.adjustedRisk || healthContext.overallRisk,
                        contextualPrediction: aiResult.contextualPrediction || mealAnalysis.prediction,
                        glucoseEstimate: {
                                expectedPeak: aiResult.expectedPeakGlucose || 50,
                                peakTime: aiResult.peakTimeMinutes || 60,
                                returnToBaseline: aiResult.returnToBaselineMinutes || 120
                        },
                        recommendations: aiResult.recommendations || [],
                        warnings: aiResult.warnings || [],
                        factors
                };

                if (mlResult) {
                    result.ml = {
                        predicted_glucose: mlResult.predicted_glucose,
                        confidence: mlResult.confidence,
                        mode: mlResult.mode,
                        n: mlResult.n,
                        delta: mlResult.delta,
                    };
                }

                return result;
    } catch (error) {
                console.error("AI Enhanced Prediction Error:", error);
                const basic = createBasicPrediction(mealAnalysis, healthContext);
                return mlResult
                    ? {
                            ...basic,
                            ml: {
                                predicted_glucose: mlResult.predicted_glucose,
                                confidence: mlResult.confidence,
                                mode: mlResult.mode,
                                n: mlResult.n,
                                delta: mlResult.delta,
                            },
                        }
                    : basic;
    }
};

/**
 * Create basic prediction without AI (fallback)
 */
const createBasicPrediction = (
    mealAnalysis: MealAnalysis,
    healthContext: HealthContext
): EnhancedMealPrediction => {
    const factors: EnhancedMealPrediction['factors'] = [];

    if (healthContext.sleep) {
        factors.push({
            name: 'Sleep',
            impact: healthContext.sleep.impact,
            description: healthContext.sleep.description
        });
    }

    if (healthContext.mood) {
        factors.push({
            name: 'Stress/Mood',
            impact: healthContext.mood.impact,
            description: healthContext.mood.description
        });
    }

    if (healthContext.activity) {
        factors.push({
            name: 'Physical Activity',
            impact: healthContext.activity.impact,
            description: healthContext.activity.description
        });
    }

    // Calculate basic estimates based on carbs and GI
    const carbImpact = mealAnalysis.estimatedCarbs * (mealAnalysis.glycemicIndex === 'High' ? 1.5 : mealAnalysis.glycemicIndex === 'Medium' ? 1.0 : 0.6);

    return {
        basePrediction: mealAnalysis,
        adjustedRisk: healthContext.overallRisk,
        contextualPrediction: mealAnalysis.prediction,
        glucoseEstimate: {
            expectedPeak: Math.round(carbImpact * 0.8),
            peakTime: mealAnalysis.glycemicIndex === 'High' ? 45 : mealAnalysis.glycemicIndex === 'Medium' ? 60 : 90,
            returnToBaseline: mealAnalysis.glycemicIndex === 'High' ? 90 : mealAnalysis.glycemicIndex === 'Medium' ? 120 : 150
        },
        recommendations: [
            'Consider a short walk after eating to help glucose uptake',
            'Pair high-carb foods with protein or healthy fats',
            'Stay hydrated to support glucose metabolism'
        ],
        warnings: healthContext.riskFactors,
        factors
    };
};

/**
 * Generate comprehensive daily insight
 */
export const generateDailyHealthInsight = async (
    apiKey: string,
    healthContext: HealthContext,
    recentMeals: MealEntry[],
    recentGlucose: { value: number; timestamp: string }[]
): Promise<DailyInsight> => {
    if (!apiKey) {
        return createBasicInsight(healthContext);
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a supportive diabetes health coach. Analyze this patient's daily health data and provide personalized insights.

PATIENT PROFILE:
- Diabetes Type: ${healthContext.diabetesType}
- Target Range: ${healthContext.targetRange.min}-${healthContext.targetRange.max} mg/dL

TODAY'S HEALTH SUMMARY:
- Sleep: ${healthContext.sleep?.description || 'No data logged'}
- Stress Level: ${healthContext.mood?.description || 'No data logged'}
- Physical Activity: ${healthContext.activity?.description || 'No data logged'}
- Meals: ${healthContext.mealHistory.mealCount} meals, ${healthContext.mealHistory.totalCarbs}g total carbs

RISK FACTORS: ${healthContext.riskFactors.length > 0 ? healthContext.riskFactors.join(', ') : 'None identified'}
PROTECTIVE FACTORS: ${healthContext.protectiveFactors.length > 0 ? healthContext.protectiveFactors.join(', ') : 'None identified'}

RECENT MEALS: ${recentMeals.slice(0, 3).map(m => `${m.analysis.foodName} (${m.analysis.estimatedCarbs}g carbs)`).join(', ') || 'None logged'}

Provide a JSON response:
{
  "summary": "1-2 sentence personalized summary of their day's health impact on glucose control",
  "riskLevel": "low" | "moderate" | "high",
  "keyPatterns": ["array of 2-3 patterns you notice in their data"],
  "recommendations": ["array of 2-3 specific, actionable recommendations"],
  "encouragement": "1 sentence of warm, personalized encouragement"
}

IMPORTANT: Return ONLY valid JSON. Be warm, supportive, and specific.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        let text = response.text?.trim() || '';

        if (text.startsWith("```json")) text = text.slice(7);
        if (text.startsWith("```")) text = text.slice(3);
        if (text.endsWith("```")) text = text.slice(0, -3);
        text = text.trim();

        const result = JSON.parse(text);

        return {
            summary: result.summary || "Keep logging your data for personalized insights!",
            riskLevel: result.riskLevel || healthContext.overallRisk,
            keyPatterns: result.keyPatterns || [],
            recommendations: result.recommendations || [],
            encouragement: result.encouragement || "You're doing great by tracking your health!"
        };
    } catch (error) {
        console.error("AI Daily Insight Error:", error);
        return createBasicInsight(healthContext);
    }
};

/**
 * Create basic insight without AI (fallback)
 */
const createBasicInsight = (healthContext: HealthContext): DailyInsight => {
    const patterns: string[] = [];
    const recommendations: string[] = [];

    if (healthContext.sleep?.impact === 'negative') {
        patterns.push("Poor sleep may be affecting your glucose control");
        recommendations.push("Aim for 7-8 hours of quality sleep tonight");
    }

    if (healthContext.mood?.stressLevel && healthContext.mood.stressLevel >= 6) {
        patterns.push("Elevated stress levels detected");
        recommendations.push("Try deep breathing or a short walk to reduce stress");
    }

    if (healthContext.activity?.totalMinutes && healthContext.activity.totalMinutes < 20) {
        patterns.push("Low physical activity today");
        recommendations.push("Even a 10-minute walk can help with glucose control");
    }

    if (patterns.length === 0) {
        patterns.push("Keep logging data to discover your patterns");
    }

    if (recommendations.length === 0) {
        recommendations.push("Continue your current routine and keep tracking");
    }

    return {
        summary: `Based on today's data, your glucose risk is ${healthContext.overallRisk}. ${healthContext.riskFactors.length > 0 ? `Watch out for: ${healthContext.riskFactors[0]}` : 'No major concerns identified.'}`,
        riskLevel: healthContext.overallRisk,
        keyPatterns: patterns,
        recommendations,
        encouragement: "Every day of tracking brings you closer to understanding your body. Keep it up!"
    };
};

/**
 * Get pre-meal warnings based on current health context
 */
export const getPreMealWarnings = (healthContext: HealthContext): string[] => {
    const warnings: string[] = [];

    if (healthContext.sleep?.impact === 'negative') {
        warnings.push("⚠️ Poor sleep may increase insulin resistance - consider smaller portions");
    }

    if (healthContext.mood?.stressLevel && healthContext.mood.stressLevel >= 7) {
        warnings.push("⚠️ High stress detected - glucose may spike more than usual");
    }

    if (healthContext.activity?.impact === 'negative') {
        warnings.push("💡 Low activity today - a short walk after eating could help");
    }

    if (healthContext.mealHistory.totalCarbs > 100) {
        warnings.push(`📊 Already consumed ${healthContext.mealHistory.totalCarbs}g carbs today`);
    }

    return warnings;
};
