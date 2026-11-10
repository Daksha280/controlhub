const db = require('../db');

/**
 * Continuous Control Monitoring (CCM) Rule Engine
 * Simulating real-time automated surveillance across card servicing journals.
 */
class RuleEngine {
  /**
   * Run full surveillance scan across all card requests and operational logs
   */
  static runFullScan(actor = { id: null, name: 'CCM Automated Scanner', role: 'system' }) {
    const rules = db.prepare('SELECT * FROM ccm_rules WHERE is_active = 1').all();
    const allRequests = db.prepare('SELECT * FROM card_requests ORDER BY created_at ASC').all();

    let newExceptionsCount = 0;
    const detectedBreaches = [];

    // Helper to log audit event
    const logAudit = (eventType, detail, resourceId) => {
      db.prepare(`
        INSERT INTO audit_logs (event_type, actor_id, actor_name, actor_role, action_detail, resource_id, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(eventType, actor.id, actor.name, actor.role, detail, resourceId, '10.142.0.1');
    };

    // Helper to create exception if not existing
    const registerException = (ruleCode, req, severity, title, desc, detectedVal) => {
      const rule = rules.find(r => r.rule_code === ruleCode);
      if (!rule) return;

      const existing = db.prepare(`
        SELECT id FROM exceptions 
        WHERE rule_code = ? AND request_id = ?
      `).get(ruleCode, req.id);

      if (!existing) {
        const nextId = db.prepare('SELECT COUNT(*) as cnt FROM exceptions').get().cnt + 1;
        const excNumber = `EXC-2026-${String(nextId).padStart(4, '0')}`;

        db.prepare(`
          INSERT INTO exceptions (
            exception_number, rule_id, rule_code, request_id, account_number_masked,
            severity, title, description, detected_value, status, assigned_to,
            risk_analyst_notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Under Investigation', 'Internal Control (Ayumi Ito)', 'Automatically flagged by CCM Rule Engine.', datetime('now'))
        `).run(excNumber, rule.id, ruleCode, req.id, req.masked_pan, severity, title, desc, detectedVal);

        newExceptionsCount++;
        logAudit('EXCEPTION_GENERATED', `[${ruleCode}] ${title} on ${req.request_number}`, excNumber);
      }

      detectedBreaches.push({
        ruleCode,
        requestId: req.id,
        requestNumber: req.request_number,
        account: req.masked_pan,
        title,
        severity,
        detectedVal
      });
    };

    // Evaluate Rule 1: Segregation of Duties (SoD) Self-Approval
    // RULE-SOD-001: Maker == Checker on approved action
    for (const req of allRequests) {
      if (req.status === 'Approved' && req.checker_id && req.maker_id === req.checker_id) {
        registerException(
          'RULE-SOD-001',
          req,
          'Critical',
          `Segregation of Duties Breach: Maker Self-Approval on ${req.request_number}`,
          `User ${req.maker_name} submitted and subsequently approved their own request (${req.transaction_type} of ¥${req.amount.toLocaleString()}) without independent supervisory oversight.`,
          `Maker ID: ${req.maker_id} == Checker ID: ${req.checker_id}`
        );
      }
    }

    // Evaluate Rule 2: Unauthorized Threshold Breach (> ¥10,000 without Checker Approval)
    // RULE-THR-002: Fee waiver > 10,000 approved without checker
    for (const req of allRequests) {
      if (req.transaction_type === 'Annual Fee Waiver (JPY)' && req.amount > 10000) {
        if (req.status === 'Approved' && !req.checker_id) {
          registerException(
            'RULE-THR-002',
            req,
            'High',
            `Threshold Breach: Fee Waiver >¥10,000 Lacks Dual Approval on ${req.request_number}`,
            `Fee waiver of ¥${req.amount.toLocaleString()} JPY exceeds the ¥10,000 threshold but was marked Approved without recorded Checker sign-off.`,
            `Amount: ¥${req.amount.toLocaleString()} (Threshold: ¥10,000). Checker: NULL`
          );
        }
      }
    }

    // Evaluate Rule 3: High-Risk Velocity Card Replacement (< 48 hours for same account)
    // RULE-VEL-003: 2 or more card replacement requests within 48h
    const replacementRequests = allRequests.filter(r => r.transaction_type === 'Card Replacement Request');
    for (let i = 0; i < replacementRequests.length; i++) {
      const current = replacementRequests[i];
      const currentTime = new Date(current.created_at).getTime();

      for (let j = i + 1; j < replacementRequests.length; j++) {
        const next = replacementRequests[j];
        if (current.masked_pan === next.masked_pan) {
          const nextTime = new Date(next.created_at).getTime();
          const diffHours = Math.abs(nextTime - currentTime) / (1000 * 60 * 60);

          if (diffHours <= 48) {
            registerException(
              'RULE-VEL-003',
              next,
              'High',
              `High-Risk Velocity: Multiple Card Replacements (<48h) on ${next.masked_pan}`,
              `Multiple card replacement requests detected within ${diffHours.toFixed(1)} hours for account ${next.masked_pan}. Possible Account Takeover (ATO) courier rerouting fraud.`,
              `Request ${current.request_number} and ${next.request_number} submitted within ${diffHours.toFixed(1)}h (Threshold: 48.0h)`
            );
          }
        }
      }
    }

    // Evaluate Rule 4: Off-Hours High-Value Servicing (> ¥1,000,000 outside 09:00 - 18:00 JST)
    for (const req of allRequests) {
      if (req.transaction_type === 'Credit Limit Adjustment (JPY)' && req.amount >= 1000000) {
        const d = new Date(req.created_at);
        // Note: Hours in UTC vs JST. If local time hour is outside 9-18
        const hour = d.getHours();
        if (hour < 9 || hour >= 18) {
          registerException(
            'RULE-OFF-004',
            req,
            'Medium',
            `Off-Hours High-Value Limit Hike on ${req.request_number}`,
            `Credit limit adjustment of ¥${req.amount.toLocaleString()} JPY submitted outside standard operational hours (09:00 - 18:00 JST).`,
            `Time: ${req.created_at.split(' ')[1] || req.created_at} JST (Outside 09:00-18:00)`
          );
        }
      }
    }

    // Log the scan execution
    logAudit(
      'CCM_SCAN_COMPLETED',
      `CCM Rule Engine completed surveillance scan across ${allRequests.length} servicing records. Evaluated ${rules.length} active rules. Detected ${detectedBreaches.length} control breaches (${newExceptionsCount} new exceptions).`,
      `SCAN-${Date.now()}`
    );

    return {
      success: true,
      scannedTransactions: allRequests.length,
      activeRulesEvaluated: rules.length,
      totalBreachesFound: detectedBreaches.length,
      newExceptionsCreated: newExceptionsCount,
      timestamp: new Date().toISOString(),
      breaches: detectedBreaches
    };
  }

  /**
   * Evaluate a single request immediately upon submission or status change
   */
  static inspectRequest(requestId) {
    const req = db.prepare('SELECT * FROM card_requests WHERE id = ?').get(requestId);
    if (!req) return null;

    const findings = [];

    // Check SoD
    if (req.status === 'Approved' && req.checker_id && req.maker_id === req.checker_id) {
      findings.push({
        ruleCode: 'RULE-SOD-001',
        title: 'Segregation of Duties Self-Approval',
        severity: 'Critical'
      });
    }

    // Check Threshold
    if (req.transaction_type === 'Annual Fee Waiver (JPY)' && req.amount > 10000 && req.status === 'Approved' && !req.checker_id) {
      findings.push({
        ruleCode: 'RULE-THR-002',
        title: 'Threshold Breach Without Dual Approval',
        severity: 'High'
      });
    }

    return findings;
  }
}

module.exports = RuleEngine;

