import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useApp } from '../context/AppContext';
import { buildHealthContext, getPreMealWarnings } from '../services/aiAgentService';
import { GlucoseReading, HealthContext, GlucoseTrend } from '../types';
import { TrendingUp, AlertCircle, Droplet, Clock, Utensils, Activity, Moon, Zap, Brain, CheckCircle, Plus, Trash2, X } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user, glucose, meals, sleep, moods, activities, getTodaysMeals, getDailyStats, addGlucoseReading, deleteGlucoseReading,
    runPrediction, predictionResult, predictionLoading, predictionError } = useApp();
  const [healthContext, setHealthContext] = useState<HealthContext | null>(null);

  // Glucose entry form state
  const [showGlucoseForm, setShowGlucoseForm] = useState(false);
  const [glucoseValue, setGlucoseValue] = useState('');
  const [glucoseNotes, setGlucoseNotes] = useState('');
  const [glucoseTrend, setGlucoseTrend] = useState<GlucoseTrend>('stable');

  const stats = getDailyStats();
  const todaysMeals = getTodaysMeals();
  const currentGlucose = glucose.length > 0 ? glucose[0] : null;
  const currentValue = currentGlucose?.value || 0;
  const inRange = currentValue >= user.targetRange.min && currentValue <= user.targetRange.max;

  // Build health context
  useEffect(() => {
    const context = buildHealthContext(user, sleep, moods, activities, meals);
    setHealthContext(context);
  }, [user, sleep, moods, activities, meals]);

  // Transform glucose data for chart (last 24 readings, sorted chronologically)
  const chartData = [...glucose]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-24) // Take the last 24 readings
    .map((g, index) => ({
      time: new Date(g.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      glucose: g.value,
      trend: g.trend,
      index: index
    }));

  const warnings = healthContext ? getPreMealWarnings(healthContext) : [];

  const StatCard = ({ title, value, unit, icon: Icon, color, trend, subtitle }: any) => (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
          <Icon className={color.replace('bg-', 'text-')} size={20} />
        </div>
        {trend && <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">{trend}</span>}
      </div>
      <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
      <div className="flex items-baseline space-x-1 mt-1">
        <span className="text-2xl font-bold text-slate-800">{value}</span>
        <span className="text-xs text-slate-400">{unit}</span>
      </div>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );

  const getGlucoseStatus = () => {
    if (!currentGlucose) return { text: 'No data', color: 'text-slate-400' };
    if (currentValue < user.targetRange.min) return { text: 'Low', color: 'text-red-500' };
    if (currentValue > user.targetRange.max) return { text: 'High', color: 'text-orange-500' };
    return { text: 'In Range', color: 'text-emerald-500' };
  };

  const glucoseStatus = getGlucoseStatus();

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-emerald-500';
      case 'moderate': return 'bg-orange-500';
      case 'high': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'negative': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  // Handle glucose entry submission
  const handleAddGlucose = () => {
    const value = parseInt(glucoseValue);
    if (isNaN(value) || value < 20 || value > 600) {
      return; // Invalid reading
    }

    addGlucoseReading({
      value,
      timestamp: new Date().toISOString(),
      source: 'manual',
      trend: glucoseTrend,
      notes: glucoseNotes || undefined
    });

    // Reset form
    setGlucoseValue('');
    setGlucoseNotes('');
    setGlucoseTrend('stable');
    setShowGlucoseForm(false);
  };

  const getTodaysGlucoseReadings = () => {
    const today = new Date().toDateString();
    return glucose.filter(g => new Date(g.timestamp).toDateString() === today);
  };

  const todaysGlucose = getTodaysGlucoseReadings();

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Welcome back, {user.name.split(' ')[0]}</h2>
        <p className="text-slate-500">
          {healthContext?.overallRisk === 'low'
            ? "Your metabolic rhythm looks stable today."
            : healthContext?.overallRisk === 'high'
              ? "Some factors may affect your glucose control today."
              : "Let's work on improving your glucose control today."}
        </p>
      </header>

      {/* Prediction quick action */}
      <div className="mb-4">
        <button
          onClick={runPrediction}
          disabled={predictionLoading}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {predictionLoading ? 'Predicting...' : 'Predict Glucose'}
        </button>

        {predictionError && <p className="text-red-500 mt-2">{predictionError}</p>}

        {predictionResult && (
          <div className="mt-3 p-3 bg-white rounded-xl border border-slate-100 inline-block">
            <p className="text-sm">Mode: {predictionResult.mode} (n={predictionResult.n})</p>
            <p className="text-sm">Last: {predictionResult.last}</p>
            <p className="text-sm">Δ Pred: {predictionResult.delta.toFixed(2)}</p>
            <p className="text-sm font-bold">Predicted: {predictionResult.predicted.toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* AI Health Summary Card */}
      {healthContext && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Brain size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg">AI Health Analysis</h3>
                <p className="text-white/80 text-sm">Based on your recent data</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${healthContext.overallRisk === 'low' ? 'bg-emerald-400 text-emerald-900' :
              healthContext.overallRisk === 'moderate' ? 'bg-orange-400 text-orange-900' :
                'bg-red-400 text-red-900'
              }`}>
              {healthContext.overallRisk.toUpperCase()} RISK
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Sleep */}
            <div className={`p-3 rounded-xl ${healthContext.sleep ? 'bg-white/20' : 'bg-white/10'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Moon size={16} />
                <span className="text-sm font-medium">Sleep</span>
              </div>
              {healthContext.sleep ? (
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">{healthContext.sleep.duration}h</span>
                  <span className="text-xs opacity-80 capitalize">{healthContext.sleep.quality}</span>
                  {healthContext.sleep.impact === 'positive' && <CheckCircle size={14} className="text-emerald-300" />}
                </div>
              ) : (
                <span className="text-sm opacity-60">No data</span>
              )}
            </div>

            {/* Stress */}
            <div className={`p-3 rounded-xl ${healthContext.mood ? 'bg-white/20' : 'bg-white/10'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Zap size={16} />
                <span className="text-sm font-medium">Stress</span>
              </div>
              {healthContext.mood ? (
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">{healthContext.mood.stressLevel}/10</span>
                  {healthContext.mood.impact === 'positive' && <CheckCircle size={14} className="text-emerald-300" />}
                </div>
              ) : (
                <span className="text-sm opacity-60">No data</span>
              )}
            </div>

            {/* Activity */}
            <div className={`p-3 rounded-xl ${healthContext.activity ? 'bg-white/20' : 'bg-white/10'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Activity size={16} />
                <span className="text-sm font-medium">Activity</span>
              </div>
              {healthContext.activity ? (
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">{healthContext.activity.totalMinutes}</span>
                  <span className="text-xs opacity-80">min</span>
                  {healthContext.activity.impact === 'positive' && <CheckCircle size={14} className="text-emerald-300" />}
                </div>
              ) : (
                <span className="text-sm opacity-60">No data</span>
              )}
            </div>
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="mt-4 bg-white/10 rounded-xl p-3">
              <p className="text-sm font-medium mb-1">⚡ Current Alerts</p>
              {warnings.slice(0, 2).map((w, i) => (
                <p key={i} className="text-sm text-white/90">{w}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Current Glucose"
          value={currentValue || '--'}
          unit="mg/dL"
          icon={Droplet}
          color={inRange ? "bg-emerald-500" : "bg-orange-500"}
          trend={glucoseStatus.text}
        />
        <StatCard
          title="Time in Range"
          value={stats.timeInRange || '--'}
          unit="%"
          icon={Clock}
          color="bg-blue-500"
          subtitle={`Target: ${user.targetRange.min}-${user.targetRange.max}`}
        />
        <StatCard
          title="Daily Avg"
          value={stats.averageGlucose || '--'}
          unit="mg/dL"
          icon={TrendingUp}
          color="bg-indigo-500"
        />
        <StatCard
          title="Meals Today"
          value={stats.mealsLogged}
          unit={`(${stats.totalCarbs}g carbs)`}
          icon={Utensils}
          color="bg-purple-500"
        />
      </div>

      {/* Glucose Alerts */}
      {(stats.highReadings > 0 || stats.lowReadings > 0) && (
        <div className="flex gap-4">
          {stats.highReadings > 0 && (
            <div className="flex-1 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="text-orange-500" size={24} />
              <div>
                <p className="font-medium text-orange-700">{stats.highReadings} High Reading{stats.highReadings > 1 ? 's' : ''}</p>
                <p className="text-sm text-orange-600">Above {user.targetRange.max} mg/dL today</p>
              </div>
            </div>
          )}
          {stats.lowReadings > 0 && (
            <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="text-red-500" size={24} />
              <div>
                <p className="font-medium text-red-700">{stats.lowReadings} Low Reading{stats.lowReadings > 1 ? 's' : ''}</p>
                <p className="text-sm text-red-600">Below {user.targetRange.min} mg/dL today</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Glucose Entry Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Droplet size={20} className="text-blue-500" /> Blood Sugar Tracking
          </h3>
          <button
            onClick={() => setShowGlucoseForm(!showGlucoseForm)}
            className={`p-2 rounded-lg transition-colors ${showGlucoseForm ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
          >
            {showGlucoseForm ? <X size={18} /> : <Plus size={18} />}
          </button>
        </div>

        {/* Quick Entry Form */}
        {showGlucoseForm && (
          <div className="mb-4 p-4 bg-slate-50 rounded-xl space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Glucose (mg/dL)</label>
                <input
                  type="number"
                  value={glucoseValue}
                  onChange={(e) => setGlucoseValue(e.target.value)}
                  placeholder="e.g., 120"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={20}
                  max={600}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Trend</label>
                <select
                  value={glucoseTrend}
                  onChange={(e) => setGlucoseTrend(e.target.value as GlucoseTrend)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="stable">→ Stable</option>
                  <option value="rising">↗ Rising</option>
                  <option value="falling">↘ Falling</option>
                  <option value="rising-rapidly">↑ Rising Rapidly</option>
                  <option value="falling-rapidly">↓ Falling Rapidly</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={glucoseNotes}
                onChange={(e) => setGlucoseNotes(e.target.value)}
                placeholder="e.g., Before breakfast, After exercise"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleAddGlucose}
              disabled={!glucoseValue || parseInt(glucoseValue) < 20}
              className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              Add Reading
            </button>
          </div>
        )}

        {/* Today's Readings */}
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {todaysGlucose.length > 0 ? (
            todaysGlucose.map(reading => (
              <div key={reading.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg group">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${reading.value < user.targetRange.min ? 'bg-red-100 text-red-600' :
                    reading.value > user.targetRange.max ? 'bg-orange-100 text-orange-600' :
                      'bg-emerald-100 text-emerald-600'
                    }`}>
                    {reading.value}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      <span className="text-slate-400 ml-2 text-xs">
                        {reading.trend === 'stable' && '→'}
                        {reading.trend === 'rising' && '↗'}
                        {reading.trend === 'falling' && '↘'}
                        {reading.trend === 'rising-rapidly' && '↑↑'}
                        {reading.trend === 'falling-rapidly' && '↓↓'}
                      </span>
                    </p>
                    {reading.notes && <p className="text-xs text-slate-400">{reading.notes}</p>}
                  </div>
                </div>
                <button
                  onClick={() => deleteGlucoseReading(reading.id)}
                  className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          ) : (
            <p className="text-center text-slate-400 py-4 text-sm">
              No readings today. Tap + to add one.
            </p>
          )}
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <ActivityIcon /> Glucose Trends (24h)
          </h3>
          <div className="flex space-x-4">
            <span className="flex items-center text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-orange-400 mr-1"></span> Glucose
            </span>
            <span className="flex items-center text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1"></span> Target Range
            </span>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="w-full h-64 min-h-[256px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGlucose" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="index"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  tickFormatter={(index) => chartData[index]?.time || ''}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'white', padding: '8px 12px' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white rounded-lg shadow-lg p-2 border border-slate-100">
                          <p className="text-xs text-slate-500">{data.time}</p>
                          <p className="text-lg font-bold text-orange-500">{data.glucose} mg/dL</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={user.targetRange.max} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />
                <ReferenceLine y={user.targetRange.min} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Area
                  type="monotone"
                  dataKey="glucose"
                  stroke="#f97316"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorGlucose)"
                  dot={false}
                  activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: '#f97316' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Activity size={48} className="mx-auto mb-4 opacity-30" />
              <p>No glucose data yet</p>
              <p className="text-sm">CGM data will appear here once available</p>
            </div>
          </div>
        )}
      </div>

      {/* Today's Meals */}
      {todaysMeals.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Utensils size={20} className="text-purple-500" /> Today's Meals
          </h3>
          <div className="space-y-3">
            {todaysMeals.map(meal => (
              <div key={meal.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  {meal.imageThumbnail && (
                    <img
                      src={meal.imageThumbnail}
                      alt={meal.analysis.foodName}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <p className="font-medium text-slate-800">{meal.analysis.foodName}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(meal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800">{meal.analysis.estimatedCarbs}g</p>
                  <p className="text-xs text-slate-400">carbs</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Tips Based on Context */}
      {healthContext && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            💡 Smart Tips for Today
          </h3>
          <div className="grid md:grid-cols-3 gap-3">
            {healthContext.sleep?.impact === 'negative' && (
              <div className="bg-white p-3 rounded-xl text-sm text-slate-600">
                <span className="font-medium text-indigo-600">Sleep tip:</span> Consider lighter meals today as poor sleep can increase insulin resistance.
              </div>
            )}
            {healthContext.mood?.stressLevel && healthContext.mood.stressLevel >= 6 && (
              <div className="bg-white p-3 rounded-xl text-sm text-slate-600">
                <span className="font-medium text-indigo-600">Stress tip:</span> Try deep breathing before meals to help with digestion and glucose control.
              </div>
            )}
            {(!healthContext.activity || healthContext.activity.totalMinutes < 20) && (
              <div className="bg-white p-3 rounded-xl text-sm text-slate-600">
                <span className="font-medium text-indigo-600">Activity tip:</span> A 10-15 minute walk after meals can significantly reduce glucose spikes.
              </div>
            )}
            {healthContext.mealHistory.totalCarbs > 100 && (
              <div className="bg-white p-3 rounded-xl text-sm text-slate-600">
                <span className="font-medium text-indigo-600">Meal tip:</span> You've had {healthContext.mealHistory.totalCarbs}g carbs today. Consider protein-focused options for your next meal.
              </div>
            )}
            {healthContext.protectiveFactors.length > 0 && (
              <div className="bg-white p-3 rounded-xl text-sm text-slate-600">
                <span className="font-medium text-emerald-600">Great job!</span> {healthContext.protectiveFactors[0]}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper icon
const ActivityIcon = () => (
  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
  </svg>
)

export default Dashboard;