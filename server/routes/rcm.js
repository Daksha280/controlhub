const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * List Risk & Control Matrix (RCM) Controls
 */
router.get('/', authenticateToken, (req, res) => {
  const { risk_level, control_type, status, search } = req.query;

  let sql = 'SELECT * FROM rcm_controls WHERE 1=1';
  const params = [];

  if (risk_level && risk_level !== 'all') {
    sql += ' AND risk_level = ?';
    params.push(risk_level);
  }

  if (control_type && control_type !== 'all') {
    sql += ' AND control_type = ?';
    params.push(control_type);
  }

  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    sql += ' AND (control_id LIKE ? OR process_step LIKE ? OR inherent_risk LIKE ? OR control_description LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  sql += ' ORDER BY control_id ASC';

  const controls = db.prepare(sql).all(...params);
  res.json(controls);
});

/**
 * Get single RCM Control with linked CAPs and exceptions
 */
router.get('/:id', authenticateToken, (req, res) => {
  const control = db.prepare('SELECT * FROM rcm_controls WHERE id = ?').get(req.params.id);
  if (!control) {
    return res.status(404).json({ error: 'CONTROL_NOT_FOUND', message: 'Control not found.' });
  }

  const relatedCaps = db.prepare('SELECT * FROM corrective_action_plans WHERE related_control_id = ?').all(control.control_id);

  res.json({
    control,
    relatedCaps
  });
});

/**
 * Update RCM Control Status & Testing Metrics (Auditor only)
 */
router.patch('/:id', authenticateToken, requireRole(['auditor']), (req, res) => {
  const { status, deficiencies_noted, sample_size, next_review_date } = req.body;
  const controlId = req.params.id;

  const current = db.prepare('SELECT * FROM rcm_controls WHERE id = ?').get(controlId);
  if (!current) {
    return res.status(404).json({ error: 'CONTROL_NOT_FOUND', message: 'Control not found.' });
  }

  const updates = [];
  const params = [];

  if (status) {
    updates.push('status = ?');
    params.push(status);
    updates.push("last_tested_at = datetime('now')");
  }

  if (deficiencies_noted !== undefined) {
    updates.push('deficiencies_noted = ?');
    params.push(deficiencies_noted);
  }

  if (sample_size !== undefined) {
    updates.push('sample_size = ?');
    params.push(sample_size);
  }

  if (next_review_date) {
    updates.push('next_review_date = ?');
    params.push(next_review_date);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'NO_UPDATES', message: 'No fields to update.' });
  }

  params.push(controlId);
  db.prepare(`UPDATE rcm_controls SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  // Log to audit journal
  db.prepare(`
    INSERT INTO audit_logs (event_type, actor_id, actor_name, actor_role, action_detail, resource_id, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    'RCM_CONTROL_UPDATED',
    req.user.id,
    req.user.name,
    req.user.role,
    `Updated RCM Control ${current.control_id} (${current.process_step}) to status '${status || current.status}'. Sample: ${sample_size || current.sample_size}, Deficiencies: ${deficiencies_noted || current.deficiencies_noted}.`,
    current.control_id,
    req.ip || '10.142.22.88'
  );

  const updated = db.prepare('SELECT * FROM rcm_controls WHERE id = ?').get(controlId);
  res.json({
    message: `Control ${current.control_id} updated successfully.`,
    control: updated
  });
});

module.exports = router;

