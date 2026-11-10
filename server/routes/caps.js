const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * List all Corrective Action Plans (CAPs)
 */
router.get('/', authenticateToken, (req, res) => {
  const { status, priority } = req.query;

  let sql = `
    SELECT cap.*, e.exception_number, e.detected_value, e.severity as exception_severity,
           rc.control_description, rc.process_step
    FROM corrective_action_plans cap
    LEFT JOIN exceptions e ON cap.related_exception_id = e.id
    LEFT JOIN rcm_controls rc ON cap.related_control_id = rc.control_id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'all') {
    sql += ' AND cap.status = ?';
    params.push(status);
  }

  if (priority && priority !== 'all') {
    sql += ' AND cap.priority = ?';
    params.push(priority);
  }

  sql += ' ORDER BY cap.created_at DESC';

  const caps = db.prepare(sql).all(...params).map(cap => ({
    ...cap,
    action_steps: JSON.parse(cap.action_steps || '[]')
  }));

  res.json(caps);
});

/**
 * Get single CAP
 */
router.get('/:id', authenticateToken, (req, res) => {
  const cap = db.prepare(`
    SELECT cap.*, e.exception_number, e.title as exception_title, e.detected_value,
           rc.control_description, rc.process_step
    FROM corrective_action_plans cap
    LEFT JOIN exceptions e ON cap.related_exception_id = e.id
    LEFT JOIN rcm_controls rc ON cap.related_control_id = rc.control_id
    WHERE cap.id = ?
  `).get(req.params.id);

  if (!cap) {
    return res.status(404).json({ error: 'CAP_NOT_FOUND', message: 'CAP not found.' });
  }

  res.json({
    ...cap,
    action_steps: JSON.parse(cap.action_steps || '[]')
  });
});

/**
 * Create new CAP (Auditor only)
 */
router.post('/', authenticateToken, requireRole(['auditor']), (req, res) => {
  const {
    title,
    finding_description,
    root_cause,
    related_control_id,
    related_exception_id,
    owner,
    due_date,
    priority,
    action_steps
  } = req.body;

  if (!title || !finding_description || !owner || !due_date) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Title, finding description, owner, and due date are required.' });
  }

  const count = db.prepare('SELECT COUNT(*) as cnt FROM corrective_action_plans').get().cnt + 1;
  const capNumber = `CAP-2026-${String(count).padStart(3, '0')}`;

  const defaultSteps = [
    { step: 'Perform root cause analysis and impact assessment', done: true },
    { step: 'Design remediation policy/technical control patch', done: false },
    { step: 'Conduct verification testing and audit review', done: false }
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
    title,
    finding_description,
    root_cause || 'Identified via internal control surveillance.',
    related_control_id || null,
    related_exception_id || null,
    owner,
    due_date,
    priority || 'High',
    stepsToSave
  );

  const newId = Number(result.lastInsertRowid);

  // Log to audit journal
  db.prepare(`
    INSERT INTO audit_logs (event_type, actor_id, actor_name, actor_role, action_detail, resource_id, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    'CAP_CREATED',
    req.user.id,
    req.user.name,
    req.user.role,
    `Logged Corrective Action Plan ${capNumber}: "${title}". Owner: ${owner}, Due: ${due_date}.`,
    capNumber,
    req.ip || '10.142.22.88'
  );

  const created = db.prepare('SELECT * FROM corrective_action_plans WHERE id = ?').get(newId);
  res.status(201).json({
    message: `CAP ${capNumber} created successfully.`,
    cap: {
      ...created,
      action_steps: JSON.parse(created.action_steps || '[]')
    }
  });
});

/**
 * Update CAP progress, steps, or status
 */
router.patch('/:id', authenticateToken, requireRole(['auditor', 'checker']), (req, res) => {
  const capId = req.params.id;
  const { status, progress_pct, action_steps, owner, due_date } = req.body;

  const current = db.prepare('SELECT * FROM corrective_action_plans WHERE id = ?').get(capId);
  if (!current) {
    return res.status(404).json({ error: 'CAP_NOT_FOUND', message: 'CAP not found.' });
  }

  const updates = ['updated_at = datetime(\'now\')'];
  const params = [];

  if (status) {
    updates.push('status = ?');
    params.push(status);
  }

  if (progress_pct !== undefined) {
    updates.push('progress_pct = ?');
    params.push(progress_pct);
  }

  if (action_steps) {
    updates.push('action_steps = ?');
    params.push(JSON.stringify(action_steps));
  }

  if (owner) {
    updates.push('owner = ?');
    params.push(owner);
  }

  if (due_date) {
    updates.push('due_date = ?');
    params.push(due_date);
  }

  params.push(capId);
  db.prepare(`UPDATE corrective_action_plans SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  // If status changed to closed and there's a related exception, mark exception remediated
  if (status === 'Closed' && current.related_exception_id) {
    db.prepare("UPDATE exceptions SET status = 'Remediated', resolved_at = datetime('now') WHERE id = ?").run(current.related_exception_id);
  }

  // Log to audit journal
  db.prepare(`
    INSERT INTO audit_logs (event_type, actor_id, actor_name, actor_role, action_detail, resource_id, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    'CAP_STATUS_UPDATED',
    req.user.id,
    req.user.name,
    req.user.role,
    `Updated ${current.cap_number} status to '${status || current.status}' (Progress: ${progress_pct !== undefined ? progress_pct : current.progress_pct}%).`,
    current.cap_number,
    req.ip || '10.142.22.88'
  );

  const updated = db.prepare('SELECT * FROM corrective_action_plans WHERE id = ?').get(capId);
  res.json({
    message: `CAP ${current.cap_number} updated.`,
    cap: {
      ...updated,
      action_steps: JSON.parse(updated.action_steps || '[]')
    }
  });
});

/**
 * Auditor Formal Sign-off and Closeout
 */
router.post('/:id/signoff', authenticateToken, requireRole(['auditor']), (req, res) => {
  const capId = req.params.id;
  const current = db.prepare('SELECT * FROM corrective_action_plans WHERE id = ?').get(capId);

  if (!current) {
    return res.status(404).json({ error: 'CAP_NOT_FOUND', message: 'CAP not found.' });
  }

  db.prepare(`
    UPDATE corrective_action_plans 
    SET status = 'Closed',
        progress_pct = 100,
        audit_signoff = 1,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(capId);

  if (current.related_exception_id) {
    db.prepare("UPDATE exceptions SET status = 'Remediated', resolved_at = datetime('now') WHERE id = ?").run(current.related_exception_id);
  }

  // Log formal closeout
  db.prepare(`
    INSERT INTO audit_logs (event_type, actor_id, actor_name, actor_role, action_detail, resource_id, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    'CAP_AUDIT_SIGNOFF',
    req.user.id,
    req.user.name,
    req.user.role,
    `FORMAL AUDIT SIGN-OFF: Auditor ${req.user.name} verified remediation evidence and closed ${current.cap_number}.`,
    current.cap_number,
    req.ip || '10.142.22.88'
  );

  const updated = db.prepare('SELECT * FROM corrective_action_plans WHERE id = ?').get(capId);
  res.json({
    message: `CAP ${current.cap_number} successfully closed with formal Auditor sign-off.`,
    cap: {
      ...updated,
      action_steps: JSON.parse(updated.action_steps || '[]')
    }
  });
});

module.exports = router;

