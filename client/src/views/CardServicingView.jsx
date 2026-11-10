import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import {
  CreditCard,
  PlusCircle,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Lock,
  RefreshCw,
  X
} from 'lucide-react';

export default function CardServicingView() {
  const { user, permissions, showToast } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');

  // Modal states
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [requestAuditTrail, setRequestAuditTrail] = useState([]);

  // New Request Form State
  const [formData, setFormData] = useState({
    cardholder_name: '',
    masked_pan: '3759-',
    card_tier: 'Platinum',
    transaction_type: 'Annual Fee Waiver (JPY)',
    amount: 165000,
    previous_limit: 3000000,
    new_limit: 5000000,
    reason: '',
    channel: 'Tokyo Concierge'
  });
  const [submitting, setSubmitting] = useState(false);

  // Approval remarks in details modal
  const [checkerRemarks, setCheckerRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await api.getRequests({
        status: statusFilter,
        type: typeFilter,
        tier: tierFilter,
        search
      });
      setRequests(data);
    } catch (err) {
      showToast(err.message || 'Failed to fetch requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, typeFilter, tierFilter, search]);

  const handleOpenDetails = async (reqItem) => {
    try {
      const details = await api.getRequestById(reqItem.id);
      setSelectedRequest(details.request);
      setRequestAuditTrail(details.auditLogs || []);
      setCheckerRemarks('');
      setDetailsModalOpen(true);
    } catch (err) {
      showToast(err.message || 'Failed to load request details', 'error');
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!permissions.canCreateRequests) {
      showToast('Action restricted: Only the Maker role can submit new servicing requests.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createRequest(formData);
      showToast(res.message, 'success');
      setIsNewModalOpen(false);
      // Reset form
      setFormData({
        cardholder_name: '',
        masked_pan: '3759-',
        card_tier: 'Platinum',
        transaction_type: 'Annual Fee Waiver (JPY)',
        amount: 165000,
        previous_limit: 3000000,
        new_limit: 5000000,
        reason: '',
        channel: 'Tokyo Concierge'
      });
      fetchRequests();
    } catch (err) {
      showToast(err.message || 'Failed to submit request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      setActionLoading(true);
      const res = await api.approveRequest(id, checkerRemarks || 'Managerial sign-off verified and approved.');
      showToast(res.message, 'success');
      setDetailsModalOpen(false);
      fetchRequests();
    } catch (err) {
      showToast(err.message || 'Approval failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id) => {
    if (!checkerRemarks) {
      showToast('Supervisory remarks are required to reject a request.', 'error');
      return;
    }
    try {
      setActionLoading(true);
      const res = await api.rejectRequest(id, checkerRemarks);
      showToast(res.message, 'success');
      setDetailsModalOpen(false);
      fetchRequests();
    } catch (err) {
      showToast(err.message || 'Rejection failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper for amounts
  const formatAmount = (r) => {
    if (r.transaction_type === 'Annual Fee Waiver (JPY)') {
      return `¥${(r.amount || 0).toLocaleString()}`;
    }
    if (r.transaction_type === 'Credit Limit Adjustment (JPY)') {
      return `¥${(r.previous_limit || 0).toLocaleString()} → ¥${(r.new_limit || 0).toLocaleString()}`;
    }
    return 'Card Re-issuance (¥0)';
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-400" />
            Card Servicing Desk & Transaction Ledger
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational journal for fee waivers, credit line adjustments, and emergency card replacements (Amex ICS Japan).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchRequests()}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition border border-slate-700"
            title="Refresh Ledger"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {permissions.canCreateRequests ? (
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/30 transition border border-emerald-400/30"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Servicing Request</span>
            </button>
          ) : (
            <div className="text-xs text-slate-400 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Creation Restricted to Maker Role</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search cardholder, PAN, or REQ#..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="Pending">Pending Checker Review</option>
          <option value="Approved">Approved (Dual Control)</option>
          <option value="Auto-Approved">Auto-Approved (&le;¥10,000)</option>
          <option value="Rejected">Rejected</option>
        </select>

        {/* Transaction Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Transaction Types</option>
          <option value="Annual Fee Waiver (JPY)">Annual Fee Waiver (JPY)</option>
          <option value="Credit Limit Adjustment (JPY)">Credit Limit Adjustment (JPY)</option>
          <option value="Card Replacement Request">Card Replacement Request</option>
        </select>

        {/* Card Tier Filter */}
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Card Tiers</option>
          <option value="Centurion">Centurion</option>
          <option value="Platinum">Platinum</option>
          <option value="Gold">Gold</option>
          <option value="Green">Green</option>
          <option value="Corporate">Corporate</option>
        </select>
      </div>

      {/* Requests Data Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Request #</th>
                <th className="py-3 px-4">Cardholder & PAN</th>
                <th className="py-3 px-4">Product Tier</th>
                <th className="py-3 px-4">Transaction Type</th>
                <th className="py-3 px-4 text-right">Amount / Adjustment</th>
                <th className="py-3 px-4 text-center">Dual Approval</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Maker / Checker</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                    Loading servicing records...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-500">
                    No card servicing records found matching the active filters.
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  const isBreachSuspect = (r.status === 'Approved' && r.requires_dual_approval && !r.checker_id) ||
                                          (r.status === 'Approved' && r.checker_id === r.maker_id);

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-800/40 transition ${
                        isBreachSuspect ? 'bg-rose-950/20 border-l-2 border-l-rose-500' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-blue-400">
                        {r.request_number}
                        {isBreachSuspect && (
                          <span className="block text-[9px] text-rose-400 font-bold uppercase">
                            Breach Suspect
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{r.cardholder_name}</div>
                        <div className="text-[11px] font-mono text-slate-400">{r.masked_pan}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.card_tier === 'Centurion' ? 'bg-zinc-800 text-zinc-100 border border-zinc-600' :
                          r.card_tier === 'Platinum' ? 'bg-slate-700 text-slate-100 border border-slate-500' :
                          r.card_tier === 'Gold' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                          r.card_tier === 'Corporate' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                          'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}>
                          {r.card_tier}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-300">
                        {r.transaction_type}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {formatAmount(r)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {r.requires_dual_approval ? (
                          <span className="bg-amber-950/80 text-amber-400 border border-amber-800/60 px-2 py-0.5 rounded text-[10px] font-semibold">
                            Dual Required
                          </span>
                        ) : (
                          <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px]">
                            Single Maker
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center w-fit gap-1 ${
                          r.status === 'Approved' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                          r.status === 'Auto-Approved' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                          r.status === 'Pending' ? 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse' :
                          'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}>
                          {r.status === 'Approved' && <CheckCircle className="w-3 h-3" />}
                          {r.status === 'Auto-Approved' && <ShieldCheck className="w-3 h-3" />}
                          {r.status === 'Pending' && <Clock className="w-3 h-3" />}
                          {r.status === 'Rejected' && <XCircle className="w-3 h-3" />}
                          <span>{r.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-[11px] text-slate-300">
                          <span className="text-slate-500">M: </span>{r.maker_name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          <span className="text-slate-500">C: </span>
                          {r.checker_name ? (
                            <span className={r.checker_id === r.maker_id ? 'text-rose-400 font-bold' : ''}>
                              {r.checker_name}
                            </span>
                          ) : (
                            <span className="italic text-slate-600">None</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleOpenDetails(r)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg text-xs font-semibold transition border border-slate-700"
                        >
                          View Audit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Card Servicing Request */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative text-xs">
            <button
              onClick={() => setIsNewModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <PlusCircle className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Submit Card Servicing Action (Maker)</h3>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Cardholder Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kenzo Miyazawa"
                    value={formData.cardholder_name}
                    onChange={(e) => setFormData({ ...formData, cardholder_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Masked PAN (Amex 15-Digit) *</label>
                  <input
                    type="text"
                    required
                    placeholder="3759-881023-45009"
                    value={formData.masked_pan}
                    onChange={(e) => setFormData({ ...formData, masked_pan: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Card Product Tier *</label>
                  <select
                    value={formData.card_tier}
                    onChange={(e) => setFormData({ ...formData, card_tier: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Centurion">Centurion</option>
                    <option value="Platinum">Platinum</option>
                    <option value="Gold">Gold</option>
                    <option value="Green">Green</option>
                    <option value="Corporate">Corporate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Channel Origin</label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Tokyo Concierge">Tokyo Concierge Desk</option>
                    <option value="Digital IVR">Digital IVR / App</option>
                    <option value="Executive Operations Desk">Executive Operations Desk</option>
                    <option value="Branch Escalation">Branch Escalation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Transaction Action Type *</label>
                <select
                  value={formData.transaction_type}
                  onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Annual Fee Waiver (JPY)">Annual Fee Waiver (JPY)</option>
                  <option value="Credit Limit Adjustment (JPY)">Credit Limit Adjustment (JPY)</option>
                  <option value="Card Replacement Request">Card Replacement Request</option>
                </select>
              </div>

              {/* Conditional Amount Fields */}
              {formData.transaction_type === 'Annual Fee Waiver (JPY)' && (
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Fee Waiver Amount (JPY ¥) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                  {/* Dynamic Gating Policy Tip */}
                  <div className={`mt-2 p-2 rounded-lg text-[11px] flex items-center gap-2 ${
                    formData.amount > 10000
                      ? 'bg-amber-950/70 text-amber-300 border border-amber-800/80'
                      : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80'
                  }`}>
                    {formData.amount > 10000 ? (
                      <>
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>Threshold Notice: Amount exceeds ¥10,000 JPY. Will route to Checker queue for managerial approval.</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                        <span>Within Maker Discretion: Amount &le; ¥10,000 JPY is eligible for immediate auto-approval.</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {formData.transaction_type === 'Credit Limit Adjustment (JPY)' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Previous Limit (JPY ¥)</label>
                    <input
                      type="number"
                      required
                      value={formData.previous_limit}
                      onChange={(e) => setFormData({ ...formData, previous_limit: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Requested New Limit (JPY ¥)</label>
                    <input
                      type="number"
                      required
                      value={formData.new_limit}
                      onChange={(e) => setFormData({ ...formData, new_limit: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {formData.transaction_type === 'Card Replacement Request' && (
                <div className="p-2.5 bg-blue-950/40 rounded-xl border border-blue-800/40 text-[11px] text-blue-300">
                  ℹ️ High-Risk Velocity Notice: Submitting multiple card replacements for the same PAN within 48h will automatically flag a Critical ATO security exception.
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Business Justification / Reason *</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Provide detailed operating justification (e.g. VIP retention agreement, merchant dispute, travel emergency)..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                ></textarea>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-md shadow-emerald-600/30 transition"
                >
                  {submitting ? 'Submitting to Queue...' : 'Submit Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Request Audit Trail & Checker Sign-off */}
      {detailsModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative text-xs max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setDetailsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <span className="text-[10px] uppercase font-mono text-blue-400 font-bold">
                  {selectedRequest.request_number}
                </span>
                <h3 className="text-base font-bold text-white">{selectedRequest.cardholder_name}</h3>
                <span className="text-slate-400 font-mono text-[11px]">{selectedRequest.masked_pan}</span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                selectedRequest.status === 'Approved' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                selectedRequest.status === 'Auto-Approved' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                selectedRequest.status === 'Pending' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                'bg-rose-950 text-rose-400 border border-rose-800'
              }`}>
                {selectedRequest.status}
              </span>
            </div>

            {/* Request Details Grid */}
            <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4">
              <div>
                <span className="text-slate-500 text-[10px] uppercase">Transaction Type</span>
                <p className="font-semibold text-slate-200 mt-0.5">{selectedRequest.transaction_type}</p>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase">Amount / Adjustment</span>
                <p className="font-semibold text-white mt-0.5 font-mono">{formatAmount(selectedRequest)}</p>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase">Card Tier</span>
                <p className="font-semibold text-slate-200 mt-0.5">{selectedRequest.card_tier}</p>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase">Channel & Origin IP</span>
                <p className="text-slate-400 mt-0.5">{selectedRequest.channel} ({selectedRequest.ip_address})</p>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 text-[10px] uppercase">Business Justification</span>
                <p className="text-slate-300 mt-0.5 italic bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                  "{selectedRequest.reason}"
                </p>
              </div>
            </div>

            {/* Checker Remarks if already reviewed */}
            {selectedRequest.checker_remarks && (
              <div className="mb-4 p-3 bg-blue-950/30 rounded-xl border border-blue-800/40">
                <span className="text-[10px] font-semibold text-blue-300 uppercase">Supervisory Review Remarks:</span>
                <p className="text-slate-200 mt-0.5">{selectedRequest.checker_remarks}</p>
                <div className="text-[10px] text-slate-400 mt-1">
                  Signed off by {selectedRequest.checker_name || 'Checker'} on {selectedRequest.updated_at}
                </div>
              </div>
            )}

            {/* Maker-Checker Workflow Action Area (If Pending) */}
            {selectedRequest.status === 'Pending' && (
              <div className="mb-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  Dual Authorization Gateway (Checker Sign-Off)
                </h4>

                {/* Segregation of Duties Check */}
                {user?.id === selectedRequest.maker_id ? (
                  <div className="p-3 bg-rose-950/70 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <div>
                      <strong className="block font-semibold">Segregation of Duties (SoD) Policy Block</strong>
                      You originated this request as Maker ({user.name}). Under ICS Control Policy CTL-ICS-002, you cannot approve your own transaction. Please switch to the Checker persona to approve.
                    </div>
                  </div>
                ) : user?.role === 'checker' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Checker Supervisory Remarks *</label>
                      <input
                        type="text"
                        placeholder="e.g. Verified supporting documents and concession authority. Approved."
                        value={checkerRemarks}
                        onChange={(e) => setCheckerRemarks(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleApprove(selectedRequest.id)}
                        disabled={actionLoading}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-md transition"
                      >
                        {actionLoading ? 'Processing...' : 'Approve Request (Dual Sign-off)'}
                      </button>
                      <button
                        onClick={() => handleReject(selectedRequest.id)}
                        disabled={actionLoading}
                        className="py-2 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold transition"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-slate-900 rounded-xl text-slate-400 text-center">
                    Awaiting review by Operations Manager (Checker).
                  </div>
                )}
              </div>
            )}

            {/* Audit Trail List */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 mb-2">Immutable Audit Journal</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {requestAuditTrail.length === 0 ? (
                  <p className="text-slate-500 italic">No specific audit logs recorded for this item.</p>
                ) : (
                  requestAuditTrail.map((log) => (
                    <div key={log.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-semibold text-blue-400">{log.event_type}</span>
                        <span className="font-mono text-[10px]">{log.created_at}</span>
                      </div>
                      <p className="text-slate-200 mt-1">{log.action_detail}</p>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Actor: {log.actor_name} ({log.actor_role}) • IP: {log.ip_address}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

