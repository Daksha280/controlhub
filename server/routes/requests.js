const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole, enforceSegregationOfDuties } = require('../middleware/auth');
const RuleEngine = require('../services/ruleEngine');

/**
 * List all card servicing requests with rich filtering
 */
router.get('/', authenticateToken, (req, res) => {
  const { status, type, tier, search, queue } = req.query;

  let sql = 'SELECT * FROM card_requests WHERE 1=1';
  const params = [];

  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (type && type !== 'all') {
    sql += ' AND transaction_type = ?';
    params.push(type);
  }

  if (tier && tier !== 'all') {
    sql += ' AND card_tier = ?';
    params.push(tier);
  }

  if (search) {
    sql += ' AND (cardholder_name LIKE ? OR masked_pan LIKE ? OR request_number LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  if (queue === 'pending_checker') {
    sql += " AND status = 'Pending' AND requires_dual_approval = 1";
  }

  sql += ' ORDER BY created_at DESC';

  const requests = db.prepare(sql).all(...params);
  res.json(requests);
});

/**
 * Get single request details
 */
router.get('/:id', authenticateToken, (req, res) => {
  const request = db.prepare('SELECT * FROM card_requests WHERE id = ?').get(req.params.id);
  if (!request) {
    return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Request not found.' });
  }

  // Fetch related audit logs
  const auditLogs = db.prepare(`
    SELECT * FROM audit_logs 
    WHERE resource_id = ? OR action_detail LIKE ?
    ORDER BY created_at ASC
  `).all(request.request_number, `%${request.request_number}%`);

  // Fetch any related exceptions
  const exceptions = db.prepare('SELECT * FROM exceptions WHERE request_id = ?').all(request.id);

  res.json({
    request,
    auditLogs,
    exceptions
  });
});

/**
 * Submit New Card Servicing Action (Maker)
 */
