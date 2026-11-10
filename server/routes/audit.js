const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * List Audit Logs with filtering
 */
router.get('/', authenticateToken, (req, res) => {
  const { event_type, role, search, limit = 100 } = req.query;

  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (event_type && event_type !== 'all') {
    sql += ' AND event_type = ?';
    params.push(event_type);
  }

  if (role && role !== 'all') {
    sql += ' AND actor_role = ?';
    params.push(role);
  }

  if (search) {
    sql += ' AND (action_detail LIKE ? OR actor_name LIKE ? OR resource_id LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit, 10) || 100);

  const logs = db.prepare(sql).all(...params);
  res.json(logs);
});

module.exports = router;

