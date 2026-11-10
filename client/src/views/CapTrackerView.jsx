import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import {
  ClipboardList,
  PlusCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Calendar,
  CheckSquare,
  Square,
  Award,
  RefreshCw,
  X,
  Filter
} from 'lucide-react';

export default function CapTrackerView() {
  const { user, permissions, showToast } = useAuth();
  const [caps, setCaps] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Modal: Create CAP
  const [isNewCapOpen, setIsNewCapOpen] = useState(false);
  const [newCapData, setNewCapData] = useState({
    title: '',
    finding_description: '',
    root_cause: '',
    related_control_id: 'CTL-ICS-001',
    owner: 'Yuki Tanaka (Operations Manager)',
    due_date: '2026-12-15',
    priority: 'High'
  });
  const [creating, setCreating] = useState(false);

  const fetchCaps = async () => {
    try {
      setLoading(true);
      const data = await api.getCaps({ status: statusFilter, priority: priorityFilter });
      setCaps(data);
    } catch (err) {
      showToast(err.message || 'Failed to fetch CAPs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaps();
  }, [statusFilter, priorityFilter]);

  const handleToggleStep = async (cap, stepIndex) => {
    const updatedSteps = [...cap.action_steps];
    updatedSteps[stepIndex].done = !updatedSteps[stepIndex].done;

    const completedCount = updatedSteps.filter(s => s.done).length;
    const progressPct = Math.round((completedCount / updatedSteps.length) * 100);

    try {
      await api.updateCap(cap.id, {
        action_steps: updatedSteps,
        progress_pct: progressPct,
        status: progressPct === 100 ? 'Under Review' : cap.status === 'Open' ? 'In Progress' : cap.status
      });
      fetchCaps();
    } catch (err) {
      showToast(err.message || 'Failed to update step', 'error');
    }
  };

  const handleStatusChange = async (capId, newStatus) => {
    try {
      await api.updateCap(capId, { status: newStatus });
      showToast(`CAP status updated to '${newStatus}'`, 'success');
      fetchCaps();
    } catch (err) {
      showToast(err.message || 'Status update failed', 'error');
    }
  };

  const handleAuditorSignoff = async (capId) => {
    if (!permissions.canManageCAPs) {
      showToast('Restricted: Only Auditor / Internal Control can formally sign off and close a CAP.', 'error');
      return;
    }

    try {
      const res = await api.signoffCap(capId);
      showToast(res.message, 'success');
      fetchCaps();
    } catch (err) {
      showToast(err.message || 'Audit signoff failed', 'error');
    }
  };

  const handleCreateCap = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      const res = await api.createCap(newCapData);
      showToast(res.message, 'success');
      setIsNewCapOpen(false);
      setNewCapData({
        title: '',
        finding_description: '',
        root_cause: '',
        related_control_id: 'CTL-ICS-001',
        owner: 'Yuki Tanaka (Operations Manager)',
        due_date: '2026-12-15',
        priority: 'High'
      });
      fetchCaps();
    } catch (err) {
      showToast(err.message || 'Failed to create CAP', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
              Issue Remediation & Finding Resolution
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-purple-400" />
            Corrective Action Plan (CAP) Tracker
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Structured remediation roadmap for audit deficiencies, control gaps, and confirmed CCM exceptions.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchCaps}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition border border-slate-700"
            title="Refresh CAPs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {permissions.canManageCAPs && (
            <button
              onClick={() => setIsNewCapOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-purple-600/30 transition border border-purple-400/30"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Log Audit Finding (CAP)</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            Filters:
          </span>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Under Review">Under Review</option>
            <option value="Closed">Closed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
          </select>
        </div>

        <div className="text-slate-400 font-mono text-[11px]">
          Total Remediation Plans: <strong>{caps.length}</strong>
        </div>
      </div>

      {/* CAP Cards List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px] text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-500 mr-2" />
            <span>Loading remediation plans...</span>
          </div>
        ) : caps.length === 0 ? (
          <div className="bg-slate-900/60 p-12 rounded-2xl border border-slate-800 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-white">No Remediation Plans Found</h3>
            <p className="text-xs text-slate-400">All audit findings and control gaps have been addressed.</p>
          </div>
        ) : (
          caps.map((cap) => {
            const isClosed = cap.status === 'Closed';
            const isOverdue = new Date(cap.due_date) < new Date() && !isClosed;

            return (
              <div
                key={cap.id}
                className={`bg-slate-900/90 rounded-2xl border p-5 shadow-sm space-y-4 transition ${
                  isClosed
                    ? 'border-emerald-900/40 bg-slate-900/40'
                    : isOverdue
                    ? 'border-rose-900/60'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header Strip */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-purple-400">{cap.cap_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        cap.priority === 'Critical' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                        cap.priority === 'High' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        'bg-blue-950 text-blue-300 border border-blue-800'
                      }`}>
                        {cap.priority} Priority
                      </span>
                      {cap.related_control_id && (
                        <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                          Linked: {cap.related_control_id}
                        </span>
                      )}
                      {isOverdue && (
                        <span className="text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800 px-2 py-0.5 rounded flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-white">{cap.title}</h3>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Status Select */}
                    <select
                      value={cap.status}
                      disabled={!permissions.canManageCAPs}
                      onChange={(e) => handleStatusChange(cap.id, e.target.value)}
                      className={`text-xs rounded-xl px-3 py-1.5 font-bold border focus:outline-none ${
                        cap.status === 'Closed' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' :
                        cap.status === 'Under Review' ? 'bg-purple-950 text-purple-300 border-purple-800' :
                        cap.status === 'In Progress' ? 'bg-blue-950 text-blue-300 border-blue-800' :
                        'bg-amber-950 text-amber-300 border-amber-800'
                      }`}
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Closed">Closed</option>
                    </select>

                    {/* Auditor Formal Sign-off Button */}
                    {!isClosed && permissions.canManageCAPs && (
                      <button
                        onClick={() => handleAuditorSignoff(cap.id)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition"
                        title="Formally verify and close out this remediation plan"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Auditor Sign-off</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Finding & Root Cause Detail */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-xs space-y-2">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Deficiency Finding:</span>
                    <p className="text-slate-200 mt-0.5">{cap.finding_description}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Root Cause Analysis:</span>
                    <p className="text-slate-300 italic mt-0.5">{cap.root_cause}</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium">Remediation Milestones</span>
                    <span className="font-mono font-bold text-purple-400">{cap.progress_pct}% Completed</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isClosed ? 'bg-emerald-500' : 'bg-purple-500'
                      }`}
                      style={{ width: `${cap.progress_pct}%` }}
                    ></div>
                  </div>
                </div>

                {/* Action Steps Checklist */}
                <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                    Action Plan Step Verification:
                  </span>
                  {cap.action_steps && cap.action_steps.length > 0 ? (
                    cap.action_steps.map((step, idx) => (
                      <div
                        key={idx}
                        onClick={() => permissions.canManageCAPs && !isClosed && handleToggleStep(cap, idx)}
                        className={`flex items-center space-x-2 text-xs py-1 px-2 rounded-lg transition ${
                          permissions.canManageCAPs && !isClosed ? 'cursor-pointer hover:bg-slate-900' : ''
                        }`}
                      >
                        {step.done ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                        <span className={step.done ? 'line-through text-slate-500' : 'text-slate-200'}>
                          {step.step}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 text-xs italic">No specific milestones defined.</p>
                  )}
                </div>

                {/* Footer Metadata */}
                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      Owner: <strong className="text-slate-300">{cap.owner}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Due Date: <strong className={`font-mono ${isOverdue ? 'text-rose-400' : 'text-slate-300'}`}>{cap.due_date}</strong>
                    </span>
                  </div>

                  {cap.audit_signoff === 1 && (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" />
                      Auditor Sign-off Verified
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create New CAP */}
      {isNewCapOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-xs">
            <button
              onClick={() => setIsNewCapOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <PlusCircle className="w-5 h-5 text-purple-400" />
              <h3 className="text-base font-bold text-white">Log Formal Corrective Action Plan (CAP)</h3>
            </div>

            <form onSubmit={handleCreateCap} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Finding / Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement Hardened Gating for Branch Fee Waivers"
                  value={newCapData.title}
                  onChange={(e) => setNewCapData({ ...newCapData, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Audit Finding Description *</label>
                <textarea
                  rows="2"
                  required
                  placeholder="Detail the control gap or policy deviation observed..."
                  value={newCapData.finding_description}
                  onChange={(e) => setNewCapData({ ...newCapData, finding_description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Root Cause Assessment *</label>
                <textarea
                  rows="2"
                  required
                  placeholder="Identify underlying policy, system or supervisory cause..."
                  value={newCapData.root_cause}
                  onChange={(e) => setNewCapData({ ...newCapData, root_cause: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Related RCM Control ID</label>
                  <select
                    value={newCapData.related_control_id}
                    onChange={(e) => setNewCapData({ ...newCapData, related_control_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="CTL-ICS-001">CTL-ICS-001 (Fee Concessions)</option>
                    <option value="CTL-ICS-002">CTL-ICS-002 (SoD Governance)</option>
                    <option value="CTL-ICS-003">CTL-ICS-003 (Credit Underwriting)</option>
                    <option value="CTL-ICS-004">CTL-ICS-004 (Card Embossing)</option>
                    <option value="CTL-ICS-005">CTL-ICS-005 (AML / Sanctions)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Priority *</label>
                  <select
                    value={newCapData.priority}
                    onChange={(e) => setNewCapData({ ...newCapData, priority: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Assigned Owner *</label>
                  <input
                    type="text"
                    required
                    value={newCapData.owner}
                    onChange={(e) => setNewCapData({ ...newCapData, owner: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Target Due Date *</label>
                  <input
                    type="date"
                    required
                    value={newCapData.due_date}
                    onChange={(e) => setNewCapData({ ...newCapData, due_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewCapOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold shadow-md shadow-purple-600/30 transition"
                >
                  {creating ? 'Saving...' : 'Create Remediation Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

