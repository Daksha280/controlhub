import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import {
  TableProperties,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Filter,
  Search,
  RefreshCw,
  Edit,
  ShieldCheck,
  X
} from 'lucide-react';

export default function RcmView() {
  const { user, permissions, showToast } = useAuth();
  const [controls, setControls] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [riskFilter, setRiskFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Edit Modal State
  const [editingControl, setEditingControl] = useState(null);
  const [editFormData, setEditFormData] = useState({
    status: 'Effective',
    deficiencies_noted: 0,
    sample_size: 50,
    next_review_date: ''
  });
  const [saving, setSaving] = useState(false);

  const fetchRcm = async () => {
    try {
      setLoading(true);
      const data = await api.getRcmControls({
        risk_level: riskFilter,
        control_type: typeFilter,
        status: statusFilter,
        search
      });
      setControls(data);
    } catch (err) {
      showToast(err.message || 'Failed to fetch RCM matrix', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRcm();
  }, [riskFilter, typeFilter, statusFilter, search]);

  const handleOpenEdit = (ctl) => {
    setEditingControl(ctl);
    setEditFormData({
      status: ctl.status,
      deficiencies_noted: ctl.deficiencies_noted || 0,
      sample_size: ctl.sample_size || 50,
      next_review_date: ctl.next_review_date || '2026-12-01'
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.updateRcmControl(editingControl.id, editFormData);
      showToast(res.message, 'success');
      setEditingControl(null);
      fetchRcm();
    } catch (err) {
      showToast(err.message || 'Failed to update control', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
              Internal Control Framework (SOX 404 / ICS Japan)
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <TableProperties className="w-5 h-5 text-purple-400" />
            Risk & Control Matrix (RCM)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Key operational controls governing credit card issuing, fee waivers, dual authorization, and embossing.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchRcm}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition border border-slate-700"
            title="Refresh RCM"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search control ID, risk, or process..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
        >
          <option value="all">All Risk Levels</option>
          <option value="High">High Inherent Risk</option>
          <option value="Med">Medium Inherent Risk</option>
          <option value="Low">Low Inherent Risk</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
        >
          <option value="all">All Control Types</option>
          <option value="Preventive">Preventive Controls</option>
          <option value="Detective">Detective Controls</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
        >
          <option value="all">All Statuses</option>
          <option value="Effective">Effective</option>
          <option value="Partially Effective">Partially Effective</option>
          <option value="Deficient">Deficient (Action Required)</option>
        </select>
      </div>

      {/* RCM Interactive Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Control ID</th>
                <th className="py-3 px-4">Process Step</th>
                <th className="py-3 px-4">Inherent Risk</th>
                <th className="py-3 px-4 text-center">Risk Level</th>
                <th className="py-3 px-4 max-w-xs">Control Description</th>
                <th className="py-3 px-4">Type & Nature</th>
                <th className="py-3 px-4">Frequency</th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-500 mb-2" />
                    Loading RCM Matrix...
                  </td>
                </tr>
              ) : controls.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-500">
                    No control objectives found matching the filters.
                  </td>
                </tr>
              ) : (
                controls.map((ctl) => (
                  <tr key={ctl.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-purple-400 whitespace-nowrap">
                      {ctl.control_id}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                      {ctl.process_step}
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-xs leading-relaxed">
                      {ctl.inherent_risk}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ctl.risk_level === 'High' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                        ctl.risk_level === 'Med' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}>
                        {ctl.risk_level}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 leading-relaxed max-w-sm">
                      {ctl.control_description}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-200">{ctl.control_type}</div>
                      <div className="text-[10px] text-slate-400">{ctl.control_nature}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                      {ctl.testing_frequency}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                      {ctl.control_owner}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                        ctl.status === 'Effective' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                        ctl.status === 'Partially Effective' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                      }`}>
                        {ctl.status === 'Effective' && <CheckCircle2 className="w-3 h-3" />}
                        {ctl.status === 'Partially Effective' && <AlertCircle className="w-3 h-3" />}
                        {ctl.status === 'Deficient' && <XCircle className="w-3 h-3" />}
                        <span>{ctl.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {permissions.canAccessRCM ? (
                        <button
                          onClick={() => handleOpenEdit(ctl)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-purple-400 rounded-lg text-xs font-semibold transition border border-slate-700 flex items-center gap-1 mx-auto"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Test / Edit</span>
                        </button>
                      ) : (
                        <span className="text-slate-600 italic text-[11px]">View only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Edit RCM Control & Record Testing Results */}
      {editingControl && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-xs">
            <button
              onClick={() => setEditingControl(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
              <h3 className="text-base font-bold text-white">
                Record Control Testing: {editingControl.control_id}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">{editingControl.process_step}</p>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Control Operating Effectiveness Status *</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 font-semibold"
                >
                  <option value="Effective">Effective (Satisfies Control Objective)</option>
                  <option value="Partially Effective">Partially Effective (Minor Operating Gap)</option>
                  <option value="Deficient">Deficient (Control Failure - Requires CAP)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Sample Size Tested *</label>
                  <input
                    type="number"
                    required
                    value={editFormData.sample_size}
                    onChange={(e) => setEditFormData({ ...editFormData, sample_size: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Deficiencies Noted *</label>
                  <input
                    type="number"
                    required
                    value={editFormData.deficiencies_noted}
                    onChange={(e) => setEditFormData({ ...editFormData, deficiencies_noted: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Next Formal Audit Review Date</label>
                <input
                  type="date"
                  value={editFormData.next_review_date}
                  onChange={(e) => setEditFormData({ ...editFormData, next_review_date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingControl(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold shadow-md shadow-purple-600/30 transition"
                >
                  {saving ? 'Saving...' : 'Update RCM Test Result'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

