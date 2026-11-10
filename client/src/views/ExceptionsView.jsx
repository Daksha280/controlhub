import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  ShieldAlert,
  Play,
  Filter,
  CheckCircle2,
  FileText,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Search,
  ExternalLink,
  X
} from 'lucide-react';

export default function ExceptionsView({ onNavigate }) {
  const { user, permissions, showToast } = useAuth();
  const [exceptions, setExceptions] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  // Filters
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal: Escalate to CAP
  const [escalateItem, setEscalateItem] = useState(null);
  const [capFormData, setCapFormData] = useState({
    title: '',
    root_cause: '',
    owner: '',
    due_date: '2026-12-15',
    priority: 'Critical'
  });
  const [escalating, setEscalating] = useState(false);

  const fetchExceptions = async () => {
    try {
      setLoading(true);
      const [excData, rulesData] = await Promise.all([
        api.getExceptions({ severity: severityFilter, status: statusFilter }),
        api.getRules()
      ]);
      setExceptions(excData);
      setRules(rulesData);
    } catch (err) {
      showToast(err.message || 'Failed to fetch exceptions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExceptions();
  }, [severityFilter, statusFilter]);

  const handleRunScan = async () => {
    if (!permissions.canRunCCM) {
      showToast('Restricted: Only Auditor / Internal Control can execute on-demand CCM scans.', 'error');
      return;
    }

    try {
      setScanning(true);
      const res = await api.runScan();
      showToast(
        `Surveillance complete! Scanned ${res.report.scannedTransactions} items, flagged ${res.report.totalBreachesFound} breaches.`,
        'success'
      );
      fetchExceptions();
    } catch (err) {
      showToast(err.message || 'CCM scan failed', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus, currentNotes) => {
    try {
      await api.updateException(id, { status: newStatus });
      showToast(`Exception status updated to '${newStatus}'`, 'success');
      fetchExceptions();
    } catch (err) {
      showToast(err.message || 'Status update failed', 'error');
    }
  };

  const handleOpenEscalateModal = (exc) => {
    setEscalateItem(exc);
    setCapFormData({
      title: `Remediate ${exc.title}`,
      root_cause: `Control breach flagged by ${exc.rule_code}: ${exc.detected_value}`,
      owner: 'Operations Management & Compliance Lead',
      due_date: '2026-12-15',
      priority: exc.severity
    });
  };

  const handleEscalateSubmit = async (e) => {
    e.preventDefault();
    try {
      setEscalating(true);
      const res = await api.escalateExceptionToCap(escalateItem.id, capFormData);
      showToast(res.message, 'success');
      setEscalateItem(null);
      fetchExceptions();
    } catch (err) {
      showToast(err.message || 'Failed to escalate to CAP', 'error');
    } finally {
      setEscalating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Surveillance Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-rose-950/30 to-slate-900 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
              Continuous Control Monitoring (CCM) Engine
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            Exceptions & Control Breaches
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated backend surveillance rules scanning 100% of card servicing journals for Segregation of Duties and threshold overrides.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleRunScan}
            disabled={scanning || !permissions.canRunCCM}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition ${
              permissions.canRunCCM
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 border border-rose-400/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Analyzing Journal Records...' : 'Execute CCM Rule Scan'}</span>
          </button>
        </div>
      </div>

      {/* Rules Legend Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {rules.map((rule) => (
          <div key={rule.id} className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-blue-400 text-[11px]">{rule.rule_code}</span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                rule.severity === 'Critical' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                rule.severity === 'High' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                'bg-blue-950 text-blue-300 border border-blue-800'
              }`}>
                {rule.severity}
              </span>
            </div>
            <div className="font-semibold text-slate-200 text-[11px] line-clamp-1">{rule.name}</div>
            <p className="text-[10px] text-slate-400 line-clamp-2">{rule.description}</p>
          </div>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            Filters:
          </span>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="Under Investigation">Under Investigation</option>
            <option value="Confirmed Exception">Confirmed Exception</option>
            <option value="Justified">Justified</option>
            <option value="Remediated">Remediated</option>
          </select>
        </div>

        <div className="text-slate-400 font-mono text-[11px]">
          Showing <strong>{exceptions.length}</strong> flagged breaches
        </div>
      </div>

      {/* Exceptions List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px] text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-rose-500 mr-2" />
            <span>Scanning exceptions...</span>
          </div>
        ) : exceptions.length === 0 ? (
          <div className="bg-slate-900/60 p-12 rounded-2xl border border-slate-800 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-white">No Exceptions Found</h3>
            <p className="text-xs text-slate-400">No active control breaches match the current filter criteria.</p>
          </div>
        ) : (
          exceptions.map((exc) => {
            const isCritical = exc.severity === 'Critical';

            return (
              <div
                key={exc.id}
                className={`bg-slate-900/90 rounded-2xl border p-5 shadow-sm space-y-3 transition ${
                  isCritical
                    ? 'border-rose-900/60 hover:border-rose-700/80 bg-gradient-to-r from-rose-950/20 via-slate-900 to-slate-900'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-rose-400">{exc.exception_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        exc.severity === 'Critical' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                        exc.severity === 'High' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        'bg-blue-950 text-blue-300 border border-blue-800'
                      }`}>
                        {exc.severity}
                      </span>
                      <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                        {exc.rule_code}
                      </span>
                      {exc.cap_number && (
                        <span className="text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded flex items-center gap-1">
                          Linked: {exc.cap_number} ({exc.cap_status})
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white">{exc.title}</h3>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Status Dropdown */}
                    <select
                      value={exc.status}
                      disabled={!permissions.canRunCCM}
                      onChange={(e) => handleUpdateStatus(exc.id, e.target.value, exc.risk_analyst_notes)}
                      className={`text-xs rounded-xl px-3 py-1.5 font-semibold border focus:outline-none ${
                        exc.status === 'Confirmed Exception' ? 'bg-rose-950 text-rose-300 border-rose-800' :
                        exc.status === 'Under Investigation' ? 'bg-amber-950 text-amber-300 border-amber-800' :
                        exc.status === 'Justified' ? 'bg-blue-950 text-blue-300 border-blue-800' :
                        'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}
                    >
                      <option value="Under Investigation">Under Investigation</option>
                      <option value="Confirmed Exception">Confirmed Exception</option>
                      <option value="Justified">Justified</option>
                      <option value="Remediated">Remediated</option>
                    </select>

                    {/* Escalate to CAP Button */}
                    {!exc.cap_id && permissions.canManageCAPs && (
                      <button
                        onClick={() => handleOpenEscalateModal(exc)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-md transition"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Escalate to CAP</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Violation Description & Forensic Evidence */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 text-xs space-y-2">
                  <p className="text-slate-300 leading-relaxed">{exc.description}</p>
                  <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/40 text-[11px] font-mono text-rose-300">
                    <strong>Forensic Breach Value:</strong> {exc.detected_value}
                  </div>
                </div>

                {/* Footer Metadata */}
                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
                  <div className="flex items-center space-x-4">
                    <span>Account: <strong className="font-mono text-slate-300">{exc.account_number_masked}</strong></span>
                    <span>Assigned: <strong>{exc.assigned_to}</strong></span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">
                    Detected: {exc.created_at}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Escalate Exception to Corrective Action Plan (CAP) */}
      {escalateItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-xs">
            <button
              onClick={() => setEscalateItem(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <ArrowUpRight className="w-5 h-5 text-purple-400" />
              <h3 className="text-base font-bold text-white">Escalate Finding to Corrective Action Plan (CAP)</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Formal remediation track under Internal Control oversight for {escalateItem.exception_number}.
            </p>

            <form onSubmit={handleEscalateSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">CAP Title *</label>
                <input
                  type="text"
                  required
                  value={capFormData.title}
                  onChange={(e) => setCapFormData({ ...capFormData, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Root Cause Assessment *</label>
                <textarea
                  rows="3"
                  required
                  value={capFormData.root_cause}
                  onChange={(e) => setCapFormData({ ...capFormData, root_cause: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Assigned Remediation Owner *</label>
                  <input
                    type="text"
                    required
                    value={capFormData.owner}
                    onChange={(e) => setCapFormData({ ...capFormData, owner: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Target Due Date *</label>
                  <input
                    type="date"
                    required
                    value={capFormData.due_date}
                    onChange={(e) => setCapFormData({ ...capFormData, due_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEscalateItem(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={escalating}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold shadow-md shadow-purple-600/30 transition"
                >
                  {escalating ? 'Creating CAP...' : 'Log Remediation Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

