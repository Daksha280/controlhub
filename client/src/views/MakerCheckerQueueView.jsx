import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Clock,
  User,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Info
} from 'lucide-react';

export default function MakerCheckerQueueView() {
  const { user, permissions, showToast } = useAuth();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewModalItem, setReviewModalItem] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const data = await api.getRequests({ queue: 'pending_checker' });
      setPendingRequests(data);
    } catch (err) {
      showToast(err.message || 'Failed to fetch Maker-Checker queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleApprove = async (id) => {
    try {
      setSubmitting(true);
      const res = await api.approveRequest(id, remarks || 'Verified and approved under managerial delegation.');
      showToast(res.message, 'success');
      setReviewModalItem(null);
      setRemarks('');
      fetchQueue();
    } catch (err) {
      showToast(err.message || 'Approval failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (id) => {
    if (!remarks) {
      showToast('Supervisory remarks are mandatory when rejecting a card servicing request.', 'error');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.rejectRequest(id, remarks);
      showToast(res.message, 'success');
      setReviewModalItem(null);
      setRemarks('');
      fetchQueue();
    } catch (err) {
      showToast(err.message || 'Rejection failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isChecker = user?.role === 'checker';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Dual Authorization Verification Desk
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-400" />
            Maker-Checker Approval Queue
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Independent managerial sign-off required for high-risk concessions (&gt;¥10,000) and credit limit adjustments.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="text-2xl font-extrabold text-amber-400 font-mono">
              {pendingRequests.length}
            </div>
            <div className="text-[10px] uppercase text-slate-400 tracking-wider">Awaiting Sign-Off</div>
          </div>
          <button
            onClick={fetchQueue}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition border border-slate-700"
            title="Refresh Queue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Role State Banner */}
      {!isChecker && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-start gap-3 text-xs text-amber-200">
          <Info className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <span className="font-bold">Active Role: {user?.role.toUpperCase()} ({user?.name})</span>
            <p className="mt-0.5 text-slate-300">
              You are currently viewing the queue in read-only mode. To approve or reject transactions, use the quick role switcher in the header to switch to <strong>Checker (Yuki Tanaka)</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Pending Items Grid / List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px] text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
          <span>Loading pending queue items...</span>
        </div>
      ) : pendingRequests.length === 0 ? (
        <div className="bg-slate-900/60 p-12 rounded-2xl border border-slate-800 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Queue Cleared — Zero Pending Requests</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            All card servicing operations requiring dual control have been reviewed and approved. New submissions from Makers will automatically populate here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingRequests.map((req) => {
            const isSelfSubmission = user?.id === req.maker_id;

            return (
              <div
                key={req.id}
                className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-sm hover:border-slate-700 transition flex flex-col justify-between space-y-4"
              >
                {/* Top Strip */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-blue-400">{req.request_number}</span>
                      <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                        req.card_tier === 'Centurion' ? 'bg-zinc-800 text-zinc-100 border border-zinc-600' :
                        req.card_tier === 'Platinum' ? 'bg-slate-700 text-slate-100 border border-slate-500' :
                        'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {req.card_tier}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white mt-1">{req.cardholder_name}</h4>
                    <p className="text-xs font-mono text-slate-400">{req.masked_pan}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/70 border border-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Pending Review
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      {req.created_at.split(' ')[0]}
                    </span>
                  </div>
                </div>

                {/* Amount / Action Details */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Action:</span>
                    <span className="font-semibold text-slate-200">{req.transaction_type}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Amount / Adjustment:</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {req.transaction_type === 'Annual Fee Waiver (JPY)'
                        ? `¥${(req.amount || 0).toLocaleString()} JPY`
                        : `¥${(req.previous_limit || 0).toLocaleString()} → ¥${(req.new_limit || 0).toLocaleString()} JPY`}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase block mb-0.5">Maker Justification:</span>
                    <p className="text-slate-300 italic text-[11px]">"{req.reason}"</p>
                  </div>
                </div>

                {/* Submitter & Origin */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Maker: <strong>{req.maker_name}</strong></span>
                  </div>
                  <span>Channel: {req.channel}</span>
                </div>

                {/* Action Area with Segregation of Duties Gating */}
                <div className="pt-2 border-t border-slate-800">
                  {isSelfSubmission ? (
                    <div className="p-3 bg-rose-950/60 rounded-xl border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                      <AlertOctagon className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>
                        <strong>SoD Policy Block:</strong> You submitted this request. Maker cannot act as Checker.
                      </span>
                    </div>
                  ) : isChecker ? (
                    <button
                      onClick={() => {
                        setReviewModalItem(req);
                        setRemarks('');
                      }}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/30 transition flex items-center justify-center gap-2"
                    >
                      <span>Review & Sign-off</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div className="text-center py-2 text-slate-500 text-xs">
                      Switch to Checker to approve this transaction.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review & Decision Modal */}
      {reviewModalItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-xs">
            <h3 className="text-base font-bold text-white mb-1">
              Supervisory Sign-Off: {reviewModalItem.request_number}
            </h3>
            <p className="text-slate-400 text-xs mb-4">
              Dual authorization sign-off by Operations Manager {user?.name}
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Cardholder:</span>
                <span className="font-semibold text-white">{reviewModalItem.cardholder_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction:</span>
                <span className="font-semibold text-slate-200">{reviewModalItem.transaction_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount / Limit:</span>
                <span className="font-mono font-bold text-white">
                  {reviewModalItem.transaction_type === 'Annual Fee Waiver (JPY)'
                    ? `¥${(reviewModalItem.amount || 0).toLocaleString()} JPY`
                    : `¥${(reviewModalItem.previous_limit || 0).toLocaleString()} → ¥${(reviewModalItem.new_limit || 0).toLocaleString()} JPY`}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase">Reason:</span>
                <p className="text-slate-300 italic mt-0.5">"{reviewModalItem.reason}"</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Checker Review Remarks (Audit Trail) *
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Enter supervisory verification observations and approval authority basis..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                ></textarea>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModalItem(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(reviewModalItem.id)}
                  disabled={submitting}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold transition"
                >
                  Reject Request
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(reviewModalItem.id)}
                  disabled={submitting}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-md shadow-emerald-600/30 transition"
                >
                  {submitting ? 'Approving...' : 'Approve (Dual Control)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

