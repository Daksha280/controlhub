import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DashboardView from './views/DashboardView';
import CardServicingView from './views/CardServicingView';
import MakerCheckerQueueView from './views/MakerCheckerQueueView';
import ExceptionsView from './views/ExceptionsView';
import RcmView from './views/RcmView';
import CapTrackerView from './views/CapTrackerView';
import AuditLogView from './views/AuditLogView';
import { api } from './api/api';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

function AppContent() {
  const { user, toast } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pendingCount, setPendingCount] = useState(0);
  const [openExceptionsCount, setOpenExceptionsCount] = useState(0);

  // Poll badges summary periodically or on tab change
  const refreshBadgeCounts = async () => {
    try {
      const [pendingReqs, exceptions] = await Promise.all([
        api.getRequests({ queue: 'pending_checker' }),
        api.getExceptions({ status: 'all' })
      ]);
      setPendingCount(pendingReqs.length);
      const openCount = exceptions.filter((e) => e.status !== 'Remediated').length;
      setOpenExceptionsCount(openCount);
    } catch {
      // Ignore background badge errors
    }
  };

  useEffect(() => {
    refreshBadgeCounts();
    const interval = setInterval(refreshBadgeCounts, 10000);
    return () => clearInterval(interval);
  }, [activeTab, user]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div
            className={`flex items-center space-x-2.5 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-700/80'
                : toast.type === 'error'
                ? 'bg-rose-950/90 text-rose-200 border-rose-700/80'
                : 'bg-blue-950/90 text-blue-200 border-blue-700/80'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Global Header with Role Switcher & Clock */}
      <Header />

      {/* Main Layout Area */}
      <div className="flex flex-1">
        {/* Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingCount={pendingCount}
          openExceptionsCount={openExceptionsCount}
        />

        {/* View Content Canvas */}
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full overflow-y-auto">
          {activeTab === 'dashboard' && <DashboardView onNavigate={setActiveTab} />}
          {activeTab === 'operations' && <CardServicingView />}
          {activeTab === 'checker_queue' && <MakerCheckerQueueView />}
          {activeTab === 'exceptions' && <ExceptionsView onNavigate={setActiveTab} />}
          {activeTab === 'rcm' && <RcmView />}
          {activeTab === 'caps' && <CapTrackerView />}
          {activeTab === 'audit_logs' && <AuditLogView />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
