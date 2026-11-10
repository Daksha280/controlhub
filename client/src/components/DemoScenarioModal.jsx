import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  CreditCard,
  Play,
  X,
  FileSpreadsheet,
  Lock
} from 'lucide-react';

export default function DemoScenarioModal({ isOpen, onClose, onNavigate }) {
  const { switchRole } = useAuth();

  if (!isOpen) return null;

  const scenarios = [
    {
      id: 1,
      badge: 'Deliberate Breach #1',
      badgeColor: 'bg-rose-950 text-rose-300 border-rose-800',
      title: 'Segregation of Duties (SoD) Self-Approval Breach',
      rule: 'RULE-SOD-001',
      severity: 'Critical',
      requestRef: 'REQ-2026-0804',
      description:
        'A ¥385,000 JPY Centurion fee waiver was submitted and subsequently approved by the same operator (Maker Kenji Sato), circumventing managerial dual control.',
      walkthrough: [
        '1. Switch to Auditor (Ayumi Ito) to inspect the Critical exception in Exceptions & Breaches.',
        '2. Review the forensic evidence: Maker ID: 1 == Checker ID: 1.',
        '3. Try submitting a new waiver as Maker and attempt self-approval to see real-time 403 SoD blocking.'
      ],
      actionLabel: 'Inspect in Exceptions',
      actionRole: 'auditor',
      targetTab: 'exceptions'
    },
    {
      id: 2,
      badge: 'Deliberate Breach #2',
      badgeColor: 'bg-amber-950 text-amber-300 border-amber-800',
      title: 'Unauthorized Threshold Breach (>¥10,000)',
      rule: 'RULE-THR-002',
      severity: 'High',
      requestRef: 'REQ-2026-0809',
      description:
        'A Platinum card fee waiver of ¥55,000 JPY exceeded the ¥10,000 dual-control threshold, but was marked Approved without any Checker sign-off (checker_id = NULL).',
      walkthrough: [
        '1. Inspect REQ-2026-0809 in the Card Servicing desk — notice the "Breach Suspect" flag.',
        '2. Trigger "Run Automated CCM Scan" to see the rule engine catch the unauthorized concession.',
        '3. Escalate the exception into CAP-2026-001 to mandate terminal system gating.'
      ],
      actionLabel: 'View in Card Servicing',
      actionRole: 'checker',
      targetTab: 'operations'
    },
    {
      id: 3,
      badge: 'Deliberate Breach #3',
      badgeColor: 'bg-blue-950 text-blue-300 border-blue-800',
      title: 'High-Risk Velocity Card Replacement (<48h)',
      rule: 'RULE-VEL-003',
      severity: 'High',
      requestRef: 'REQ-2026-0810 & 0811',
      description:
        'Account 3759-881023-45009 experienced 2 emergency card replacement dispatches within 14 hours. Classic courier interception / Account Takeover (ATO) indicator.',
      walkthrough: [
        '1. View the velocity alert flagged automatically upon the second replacement.',
        '2. Inspect CAP-2026-002: Establishing automated 48-hour velocity lockout on card embossing.',
        '3. Check off remediation steps and execute formal Auditor sign-off.'
      ],
      actionLabel: 'Review Remediation (CAP)',
      actionRole: 'auditor',
      targetTab: 'caps'
    }
  ];

  const handleExecuteScenario = async (s) => {
    await switchRole(s.actionRole);
    if (onNavigate) {
      onNavigate(s.targetTab);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl relative text-xs max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <Play className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Guided Scenario Walkthrough & Control Testing
            </h3>
            <p className="text-xs text-slate-400">
              Test all 3 deliberate control breaches seeded into the American Express ICS-J simulator.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {scenarios.map((s) => (
            <div
              key={s.id}
              className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 hover:border-slate-700 transition"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${s.badgeColor}`}>
                    {s.badge}
                  </span>
                  <span className="font-mono text-slate-400 font-bold text-[11px]">{s.requestRef}</span>
                  <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                    {s.rule}
                  </span>
                </div>
                <button
                  onClick={() => handleExecuteScenario(s)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/30 transition"
                >
                  <span>{s.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <h4 className="text-sm font-bold text-white">{s.title}</h4>
                <p className="text-slate-300 text-xs mt-1 leading-relaxed">{s.description}</p>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <span className="text-slate-300 font-semibold block mb-0.5">Recommended Testing Steps:</span>
                {s.walkthrough.map((step, idx) => (
                  <div key={idx} className="text-slate-300">
                    {step}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-500">
          <span>American Express International Card Services — Japan Compliance Standard</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}

