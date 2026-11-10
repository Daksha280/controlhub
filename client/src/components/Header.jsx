import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, ShieldAlert, UserCheck, Eye, Clock, Building2, RefreshCw, Sparkles, Play } from 'lucide-react';
import DemoScenarioModal from './DemoScenarioModal';

export default function Header({ onNavigate }) {
  const { user, switchRole, loading } = useAuth();
  const [currentTime, setCurrentTime] = useState('');
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);

  // Live JST Clock (Tokyo Time)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = {
        timeZone: 'Asia/Tokyo',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      };
      setCurrentTime(new Intl.DateTimeFormat('ja-JP', options).format(now) + ' JST');
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-lg">
        {/* Top Corporate Bar */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 px-6 py-2 border-b border-blue-900/40 flex flex-wrap items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-3">
            <span className="font-semibold text-blue-400 tracking-wider uppercase flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              American Express International Card Services — Japan Market (ICS-J)
            </span>
            <span className="hidden md:inline text-slate-600">|</span>
            <span className="hidden md:inline text-slate-400">Tokyo Headquarters - Card Operations & Risk Governance</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 text-slate-300 font-mono bg-slate-950/70 px-2.5 py-0.5 rounded border border-slate-800">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>{currentTime || 'Loading JST...'}</span>
            </div>
            <div className="flex items-center space-x-1 text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
              <Shield className="w-3 h-3" />
              <span>SoD Engine: ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Main Navigation & Role Switcher Bar */}
        <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 border border-blue-400/40">
              <span className="text-white font-extrabold text-xl tracking-tighter">ICS</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">ControlHub</h1>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded font-mono font-medium">
                  v2.4-PROD
                </span>
              </div>
              <p className="text-xs text-slate-400">Internal Control & Operational Risk Monitoring Portal</p>
            </div>
          </div>

          {/* Quick Guided Demo Tour Button */}
          <button
            onClick={() => setIsScenarioModalOpen(true)}
            className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 border border-amber-300/40 transition animate-pulse"
            title="Open guided walkthrough to test the 3 deliberate control breaches"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Test 3 Control Breaches (Demo Tour)</span>
          </button>

          {/* Demo Role Switcher Header Widget */}
          <div className="flex items-center bg-slate-950/90 p-1.5 rounded-xl border border-slate-800 shadow-inner">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 hidden lg:inline">
              Demo Persona Switcher:
            </span>

            <div className="flex items-center space-x-1">
              {/* Maker Button */}
              <button
                onClick={() => switchRole('maker')}
                disabled={loading || user?.role === 'maker'}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  user?.role === 'maker'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title="Maker: Operations Analyst (Can submit card servicing actions, cannot approve own requests)"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                <span>Maker (Kenji Sato)</span>
                <span className="text-[10px] opacity-75 hidden sm:inline">[Ops Analyst]</span>
              </button>

              {/* Checker Button */}
              <button
                onClick={() => switchRole('checker')}
                disabled={loading || user?.role === 'checker'}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  user?.role === 'checker'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title="Checker: Operations Manager (Can review and approve/reject Maker requests; strictly barred from self-approval)"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Checker (Yuki Tanaka)</span>
                <span className="text-[10px] opacity-75 hidden sm:inline">[Ops Manager]</span>
              </button>

              {/* Auditor Button */}
              <button
                onClick={() => switchRole('auditor')}
                disabled={loading || user?.role === 'auditor'}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  user?.role === 'auditor'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title="Auditor: Internal Control / Risk Analyst (Read-only transactions, exclusive access to CCM Exceptions, RCM & CAP remediation)"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Auditor (Ayumi Ito)</span>
                <span className="text-[10px] opacity-75 hidden sm:inline">[Risk Control]</span>
              </button>
            </div>
          </div>

          {/* Current Active Persona Badge */}
          {user && (
            <div className="flex items-center space-x-3 bg-slate-800/80 pl-3 pr-4 py-1.5 rounded-xl border border-slate-700/80">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase shadow ${
                user.role === 'maker' ? 'bg-emerald-700 text-emerald-100' :
                user.role === 'checker' ? 'bg-blue-700 text-blue-100' :
                'bg-purple-700 text-purple-100'
              }`}>
                {user.name.charAt(0)}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-100">{user.name}</span>
                  <span className={`text-[10px] uppercase font-mono px-1.5 py-0.2 rounded font-bold ${
                    user.role === 'maker' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                    user.role === 'checker' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                    'bg-purple-950 text-purple-300 border border-purple-800'
                  }`}>
                    {user.role}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate max-w-[170px]">{user.department}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Guided Walkthrough Modal */}
      <DemoScenarioModal
        isOpen={isScenarioModalOpen}
        onClose={() => setIsScenarioModalOpen(false)}
        onNavigate={onNavigate}
      />
    </>
  );
}
