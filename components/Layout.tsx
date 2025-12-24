import React, { useState } from 'react';
import { PageView, UserProfile } from '../types';
import { LayoutDashboard, Utensils, Activity, Sparkles, Menu, X, Settings, User } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: PageView;
  onNavigate: (page: PageView) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  user: UserProfile;
}

const Layout: React.FC<LayoutProps> = ({ children, currentPage, onNavigate, apiKey, setApiKey, user }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(!apiKey);

  const NavItem = ({ page, icon: Icon, label }: { page: PageView; icon: any; label: string }) => (
    <button
      onClick={() => {
        onNavigate(page);
        setSidebarOpen(false);
      }}
      className={`flex items-center space-x-3 w-full p-3 rounded-lg transition-colors ${
        currentPage === page
          ? 'bg-blue-600 text-white shadow-md'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 w-full bg-white border-b border-slate-200 z-20 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-orange-400 rounded-lg flex items-center justify-center text-white font-bold">D</div>
          <span className="font-bold text-xl text-slate-800 tracking-tight">Dia-Log</span>
        </div>
        <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-slate-600 p-1">
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative inset-y-0 left-0 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out z-30 flex flex-col ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6 hidden lg:flex items-center space-x-3 border-b border-slate-100">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">D</div>
          <div>
            <h1 className="font-bold text-xl text-slate-900 tracking-tight">Dia-Log</h1>
            <p className="text-xs text-slate-500">Glycemic Intelligence</p>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-2 mt-14 lg:mt-0 overflow-y-auto">
          <div className="mb-6 px-3">
             <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="bg-blue-100 p-2 rounded-full">
                    <User size={16} className="text-blue-600" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.diabetesType}</p>
                </div>
             </div>
          </div>

          <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Menu</p>
          <NavItem page={PageView.DASHBOARD} icon={LayoutDashboard} label="Dashboard" />
          <NavItem page={PageView.MEAL_LOG} icon={Utensils} label="Meal Analysis" />
          <NavItem page={PageView.HEALTH_LOG} icon={Activity} label="Health Log" />
          <NavItem page={PageView.INSIGHTS} icon={Sparkles} label="AI Predictions" />
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="space-y-3">
            {!apiKey ? (
               <button 
                onClick={() => setShowKeyInput(true)}
                className="w-full text-xs text-red-500 flex items-center justify-center space-x-1 border border-red-200 p-2 rounded hover:bg-red-50"
               >
                 <span>⚠️ API Key Missing</span>
               </button>
            ) : (
                <div className="flex items-center space-x-2 text-green-600 text-xs px-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Gemini Connected</span>
                </div>
            )}
            <button 
                onClick={() => setShowKeyInput(true)}
                className="flex items-center space-x-2 text-slate-500 hover:text-slate-800 transition-colors w-full px-3 py-2 text-sm"
            >
                <Settings size={16} />
                <span>Settings</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pt-16 lg:pt-0 relative">
        <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-full">
          {children}
        </div>
      </main>

      {/* API Key Modal */}
      {showKeyInput && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-slate-800">Gemini API Configuration</h2>
            <p className="text-sm text-slate-600 mb-4">
              Dia-Log uses Google's Gemini models to analyze your food and predict glucose trends. 
              The key is stored locally in your browser session.
            </p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Gemini API Key"
              className="w-full border border-slate-300 rounded-lg p-3 mb-4 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
            />
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowKeyInput(false)}
                className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={() => setShowKeyInput(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-md shadow-blue-200"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;