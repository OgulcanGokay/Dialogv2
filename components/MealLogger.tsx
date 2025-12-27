import React, { useState, useRef, useEffect, useMemo } from 'react';
import { analyzeFoodImage } from '../services/geminiService';
import { buildHealthContext, generateEnhancedPrediction, getPreMealWarnings } from '../services/aiAgentService';
import { useApp } from '../context/AppContext';
import { MealAnalysis, EnhancedMealPrediction, HealthContext, MealType, GlycemicIndex, MealFilter, PortionSize } from '../types';
import { Camera, Upload, Check, Loader2, Info, AlertTriangle, History, Trash2, Activity, Moon, Zap, TrendingUp, ChevronDown, ChevronUp, Search, Filter, X, Coffee, Sun, Sunset, Cookie } from 'lucide-react';

const MealLogger: React.FC = () => {
  const { apiKey, user, meals, sleep, moods, activities, logMealFromAnalysis, deleteMeal, getFilteredMeals, getRecentGlucosePoints } = useApp();

  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  const [enhancedPrediction, setEnhancedPrediction] = useState<EnhancedMealPrediction | null>(null);
  const [healthContext, setHealthContext] = useState<HealthContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [portionSize, setPortionSize] = useState<PortionSize>('medium');
  const [portionHint, setPortionHint] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showFactors, setShowFactors] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filter, setFilter] = useState<MealFilter>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build health context on component mount and when data changes
  useEffect(() => {
    const context = buildHealthContext(user, sleep, moods, activities, meals);
    setHealthContext(context);
  }, [user, sleep, moods, activities, meals]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setAnalysis(null);
        setEnhancedPrediction(null);
        setError(null);
        setSavedSuccess(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!image || !healthContext) return;
    if (!apiKey) {
      setError("Please enter your Gemini API Key in settings first.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Strip data:image/jpeg;base64, prefix if present for the API
      const base64Data = image.split(',')[1];

      // Step 1: Get basic meal analysis (pass portion hint if provided)
      const mealResult = await analyzeFoodImage(apiKey, base64Data, portionHint || undefined);
      setAnalysis(mealResult);

      // Pre-select the AI-detected portion size (user can adjust)
      if (mealResult.portionSize) {
        setPortionSize(mealResult.portionSize);
      }

      // Step 2: Generate enhanced prediction with health context (also call local ML /predict)
      const recentGlucose = getRecentGlucosePoints(30); // 10-30+ points

      const mealTypeTitle =
        mealType === "breakfast" ? "Breakfast" :
        mealType === "lunch" ? "Lunch" :
        mealType === "dinner" ? "Dinner" :
        "Snack";

      const enhanced = await generateEnhancedPrediction(
        apiKey,
        mealResult,
        healthContext,
        {
          userId: user?.id || "001",
          mealType: mealTypeTitle,
          recentGlucose,
        }
      );
      setEnhancedPrediction(enhanced);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze image. Ensure your API Key is valid and the image is clear.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogMeal = () => {
    if (!analysis) return;

    // Apply user's selected portion size to the analysis
    const updatedAnalysis = {
      ...analysis,
      portionSize: portionSize,
    };

    const thumbnail = image || undefined;
    logMealFromAnalysis(updatedAnalysis, thumbnail, notes || undefined, mealType);

    setSavedSuccess(true);
    setTimeout(() => {
      setImage(null);
      setAnalysis(null);
      setEnhancedPrediction(null);
      setNotes('');
      setMealType('lunch');
      setPortionSize('medium');
      setPortionHint('');
      setSavedSuccess(false);
    }, 1500);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const preWarnings = healthContext ? getPreMealWarnings(healthContext) : [];

  // Filtered meals using the context function
  const filteredMeals = useMemo(() => {
    const hasFilter = filter.mealType || filter.glycemicIndex || filter.searchTerm;
    if (hasFilter) {
      return getFilteredMeals(filter);
    }
    return meals;
  }, [meals, filter, getFilteredMeals]);

  const recentMeals = filteredMeals.slice(0, 10);

  const mealTypeOptions: { type: MealType; label: string; icon: React.ReactNode }[] = [
    { type: 'breakfast', label: 'Breakfast', icon: <Coffee size={16} /> },
    { type: 'lunch', label: 'Lunch', icon: <Sun size={16} /> },
    { type: 'dinner', label: 'Dinner', icon: <Sunset size={16} /> },
    { type: 'snack', label: 'Snack', icon: <Cookie size={16} /> },
  ];

  const portionOptions: { size: PortionSize; label: string; emoji: string }[] = [
    { size: 'small', label: 'Small', emoji: '🥄' },
    { size: 'medium', label: 'Medium', emoji: '🍽️' },
    { size: 'large', label: 'Large', emoji: '🍲' },
    { size: 'extra-large', label: 'XL', emoji: '🥘' },
  ];

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive': return 'text-emerald-600 bg-emerald-50';
      case 'negative': return 'text-red-600 bg-red-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-emerald-500';
      case 'moderate': return 'bg-orange-500';
      case 'high': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      {/* Input Section */}
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Meal Analysis</h2>
            <p className="text-slate-500">AI-powered analysis considering your health context.</p>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`lg:hidden p-2 rounded-lg transition-colors ${showHistory ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}
          >
            <History size={20} />
          </button>
        </div>

        {/* Health Context Card */}
        {healthContext && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 text-sm">Your Current Health Context</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-bold text-white ${getRiskColor(healthContext.overallRisk)}`}>
                {healthContext.overallRisk.toUpperCase()} RISK
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className={`p-3 rounded-xl ${healthContext.sleep ? getImpactColor(healthContext.sleep.impact) : 'bg-slate-100 text-slate-400'}`}>
                <Moon size={16} className="mb-1" />
                <p className="text-xs font-medium">Sleep</p>
                <p className="text-xs opacity-75">{healthContext.sleep ? `${healthContext.sleep.duration}h ${healthContext.sleep.quality}` : 'No data'}</p>
              </div>
              <div className={`p-3 rounded-xl ${healthContext.mood ? getImpactColor(healthContext.mood.impact) : 'bg-slate-100 text-slate-400'}`}>
                <Zap size={16} className="mb-1" />
                <p className="text-xs font-medium">Stress</p>
                <p className="text-xs opacity-75">{healthContext.mood ? `${healthContext.mood.stressLevel}/10` : 'No data'}</p>
              </div>
              <div className={`p-3 rounded-xl ${healthContext.activity ? getImpactColor(healthContext.activity.impact) : 'bg-slate-100 text-slate-400'}`}>
                <Activity size={16} className="mb-1" />
                <p className="text-xs font-medium">Activity</p>
                <p className="text-xs opacity-75">{healthContext.activity ? `${healthContext.activity.totalMinutes} min` : 'No data'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Pre-meal Warnings */}
        {preWarnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h4 className="font-medium text-amber-800 mb-2 text-sm">Before You Eat</h4>
            <ul className="space-y-1">
              {preWarnings.map((warning, i) => (
                <li key={i} className="text-sm text-amber-700">{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Image Upload Area */}
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-8 flex flex-col items-center justify-center min-h-[350px] relative overflow-hidden group hover:border-blue-400 transition-colors shadow-sm">
          {image ? (
            <>
              <img src={image} alt="Meal preview" className="absolute inset-0 w-full h-full object-cover" />
              <button
                onClick={() => {
                  setImage(null);
                  setAnalysis(null);
                  setEnhancedPrediction(null);
                  setSavedSuccess(false);
                }}
                className="absolute top-4 right-4 bg-white/90 p-2 rounded-full text-slate-600 hover:text-red-500 transition-colors shadow-sm z-10"
              >
                <Upload size={20} className="rotate-45" />
              </button>
            </>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto transition-transform group-hover:scale-110 duration-300">
                <Camera size={40} />
              </div>
              <div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 font-semibold hover:underline text-lg"
                >
                  Upload a photo
                </button>
                <p className="text-slate-400 mt-2 text-sm">Supports JPG, PNG</p>
              </div>
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleImageUpload}
          />
        </div>

        {/* Optional Portion Input (before analysis) */}
        {image && !analysis && (
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <label className="block text-sm font-medium text-slate-600 mb-2">
              📏 Portion Size (optional)
            </label>
            <input
              type="text"
              value={portionHint}
              onChange={(e) => setPortionHint(e.target.value)}
              placeholder="e.g., 1 cup, 2 slices, half plate, large bowl"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            />
            <p className="text-xs text-slate-400 mt-1">
              Enter your portion for more accurate nutrition estimates, or leave blank to let AI estimate
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleAnalyze}
            disabled={!image || loading}
            className={`
              flex items-center space-x-2 px-8 py-4 rounded-xl font-semibold text-white transition-all transform hover:-translate-y-1 shadow-lg
              ${!image || loading ? 'bg-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-blue-200'}
            `}
          >
            {loading ? <Loader2 className="animate-spin" /> : <SparklesIcon />}
            <span>{loading ? 'Analyzing...' : 'Analyze with AI'}</span>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center space-x-3 text-sm">
            <AlertTriangle size={20} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Results Section */}
      <div className="bg-slate-100 rounded-3xl p-6 lg:p-8 flex flex-col h-full border border-slate-200 overflow-y-auto">
        {showHistory && (
          <div className="lg:hidden mb-6">
            <h3 className="font-bold text-slate-800 mb-3">Recent Meals</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {recentMeals.map(meal => (
                <MealHistoryItem key={meal.id} meal={meal} onDelete={deleteMeal} formatTime={formatTime} />
              ))}
            </div>
          </div>
        )}

        {!analysis ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
              <Info size={32} className="text-slate-300" />
            </div>
            <p className="text-center max-w-xs">Upload an image and tap analyze to see AI-powered nutritional insights.</p>
          </div>
        ) : (
          <div className="space-y-5 animate-fadeIn">
            {/* Food Name & Score */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">{analysis.foodName}</h3>
                <div className="flex items-center space-x-2 mt-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${analysis.healthScore >= 8 ? 'bg-emerald-100 text-emerald-700' :
                    analysis.healthScore >= 5 ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                    Score: {analysis.healthScore}/10
                  </span>
                  {enhancedPrediction && (
                    <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${getRiskColor(enhancedPrediction.adjustedRisk)}`}>
                      {enhancedPrediction.adjustedRisk.toUpperCase()} RISK
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Nutrition Stats - Detailed */}
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-700 text-sm">Nutrition Facts</h4>
                {analysis.portionDescription && (
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                    📦 {analysis.portionDescription} ({analysis.portionSize || 'medium'})
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-blue-50 rounded-lg">
                  <p className="text-lg font-bold text-blue-600">{analysis.estimatedCalories || 0}</p>
                  <p className="text-xs text-blue-500">Calories</p>
                </div>
                <div className="text-center p-2 bg-amber-50 rounded-lg">
                  <p className="text-lg font-bold text-amber-600">{analysis.estimatedCarbs}g</p>
                  <p className="text-xs text-amber-500">Carbs</p>
                </div>
                <div className="text-center p-2 bg-red-50 rounded-lg">
                  <p className="text-lg font-bold text-red-500">{analysis.estimatedSugar || 0}g</p>
                  <p className="text-xs text-red-400">Sugar</p>
                </div>
                <div className="text-center p-2 bg-emerald-50 rounded-lg">
                  <p className="text-lg font-bold text-emerald-600">{analysis.estimatedProtein || 0}g</p>
                  <p className="text-xs text-emerald-500">Protein</p>
                </div>
                <div className="text-center p-2 bg-orange-50 rounded-lg">
                  <p className="text-lg font-bold text-orange-500">{analysis.estimatedFat || 0}g</p>
                  <p className="text-xs text-orange-400">Fat</p>
                </div>
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <p className="text-lg font-bold text-green-600">{analysis.estimatedFiber || 0}g</p>
                  <p className="text-xs text-green-500">Fiber</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="text-xs text-slate-500">Glycemic Index:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${analysis.glycemicIndex === 'High' ? 'bg-red-100 text-red-600' :
                  analysis.glycemicIndex === 'Medium' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                  {analysis.glycemicIndex}
                </span>
              </div>
            </div>

            {/* Enhanced Prediction - Glucose Estimate */}
            {enhancedPrediction && (
              <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-indigo-500">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="text-indigo-500" size={18} />
                  <h4 className="font-semibold text-slate-800 text-sm">Glucose Prediction</h4>

                  {enhancedPrediction?.ml && (
                    <span className="ml-auto px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                      Confidence: {enhancedPrediction.ml.confidence.toUpperCase()} (n={enhancedPrediction.ml.n})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-indigo-600">+{enhancedPrediction.glucoseEstimate.expectedPeak}</p>
                    <p className="text-xs text-slate-400">mg/dL peak</p>
                  </div>

                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-700">{enhancedPrediction.glucoseEstimate.peakTime}</p>
                    <p className="text-xs text-slate-400">min to peak</p>
                  </div>

                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-700">{enhancedPrediction.glucoseEstimate.returnToBaseline}</p>
                    <p className="text-xs text-slate-400">min to normal</p>
                  </div>
                </div>

                {enhancedPrediction?.ml && (
                  <p className="text-sm text-slate-600 mt-3">
                    ML Predicted glucose: <b>{Math.round(enhancedPrediction.ml.predicted_glucose)}</b> mg/dL
                    <span className="text-xs text-slate-400"> ({enhancedPrediction.ml.mode})</span>
                  </p>
                )}

                <p className="text-sm text-slate-600 mt-3">{enhancedPrediction.contextualPrediction}</p>
              </div>
            )}

            {/* Contributing Factors */}
            {enhancedPrediction && enhancedPrediction.factors.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setShowFactors(!showFactors)}
                  className="w-full p-3 flex items-center justify-between text-left"
                >
                  <span className="font-medium text-slate-700 text-sm">Health Factors Considered</span>
                  {showFactors ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {showFactors && (
                  <div className="px-3 pb-3 space-y-2">
                    {enhancedPrediction.factors.map((factor, i) => (
                      <div key={i} className={`p-2 rounded-lg text-sm ${getImpactColor(factor.impact)}`}>
                        <span className="font-medium">{factor.name}:</span> {factor.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recommendations */}
            {enhancedPrediction && enhancedPrediction.recommendations.length > 0 && (
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <h4 className="font-medium text-emerald-800 mb-2 text-sm">💡 Recommendations</h4>
                <ul className="space-y-1">
                  {enhancedPrediction.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-emerald-700">• {rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {enhancedPrediction && enhancedPrediction.warnings.length > 0 && (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                <h4 className="font-medium text-amber-800 mb-2 text-sm">⚠️ Warnings</h4>
                <ul className="space-y-1">
                  {enhancedPrediction.warnings.map((warn, i) => (
                    <li key={i} className="text-sm text-amber-700">• {warn}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Meal Type Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Meal Type</label>
              <div className="flex gap-2">
                {mealTypeOptions.map(option => (
                  <button
                    key={option.type}
                    onClick={() => setMealType(option.type)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${mealType === option.type
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                      }`}
                  >
                    {option.icon}
                    <span className="hidden sm:inline">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Portion Size Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Portion Size</label>
              <div className="flex gap-2">
                {portionOptions.map(option => (
                  <button
                    key={option.size}
                    onClick={() => setPortionSize(option.size)}
                    className={`flex-1 flex flex-col items-center justify-center py-2 px-2 rounded-lg text-sm font-medium transition-all ${portionSize === option.size
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                      }`}
                  >
                    <span className="text-lg">{option.emoji}</span>
                    <span className="text-xs">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Notes & Log Button */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Ate with coffee, smaller portion"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
              />
            </div>

            <button
              onClick={handleLogMeal}
              disabled={savedSuccess}
              className={`w-full py-4 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2 ${savedSuccess
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-800 text-white hover:bg-slate-900'
                }`}
            >
              <Check size={20} />
              <span>{savedSuccess ? 'Meal Logged!' : 'Log this Meal'}</span>
            </button>
          </div>
        )}

        {/* Recent Meals - Desktop */}
        {!analysis && (
          <div className="hidden lg:block mt-auto pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <History size={18} /> Meal History
              </h3>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${showFilters ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <Filter size={16} />
              </button>
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="mb-4 p-3 bg-slate-50 rounded-xl space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by food name..."
                    value={filter.searchTerm || ''}
                    onChange={(e) => setFilter(prev => ({ ...prev, searchTerm: e.target.value || undefined }))}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Meal Type Filter */}
                <div>
                  <p className="text-xs text-slate-500 mb-1">Meal Type</p>
                  <div className="flex flex-wrap gap-1">
                    {mealTypeOptions.map(option => (
                      <button
                        key={option.type}
                        onClick={() => setFilter(prev => ({
                          ...prev,
                          mealType: prev.mealType === option.type ? undefined : option.type
                        }))}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${filter.mealType === option.type
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* GI Filter */}
                <div>
                  <p className="text-xs text-slate-500 mb-1">Glycemic Index</p>
                  <div className="flex gap-1">
                    {(['Low', 'Medium', 'High'] as GlycemicIndex[]).map(gi => (
                      <button
                        key={gi}
                        onClick={() => setFilter(prev => ({
                          ...prev,
                          glycemicIndex: prev.glycemicIndex === gi ? undefined : gi
                        }))}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${filter.glycemicIndex === gi
                          ? gi === 'Low' ? 'bg-emerald-600 text-white' : gi === 'Medium' ? 'bg-orange-500 text-white' : 'bg-red-500 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        {gi}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear Filters */}
                {(filter.mealType || filter.glycemicIndex || filter.searchTerm) && (
                  <button
                    onClick={() => setFilter({})}
                    className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <X size={12} /> Clear filters
                  </button>
                )}
              </div>
            )}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {recentMeals.length > 0 ? (
                recentMeals.map(meal => (
                  <MealHistoryItem key={meal.id} meal={meal} onDelete={deleteMeal} formatTime={formatTime} />
                ))
              ) : (
                <p className="text-slate-400 text-sm">No meals logged yet</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Meal History Item Component
const MealHistoryItem: React.FC<{
  meal: any;
  onDelete: (id: string) => void;
  formatTime: (timestamp: string) => string;
}> = ({ meal, onDelete, formatTime }) => {
  const getMealTypeEmoji = (type?: string) => {
    switch (type) {
      case 'breakfast': return '☕';
      case 'lunch': return '☀️';
      case 'dinner': return '🌙';
      case 'snack': return '🍪';
      default: return '🍽️';
    }
  };

  return (
    <div className="bg-white p-3 rounded-xl flex items-center justify-between group">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-lg">{getMealTypeEmoji(meal.mealType)}</span>
        <div className="min-w-0">
          <p className="font-medium text-slate-800 truncate">{meal.analysis.foodName}</p>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{formatTime(meal.timestamp)}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${meal.analysis.glycemicIndex === 'Low' ? 'bg-emerald-100 text-emerald-600' :
              meal.analysis.glycemicIndex === 'Medium' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'
              }`}>
              {meal.analysis.glycemicIndex} GI
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-700">{meal.analysis.estimatedCarbs}g</p>
          <p className="text-[10px] text-slate-400">{meal.analysis.estimatedCalories || 0} cal</p>
        </div>
        <button
          onClick={() => onDelete(meal.id)}
          className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

const SparklesIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 3.214L13 21l-2.286-6.857L5 12l5.714-3.214z" />
  </svg>
);

export default MealLogger;