const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const RuleEngine = require('../services/ruleEngine');

/**
 * List all CCM Rules
 */
router.get('/rules', authenticateToken, (req, res) => {
  const rules = db.prepare('SELECT * FROM ccm_rules ORDER BY id ASC').all();
  res.json(rules);
});

/**
 * List all Exceptions flagged by CCM Engine
 */
router.get('/exceptions', authenticateToken, (req, res) => {
  const { status, severity, ruleCode } = req.query;

  let sql = `
    SELECT e.*, r.name as rule_name, r.category as rule_category,
           cr.request_number, cr.cardholder_name, cr.transaction_type, cr.amount, cr.card_tier,
           cap.cap_number, cap.status as cap_status
    FROM exceptions e
    JOIN ccm_rules r ON e.rule_id = r.id
    LEFT JOIN card_requests cr ON e.request_id = cr.id
    LEFT JOIN corrective_action_plans cap ON e.cap_id = cap.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'all') {
    sql += ' AND e.status = ?';
    params.push(status);
  }

  if (severity && severity !== 'all') {
    sql += ' AND e.severity = ?';
    params.push(severity);
  }

  if (ruleCode && ruleCode !== 'all') {
    sql += ' AND e.rule_code = ?';
    params.push(ruleCode);
  }

  sql += ' ORDER BY e.created_at DESC';

  const exceptions = db.prepare(sql).all(...params);
  res.json(exceptions);
});

/**
 * Trigger Continuous Control Monitoring (CCM) Rule Engine Scan
 * (Auditor / Risk Analyst access)
 */
router.post('/scan', authenticateToken, requireRole(['auditor']), (req, res) => {
  const scanReport = RuleEngine.runFullScan({
    id: req.user.id,
    name: req.user.name,
    role: req.user.role
  });

  res.json({
    message: 'Continuous Control Monitoring surveillance scan executed successfully.',
    report: scanReport
  });
});

/**
 * Update Exception Status & Risk Analyst Notes
 * (Auditor / Risk Analyst access)
 */
router.patch('/exceptions/:id', authenticateToken, requireRole(['auditor']), (req, res) => {
  const { status, notes, assigned_to } = req.body;
  const exceptionId = req.params.id;

  const current = db.prepare('SELECT * FROM exceptions WHERE id = ?').get(exceptionId);
  if (!current) {
    return res.status(404).json({ error: 'EXCEPTION_NOT_FOUND', message: 'Exception not found.' });
  }

  const updates = [];
  const params = [];

  if (status) {
    updates.push('status = ?');
    params.push(status);
    if (status === 'Remediated' || status === 'Justified') {
      updates.push("resolved_at = datetime('now')");
    }
  }

  if (notes !== undefined) {
    updates.push('risk_analyst_notes = ?');
    params.push(notes);
  }

  if (assigned_to) {
    updates.push('assigned_to = ?');
    params.push(assigned_to);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'NO_UPDATES', message: 'No fields to update.' });
  }

  params.push(exceptionId);
  db.prepare(`UPDATE exceptions SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  // Log to audit journal
  db.prepare(`
    INSERT INTO audit_logs (event_type, actor_id, actor_name, actor_role, action_detail, resource_id, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    'EXCEPTION_STATUS_UPDATED',
    req.user.id,
    req.user.name,
    req.user.role,
    `Updated exception ${current.exception_number} to status '${status || current.status}'. Notes: "${notes || current.risk_analyst_notes}".`,
    current.exception_number,
    req.ip || '10.142.22.88'
  );

  const updated = db.prepare('SELECT * FROM exceptions WHERE id = ?').get(exceptionId);
  res.json({
    message: `Exception ${current.exception_number} updated.`,
    exception: updated
  });
});

/**
 * Escalate an Exception to a Corrective Action Plan (CAP)
 */
router.post('/exceptions/:id/escalate-cap', authenticateToken, requireRole(['auditor']), (req, res) => {
  const exceptionId = req.params.id;
  const { title, root_cause, owner, due_date, priority, action_steps } = req.body;

  const exc = db.prepare('SELECT * FROM exceptions WHERE id = ?').get(exceptionId);
  if (!exc) {
    return res.status(404).json({ error: 'EXCEPTION_NOT_FOUND', message: 'Exception not found.' });
  }

  if (exc.cap_id) {
    return res.status(400).json({ error: 'ALREADY_ESCALATED', message: 'This exception is already linked to a CAP.' });
  }

  const capCount = db.prepare('SELECT COUNT(*) as cnt FROM corrective_action_plans').get().cnt + 1;
  const capNumber = `CAP-2026-${String(capCount).padStart(3, '0')}`;

  const defaultSteps = [
    { step: 'Conduct forensic review of operator session logs and terminal telemetry', done: false },
    { step: 'Formulate policy clarification or systemic technical preventive gating', done: false },
    { step: 'Deploy preventive control fix to production card issuing gateway', done: false },
    { step: 'Auditor inspection & formal verification for CAP closure', done: false }
  ];

  const stepsToSave = action_steps && Array.isArray(action_steps)
    ? JSON.stringify(action_steps)
    : JSON.stringify(defaultSteps);

  const result = db.prepare(`
    INSERT INTO corrective_action_plans (
      cap_number, title, finding_description, root_cause,
      related_control_id, related_exception_id, owner, due_date,
      priority, status, progress_pct, action_steps, audit_signoff,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', 10, ?, 0, datetime('now'), datetime('now'))
  `).run(
    capNumber,
    title || `Remediation for ${exc.title}`,
    exc.description,
    root_cause || `Escalated from exception ${exc.exception_number}: ${exc.detected_value}`,
    exc.rule_code === 'RULE-SOD-001' ? 'CTL-ICS-002' : exc.rule_code === 'RULE-THR-002' ? 'CTL-ICS-001' : 'CTL-ICS-004',
    exc.id,
    owner || 'Operations Management & IT Security',
    due_date || '2026-12-15',
    priority || exc.severity,
    stepsToSave
  );

  const newCapId = Number(result.lastInsertRowid);

  // Link CAP to exception and set status to Confirmed Exception
  db.prepare("UPDATE exceptions SET cap_id = ?, status = 'Confirmed Exception' WHERE id = ?").run(newCapId, exc.id);

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (event_type, actor_id, actor_name, actor_role, action_detail, resource_id, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    'CAP_ESCALATED_FROM_EXCEPTION',
    req.user.id,
    req.user.name,
    req.user.role,
    `Escalated exception ${exc.exception_number} into Corrective Action Plan ${capNumber}: "${title || exc.title}".`,
    capNumber,
    req.ip || '10.142.22.88'
  );

  const createdCap = db.prepare('SELECT * FROM corrective_action_plans WHERE id = ?').get(newCapId);
  res.status(201).json({
    message: `Exception ${exc.exception_number} successfully escalated to ${capNumber}.`,
    cap: createdCap
  });
});

module.exports = router;

