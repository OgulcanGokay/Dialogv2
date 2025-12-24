import { UserProfile } from "./types";

// Default user profile for new users
export const DEFAULT_PROFILE: UserProfile = {
  id: 'default-user',
  name: "Guest User",
  diabetesType: "Type 2",
  targetRange: {
    min: 70,
    max: 180
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Activity type options with emojis
export const ACTIVITY_TYPES = [
  { value: 'walking', label: 'Walking', emoji: '🚶' },
  { value: 'running', label: 'Running', emoji: '🏃' },
  { value: 'cycling', label: 'Cycling', emoji: '🚴' },
  { value: 'swimming', label: 'Swimming', emoji: '🏊' },
  { value: 'strength', label: 'Strength Training', emoji: '🏋️' },
  { value: 'yoga', label: 'Yoga', emoji: '🧘' },
  { value: 'other', label: 'Other', emoji: '💪' }
] as const;

// Emotion options for mood tracking
export const EMOTION_OPTIONS = [
  { id: 'happy', label: '😊 Happy', color: 'bg-yellow-100' },
  { id: 'calm', label: '😌 Calm', color: 'bg-blue-100' },
  { id: 'anxious', label: '😰 Anxious', color: 'bg-orange-100' },
  { id: 'stressed', label: '😤 Stressed', color: 'bg-red-100' },
  { id: 'tired', label: '😴 Tired', color: 'bg-purple-100' },
  { id: 'energetic', label: '⚡ Energetic', color: 'bg-green-100' },
  { id: 'sad', label: '😢 Sad', color: 'bg-gray-100' },
  { id: 'irritable', label: '😠 Irritable', color: 'bg-red-100' }
] as const;

// Glycemic index information
export const GLYCEMIC_INDEX_INFO = {
  Low: {
    range: '55 or less',
    description: 'Best for glucose control. Foods are digested slowly.',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-100'
  },
  Medium: {
    range: '56-69',
    description: 'Moderate impact on blood glucose.',
    color: 'text-orange-500',
    bgColor: 'bg-orange-100'
  },
  High: {
    range: '70 or more',
    description: 'Rapid glucose spike. Use with caution.',
    color: 'text-red-500',
    bgColor: 'bg-red-100'
  }
} as const;

// Default glucose targets by diabetes type
export const DEFAULT_TARGETS = {
  'Type 1': { min: 70, max: 180 },
  'Type 2': { min: 70, max: 180 },
  'Gestational': { min: 70, max: 140 },
  'Prediabetes': { min: 70, max: 140 }
} as const;

// Time-based glucose target adjustments
export const TIME_BASED_TARGETS = {
  fasting: { min: 70, max: 130 },      // Before breakfast
  preMeal: { min: 70, max: 130 },      // Before meals
  postMeal: { min: 70, max: 180 },     // 1-2 hours after meals
  bedtime: { min: 90, max: 150 }       // Before sleep
} as const;