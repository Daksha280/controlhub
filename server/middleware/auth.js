const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'ics-controlhub-super-secret-key-japan-2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Access denied. Valid JWT bearer token required.'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        error: 'INVALID_TOKEN',
        message: 'JWT token has expired or is invalid.'
      });
    }

    // Attach fresh user record from DB
    const user = db.prepare('SELECT id, username, email, name, role, department, employee_id FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User associated with token no longer exists.' });
    }

    req.user = user;
    next();
  });
}

/**
 * RBAC Role Authorization Middleware
 * @param {Array<string>} roles - e.g. ['maker', 'checker'] or ['auditor']
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN_ROLE_ACCESS',
        message: `Action restricted. Required role: [${roles.join(', ')}]. Your current role: '${req.user.role}'.`,
        requiredRoles: roles,
        userRole: req.user.role
      });
    }

    next;
    next();
  };
}

/**
 * Segregation of Duties (SoD) Enforcement Middleware
 * Ensures the Approver (Checker) is strictly distinct from the Request Originator (Maker)
 */
function enforceSegregationOfDuties(req, res, next) {
  const requestId = req.params.id;
  const currentUser = req.user;

  if (!requestId) {
    return next();
  }

  const cardReq = db.prepare('SELECT * FROM card_requests WHERE id = ?').get(requestId);
  if (!cardReq) {
    return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Card servicing request not found.' });
  }

  // Check if current user is the same person as the maker
  if (cardReq.maker_id === currentUser.id) {
    // Log deliberate SoD attempt to audit logs
    db.prepare(`
      INSERT INTO audit_logs (event_type, actor_id, actor_name, actor_role, action_detail, resource_id, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      'SOD_VIOLATION_BLOCKED',
      currentUser.id,
      currentUser.name,
      currentUser.role,
      `BLOCKED: User attempted to approve their own request ${cardReq.request_number} (${cardReq.transaction_type} of ¥${cardReq.amount.toLocaleString()}). Enforced by SoD engine.`,
      cardReq.request_number,
      req.ip || '10.142.18.22'
    );

    return res.status(403).json({
      error: 'SOD_POLICY_VIOLATION',
      message: `Segregation of Duties Policy Violation: You cannot approve request ${cardReq.request_number} because you created it. An independent Checker is required by ICS Control Policy.`,
      violationType: 'MAKER_CHECKER_IDENTITY_COLLISION',
      makerId: cardReq.maker_id,
      checkerId: currentUser.id
    });
  }

  req.cardRequest = cardReq;
  next();
}

module.exports = {
  authenticateToken,
  requireRole,
  enforceSegregationOfDuties,
  JWT_SECRET
};

