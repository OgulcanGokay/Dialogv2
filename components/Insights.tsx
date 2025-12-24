import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { buildHealthContext, generateDailyHealthInsight } from '../services/aiAgentService';
import { HealthContext, DailyInsight } from '../types';
import { Sparkles, RefreshCw, MessageSquareQuote, TrendingUp, Moon, Activity, Utensils, Zap, AlertTriangle, CheckCircle, Target, Brain } from 'lucide-react';

const Insights: React.FC = () => {
    const { apiKey, user, meals, glucose, activities, moods, sleep, getDailyStats } = useApp();

    const [insight, setInsight] = useState<DailyInsight | null>(null);
    const [healthContext, setHealthContext] = useState<HealthContext | null>(null);
    const [loading, setLoading] = useState(false);

    const stats = getDailyStats();

    // Build health context on mount and when data changes
    useEffect(() => {
        const context = buildHealthContext(user, sleep, moods, activities, meals);
        setHealthContext(context);
    }, [user, sleep, moods, activities, meals]);

    const handleGenerate = async () => {
        if (!healthContext) return;

        setLoading(true);
        try {
            const recentGlucose = glucose.slice(0, 10).map(g => ({
                value: g.value,
                timestamp: g.timestamp
            }));

            const result = await generateDailyHealthInsight(
                apiKey,
                healthContext,
                meals,
                recentGlucose
            );
            setInsight(result);
        } catch (e) {
            console.error(e);
            setInsight({
                summary: "Unable to generate insights at this time. Keep logging your health data!",
                riskLevel: healthContext.overallRisk,
                keyPatterns: [],
                recommendations: ["Continue tracking your meals, sleep, and activities"],
                encouragement: "Every day of tracking brings you closer to better health!"
            });
        } finally {
            setLoading(false);
        }
    };

    const getRiskColor = (risk: string) => {
        switch (risk) {
            case 'low': return { bg: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50' };
            case 'moderate': return { bg: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-50' };
            case 'high': return { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50' };
            default: return { bg: 'bg-slate-500', text: 'text-slate-700', light: 'bg-slate-50' };
        }
    };

    const getImpactIcon = (impact: string) => {
        switch (impact) {
            case 'positive': return <CheckCircle className="text-emerald-500" size={18} />;
            case 'negative': return <AlertTriangle className="text-red-500" size={18} />;
            default: return <Target className="text-slate-400" size={18} />;
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-2xl mb-4 text-indigo-600">
                    <Brain size={32} />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">AI Health Analysis</h2>
                <p className="text-slate-500 max-w-lg mx-auto">
                    Your personalized diabetes insights based on meals, mood, sleep, and activity data.
                </p>
            </div>

            {/* Health Context Overview */}
            {healthContext && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                            <Activity size={20} className="text-indigo-500" />
                            Today's Health Context
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold text-white ${getRiskColor(healthContext.overallRisk).bg}`}>
                            {healthContext.overallRisk.toUpperCase()} RISK
                        </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {/* Sleep Factor */}
                        <div className={`p-4 rounded-xl border ${healthContext.sleep ? 'border-indigo-100 bg-indigo-50' : 'border-slate-100 bg-slate-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <Moon size={18} className={healthContext.sleep ? 'text-indigo-600' : 'text-slate-400'} />
                                {healthContext.sleep && getImpactIcon(healthContext.sleep.impact)}
                            </div>
                            <p className="font-semibold text-slate-800">Sleep</p>
                            {healthContext.sleep ? (
                                <>
                                    <p className="text-2xl font-bold text-indigo-600">{healthContext.sleep.duration}h</p>
                                    <p className="text-xs text-slate-500 capitalize">{healthContext.sleep.quality} quality</p>
                                </>
                            ) : (
                                <p className="text-sm text-slate-400 mt-2">No data</p>
                            )}
                        </div>

                        {/* Mood/Stress Factor */}
                        <div className={`p-4 rounded-xl border ${healthContext.mood ? 'border-yellow-100 bg-yellow-50' : 'border-slate-100 bg-slate-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <Zap size={18} className={healthContext.mood ? 'text-yellow-600' : 'text-slate-400'} />
                                {healthContext.mood && getImpactIcon(healthContext.mood.impact)}
                            </div>
                            <p className="font-semibold text-slate-800">Stress</p>
                            {healthContext.mood ? (
                                <>
                                    <p className="text-2xl font-bold text-yellow-600">{healthContext.mood.stressLevel}/10</p>
                                    <p className="text-xs text-slate-500">Mood: {healthContext.mood.level}/10</p>
                                </>
                            ) : (
                                <p className="text-sm text-slate-400 mt-2">No data</p>
                            )}
                        </div>

                        {/* Activity Factor */}
                        <div className={`p-4 rounded-xl border ${healthContext.activity ? 'border-orange-100 bg-orange-50' : 'border-slate-100 bg-slate-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <Activity size={18} className={healthContext.activity ? 'text-orange-600' : 'text-slate-400'} />
                                {healthContext.activity && getImpactIcon(healthContext.activity.impact)}
                            </div>
                            <p className="font-semibold text-slate-800">Activity</p>
                            {healthContext.activity ? (
                                <>
                                    <p className="text-2xl font-bold text-orange-600">{healthContext.activity.totalMinutes}</p>
                                    <p className="text-xs text-slate-500">minutes today</p>
                                </>
                            ) : (
                                <p className="text-sm text-slate-400 mt-2">No data</p>
                            )}
                        </div>

                        {/* Meals Factor */}
                        <div className="p-4 rounded-xl border border-purple-100 bg-purple-50">
                            <div className="flex items-center gap-2 mb-2">
                                <Utensils size={18} className="text-purple-600" />
                            </div>
                            <p className="font-semibold text-slate-800">Meals</p>
                            <p className="text-2xl font-bold text-purple-600">{healthContext.mealHistory.mealCount}</p>
                            <p className="text-xs text-slate-500">{healthContext.mealHistory.totalCarbs}g carbs</p>
                        </div>
                    </div>

                    {/* Risk & Protective Factors */}
                    <div className="grid md:grid-cols-2 gap-4">
                        {healthContext.riskFactors.length > 0 && (
                            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                                <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                                    <AlertTriangle size={16} /> Risk Factors
                                </h4>
                                <ul className="space-y-1">
                                    {healthContext.riskFactors.map((factor, i) => (
                                        <li key={i} className="text-sm text-red-700">• {factor}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {healthContext.protectiveFactors.length > 0 && (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                                <h4 className="font-medium text-emerald-800 mb-2 flex items-center gap-2">
                                    <CheckCircle size={16} /> Protective Factors
                                </h4>
                                <ul className="space-y-1">
                                    {healthContext.protectiveFactors.map((factor, i) => (
                                        <li key={i} className="text-sm text-emerald-700">• {factor}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
                    <Utensils className="mx-auto text-purple-500 mb-2" size={24} />
                    <p className="text-2xl font-bold text-slate-800">{meals.length}</p>
                    <p className="text-xs text-slate-400">Meals Logged</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
                    <Activity className="mx-auto text-orange-500 mb-2" size={24} />
                    <p className="text-2xl font-bold text-slate-800">{activities.length}</p>
                    <p className="text-xs text-slate-400">Activities</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
                    <Moon className="mx-auto text-indigo-500 mb-2" size={24} />
                    <p className="text-2xl font-bold text-slate-800">{sleep.length}</p>
                    <p className="text-xs text-slate-400">Sleep Logs</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
                    <TrendingUp className="mx-auto text-emerald-500 mb-2" size={24} />
                    <p className="text-2xl font-bold text-slate-800">{stats.timeInRange || '--'}%</p>
                    <p className="text-xs text-slate-400">Time in Range</p>
                </div>
            </div>

            {/* AI Insight Generation */}
            {!insight ? (
                <div className="flex flex-col items-center">
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className={`
              group relative px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full font-bold text-lg shadow-lg hover:shadow-indigo-200 transition-all transform hover:-translate-y-1 overflow-hidden
              ${loading ? 'opacity-80 cursor-wait' : ''}
            `}
                    >
                        <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-700 ease-in-out -skew-x-12 origin-left"></div>
                        <div className="flex items-center space-x-3">
                            {loading ? <RefreshCw className="animate-spin" /> : <Sparkles />}
                            <span>{loading ? 'Analyzing your data...' : 'Generate AI Insights'}</span>
                        </div>
                    </button>

                    <p className="mt-4 text-sm text-slate-400 text-center max-w-md">
                        Our AI will analyze your health context and provide personalized recommendations for better glucose control.
                    </p>
                </div>
            ) : (
                <div className="animate-fadeIn space-y-6">
                    {/* Main Insight Card */}
                    <div className={`rounded-3xl p-8 shadow-xl relative overflow-hidden ${getRiskColor(insight.riskLevel).light} border ${insight.riskLevel === 'low' ? 'border-emerald-200' : insight.riskLevel === 'high' ? 'border-red-200' : 'border-orange-200'}`}>
                        <div className="absolute top-0 right-0 p-32 bg-white/30 rounded-full blur-3xl -mr-16 -mt-16"></div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <MessageSquareQuote size={32} className={getRiskColor(insight.riskLevel).text} />
                                <span className={`px-3 py-1 rounded-full text-sm font-bold text-white ${getRiskColor(insight.riskLevel).bg}`}>
                                    {insight.riskLevel.toUpperCase()} RISK TODAY
                                </span>
                            </div>

                            <h3 className="text-xl md:text-2xl font-semibold text-slate-800 leading-relaxed mb-6">
                                {insight.summary}
                            </h3>

                            {/* Key Patterns */}
                            {insight.keyPatterns.length > 0 && (
                                <div className="mb-6">
                                    <h4 className="font-medium text-slate-700 mb-2">📊 Key Patterns Detected</h4>
                                    <ul className="space-y-1">
                                        {insight.keyPatterns.map((pattern, i) => (
                                            <li key={i} className="text-slate-600 text-sm">• {pattern}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Recommendations */}
                            {insight.recommendations.length > 0 && (
                                <div className="bg-white/70 rounded-xl p-4 mb-4">
                                    <h4 className="font-medium text-slate-700 mb-2">💡 Personalized Recommendations</h4>
                                    <ul className="space-y-2">
                                        {insight.recommendations.map((rec, i) => (
                                            <li key={i} className="text-slate-600 text-sm flex items-start gap-2">
                                                <span className="text-indigo-500 font-bold">{i + 1}.</span>
                                                {rec}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Encouragement */}
                            <div className="pt-4 border-t border-slate-200/50">
                                <p className="text-slate-600 italic">✨ {insight.encouragement}</p>
                            </div>
                        </div>
                    </div>

                    {/* Generate New Button */}
                    <div className="text-center">
                        <button
                            onClick={() => setInsight(null)}
                            className="text-indigo-600 font-semibold hover:underline"
                        >
                            Generate New Insight
                        </button>
                    </div>

                    {/* Action Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <h4 className="font-medium text-blue-800 mb-2">🎯 Focus Area</h4>
                            <p className="text-sm text-blue-600">
                                {healthContext?.riskFactors[0] || "Keep logging data consistently to identify areas for improvement."}
                            </p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                            <h4 className="font-medium text-purple-800 mb-2">📱 Track More</h4>
                            <p className="text-sm text-purple-600">
                                {!healthContext?.sleep ? "Log your sleep for better predictions" :
                                    !healthContext?.mood ? "Track your mood to understand stress impact" :
                                        !healthContext?.activity ? "Log activities to see exercise benefits" :
                                            "Great job! Keep tracking all your health factors."}
                            </p>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                            <h4 className="font-medium text-emerald-800 mb-2">✅ Today's Goal</h4>
                            <p className="text-sm text-emerald-600">
                                {healthContext?.overallRisk === 'high' ? "Focus on stress reduction and light activity" :
                                    healthContext?.overallRisk === 'moderate' ? "Maintain your current routine with mindful eating" :
                                        "Keep up the excellent work with your healthy habits!"}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Insights;