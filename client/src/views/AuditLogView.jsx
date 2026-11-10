import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  ShieldAlert,
  CheckCircle,
  Clock,
  User,
  Key
} from 'lucide-react';

export default function AuditLogView() {
  const { showToast } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditLogs({
        event_type: eventTypeFilter,
        role: roleFilter,
        search
      });
      setLogs(data);
    } catch (err) {
      showToast(err.message || 'Failed to fetch audit logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [eventTypeFilter, roleFilter, search]);

  const getEventBadge = (type) => {
    if (type.includes('SOD') || type.includes('BREACH') || type.includes('BLOCKED')) {
      return 'bg-rose-950 text-rose-300 border-rose-800';
    }
    if (type.includes('APPROVED')) {
      return 'bg-emerald-950 text-emerald-300 border-emerald-800';
    }
    if (type.includes('REJECTED')) {
      return 'bg-rose-950 text-rose-300 border-rose-800';
    }
    if (type.includes('SCAN')) {
      return 'bg-purple-950 text-purple-300 border-purple-800';
    }
    if (type.includes('LOGIN') || type.includes('ROLE_SWITCH')) {
      return 'bg-cyan-950 text-cyan-300 border-cyan-800';
    }
    return 'bg-blue-950 text-blue-300 border-blue-800';
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Cryptographic Security Journal
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            Immutable Audit Trail & Activity Logs
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Tamper-evident chronological journal capturing every card servicing submission, managerial approval, and SoD enforcement event.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition border border-slate-700"
          title="Refresh Journal"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search action details, actor, or resource..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Event Types</option>
          <option value="REQUEST_CREATED">Request Created</option>
          <option value="REQUEST_APPROVED">Request Approved (Dual Control)</option>
          <option value="REQUEST_REJECTED">Request Rejected</option>
          <option value="SOD_VIOLATION_BLOCKED">SoD Violation Blocked</option>
          <option value="CCM_SCAN_COMPLETED">CCM Scan Completed</option>
          <option value="ROLE_SWITCH">Persona Switch</option>
          <option value="LOGIN">User Login</option>
        </select>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Actor Roles</option>
          <option value="maker">Maker (Ops Analyst)</option>
          <option value="checker">Checker (Ops Manager)</option>
          <option value="auditor">Auditor (Internal Control)</option>
          <option value="system">System Kernel</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp (JST)</th>
                <th className="py-3 px-4">Event Category</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Target Resource</th>
                <th className="py-3 px-4">Action Detail</th>
                <th className="py-3 px-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                    Loading audit journal...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    No audit records found matching the active filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {log.created_at}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getEventBadge(log.event_type)}`}>
                        {log.event_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                      {log.actor_name}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                        {log.actor_role}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-blue-400 whitespace-nowrap">
                      {log.resource_id || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-md leading-relaxed">
                      {log.action_detail}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {log.ip_address}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

