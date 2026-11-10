const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'data', 'controlhub.sqlite');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency and performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    -- Users & RBAC
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('maker', 'checker', 'auditor')),
      department TEXT NOT NULL,
      employee_id TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Card Servicing Operational Requests
    CREATE TABLE IF NOT EXISTS card_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_number TEXT UNIQUE NOT NULL,
      cardholder_name TEXT NOT NULL,
      masked_pan TEXT NOT NULL,
      card_tier TEXT NOT NULL CHECK(card_tier IN ('Centurion', 'Platinum', 'Gold', 'Green', 'Corporate')),
      transaction_type TEXT NOT NULL CHECK(transaction_type IN ('Annual Fee Waiver (JPY)', 'Credit Limit Adjustment (JPY)', 'Card Replacement Request')),
      amount INTEGER DEFAULT 0,
      previous_limit INTEGER DEFAULT 0,
      new_limit INTEGER DEFAULT 0,
      reason TEXT NOT NULL,
      requires_dual_approval INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Auto-Approved')),
      maker_id INTEGER NOT NULL,
      maker_name TEXT NOT NULL,
      checker_id INTEGER,
      checker_name TEXT,
      checker_remarks TEXT,
      channel TEXT DEFAULT 'Tokyo Concierge',
      ip_address TEXT DEFAULT '10.142.18.22',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      FOREIGN KEY (maker_id) REFERENCES users(id),
      FOREIGN KEY (checker_id) REFERENCES users(id)
    );

    -- Continuous Control Monitoring (CCM) Rules
    CREATE TABLE IF NOT EXISTS ccm_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('Critical', 'High', 'Medium', 'Low')),
      category TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      threshold_value INTEGER DEFAULT 0
    );

    -- Exceptions Flagged by CCM Engine
    CREATE TABLE IF NOT EXISTS exceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exception_number TEXT UNIQUE NOT NULL,
      rule_id INTEGER NOT NULL,
      rule_code TEXT NOT NULL,
      request_id INTEGER,
      account_number_masked TEXT,
      severity TEXT NOT NULL CHECK(severity IN ('Critical', 'High', 'Medium', 'Low')),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      detected_value TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Under Investigation' CHECK(status IN ('Under Investigation', 'Justified', 'Confirmed Exception', 'Remediated')),
      assigned_to TEXT DEFAULT 'Internal Control (Ayumi Ito)',
      risk_analyst_notes TEXT,
      cap_id INTEGER,
      created_at DATETIME NOT NULL,
      resolved_at DATETIME,
      FOREIGN KEY (rule_id) REFERENCES ccm_rules(id),
      FOREIGN KEY (request_id) REFERENCES card_requests(id)
    );

    -- Risk & Control Matrix (RCM)
    CREATE TABLE IF NOT EXISTS rcm_controls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      control_id TEXT UNIQUE NOT NULL,
      process_step TEXT NOT NULL,
      inherent_risk TEXT NOT NULL,
      risk_level TEXT NOT NULL CHECK(risk_level IN ('High', 'Med', 'Low')),
      control_description TEXT NOT NULL,
      control_type TEXT NOT NULL CHECK(control_type IN ('Preventive', 'Detective')),
      control_nature TEXT NOT NULL CHECK(control_nature IN ('Automated', 'IT-Dependent Manual', 'Manual')),
      testing_frequency TEXT NOT NULL,
      control_owner TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Effective', 'Partially Effective', 'Deficient')),
      last_tested_at DATETIME,
      next_review_date TEXT,
      sample_size INTEGER DEFAULT 50,
      deficiencies_noted INTEGER DEFAULT 0
    );

    -- Corrective Action Plans (CAP)
    CREATE TABLE IF NOT EXISTS corrective_action_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cap_number TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      finding_description TEXT NOT NULL,
      root_cause TEXT NOT NULL,
      related_control_id TEXT,
      related_exception_id INTEGER,
      owner TEXT NOT NULL,
      due_date TEXT NOT NULL,
      priority TEXT NOT NULL CHECK(priority IN ('Critical', 'High', 'Medium', 'Low')),
      status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open', 'In Progress', 'Under Review', 'Closed')),
      progress_pct INTEGER DEFAULT 0,
      action_steps TEXT NOT NULL,
      audit_signoff INTEGER DEFAULT 0,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      FOREIGN KEY (related_exception_id) REFERENCES exceptions(id)
    );

    -- Audit Logs (Chronological Security & Control Journal)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      actor_id INTEGER,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action_detail TEXT NOT NULL,
      resource_id TEXT,
      ip_address TEXT DEFAULT '127.0.0.1',
      created_at DATETIME NOT NULL
    );
  `);
}

function seedDatabase() {
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  if (userCount > 0) {
    return; // Already seeded
  }

  console.log('[ICS ControlHub DB] Initializing fresh schema & seed data...');

  const passwordHash = bcrypt.hashSync('maker123', 8);
  const checkerHash = bcrypt.hashSync('checker123', 8);
  const auditorHash = bcrypt.hashSync('auditor123', 8);

  // 1. Seed Users (Maker, Checker, Auditor)
  const insertUser = db.prepare(`
    INSERT INTO users (username, email, name, role, department, employee_id, password_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const maker = insertUser.run('maker_sato', 'maker@controlhub.jp', 'Kenji Sato', 'maker', 'Card Operations - Servicing Desk', 'ICS-JP-4091', passwordHash);
  const checker = insertUser.run('checker_tanaka', 'checker@controlhub.jp', 'Yuki Tanaka', 'checker', 'Operations Governance & Manager Approvals', 'ICS-JP-1102', checkerHash);
  const auditor = insertUser.run('auditor_ito', 'auditor@controlhub.jp', 'Ayumi Ito', 'auditor', 'Operational Risk, Compliance & Internal Control', 'ICS-JP-0844', auditorHash);

  const makerId = Number(maker.lastInsertRowid);
  const checkerId = Number(checker.lastInsertRowid);
  const auditorId = Number(auditor.lastInsertRowid);

  // 2. Seed CCM Rules
  const insertRule = db.prepare(`
    INSERT INTO ccm_rules (rule_code, name, description, severity, category, is_active, threshold_value)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const r1 = insertRule.run(
    'RULE-SOD-001',
    'Segregation of Duties (SoD) Self-Approval Breach',
    'Detects any operational action where the Maker and Checker are the identical user ID, violating segregation of duties principles.',
    'Critical',
    'Segregation of Duties',
    1,
    0
  );

  const r2 = insertRule.run(
    'RULE-THR-002',
    'Unauthorized Threshold Breach (>¥10,000)',
    'Detects fee waivers exceeding ¥10,000 or credit limit increases processed without secondary managerial Checker sign-off.',
    'High',
    'Authorization Limits',
    1,
    10000
  );

  const r3 = insertRule.run(
    'RULE-VEL-003',
    'High-Risk Velocity Card Replacement (<48h)',
    'Detects accounts experiencing 2 or more card replacement requests within a 48-hour rolling window (high risk of Account Takeover/ATO).',
    'High',
    'Fraud & Identity Takeover',
    1,
    48
  );

  const r4 = insertRule.run(
    'RULE-OFF-004',
    'Off-Hours High-Value Servicing (>¥1,000,000 Limit Hike)',
    'Detects credit limit changes exceeding ¥1,000,000 executed outside standard Tokyo business hours (09:00 - 18:00 JST).',
    'Medium',
    'Operational Anomaly',
    1,
    1000000
  );

  const ruleIdSod = Number(r1.lastInsertRowid);
  const ruleIdThr = Number(r2.lastInsertRowid);
  const ruleIdVel = Number(r3.lastInsertRowid);

  // 3. Seed Risk & Control Matrix (RCM)
  const insertRcm = db.prepare(`
    INSERT INTO rcm_controls (
      control_id, process_step, inherent_risk, risk_level, control_description,
      control_type, control_nature, testing_frequency, control_owner, status,
      last_tested_at, next_review_date, sample_size, deficiencies_noted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertRcm.run(
    'CTL-ICS-001',
    'Fee Assessment & Concessions',
    'Unauthorized financial leakage through rogue or excessive manual fee waivers by frontline operators.',
    'High',
    'Systemic threshold gating requiring secondary Checker approval for all fee concessions exceeding ¥10,000 JPY.',
    'Preventive',
    'Automated',
    'Continuous',
    'Operations Governance',
    'Partially Effective',
    '2026-11-01 10:30:00',
    '2026-12-01',
    120,
    1
  );

  insertRcm.run(
    'CTL-ICS-002',
    'Segregation of Duties (SoD)',
    'Single operator executing unauthorized account alterations without independent supervisory oversight.',
    'High',
    'Role-based access matrix and cryptographic token binding preventing Makers from approving their own submitted requests.',
    'Preventive',
    'Automated',
    'Continuous',
    'Compliance & IT Security',
    'Partially Effective',
    '2026-11-03 14:15:00',
    '2026-12-01',
    95,
    1
  );

  insertRcm.run(
    'CTL-ICS-003',
    'Credit Underwriting & Line Maintenance',
    'Excessive credit exposure granted without underwriting verification, exceeding Tokyo branch credit risk appetite.',
    'High',
    'Mandatory credit committee dual sign-off on all line hikes exceeding ¥1,000,000 with debt-burden ratio verification.',
    'Preventive',
    'IT-Dependent Manual',
    'Weekly',
    'Credit Risk Management',
    'Effective',
    '2026-11-05 09:00:00',
    '2026-11-20',
    75,
    0
  );

  insertRcm.run(
    'CTL-ICS-004',
    'Card Embossing & Emergency Replacement',
    'Account Takeover (ATO) and card interception through fraudulent emergency replacement dispatches.',
    'High',
    'Automated 48-hour velocity monitoring blocking multiple re-issuance requests to unverified residential addresses.',
    'Detective',
    'Automated',
    'Continuous',
    'Fraud Risk Operations',
    'Deficient',
    '2026-10-28 16:45:00',
    '2026-11-15',
    80,
    2
  );

  insertRcm.run(
    'CTL-ICS-005',
    'AML / Sanctions Screening',
    'Card servicing or limit adjustment provided to designated sanctions target or PEP without enhanced due diligence.',
    'High',
    'Real-time automated screening against Japan MOF, OFAC, and UN sanction lists on every card servicing trigger.',
    'Preventive',
    'Automated',
    'Continuous',
    'AML & Sanctions Compliance',
    'Effective',
    '2026-11-08 11:20:00',
    '2026-12-08',
    250,
    0
  );

  insertRcm.run(
    'CTL-ICS-006',
    'Off-Hours Servicing Oversight',
    'Operator tampering or malicious adjustments entered during non-business hours without surveillance.',
    'Med',
    'Detective exception log reviewed daily at 09:00 JST by Operations Supervisor for any activity between 19:00 - 08:00.',
    'Detective',
    'Manual',
    'Daily',
    'Operations Supervision',
    'Effective',
    '2026-11-09 09:30:00',
    '2026-11-16',
    60,
    0
  );

  // 4. Seed Realistic Card Servicing Records (28 records, with 3 deliberate control breaches)
  const insertReq = db.prepare(`
    INSERT INTO card_requests (
      request_number, cardholder_name, masked_pan, card_tier, transaction_type,
      amount, previous_limit, new_limit, reason, requires_dual_approval,
      status, maker_id, maker_name, checker_id, checker_name, checker_remarks,
      channel, ip_address, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Realistic seed data list (Amex ICS Japan - ¥ Currency)
  const seedRequests = [
    // 1. Normal Approved fee waiver with dual approval
    {
      req: 'REQ-2026-0801',
      holder: 'Hiroshi Takahashi',
      pan: '3759-874210-12005',
      tier: 'Platinum',
      type: 'Annual Fee Waiver (JPY)',
      amount: 165000,
      prevLim: 0,
      newLim: 0,
      reason: 'Long-standing Centurion migration candidate; retention concession approved per guideline 4.2.',
      reqDual: 1,
      status: 'Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: checkerId,
      checkerName: 'Yuki Tanaka',
      remarks: 'Concession verified against 10-year cardholder spend profile (>¥15M annual spend). Approved.',
      channel: 'Tokyo Concierge',
      ip: '10.142.18.22',
      created: '2026-10-12 11:24:00',
      updated: '2026-10-12 13:10:00'
    },
    // 2. Normal Auto-Approved fee waiver <= 10,000 (no checker required)
    {
      req: 'REQ-2026-0802',
      holder: 'Emi Watanabe',
      pan: '3759-712890-44002',
      tier: 'Gold',
      type: 'Annual Fee Waiver (JPY)',
      amount: 5500,
      prevLim: 0,
      newLim: 0,
      reason: 'Late payment fee waiver due to bank transit holiday delay in Fukuoka branch.',
      reqDual: 0,
      status: 'Auto-Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: null,
      checkerName: null,
      remarks: 'Under ¥10,000 threshold. Auto-processed within Maker operational authority.',
      channel: 'Digital IVR',
      ip: '10.142.18.22',
      created: '2026-10-14 09:40:00',
      updated: '2026-10-14 09:40:00'
    },
    // 3. Normal Limit Adjustment Approved with Checker
    {
      req: 'REQ-2026-0803',
      holder: 'Takeshi Yamamoto',
      pan: '3759-650123-99104',
      tier: 'Platinum',
      type: 'Credit Limit Adjustment (JPY)',
      amount: 1000000,
      prevLim: 2000000,
      newLim: 3000000,
      reason: 'Member traveling to Paris for luxury exhibition; requested temporary limit elevation.',
      reqDual: 1,
      status: 'Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: checkerId,
      checkerName: 'Yuki Tanaka',
      remarks: 'Confirmed asset documentation and clear repayment history with zero delinquency.',
      channel: 'Tokyo Concierge',
      ip: '10.142.18.22',
      created: '2026-10-16 14:12:00',
      updated: '2026-10-16 15:30:00'
    },

    // 4. *** DELIBERATE BREACH 1: SoD VIOLATION (Self-Approval) ***
    {
      req: 'REQ-2026-0804',
      holder: 'Shun Ogawa',
      pan: '3759-994102-33201',
      tier: 'Centurion',
      type: 'Annual Fee Waiver (JPY)',
      amount: 385000,
      prevLim: 0,
      newLim: 0,
      reason: 'VIP relationship management concession override.',
      reqDual: 1,
      status: 'Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: makerId, // <--- CRITICAL SOD VIOLATION: Maker approved own request!
      checkerName: 'Kenji Sato',
      remarks: 'Manager was away on leave, self-approved pursuant to emergency override ticket #9921.',
      channel: 'Executive Operations Desk',
      ip: '10.142.18.22',
      created: '2026-10-18 17:05:00',
      updated: '2026-10-18 17:06:00'
    },

    // 5. Normal Card Replacement Approved
    {
      req: 'REQ-2026-0805',
      holder: 'Sakura Mori',
      pan: '3759-330192-88123',
      tier: 'Green',
      type: 'Card Replacement Request',
      amount: 0,
      prevLim: 0,
      newLim: 0,
      reason: 'Damaged chip reported at Ginza shopping terminal. Expedited courier dispatch.',
      reqDual: 0,
      status: 'Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: null,
      checkerName: null,
      remarks: 'Single replacement request within 30 days. Standard protocol verified.',
      channel: 'Tokyo Concierge',
      ip: '10.142.18.22',
      created: '2026-10-20 10:15:00',
      updated: '2026-10-20 10:15:00'
    },
    // 6. Rejected Request by Checker
    {
      req: 'REQ-2026-0806',
      holder: 'Daiki Kobayashi',
      pan: '3759-112349-77401',
      tier: 'Gold',
      type: 'Credit Limit Adjustment (JPY)',
      amount: 1500000,
      prevLim: 1000000,
      newLim: 2500000,
      reason: 'Cardholder requested limit increase for speculative crypto transaction.',
      reqDual: 1,
      status: 'Rejected',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: checkerId,
      checkerName: 'Yuki Tanaka',
      remarks: 'Rejected: Inconsistent with ICS Credit Policy Section 9 (prohibited speculative use).',
      channel: 'Digital IVR',
      ip: '10.142.18.22',
      created: '2026-10-22 13:50:00',
      updated: '2026-10-22 14:40:00'
    },
    // 7. Normal Fee Waiver
    {
      req: 'REQ-2026-0807',
      holder: 'Keiko Sato',
      pan: '3759-556102-12093',
      tier: 'Gold',
      type: 'Annual Fee Waiver (JPY)',
      amount: 31900,
      prevLim: 0,
      newLim: 0,
      reason: 'Goodwill adjustment for dispute resolution regarding double-billed merchant charge in Roppongi.',
      reqDual: 1,
      status: 'Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: checkerId,
      checkerName: 'Yuki Tanaka',
      remarks: 'Merchant chargeback confirmed; waiver granted as client service remedy.',
      channel: 'Tokyo Concierge',
      ip: '10.142.18.22',
      created: '2026-10-24 16:10:00',
      updated: '2026-10-24 16:45:00'
    },
    // 8. Normal Limit Adjustment
    {
      req: 'REQ-2026-0808',
      holder: 'Ryota Suzuki',
      pan: '3759-441298-55102',
      tier: 'Platinum',
      type: 'Credit Limit Adjustment (JPY)',
      amount: 2000000,
      prevLim: 3000000,
      newLim: 5000000,
      reason: 'Executive corporate cardholder business expense expansion.',
      reqDual: 1,
      status: 'Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: checkerId,
      checkerName: 'Yuki Tanaka',
      remarks: 'Approved following underwriting credit bureau (CIC/JICC) review.',
      channel: 'Executive Operations Desk',
      ip: '10.142.18.22',
      created: '2026-10-26 11:00:00',
      updated: '2026-10-26 12:15:00'
    },

    // 9. *** DELIBERATE BREACH 2: THRESHOLD BREACH (>¥10,000 without Checker Approval) ***
    {
      req: 'REQ-2026-0809',
      holder: 'Naoko Ito',
      pan: '3759-661902-88001',
      tier: 'Platinum',
      type: 'Annual Fee Waiver (JPY)',
      amount: 55000, // > ¥10,000!
      prevLim: 0,
      newLim: 0,
      reason: 'Retention waiver negotiated during card cancellation consultation.',
      reqDual: 1,
      status: 'Approved', // <--- Bypassed! Marked Approved without any Checker ID!
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: null, // <--- No checker sign-off!
      checkerName: null,
      remarks: null,
      channel: 'Branch Escalation',
      ip: '10.142.18.22',
      created: '2026-10-27 15:30:00',
      updated: '2026-10-27 15:30:00'
    },

    // 10. *** DELIBERATE BREACH 3A: HIGH-RISK VELOCITY REPLACEMENT 1 (<48h) ***
    {
      req: 'REQ-2026-0810',
      holder: 'Kenzo Miyazawa',
      pan: '3759-881023-45009',
      tier: 'Platinum',
      type: 'Card Replacement Request',
      amount: 0,
      prevLim: 0,
      newLim: 0,
      reason: 'Member reported lost wallet during business trip in Osaka. Re-issue to hotel address.',
      reqDual: 0,
      status: 'Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: null,
      checkerName: null,
      remarks: 'Emergency card dispatch authorized.',
      channel: 'Tokyo Concierge',
      ip: '10.142.18.22',
      created: '2026-10-29 08:30:00',
      updated: '2026-10-29 08:30:00'
    },

    // 11. *** DELIBERATE BREACH 3B: HIGH-RISK VELOCITY REPLACEMENT 2 (14 hours later on same PAN!) ***
    {
      req: 'REQ-2026-0811',
      holder: 'Kenzo Miyazawa',
      pan: '3759-881023-45009', // Same account!
      tier: 'Platinum',
      type: 'Card Replacement Request',
      amount: 0,
      prevLim: 0,
      newLim: 0,
      reason: 'Second call received claiming hotel courier failed; requested redirection to third-party courier locker.',
      reqDual: 0,
      status: 'Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: null,
      checkerName: null,
      remarks: 'Processed without detecting previous replacement dispatch 14 hours earlier.',
      channel: 'Digital IVR',
      ip: '10.142.18.22',
      created: '2026-10-29 22:45:00', // 14 hours after REQ-2026-0810! Velocity breach!
      updated: '2026-10-29 22:45:00'
    },

    // 12. Normal Pending Review Request
    {
      req: 'REQ-2026-0812',
      holder: 'Akira Kudo',
      pan: '3759-229910-44111',
      tier: 'Centurion',
      type: 'Credit Limit Adjustment (JPY)',
      amount: 5000000,
      prevLim: 10000000,
      newLim: 15000000,
      reason: 'Art Basel Tokyo auction purchase authorization requested by relationship manager.',
      reqDual: 1,
      status: 'Pending',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: null,
      checkerName: null,
      remarks: null,
      channel: 'Tokyo Concierge',
      ip: '10.142.18.22',
      created: '2026-11-01 09:15:00',
      updated: '2026-11-01 09:15:00'
    },
    // 13. Fee waiver pending
    {
      req: 'REQ-2026-0813',
      holder: 'Mayumi Chiba',
      pan: '3759-771120-33445',
      tier: 'Gold',
      type: 'Annual Fee Waiver (JPY)',
      amount: 31900,
      prevLim: 0,
      newLim: 0,
      reason: 'System billing glitch duplicate charge reversal request.',
      reqDual: 1,
      status: 'Pending',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: null,
      checkerName: null,
      remarks: null,
      channel: 'Digital IVR',
      ip: '10.142.18.22',
      created: '2026-11-02 11:45:00',
      updated: '2026-11-02 11:45:00'
    },
    // 14. Replacement pending
    {
      req: 'REQ-2026-0814',
      holder: 'Koji Matsuoka',
      pan: '3759-550019-22119',
      tier: 'Corporate',
      type: 'Card Replacement Request',
      amount: 0,
      prevLim: 0,
      newLim: 0,
      reason: 'Corporate card magnetic stripe demagnetized at airline kiosk.',
      reqDual: 0,
      status: 'Pending',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: null,
      checkerName: null,
      remarks: null,
      channel: 'Executive Operations Desk',
      ip: '10.142.18.22',
      created: '2026-11-03 14:00:00',
      updated: '2026-11-03 14:00:00'
    },
    // 15 - 28. Additional realistic servicing records for rich analytics
    {
      req: 'REQ-2026-0815',
      holder: 'Tomoko Noguchi',
      pan: '3759-114477-99223',
      tier: 'Green',
      type: 'Annual Fee Waiver (JPY)',
      amount: 13200,
      prevLim: 0,
      newLim: 0,
      reason: 'First year promotional membership fee waiver rebate.',
      reqDual: 1,
      status: 'Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: checkerId,
      checkerName: 'Yuki Tanaka',
      remarks: 'Promotion code AMX2026JP verified against marketing campaign ledger.',
      channel: 'Digital IVR',
      ip: '10.142.18.22',
      created: '2026-11-03 16:20:00',
      updated: '2026-11-03 17:00:00'
    },
    {
      req: 'REQ-2026-0816',
      holder: 'Yuta Hoshino',
      pan: '3759-448811-22900',
      tier: 'Gold',
      type: 'Credit Limit Adjustment (JPY)',
      amount: 500000,
      prevLim: 1500000,
      newLim: 2000000,
      reason: 'Home renovation deposit payment scheduled for end of month.',
      reqDual: 1,
      status: 'Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: checkerId,
      checkerName: 'Yuki Tanaka',
      remarks: 'Temporary limit line increase granted with 60-day expiry tag.',
      channel: 'Tokyo Concierge',
      ip: '10.142.18.22',
      created: '2026-11-04 10:30:00',
      updated: '2026-11-04 11:15:00'
    },
    {
      req: 'REQ-2026-0817',
      holder: 'Haruto Abe',
      pan: '3759-338822-11440',
      tier: 'Corporate',
      type: 'Credit Limit Adjustment (JPY)',
      amount: 3000000,
      prevLim: 5000000,
      newLim: 8000000,
      reason: 'Subsidiary quarterly flight booking consolidation.',
      reqDual: 1,
      status: 'Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: checkerId,
      checkerName: 'Yuki Tanaka',
      remarks: 'Parent corporation bank guarantee letter confirmed on file.',
      channel: 'Executive Operations Desk',
      ip: '10.142.18.22',
      created: '2026-11-05 09:45:00',
      updated: '2026-11-05 10:45:00'
    },
    {
      req: 'REQ-2026-0818',
      holder: 'Yui Inoue',
      pan: '3759-992244-66110',
      tier: 'Green',
      type: 'Annual Fee Waiver (JPY)',
      amount: 8000,
      prevLim: 0,
      newLim: 0,
      reason: 'Service satisfaction token credit for delayed card delivery in Sendai.',
      reqDual: 0,
      status: 'Auto-Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: null,
      checkerName: null,
      remarks: 'Under ¥10,000 threshold. Auto-processed within Maker daily delegation.',
      channel: 'Digital IVR',
      ip: '10.142.18.22',
      created: '2026-11-05 13:10:00',
      updated: '2026-11-05 13:10:00'
    },
    {
      req: 'REQ-2026-0819',
      holder: 'Souta Maeda',
      pan: '3759-880011-33224',
      tier: 'Platinum',
      type: 'Card Replacement Request',
      amount: 0,
      prevLim: 0,
      newLim: 0,
      reason: 'Cardholder requested metal card reissue due to surface scratching.',
      reqDual: 0,
      status: 'Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: null,
      checkerName: null,
      remarks: 'Standard metal card reissue fee waived per Centurion/Platinum concierge benefit.',
      channel: 'Tokyo Concierge',
      ip: '10.142.18.22',
      created: '2026-11-06 14:50:00',
      updated: '2026-11-06 14:50:00'
    },
    {
      req: 'REQ-2026-0820',
      holder: 'Rin Kimura',
      pan: '3759-775533-11998',
      tier: 'Gold',
      type: 'Annual Fee Waiver (JPY)',
      amount: 31900,
      prevLim: 0,
      newLim: 0,
      reason: 'Gold card annual renewal waiver requested under partner mileage conversion agreement.',
      reqDual: 1,
      status: 'Rejected',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: checkerId,
      checkerName: 'Yuki Tanaka',
      remarks: 'Rejected: Insufficient qualifying partner mileage activity in 2026 tier cycle.',
      channel: 'Tokyo Concierge',
      ip: '10.142.18.22',
      created: '2026-11-06 15:30:00',
      updated: '2026-11-06 16:15:00'
    },
    {
      req: 'REQ-2026-0821',
      holder: 'Kazuki Nishimura',
      pan: '3759-664422-88119',
      tier: 'Centurion',
      type: 'Credit Limit Adjustment (JPY)',
      amount: 10000000,
      prevLim: 20000000,
      newLim: 30000000,
      reason: 'Annual yacht charter booking in Monaco via Centurion Travel Service.',
      reqDual: 1,
      status: 'Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: checkerId,
      checkerName: 'Yuki Tanaka',
      remarks: 'Highest tier account with flawless 15-year standing. Dual managerial sign-off recorded.',
      channel: 'Tokyo Concierge',
      ip: '10.142.18.22',
      created: '2026-11-07 10:00:00',
      updated: '2026-11-07 11:20:00'
    },
    {
      req: 'REQ-2026-0822',
      holder: 'Mio Shimizu',
      pan: '3759-551188-77443',
      tier: 'Platinum',
      type: 'Annual Fee Waiver (JPY)',
      amount: 165000,
      prevLim: 0,
      newLim: 0,
      reason: 'Cardholder dispute over delayed hotel tier status enrollment benefit.',
      reqDual: 1,
      status: 'Pending',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: null,
      checkerName: null,
      remarks: null,
      channel: 'Tokyo Concierge',
      ip: '10.142.18.22',
      created: '2026-11-08 09:20:00',
      updated: '2026-11-08 09:20:00'
    },
    {
      req: 'REQ-2026-0823',
      holder: 'Ren Okada',
      pan: '3759-443322-99001',
      tier: 'Green',
      type: 'Credit Limit Adjustment (JPY)',
      amount: 300000,
      prevLim: 500000,
      newLim: 800000,
      reason: 'Salary increase verified via tax certificate submission.',
      reqDual: 1,
      status: 'Pending',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: null,
      checkerName: null,
      remarks: null,
      channel: 'Digital IVR',
      ip: '10.142.18.22',
      created: '2026-11-08 14:15:00',
      updated: '2026-11-08 14:15:00'
    },
    {
      req: 'REQ-2026-0824',
      holder: 'Hinata Goto',
      pan: '3759-332211-00998',
      tier: 'Gold',
      type: 'Card Replacement Request',
      amount: 0,
      prevLim: 0,
      newLim: 0,
      reason: 'Lost during Shinkansen commute from Kyoto to Shinagawa.',
      reqDual: 0,
      status: 'Pending',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: null,
      checkerName: null,
      remarks: null,
      channel: 'Tokyo Concierge',
      ip: '10.142.18.22',
      created: '2026-11-09 08:45:00',
      updated: '2026-11-09 08:45:00'
    },
    {
      req: 'REQ-2026-0825',
      holder: 'Sora Hasegawa',
      pan: '3759-221199-88776',
      tier: 'Platinum',
      type: 'Credit Limit Adjustment (JPY)',
      amount: 1500000,
      prevLim: 3500000,
      newLim: 5000000,
      reason: 'Family overseas medical emergency pre-authorization.',
      reqDual: 1,
      status: 'Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: checkerId,
      checkerName: 'Yuki Tanaka',
      remarks: 'Expedited approval granted under humanitarian emergency clause #12.',
      channel: 'Tokyo Concierge',
      ip: '10.142.18.22',
      created: '2026-11-09 11:30:00',
      updated: '2026-11-09 11:55:00'
    },
    {
      req: 'REQ-2026-0826',
      holder: 'Kanna Endo',
      pan: '3759-119988-66554',
      tier: 'Corporate',
      type: 'Annual Fee Waiver (JPY)',
      amount: 22000,
      prevLim: 0,
      newLim: 0,
      reason: 'Multi-card corporate billing agreement tier discount.',
      reqDual: 1,
      status: 'Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: checkerId,
      checkerName: 'Yuki Tanaka',
      remarks: 'Master corporate billing schedule tier 3 fee reduction applied.',
      channel: 'Executive Operations Desk',
      ip: '10.142.18.22',
      created: '2026-11-09 15:10:00',
      updated: '2026-11-09 16:00:00'
    },
    {
      req: 'REQ-2026-0827',
      holder: 'Takumi Fujiwara',
      pan: '3759-998877-55443',
      tier: 'Gold',
      type: 'Annual Fee Waiver (JPY)',
      amount: 9500,
      prevLim: 0,
      newLim: 0,
      reason: 'Foreign currency transaction surcharge adjustment after terminal conversion error.',
      reqDual: 0,
      status: 'Auto-Approved',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: null,
      checkerName: null,
      remarks: 'Under ¥10,000 threshold. Auto-processed within Maker daily delegation.',
      channel: 'Digital IVR',
      ip: '10.142.18.22',
      created: '2026-11-10 10:15:00',
      updated: '2026-11-10 10:15:00'
    },
    {
      req: 'REQ-2026-0828',
      holder: 'Aoi Moriyama',
      pan: '3759-887766-44332',
      tier: 'Centurion',
      type: 'Credit Limit Adjustment (JPY)',
      amount: 8000000,
      prevLim: 12000000,
      newLim: 20000000,
      reason: 'Tokyo real estate leasehold deposit security payment.',
      reqDual: 1,
      status: 'Pending',
      makerId: makerId,
      makerName: 'Kenji Sato',
      checkerId: null,
      checkerName: null,
      remarks: null,
      channel: 'Tokyo Concierge',
      ip: '10.142.18.22',
      created: '2026-11-10 13:00:00',
      updated: '2026-11-10 13:00:00'
    }
  ];

  const reqInsertMap = {};
  for (const s of seedRequests) {
    const res = insertReq.run(
      s.req, s.holder, s.pan, s.tier, s.type,
      s.amount, s.prevLim, s.newLim, s.reason, s.reqDual,
      s.status, s.makerId, s.makerName, s.checkerId, s.checkerName, s.remarks,
      s.channel, s.ip, s.created, s.updated
    );
    reqInsertMap[s.req] = Number(res.lastInsertRowid);
  }

  // 5. Seed Initial Exceptions for the 3 Deliberate Breaches
  const insertException = db.prepare(`
    INSERT INTO exceptions (
      exception_number, rule_id, rule_code, request_id, account_number_masked,
      severity, title, description, detected_value, status,
      assigned_to, risk_analyst_notes, cap_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Breach 1 Exception (SoD Violation on REQ-2026-0804)
  const e1 = insertException.run(
    'EXC-2026-0001',
    ruleIdSod,
    'RULE-SOD-001',
    reqInsertMap['REQ-2026-0804'],
    '3759-994102-33201',
    'Critical',
    'Segregation of Duties Breach: Maker Self-Approved Fee Waiver of ¥385,000',
    'Request REQ-2026-0804 was submitted and approved by the same user ID (maker_sato). Dual control gate was entirely circumvented on a high-value Centurion fee waiver.',
    'Maker ID: 1 (Kenji Sato) == Checker ID: 1 (Kenji Sato). Amount: ¥385,000',
    'Under Investigation',
    'Internal Control (Ayumi Ito)',
    'Escalated finding. Confirmed Maker logged in with supervisory override flag. Urgent remediation required.',
    null,
    '2026-10-18 17:15:00'
  );
  const excId1 = Number(e1.lastInsertRowid);

  // Breach 2 Exception (Threshold Breach on REQ-2026-0809)
  const e2 = insertException.run(
    'EXC-2026-0002',
    ruleIdThr,
    'RULE-THR-002',
    reqInsertMap['REQ-2026-0809'],
    '3759-661902-88001',
    'High',
    'Unauthorized Threshold Breach: Fee Waiver >¥10,000 Processed Without Checker Sign-off',
    'Request REQ-2026-0809 for ¥55,000 JPY was flagged as Approved directly without obtaining secondary Operations Manager sign-off.',
    'Amount: ¥55,000 (Exceeds policy threshold ¥10,000 by ¥45,000). Checker ID is NULL.',
    'Confirmed Exception',
    'Internal Control (Ayumi Ito)',
    'Branch escalation terminal failed to enforce mandatory gating before sending settlement dispatch to core banking ledger.',
    null,
    '2026-10-27 15:45:00'
  );
  const excId2 = Number(e2.lastInsertRowid);

  // Breach 3 Exception (High-Risk Velocity on REQ-2026-0811)
  const e3 = insertException.run(
    'EXC-2026-0003',
    ruleIdVel,
    'RULE-VEL-003',
    reqInsertMap['REQ-2026-0811'],
    '3759-881023-45009',
    'High',
    'High-Risk Velocity: 2 Card Replacements in 14 Hours for Same Account',
    'Account 3759-881023-45009 experienced 2 separate physical replacement dispatches within a 14-hour interval. Classic indicator of Account Takeover (ATO) courier interception.',
    'First replacement at 2026-10-29 08:30 JST (REQ-2026-0810), second replacement at 2026-10-29 22:45 JST (REQ-2026-0811). Delta: 14h 15m.',
    'Confirmed Exception',
    'Internal Control (Ayumi Ito)',
    'High ATO alert. Card shipping courier intercepted and put on emergency fraud hold.',
    null,
    '2026-10-30 08:15:00'
  );
  const excId3 = Number(e3.lastInsertRowid);

  // 6. Seed Corrective Action Plans (CAPs)
  const insertCap = db.prepare(`
    INSERT INTO corrective_action_plans (
      cap_number, title, finding_description, root_cause,
      related_control_id, related_exception_id, owner, due_date,
      priority, status, progress_pct, action_steps, audit_signoff,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const c1 = insertCap.run(
    'CAP-2026-001',
    'Harden Core Terminal Against Single-Operator Fee Overrides',
    'Audit inspection noted branch escalation terminal allowed frontline operator to bypass secondary approval for waivers > ¥10,000.',
    'System migration in Q3 left legacy bypass parameter active on branch staging endpoints.',
    'CTL-ICS-001',
    excId2, // Links to EXC-2026-0002
    'Yuki Tanaka (Operations Manager)',
    '2026-11-25',
    'High',
    'In Progress',
    65,
    JSON.stringify([
      { step: 'Deploy system hotfix revoking client-side bypass parameter', done: true },
      { step: 'Conduct regression testing across all 14 Tokyo servicing desks', done: true },
      { step: 'Perform retrospective audit on all fee waivers executed since Q3', done: false },
      { step: 'Submit remediation verification evidence to Internal Audit', done: false }
    ]),
    0,
    '2026-10-28 10:00:00',
    '2026-11-05 15:30:00'
  );
  const capId1 = Number(c1.lastInsertRowid);

  const c2 = insertCap.run(
    'CAP-2026-002',
    'Implement Automated 48-Hour Velocity Lockout on Card Re-issuance',
    'Two replacement cards dispatched for cardholder Kenzo Miyazawa within 14 hours without fraud warning trigger.',
    'Embossing subsystem lacked real-time cross-channel query against digital IVR dispatch queue.',
    'CTL-ICS-004',
    excId3, // Links to EXC-2026-0003
    'Ayumi Ito (Internal Control) & Fraud Ops',
    '2026-11-30',
    'Critical',
    'In Progress',
    40,
    JSON.stringify([
      { step: 'Define automated 48-hour velocity suppression rule in core queue', done: true },
      { step: 'Route second re-issue attempts to Senior Fraud Analyst queue', done: false },
      { step: 'Implement biometric / SMS OTP verification for out-of-region courier address changes', done: false }
    ]),
    0,
    '2026-10-31 09:00:00',
    '2026-11-06 11:20:00'
  );
  const capId2 = Number(c2.lastInsertRowid);

  const c3 = insertCap.run(
    'CAP-2026-003',
    'Enforce Cryptographic Segregation of Duties (SoD) in Card Servicing Gateway',
    'Frontline maker was able to self-approve a ¥385,000 Centurion fee waiver using an administrative role switcher token.',
    'Application layer lacked server-side validation rejecting maker_id == checker_id at execution endpoint.',
    'CTL-ICS-002',
    excId1, // Links to EXC-2026-0001
    'Kenzo Moriyama (Lead Systems Architect)',
    '2026-11-18',
    'Critical',
    'Open',
    20,
    JSON.stringify([
      { step: 'Implement hardcoded database constraint rejecting maker_id == checker_id', done: true },
      { step: 'Establish real-time CCM alerting directly into Auditor dashboard', done: false },
      { step: 'Audit all employee privilege entitlements in Active Directory', done: false }
    ]),
    0,
    '2026-10-19 14:00:00',
    '2026-10-19 14:00:00'
  );
  const capId3 = Number(c3.lastInsertRowid);

  // Link CAPs back to their exceptions
  db.prepare('UPDATE exceptions SET cap_id = ? WHERE id = ?').run(capId1, excId2);
  db.prepare('UPDATE exceptions SET cap_id = ? WHERE id = ?').run(capId2, excId3);
  db.prepare('UPDATE exceptions SET cap_id = ? WHERE id = ?').run(capId3, excId1);

  // 7. Seed Initial Audit Logs
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (event_type, actor_id, actor_name, actor_role, action_detail, resource_id, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run('SYSTEM_INIT', null, 'ICS System Kernel', 'system', 'Database initialized and schema migrated with American Express ICS Japan control standards', 'SYS-001', '127.0.0.1', '2026-10-01 00:00:00');
  insertAudit.run('REQUEST_APPROVED', checkerId, 'Yuki Tanaka', 'checker', 'Approved Annual Fee Waiver ¥165,000 for Hiroshi Takahashi (Platinum). Dual control validated.', 'REQ-2026-0801', '10.142.18.35', '2026-10-12 13:10:00');
  insertAudit.run('SOD_VIOLATION_DETECTED', makerId, 'Kenji Sato', 'maker', 'ALERT: Self-approval detected on REQ-2026-0804 (¥385,000 Centurion Waiver). Maker ID == Checker ID.', 'REQ-2026-0804', '10.142.18.22', '2026-10-18 17:06:00');
  insertAudit.run('THRESHOLD_BREACH_DETECTED', makerId, 'Kenji Sato', 'maker', 'ALERT: Fee waiver of ¥55,000 processed without Checker sign-off on REQ-2026-0809.', 'REQ-2026-0809', '10.142.18.22', '2026-10-27 15:30:00');
  insertAudit.run('VELOCITY_BREACH_DETECTED', null, 'CCM Automated Scanner', 'system', 'ALERT: 2 replacement cards dispatched for account 3759-881023-45009 within 14 hours.', 'REQ-2026-0811', '10.142.0.1', '2026-10-29 22:46:00');
  insertAudit.run('CAP_CREATED', auditorId, 'Ayumi Ito', 'auditor', 'Created Remediation Plan CAP-2026-001 for Branch Threshold Override Vulnerability.', 'CAP-2026-001', '10.142.22.88', '2026-10-28 10:00:00');
  insertAudit.run('LOGIN', auditorId, 'Ayumi Ito', 'auditor', 'Authenticated to ICS ControlHub Internal Control Portal from Tokyo Corporate HQ.', 'SESSION-8844', '10.142.22.88', '2026-11-10 09:00:00');

  console.log('[ICS ControlHub DB] Successfully seeded 3 users, 4 CCM rules, 6 RCM controls, 28 card servicing records, 3 deliberate control breaches, 3 CAPs, and audit logs.');
}

// Initialize on require
initSchema();
seedDatabase();

module.exports = db;

