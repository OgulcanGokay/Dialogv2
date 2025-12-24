import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ActivityType, Intensity, SleepQuality } from '../types';
import { Activity, Moon, Zap, Save, Trash2, Smile, Frown, Meh } from 'lucide-react';
import { getCurrentTimestamp } from '../services/dataService';

type TabType = 'activity' | 'sleep' | 'mood';

const HealthLog: React.FC = () => {
  const {
    activities, moods, sleep,
    addActivity, addMood, addSleep,
    deleteActivity, deleteMood, deleteSleep,
    getRecentLogs
  } = useApp();

  const [activeTab, setActiveTab] = useState<TabType>('activity');

  // Activity Form State
  const [activityType, setActivityType] = useState<ActivityType>('walking');
  const [activityDuration, setActivityDuration] = useState<number>(30);
  const [activityIntensity, setActivityIntensity] = useState<Intensity>('moderate');
  const [activityNotes, setActivityNotes] = useState('');

  // Sleep Form State
  const [sleepDuration, setSleepDuration] = useState<number>(7);
  const [sleepQuality, setSleepQuality] = useState<SleepQuality>('good');
  const [sleepInterruptions, setSleepInterruptions] = useState<number>(0);
  const [sleepNotes, setSleepNotes] = useState('');

  // Mood Form State
  const [moodLevel, setMoodLevel] = useState<number>(5);
  const [stressLevel, setStressLevel] = useState<number>(5);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [moodNotes, setMoodNotes] = useState('');

  const recentLogs = getRecentLogs(10);

  const handleAddActivity = () => {
    addActivity({
      timestamp: getCurrentTimestamp(),
      type: activityType,
      duration: activityDuration,
      intensity: activityIntensity,
      notes: activityNotes || undefined
    });
    // Reset form
    setActivityDuration(30);
    setActivityNotes('');
  };

  const handleAddSleep = () => {
    addSleep({
      timestamp: getCurrentTimestamp(),
      duration: sleepDuration,
      quality: sleepQuality,
      interruptions: sleepInterruptions,
      notes: sleepNotes || undefined
    });
    // Reset form
    setSleepDuration(7);
    setSleepInterruptions(0);
    setSleepNotes('');
  };

  const handleAddMood = () => {
    addMood({
      timestamp: getCurrentTimestamp(),
      level: moodLevel,
      stressLevel: stressLevel,
      emotions: selectedEmotions,
      notes: moodNotes || undefined
    });
    // Reset form
    setMoodLevel(5);
    setStressLevel(5);
    setSelectedEmotions([]);
    setMoodNotes('');
  };

  const toggleEmotion = (emotion: string) => {
    setSelectedEmotions(prev =>
      prev.includes(emotion)
        ? prev.filter(e => e !== emotion)
        : [...prev, emotion]
    );
  };

  const emotions = [
    { id: 'happy', label: '😊 Happy' },
    { id: 'calm', label: '😌 Calm' },
    { id: 'anxious', label: '😰 Anxious' },
    { id: 'stressed', label: '😤 Stressed' },
    { id: 'tired', label: '😴 Tired' },
    { id: 'energetic', label: '⚡ Energetic' },
    { id: 'sad', label: '😢 Sad' },
    { id: 'irritable', label: '😠 Irritable' }
  ];

  const activityTypes: { value: ActivityType; label: string; emoji: string }[] = [
    { value: 'walking', label: 'Walking', emoji: '🚶' },
    { value: 'running', label: 'Running', emoji: '🏃' },
    { value: 'cycling', label: 'Cycling', emoji: '🚴' },
    { value: 'swimming', label: 'Swimming', emoji: '🏊' },
    { value: 'strength', label: 'Strength', emoji: '🏋️' },
    { value: 'yoga', label: 'Yoga', emoji: '🧘' },
    { value: 'other', label: 'Other', emoji: '💪' }
  ];

  const handleDeleteLog = (log: any) => {
    switch (log.type) {
      case 'activity':
        deleteActivity(log.id);
        break;
      case 'mood':
        deleteMood(log.id);
        break;
      case 'sleep':
        deleteSleep(log.id);
        break;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'activity': return <Activity size={18} className="text-orange-500" />;
      case 'sleep': return <Moon size={18} className="text-indigo-500" />;
      case 'mood': return <Zap size={18} className="text-yellow-500" />;
      default: return <Activity size={18} />;
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Health Log</h2>
        <p className="text-slate-500">Track lifestyle factors to improve AI predictions.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${activeTab === 'activity' ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Activity size={18} />
            <span>Activity</span>
          </button>
          <button
            onClick={() => setActiveTab('sleep')}
            className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${activeTab === 'sleep' ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-500' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Moon size={18} />
            <span>Sleep</span>
          </button>
          <button
            onClick={() => setActiveTab('mood')}
            className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${activeTab === 'mood' ? 'bg-yellow-50 text-yellow-600 border-b-2 border-yellow-500' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Zap size={18} />
            <span>Mood</span>
          </button>
        </div>

        {/* Activity Form */}
        {activeTab === 'activity' && (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Activity Type
              </label>
              <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                {activityTypes.map(type => (
                  <button
                    key={type.value}
                    onClick={() => setActivityType(type.value)}
                    className={`p-3 rounded-xl text-center transition-all ${activityType === type.value
                        ? 'bg-orange-100 border-2 border-orange-500 text-orange-700'
                        : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                      }`}
                  >
                    <span className="text-2xl block">{type.emoji}</span>
                    <span className="text-xs mt-1 block">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={activityDuration}
                  onChange={(e) => setActivityDuration(Number(e.target.value))}
                  min="1"
                  max="300"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Intensity
                </label>
                <select
                  value={activityIntensity}
                  onChange={(e) => setActivityIntensity(e.target.value as Intensity)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-700"
                >
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Notes (optional)
              </label>
              <input
                type="text"
                value={activityNotes}
                onChange={(e) => setActivityNotes(e.target.value)}
                placeholder="e.g., Morning jog in the park"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-700"
              />
            </div>

            <button
              onClick={handleAddActivity}
              className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600 transition-colors flex items-center justify-center space-x-2"
            >
              <Save size={20} />
              <span>Log Activity</span>
            </button>
          </div>
        )}

        {/* Sleep Form */}
        {activeTab === 'sleep' && (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Sleep Duration: {sleepDuration} hours
              </label>
              <input
                type="range"
                value={sleepDuration}
                onChange={(e) => setSleepDuration(Number(e.target.value))}
                min="1"
                max="12"
                step="0.5"
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>1h</span>
                <span>6h</span>
                <span>12h</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Sleep Quality
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['poor', 'fair', 'good', 'excellent'] as SleepQuality[]).map(quality => (
                  <button
                    key={quality}
                    onClick={() => setSleepQuality(quality)}
                    className={`p-3 rounded-xl text-center capitalize transition-all ${sleepQuality === quality
                        ? 'bg-indigo-100 border-2 border-indigo-500 text-indigo-700'
                        : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                      }`}
                  >
                    {quality === 'poor' && <Frown className="mx-auto mb-1 text-red-400" size={24} />}
                    {quality === 'fair' && <Meh className="mx-auto mb-1 text-orange-400" size={24} />}
                    {quality === 'good' && <Smile className="mx-auto mb-1 text-green-400" size={24} />}
                    {quality === 'excellent' && <Smile className="mx-auto mb-1 text-emerald-400" size={24} />}
                    <span className="text-sm">{quality}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Interruptions: {sleepInterruptions}
              </label>
              <input
                type="range"
                value={sleepInterruptions}
                onChange={(e) => setSleepInterruptions(Number(e.target.value))}
                min="0"
                max="10"
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Notes (optional)
              </label>
              <input
                type="text"
                value={sleepNotes}
                onChange={(e) => setSleepNotes(e.target.value)}
                placeholder="e.g., Woke up feeling rested"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
              />
            </div>

            <button
              onClick={handleAddSleep}
              className="w-full bg-indigo-500 text-white py-3 rounded-xl font-medium hover:bg-indigo-600 transition-colors flex items-center justify-center space-x-2"
            >
              <Save size={20} />
              <span>Log Sleep</span>
            </button>
          </div>
        )}

        {/* Mood Form */}
        {activeTab === 'mood' && (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Overall Mood: {moodLevel}/10
              </label>
              <input
                type="range"
                value={moodLevel}
                onChange={(e) => setMoodLevel(Number(e.target.value))}
                min="1"
                max="10"
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>😞 Low</span>
                <span>😐 Neutral</span>
                <span>😊 Great</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Stress Level: {stressLevel}/10
              </label>
              <input
                type="range"
                value={stressLevel}
                onChange={(e) => setStressLevel(Number(e.target.value))}
                min="1"
                max="10"
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>😌 Relaxed</span>
                <span>😐 Moderate</span>
                <span>😤 High</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                How are you feeling? (select all that apply)
              </label>
              <div className="flex flex-wrap gap-2">
                {emotions.map(emotion => (
                  <button
                    key={emotion.id}
                    onClick={() => toggleEmotion(emotion.id)}
                    className={`px-3 py-2 rounded-full text-sm transition-all ${selectedEmotions.includes(emotion.id)
                        ? 'bg-yellow-100 border-2 border-yellow-500 text-yellow-700'
                        : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                      }`}
                  >
                    {emotion.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Notes (optional)
              </label>
              <input
                type="text"
                value={moodNotes}
                onChange={(e) => setMoodNotes(e.target.value)}
                placeholder="e.g., Busy day at work"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 text-slate-700"
              />
            </div>

            <button
              onClick={handleAddMood}
              className="w-full bg-yellow-500 text-white py-3 rounded-xl font-medium hover:bg-yellow-600 transition-colors flex items-center justify-center space-x-2"
            >
              <Save size={20} />
              <span>Log Mood</span>
            </button>
          </div>
        )}
      </div>

      {/* Recent Logs */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-800 text-lg">Recent Health Logs</h3>
        {recentLogs.filter(log => log.type !== 'meal').length > 0 ? (
          recentLogs
            .filter(log => log.type !== 'meal')
            .map((log) => (
              <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between group animate-fadeIn">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-full ${log.type === 'activity' ? 'bg-orange-100' :
                      log.type === 'sleep' ? 'bg-indigo-100' : 'bg-yellow-100'
                    }`}>
                    {getIcon(log.type)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800 capitalize">{log.type}</p>
                    <p className="text-sm text-slate-500">{log.details}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400">{formatTime(log.timestamp)}</span>
                  <button
                    onClick={() => handleDeleteLog(log)}
                    className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
        ) : (
          <div className="bg-slate-50 p-8 rounded-xl text-center text-slate-400">
            <p>No health logs yet. Start tracking your activity, sleep, and mood!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthLog;