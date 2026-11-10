import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  CreditCard,
  CheckSquare,
  AlertTriangle,
  TableProperties,
  ClipboardList,
  History,
  ShieldCheck,
  Lock,
  ChevronRight
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, pendingCount = 0, openExceptionsCount = 0 }) {
  const { user } = useAuth();
  const role = user?.role;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Executive KRI Dashboard',
      subtitle: 'Key Risk Indicators & Charts',
      icon: LayoutDashboard,
      badge: null,
      allowedRoles: ['maker', 'checker', 'auditor']
    },
    {
      id: 'operations',
      label: 'Card Servicing Operations',
      subtitle: 'Fee Waivers, Limits, Cards',
      icon: CreditCard,
      badge: null,
      allowedRoles: ['maker', 'checker', 'auditor']
    },
    {
      id: 'checker_queue',
      label: 'Maker-Checker Queue',
      subtitle: 'Dual Authorization Desk',
      icon: CheckSquare,
      badge: pendingCount > 0 ? `${pendingCount} Pending` : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      allowedRoles: ['checker', 'auditor', 'maker']
    },
    {
      id: 'exceptions',
      label: 'Exceptions & Breaches',
      subtitle: 'Continuous Control Monitoring',
      icon: AlertTriangle,
      badge: openExceptionsCount > 0 ? `${openExceptionsCount} Open` : null,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      allowedRoles: ['auditor', 'checker']
    },
    {
      id: 'rcm',
      label: 'Risk & Control Matrix',
      subtitle: 'RCM Controls & Testing',
      icon: TableProperties,
      badge: 'Auditor',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      allowedRoles: ['auditor', 'checker']
    },
    {
      id: 'caps',
      label: 'Remediation Plans (CAP)',
      subtitle: 'Corrective Action Tracker',
      icon: ClipboardList,
      badge: null,
      allowedRoles: ['auditor', 'checker']
    },
    {
      id: 'audit_logs',
      label: 'Security & Audit Logs',
      subtitle: 'Immutable Chronological Journal',
      icon: History,
      badge: null,
      allowedRoles: ['maker', 'checker', 'auditor']
    }
  ];

  return (
    <aside className="w-72 bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0 min-h-[calc(100vh-105px)]">
      <div className="p-4 space-y-6">
        {/* Navigation Section */}
        <div>
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Governance Modules</span>
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isAllowed = item.allowedRoles.includes(role);

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between group ${
                    isActive
                      ? 'bg-blue-600/20 text-white border border-blue-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div className={`p-1.5 rounded-lg ${
                      isActive ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 group-hover:text-blue-400'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate text-left">
                      <div className="font-semibold truncate text-slate-100 flex items-center gap-1.5">
                        {item.label}
                        {!isAllowed && (
                          <Lock className="w-2.5 h-2.5 text-slate-500" title="Restricted view for your active role" />
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{item.subtitle}</div>
                    </div>
                  </div>

                  {item.badge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-medium ${item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Segregation of Duties (SoD) Card */}
        <div className="bg-slate-900/80 rounded-xl p-3.5 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              SoD Policy Rules
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-900">
              STRICT
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            • Fee Waivers &gt; ¥10,000 require independent Checker approval.
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            • Makers are cryptographically blocked from approving their own entries.
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            • Card replacements &lt;48h trigger velocity fraud alerts.
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/80 text-[11px] text-slate-500 space-y-1">
        <div className="flex items-center justify-between">
          <span>Tokyo Op Center</span>
          <span className="font-mono text-slate-400">ICS-JP-01</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Active Environment</span>
          <span className="font-mono text-blue-400">SIM-PRODUCTION</span>
        </div>
      </div>
    </aside>
  );
}

