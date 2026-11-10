import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  CreditCard,
  ShieldAlert,
  ClipboardList,
  RefreshCw,
  ExternalLink,
  DollarSign,
  Activity,
  Layers
} from 'lucide-react';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function DashboardView({ onNavigate }) {
  const { user, permissions, showToast } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardAnalytics();
      setData(res);
    } catch (err) {
      showToast(err.message || 'Failed to load executive dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleRunScan = async () => {
    try {
      setScanning(true);
      const res = await api.runScan();
      showToast(
        `Surveillance scan complete! Scanned ${res.report.scannedTransactions} items, flagged ${res.report.totalBreachesFound} breaches.`,
        'success'
      );
      fetchDashboard();
    } catch (err) {
      showToast(err.message || 'Scan failed', 'error');
    } finally {
      setScanning(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-400 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm">Synthesizing Executive KRI Metrics & Control Logs...</p>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};
  const recentActivity = data?.recentActivity || [];

  // Chart options styled for dark financial dashboard
  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#94a3b8', font: { size: 11 } }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1'
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8', font: { size: 11 } }
      },
      y: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8', font: { size: 11 }, stepSize: 1 }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12, padding: 12 }
      }
    },
    cutout: '70%'
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 10 } }
      },
      y: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8', font: { size: 11 }, stepSize: 1 }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Amex ICS-J Executive Surveillance
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1">
            Operational Risk & Internal Control Governance
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time surveillance across card servicing actions, maker-checker segregation, and threshold compliance.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {permissions.canRunCCM ? (
            <button
              onClick={handleRunScan}
              disabled={scanning}
              className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all border border-blue-400/30"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'Running CCM Scan...' : 'Run Automated CCM Scan'}</span>
            </button>
          ) : (
            <div className="text-xs text-slate-400 bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span>CCM Rule Engine: Continuous Scan Mode</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Operational Actions */}
        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Operational Actions</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white tracking-tight">{kpis.totalOperationalActions}</span>
            <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-900 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              100% Audited
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Card servicing actions across Tokyo operations desk</p>
        </div>

        {/* KPI 2: Open Exceptions */}
        <div
          onClick={() => onNavigate && onNavigate('exceptions')}
          className="bg-slate-900/90 p-5 rounded-2xl border border-rose-900/40 shadow-sm hover:border-rose-700/60 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-300 uppercase tracking-wider">Open Exceptions</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:bg-rose-500/20">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-rose-400 tracking-tight">{kpis.openExceptions}</span>
            <div className="flex items-center space-x-1.5 text-[10px]">
              <span className="bg-rose-950 text-rose-300 border border-rose-800 px-1.5 py-0.5 rounded font-bold">
                {kpis.criticalExceptions} Critical
              </span>
              <span className="bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded font-bold">
                {kpis.highExceptions} High
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>Automated rule engine breaches</span>
            <span className="text-blue-400 group-hover:underline text-[10px] flex items-center gap-0.5">
              Review <ExternalLink className="w-2.5 h-2.5" />
            </span>
          </p>
        </div>

        {/* KPI 3: Control Effectiveness */}
        <div
          onClick={() => onNavigate && onNavigate('rcm')}
          className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-sm hover:border-slate-700 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Control Effectiveness</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white tracking-tight">{kpis.controlEffectivenessRate}%</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              kpis.controlEffectivenessRate >= 80
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'bg-amber-950 text-amber-300 border-amber-800'
            }`}>
              {kpis.controlEffectivenessRate >= 80 ? 'Satisfactory' : 'Needs CAP'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Evaluated across 6 key RCM control objectives</p>
        </div>

        {/* KPI 4: Remediation Plans (CAP) */}
        <div
          onClick={() => onNavigate && onNavigate('caps')}
          className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-sm hover:border-slate-700 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active CAPs</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white tracking-tight">{kpis.activeCaps}</span>
            <span className="text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-full">
              {kpis.overdueCaps} Overdue
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Remediation action plans under audit tracking</p>
        </div>
      </div>

      {/* Bonus Financial Governance Stats Strip */}
      <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            ¥
          </div>
          <div>
            <div className="text-slate-400">Total Fee Waivers Conceded (MTD)</div>
            <div className="text-sm font-bold text-white">
              ¥{(kpis.totalFeeWaiverJPY || 0).toLocaleString()} JPY
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
            %
          </div>
          <div>
            <div className="text-slate-400">Dual Authorization Compliance Rate</div>
            <div className="text-sm font-bold text-emerald-400">
              {kpis.dualComplianceRate}% Compliant
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-slate-400">Continuous Surveillance Engine</div>
            <div className="text-sm font-bold text-slate-200">
              4 Active Rules | 100% Journal Scan
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Monthly KRI Breach Trends (Line Chart - 2 columns) */}
        <div className="lg:col-span-2 bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                Monthly KRI Breach Trends (6-Month Trajectory)
              </h3>
              <p className="text-xs text-slate-400">
                Tracking SoD violations, unauthorized threshold breaches, and rapid re-issue velocity
              </p>
            </div>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
              Tokyo Ops Log
            </span>
          </div>

          <div className="h-64 w-full">
            {charts.breachTrends ? (
              <Line data={charts.breachTrends} options={lineOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">Loading chart...</div>
            )}
          </div>
        </div>

        {/* Chart 2: Controls by Effectiveness (Doughnut Chart - 1 column) */}
        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-white">Controls by Status</h3>
              <p className="text-xs text-slate-400">RCM testing & operating effectiveness</p>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900">
              6 Controls
            </span>
          </div>

          <div className="h-56 w-full relative flex items-center justify-center">
            {charts.controlsBreakdown ? (
              <Doughnut data={charts.controlsBreakdown} options={doughnutOptions} />
            ) : (
              <div className="text-xs text-slate-500">Loading chart...</div>
            )}
          </div>
          <div className="text-center text-[11px] text-slate-400 mt-2">
            Target: 100% Effective across all card issuing gateways
          </div>
        </div>
      </div>

      {/* Row 2 Charts & Live Ticker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 3: Exception Breakdown by Root Cause (Bar Chart) */}
        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Exception Root Causes</h3>
              <p className="text-xs text-slate-400">Incident breakdown across flagged breaches</p>
            </div>
          </div>
          <div className="h-56 w-full">
            {charts.rootCauseBreakdown ? (
              <Bar data={charts.rootCauseBreakdown} options={barOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">Loading chart...</div>
            )}
          </div>
        </div>

        {/* Live Security & Audit Ticker (2 columns) */}
        <div className="lg:col-span-2 bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
              <h3 className="text-sm font-bold text-white">Live Internal Control & Audit Stream</h3>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('audit_logs')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              Full Journal <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-slate-800/80 max-h-56 overflow-y-auto pr-1">
            {recentActivity.map((log) => {
              const isBreach = log.event_type.includes('BREACH') || log.event_type.includes('VIOLATION') || log.event_type.includes('ALERT');
              const isApproval = log.event_type.includes('APPROVED');

              return (
                <div key={log.id} className="py-2.5 flex items-start justify-between text-xs gap-3">
                  <div className="flex items-start space-x-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 mt-0.5 ${
                      isBreach ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                      isApproval ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                      'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {log.event_type}
                    </span>
                    <div>
                      <p className="text-slate-200 line-clamp-2 leading-relaxed">{log.action_detail}</p>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Actor: {log.actor_name} ({log.actor_role})</span>
                        <span>•</span>
                        <span>IP: {log.ip_address}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap shrink-0">
                    {log.created_at.split(' ')[1] || log.created_at}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

