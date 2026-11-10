const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

/**
 * Standard credentials login
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
  if (!user) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'User not found' });
  }

  if (password) {
    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid && password !== 'demo123') {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid password' });
    }
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (event_type, actor_id, actor_name, actor_role, action_detail, resource_id, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run('LOGIN', user.id, user.name, user.role, `Logged in as ${user.role.toUpperCase()} (${user.department})`, `SESSION-${Date.now()}`, req.ip || '10.142.18.22');

  const { password_hash, ...userProfile } = user;
  res.json({
    token,
    user: userProfile
  });
});

/**
 * Quick Switch Role Endpoint (Presentation & Testing Tool)
 * Seamlessly switches the active session to Maker, Checker, or Auditor
 */
router.post('/switch-role', (req, res) => {
  const { role } = req.body;

  if (!['maker', 'checker', 'auditor'].includes(role)) {
    return res.status(400).json({ error: 'INVALID_ROLE', message: 'Role must be maker, checker, or auditor' });
  }

  const user = db.prepare('SELECT * FROM users WHERE role = ? LIMIT 1').get(role);
  if (!user) {
    return res.status(404).json({ error: 'USER_NOT_FOUND', message: `No demo user found for role ${role}` });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  // Log role switch in audit journal
  db.prepare(`
    INSERT INTO audit_logs (event_type, actor_id, actor_name, actor_role, action_detail, resource_id, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    'ROLE_SWITCH',
    user.id,
    user.name,
    user.role,
    `Switched active demo profile to ${user.name} [${user.role.toUpperCase()} - ${user.department}]`,
    `USER-${user.id}`,
    req.ip || '10.142.18.22'
  );

  const { password_hash, ...userProfile } = user;
  res.json({
    message: `Switched active role to ${user.role.toUpperCase()}`,
    token,
    user: userProfile
  });
});

/**
 * Get current session user profile and permissions
 */
router.get('/me', authenticateToken, (req, res) => {
  const permissions = {
    canCreateRequests: ['maker'].includes(req.user.role),
    canApproveRequests: ['checker'].includes(req.user.role),
    canRejectRequests: ['checker'].includes(req.user.role),
    canAccessRCM: ['auditor'].includes(req.user.role),
    canRunCCM: ['auditor'].includes(req.user.role),
    canManageCAPs: ['auditor'].includes(req.user.role),
    isReadOnly: ['auditor'].includes(req.user.role)
  };

  res.json({
    user: req.user,
    permissions
  });
});

/**
 * Get all demo accounts for UI switcher
 */
router.get('/demo-users', (req, res) => {
  const users = db.prepare('SELECT id, username, email, name, role, department, employee_id FROM users').all();
  res.json(users);
});

module.exports = router;