router.post('/', authenticateToken, requireRole(['maker']), (req, res) => {
  const {
    cardholder_name,
    masked_pan,
    card_tier,
    transaction_type,
    amount,
    previous_limit,
    new_limit,
    reason,
    channel
  } = req.body;

  if (!cardholder_name || !masked_pan || !card_tier || !transaction_type || !reason) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Please provide all mandatory servicing fields.' });
  }

  // Generate Request ID
  const count = db.prepare('SELECT COUNT(*) as cnt FROM card_requests').get().cnt + 1;
  const requestNumber = `REQ-2026-${String(count).padStart(4, '0')}`;

  const numAmount = parseInt(amount, 10) || 0;
  const numPrevLimit = parseInt(previous_limit, 10) || 0;
  const numNewLimit = parseInt(new_limit, 10) || 0;

  // INTERNAL CONTROL POLICY LOGIC:
  // 1. Fee Waiver: > ¥10,000 strictly requires Checker dual approval.
  //    <= ¥10,000 can be auto-approved under Maker daily discretion.
  // 2. Limit Adjustment: Any limit increase requires Checker approval.
  // 3. Card Replacement: Standard policy requires single Maker submission,
  //    but if within 48h of another replacement for same PAN, high-risk velocity is triggered.
  let requiresDualApproval = 0;
  let initialStatus = 'Pending';

  if (transaction_type === 'Annual Fee Waiver (JPY)') {
    if (numAmount > 10000) {
      requiresDualApproval = 1;
      initialStatus = 'Pending';
    } else {
      requiresDualApproval = 0;
      initialStatus = 'Auto-Approved';
    }
  } else if (transaction_type === 'Credit Limit Adjustment (JPY)') {
    if (numNewLimit > numPrevLimit) {
      requiresDualApproval = 1;
      initialStatus = 'Pending';
    } else {
      requiresDualApproval = 0;
      initialStatus = 'Auto-Approved';
    }
  } else if (transaction_type === 'Card Replacement Request') {
    requiresDualApproval = 0;
    initialStatus = 'Approved';
  }

  const result = db.prepare(`
    INSERT INTO card_requests (
      request_number, cardholder_name, masked_pan, card_tier, transaction_type,
      amount, previous_limit, new_limit, reason, requires_dual_approval,
      status, maker_id, maker_name, channel, ip_address, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    requestNumber,
    cardholder_name,
    masked_pan,
    card_tier,
    transaction_type,
    numAmount,
    numPrevLimit,
    numNewLimit,
    reason,
    requiresDualApproval,
    initialStatus,
    req.user.id,
    req.user.name,
    channel || 'Tokyo Concierge',
    req.ip || '10.142.18.22'
  );

  const newRequestId = Number(result.lastInsertRowid);

  // Log to Audit Journal
  db.prepare(`
    INSERT INTO audit_logs (event_type, actor_id, actor_name, actor_role, action_detail, resource_id, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    'REQUEST_CREATED',
    req.user.id,
    req.user.name,
    req.user.role,
    `Submitted ${transaction_type} for ${cardholder_name} (${masked_pan}). Status: ${initialStatus}. Requires Dual: ${requiresDualApproval ? 'YES (>¥10,000 threshold)' : 'NO'}.`,
    requestNumber,
    req.ip || '10.142.18.22'
  );

  // Real-time Velocity Check for Card Replacements
  if (transaction_type === 'Card Replacement Request') {
    const recentReplacements = db.prepare(`
      SELECT * FROM card_requests 
      WHERE masked_pan = ? AND transaction_type = 'Card Replacement Request' AND id != ?
      AND created_at >= datetime('now', '-48 hours')
    `).all(masked_pan, newRequestId);

    if (recentReplacements.length > 0) {
      // Create high-risk velocity exception
      const excCount = db.prepare('SELECT COUNT(*) as cnt FROM exceptions').get().cnt + 1;
      const excNum = `EXC-2026-${String(excCount).padStart(4, '0')}`;
      const rule = db.prepare("SELECT * FROM ccm_rules WHERE rule_code = 'RULE-VEL-003'").get();

      db.prepare(`
        INSERT INTO exceptions (
          exception_number, rule_id, rule_code, request_id, account_number_masked,
          severity, title, description, detected_value, status, assigned_to,
          risk_analyst_notes, created_at
        ) VALUES (?, ?, 'RULE-VEL-003', ?, ?, 'High', ?, ?, ?, 'Under Investigation', 'Internal Control (Ayumi Ito)', 'Real-time alert triggered upon request submission.', datetime('now'))
      `).run(
        excNum,
        rule ? rule.id : 3,
        newRequestId,
        masked_pan,
        `High-Risk Velocity: Multiple Card Replacements (<48h) on ${masked_pan}`,
        `Account ${masked_pan} requested a replacement within 48h of request ${recentReplacements[0].request_number}. Potential ATO account takeover attempt.`,
        `Previous request: ${recentReplacements[0].request_number} at ${recentReplacements[0].created_at}`
      );

      // Also log security audit
      db.prepare(`
        INSERT INTO audit_logs (event_type, actor_id, actor_name, actor_role, action_detail, resource_id, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        'VELOCITY_ALERT_TRIGGERED',
        req.user.id,
        req.user.name,
        req.user.role,
        `ALERT: Real-time velocity suppression triggered on ${masked_pan}. 2 replacement requests within 48h.`,
        requestNumber,
        req.ip || '10.142.18.22'
      );
    }
  }

  const createdRequest = db.prepare('SELECT * FROM card_requests WHERE id = ?').get(newRequestId);
  res.status(201).json({
    message: initialStatus === 'Auto-Approved'
      ? 'Request processed and auto-approved (within Maker discretionary delegation).'
      : 'Request submitted successfully. Routed to Checker queue for managerial approval.',
    request: createdRequest
  });
});

/**
 * Approve Card Servicing Request (Checker)
 * Strictly enforces Segregation of Duties (SoD) via middleware
 */
router.post('/:id/approve', authenticateToken, requireRole(['checker']), enforceSegregationOfDuties, (req, res) => {
  const { remarks } = req.body;
  const requestId = req.params.id;
  const cardReq = req.cardRequest;

  if (cardReq.status !== 'Pending') {
    return res.status(400).json({ error: 'INVALID_STATUS', message: `Request is already in status '${cardReq.status}'.` });
  }

  // Update status to Approved
  db.prepare(`
    UPDATE card_requests 
    SET status = 'Approved',
        checker_id = ?,
        checker_name = ?,
        checker_remarks = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    req.user.id,
    req.user.name,
    remarks || 'Managerial sign-off verified and approved per ICS Japan operating procedures.',
    requestId
  );

  // Log to Audit Journal
  db.prepare(`
    INSERT INTO audit_logs (event_type, actor_id, actor_name, actor_role, action_detail, resource_id, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    'REQUEST_APPROVED',
    req.user.id,
    req.user.name,
    req.user.role,
    `APPROVED: Request ${cardReq.request_number} (${cardReq.transaction_type} of ¥${cardReq.amount.toLocaleString()}) by Checker ${req.user.name}. Remarks: "${remarks || 'Approved'}". SoD validated (Maker: ${cardReq.maker_name}).`,
    cardReq.request_number,
    req.ip || '10.142.18.35'
  );

  const updated = db.prepare('SELECT * FROM card_requests WHERE id = ?').get(requestId);
  res.json({
    message: `Request ${cardReq.request_number} has been approved with dual authorization.`,
    request: updated
  });
});

/**
 * Reject Card Servicing Request (Checker)
 */
router.post('/:id/reject', authenticateToken, requireRole(['checker']), enforceSegregationOfDuties, (req, res) => {
  const { remarks } = req.body;
  const requestId = req.params.id;
  const cardReq = req.cardRequest;

  if (cardReq.status !== 'Pending') {
    return res.status(400).json({ error: 'INVALID_STATUS', message: `Request is already in status '${cardReq.status}'.` });
  }

  if (!remarks) {
    return res.status(400).json({ error: 'REMARKS_REQUIRED', message: 'Rejection remarks are mandatory for supervisory audit trail.' });
  }

  db.prepare(`
    UPDATE card_requests 
    SET status = 'Rejected',
        checker_id = ?,
        checker_name = ?,
        checker_remarks = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(req.user.id, req.user.name, remarks, requestId);

  // Log rejection in Audit Journal
  db.prepare(`
    INSERT INTO audit_logs (event_type, actor_id, actor_name, actor_role, action_detail, resource_id, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    'REQUEST_REJECTED',
    req.user.id,
    req.user.name,
    req.user.role,
    `REJECTED: Request ${cardReq.request_number} rejected by Checker ${req.user.name}. Reason: "${remarks}".`,
    cardReq.request_number,
    req.ip || '10.142.18.35'
  );

  const updated = db.prepare('SELECT * FROM card_requests WHERE id = ?').get(requestId);
  res.json({
    message: `Request ${cardReq.request_number} has been rejected.`,
    request: updated
  });
});

module.exports = router;

