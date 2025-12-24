import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import MealLogger from './components/MealLogger';
import HealthLog from './components/HealthLog';
import Insights from './components/Insights';
import { PageView } from './types';

// Inner app component that uses the context
const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageView>(PageView.DASHBOARD);
  const { user, apiKey, setApiKey, isLoading } = useApp();

  const renderPage = () => {
    switch (currentPage) {
      case PageView.DASHBOARD:
        return <Dashboard />;
      case PageView.MEAL_LOG:
        return <MealLogger />;
      case PageView.HEALTH_LOG:
        return <HealthLog />;
      case PageView.INSIGHTS:
        return <Insights />;
      default:
        return <Dashboard />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading Dia-Log...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      apiKey={apiKey}
      setApiKey={setApiKey}
      user={user}
    >
      {renderPage()}
    </Layout>
  );
};

// Main App component wrapped with provider
const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;