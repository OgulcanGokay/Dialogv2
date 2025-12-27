// ============================================
// Dia-Log: Comprehensive Type Definitions
// ============================================

// Enums
export enum PageView {
  DASHBOARD = 'DASHBOARD',
  MEAL_LOG = 'MEAL_LOG',
  HEALTH_LOG = 'HEALTH_LOG',
  INSIGHTS = 'INSIGHTS'
}

export type DiabetesType = 'Type 1' | 'Type 2' | 'Gestational' | 'Prediabetes';

export type GlucoseTrend = 'stable' | 'rising' | 'falling' | 'rising-rapidly' | 'falling-rapidly';

export type GlucoseSource = 'cgm' | 'manual' | 'simulated';

export type ActivityType = 'walking' | 'running' | 'cycling' | 'swimming' | 'strength' | 'yoga' | 'other';

export type Intensity = 'low' | 'moderate' | 'high';

export type SleepQuality = 'poor' | 'fair' | 'good' | 'excellent';

export type GlycemicIndex = 'Low' | 'Medium' | 'High';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type PortionSize = 'small' | 'medium' | 'large' | 'extra-large';

// ============================================
// Core Data Models
// ============================================

/**
 * Result from AI-powered meal analysis
 */
export interface MealAnalysis {
  foodName: string;
  estimatedCarbs: number;      // grams
  estimatedProtein?: number;   // grams
  estimatedFat?: number;       // grams
  estimatedCalories?: number;
  estimatedFiber?: number;     // grams
  estimatedSugar?: number;     // grams
  glycemicIndex: GlycemicIndex;
  prediction: string;          // AI prediction text
  healthScore: number;         // 1-10
  portionSize?: PortionSize;
  portionDescription?: string; // e.g., "1 cup", "2 slices"
}

/**
 * A logged meal with analysis and glucose impact
 */
export interface MealEntry {
  id: string;
  timestamp: string;           // ISO string
  imageBase64?: string;        // Stored meal photo (optional to save space)
  imageThumbnail?: string;     // Smaller version for display
  analysis: MealAnalysis;
  mealType?: MealType;         // breakfast, lunch, dinner, snack
  notes?: string;
  glucoseImpact?: {
    before: number;            // mg/dL before meal
    after: number;             // mg/dL 2h after
    peakValue: number;         // Highest reading
    peakTimeMinutes: number;   // Minutes after meal when peak occurred
  };
}

/**
 * Filter options for meal history
 */
export interface MealFilter {
  dateRange?: { start: Date; end: Date };
  mealType?: MealType;
  glycemicIndex?: GlycemicIndex;
  searchTerm?: string;
}

/**
 * Individual glucose reading
 */
export interface GlucoseEntry {
  id: string;
  timestamp: string;           // ISO string
  value: number;               // mg/dL
  source: GlucoseSource;
  trend: GlucoseTrend;
  notes?: string;
}

/**
 * For backwards compatibility with existing chart
 */
export interface GlucoseReading {
  timestamp: string;
  value: number;
  trend: GlucoseTrend;
}

/**
 * Physical activity entry
 */
export interface ActivityEntry {
  id: string;
  timestamp: string;           // ISO string
  type: ActivityType;
  duration: number;            // minutes
  intensity: Intensity;
  caloriesBurned?: number;
  notes?: string;
}

/**
 * Mood and emotional state entry
 */
export interface MoodEntry {
  id: string;
  timestamp: string;           // ISO string
  level: number;               // 1-10 overall mood
  stressLevel: number;         // 1-10 stress level
  emotions: string[];          // e.g., ['happy', 'anxious', 'calm']
  notes?: string;
}

/**
 * Sleep tracking entry
 */
export interface SleepEntry {
  id: string;
  timestamp: string;           // ISO string (date of waking up)
  duration: number;            // hours (decimal, e.g., 7.5)
  quality: SleepQuality;
  interruptions: number;       // times woken up during night
  notes?: string;
}

/**
 * Enhanced user profile
 */
export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  diabetesType: DiabetesType;
  targetRange: {
    min: number;               // mg/dL
    max: number;               // mg/dL
  };
  age?: number;
  weight?: number;             // kg
  height?: number;             // cm
  insulinSensitivity?: number; // mg/dL drop per unit of insulin
  carbRatio?: number;          // grams of carbs per unit of insulin
  createdAt: string;           // ISO string
  updatedAt: string;           // ISO string
}

// ============================================
// Unified Log Type (for timeline display)
// ============================================

export type LogType = 'meal' | 'glucose' | 'activity' | 'mood' | 'sleep';

export interface DailyLog {
  id: string;
  type: LogType;
  timestamp: string;
  details: string;             // Human-readable summary
  data: MealEntry | GlucoseEntry | ActivityEntry | MoodEntry | SleepEntry;
}

// ============================================
// App State Types
// ============================================

export interface AppData {
  user: UserProfile;
  meals: MealEntry[];
  glucose: GlucoseEntry[];
  activities: ActivityEntry[];
  moods: MoodEntry[];
  sleep: SleepEntry[];
}

// ============================================
// Utility Types
// ============================================

export type TimeRange = 'today' | 'week' | 'month' | 'all';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface Stats {
  averageGlucose: number;
  timeInRange: number;         // percentage
  highReadings: number;        // count
  lowReadings: number;         // count
  totalCarbs: number;
  mealsLogged: number;
}

// ============================================
// AI Agent Types
// ============================================

export type ImpactLevel = 'positive' | 'neutral' | 'negative';
export type RiskLevel = 'low' | 'moderate' | 'high';

/**
 * Sleep context for AI analysis
 */
export interface SleepContext {
  duration: number;
  quality: SleepQuality;
  impact: ImpactLevel;
  description: string;
}

/**
 * Mood/Stress context for AI analysis
 */
export interface MoodContext {
  level: number;
  stressLevel: number;
  emotions: string[];
  impact: ImpactLevel;
  description: string;
}

/**
 * Activity context for AI analysis
 */
export interface ActivityContext {
  totalMinutes: number;
  averageIntensity: Intensity;
  activities: string[];
  impact: ImpactLevel;
  description: string;
}

/**
 * Meal history context for AI analysis
 */
export interface MealHistoryContext {
  totalCarbs: number;
  mealCount: number;
  lastMealTime: string | null;
  averageHealthScore: number;
}

/**
 * Comprehensive health context for AI agent
 */
export interface HealthContext {
  // Individual factors
  sleep: SleepContext | null;
  mood: MoodContext | null;
  activity: ActivityContext | null;
  mealHistory: MealHistoryContext;

  // Overall assessment
  overallRisk: RiskLevel;
  riskFactors: string[];
  protectiveFactors: string[];

  // User profile
  diabetesType: DiabetesType;
  targetRange: { min: number; max: number };
}

/**
 * AI-enhanced meal prediction
 */
export interface EnhancedMealPrediction {
  basePrediction: MealAnalysis;
  adjustedRisk: RiskLevel;
  contextualPrediction: string;
  glucoseEstimate: {
    expectedPeak: number;      // mg/dL
    peakTime: number;          // minutes after meal
    returnToBaseline: number;  // minutes
  };
  recommendations: string[];
  warnings: string[];
  factors: {
    name: string;
    impact: ImpactLevel;
    description: string;
  }[];
  ml?: {
    predicted_glucose: number;
    confidence: "low" | "medium" | "high";
    mode: string;
    n: number;
    delta?: number;
  };
}

/**
 * AI-generated daily insight
 */
export interface DailyInsight {
  summary: string;
  riskLevel: RiskLevel;
  keyPatterns: string[];
  recommendations: string[];
  encouragement: string;
}