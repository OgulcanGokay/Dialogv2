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
              try {
                const r = await predictGlucose({
                  user_id: "001",
                  meal_type: "Lunch",
                  glucose: [
                    { ts: "2025-12-26T12:00:00", value: 120 },
                    { ts: "2025-12-26T12:05:00", value: 125 },
                    { ts: "2025-12-26T12:10:00", value: 131 },
                    { ts: "2025-12-26T12:15:00", value: 128 },
                    { ts: "2025-12-26T12:20:00", value: 135 },
                    { ts: "2025-12-26T12:25:00", value: 140 },
                    { ts: "2025-12-26T12:30:00", value: 142 },
                    { ts: "2025-12-26T12:35:00", value: 145 },
                    { ts: "2025-12-26T12:40:00", value: 147 },
                    { ts: "2025-12-26T12:45:00", value: 150 },
                  ],
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