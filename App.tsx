import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import MealLogger from './components/MealLogger';
import HealthLog from './components/HealthLog';
import Insights from './components/Insights';
import { PageView } from './types';
import { predictGlucose } from "./services/predictApi";

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
      <>
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={async () => {
              console.log("API_BASE", import.meta.env.VITE_API_BASE);
              try {
                // Generate 60 mins of sample data (12 points at 5-min intervals)
                const now = new Date();
                const sampleData = Array.from({ length: 12 }, (_, i) => {
                  const ts = new Date(now.getTime() - (11 - i) * 5 * 60 * 1000);
                  return {
                    ts: ts.toISOString(),
                    value: 120 + Math.floor(Math.random() * 30)
                  };
                });
                
                const r = await predictGlucose({
                  user_id: "001",
                  meal_type: "Lunch",
                  glucose: sampleData,
                });

                console.log("PREDICT:", r);
                alert("Predict OK — console'a bak (F12)");
              } catch (err) {
                console.error(err);
                alert("Predict failed: " + (err as Error).message);
              }
            }}
          >
            Test Predict
          </button>
        </div>
        {renderPage()}
      </>
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