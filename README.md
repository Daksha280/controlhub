# 🏛️ ICS ControlHub — Internal Control & Operational Risk Monitoring Portal
### Simulating American Express International Card Services — Japan Market (Tokyo Operations Center)

**ICS ControlHub** is an enterprise-grade Internal Control, Segregation of Duties (SoD), and Continuous Control Monitoring (CCM) portal built for a credit card issuing business. It simulates the high-stakes operational risk, card servicing concessions, and regulatory compliance standards of the Japan market (ICS-J Tokyo HQ).

---

## 🌟 Key Business & Governance Modules

### 1. Authentication & Segregation of Duties (SoD / RBAC)
- **Role-Based Access Control (RBAC)** powered by cryptographic JSON Web Tokens (JWT) and database-level constraints.
- **3 Distinct Pre-configured Personas**:
  - 🟢 **Maker (Kenji Sato - Operations Analyst)**: Can submit operational card servicing requests (manual fee waivers, limit increases, emergency card replacements). Strictly blocked from approving their own entries.
  - 🔵 **Checker (Yuki Tanaka - Operations Manager)**: Reviews, approves, or rejects requests requiring dual authorization. Blocked by server-side SoD validation if attempting to approve a request they originated.
  - 🟣 **Auditor / Risk Analyst (Ayumi Ito - Internal Control & Compliance)**: Read-only access to transaction journals, with exclusive authority to trigger on-demand CCM rule scans, manage the Risk & Control Matrix (RCM), and execute Corrective Action Plans (CAPs).
- **One-Click Persona Switcher**: Embedded directly in the application header for effortless live demonstration and workflow evaluation without logging in and out.

### 2. Operations & Maker-Checker Workflow (Card Servicing)
- **Servicing Actions Supported**:
  - **Annual Fee Waiver (JPY)**: Up to Centurion level (¥385,000) and Platinum level (¥165,000).
  - **Credit Limit Adjustment (JPY)**: Line elevations (e.g. ¥3M → ¥5M) requiring credit underwriter dual sign-off.
  - **Card Replacement Request**: Physical card re-issuance (damaged chip, lost transit, metal reissue).
- **Dual Approval Policy Gating**:
  - **Threshold Policy**: Any manual fee waiver **> ¥10,000 JPY** strictly requires secondary managerial Checker approval (`status: Pending`).
  - **Discretionary Policy**: Concessions **&le; ¥10,000 JPY** are auto-approved within Maker frontline delegation.
  - **Credit Line Rule**: Any limit increase requires Checker sign-off.
- **Immutable Audit Trail**: Every submission, approval, and rejection records actor ID, role, client IP address, and supervisory remarks.

### 3. Continuous Control Monitoring (CCM) & Automated Exception Engine
An automated backend rule engine (`server/services/ruleEngine.js`) inspects operational journals and flags control breaches:
- **`RULE-SOD-001` (Segregation of Duties Breach)**: Identifies any action where `maker_id === checker_id` (self-approval circumventing dual control).
- **`RULE-THR-002` (Unauthorized Threshold Breach)**: Flags manual fee waivers > ¥10,000 JPY processed without secondary Checker approval.
- **`RULE-VEL-003` (High-Risk Velocity Card Replacement)**: Detects accounts experiencing 2 or more card replacements within a 48-hour rolling window (Account Takeover / ATO courier diversion indicator).
- **`RULE-OFF-004` (Off-Hours High-Value Servicing)**: Flags credit limit adjustments > ¥1,000,000 JPY executed outside standard Tokyo operational hours (09:00–18:00 JST).
- **Interactive Exception Management**: Status workflow (`Under Investigation` &rarr; `Justified` &rarr; `Confirmed Exception` &rarr; `Remediated`), risk analyst notes, and 1-click escalation into a formal CAP.

### 4. Risk & Control Matrix (RCM) & Corrective Action Plan (CAP) Tracker
- **Interactive RCM Table**: Displays process steps, inherent risks, risk levels (High/Med/Low), control descriptions, control types (Preventive/Detective), nature (Automated/Manual), testing frequencies, and operating effectiveness status (`Effective`, `Partially Effective`, `Deficient`).
- **Auditor Control Testing**: Risk analysts can record testing sample sizes, deficiencies noted, and update control effectiveness.
- **CAP Remediation Roadmap**: Log audit findings, assign owners, set target due dates, track milestone step checklists, and execute formal **Auditor Verification & Sign-off** to remediate findings.

### 5. Executive KRI Dashboard (Chart.js Visualizations)
- **Executive Metric Cards**: Total Operational Actions, Open Exceptions (Critical/High), Control Effectiveness Rate (%), Active CAPs, MTD Fee Concession Volume in JPY, and Dual Authorization Compliance Rate.
- **Chart 1 (Monthly KRI Breach Trends)**: Multi-line historical trend showing SoD violations, threshold overrides, and velocity spikes.
- **Chart 2 (Controls by Effectiveness)**: Doughnut chart detailing Satisfactory vs Deficient controls.
- **Chart 3 (Exception Breakdown by Root Cause)**: Bar chart categorizing policy failures and system misconfigurations.
- **Live Security Audit Ticker**: Real-time stream of security and operational events with Tokyo JST timestamps.

---

## 🔍 Pre-Configured Deliberate Control Breaches (Seeded for Testing)

The database is seeded with 28–30 realistic card servicing records formatted in Japanese Yen (¥), containing **3 deliberate historical control breaches** to validate the CCM Engine:

| Breach ID | Transaction Ref | Type | Violation Details | CCM Rule Triggered | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Breach 1** | `REQ-2026-0804` | Annual Fee Waiver (¥385,000) | **SoD Self-Approval**: Maker Kenji Sato approved his own Centurion waiver. | `RULE-SOD-001` | **Critical** |
| **Breach 2** | `REQ-2026-0809` | Annual Fee Waiver (¥55,000) | **Threshold Bypass**: Processed as Approved with `checker_id = NULL`. | `RULE-THR-002` | **High** |
| **Breach 3** | `REQ-2026-0810` & `REQ-2026-0811` | Card Replacements (¥0) | **High-Risk Velocity**: Same account (`3759-881023-45009`) requested 2 replacements within 14 hours. | `RULE-VEL-003` | **High** |

---

## 👥 Demo Personas & Credentials

| Role | Persona Name | Department | Credentials | Primary Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Maker** | Kenji Sato | Card Operations Servicing | `maker_sato` / `maker123` | Submit card actions. Cannot approve own requests. |
| **Checker** | Yuki Tanaka | Operations Manager Approvals | `checker_tanaka` / `checker123` | Review & approve/reject Maker requests. SoD enforced. |
| **Auditor** | Ayumi Ito | Operational Risk & Compliance | `auditor_ito` / `auditor123` | Full audit access, CCM rule scans, RCM testing, CAP manager. |

*Tip: Use the **Demo Persona Switcher** in the top navigation bar to switch personas with one click!*

---

## 🛠️ Tech Stack & Architecture

- **Frontend**:
  - React 19 with Vite 8
  - Tailwind CSS v4 with modern dark financial dashboard styling
  - Chart.js & `react-chartjs-2` for financial analytics
  - Lucide React for consistent icons
- **Backend**:
  - Node.js with Express.js REST APIs
  - JSON Web Tokens (`jsonwebtoken`) & `bcryptjs`
  - Segregation of Duties (SoD) enforcement middleware
- **Database**:
  - SQLite with `better-sqlite3` in WAL mode
  - Auto-migrated schema and seed data on startup (`data/controlhub.sqlite`)
- **Single Command Runner**:
  - `concurrently` orchestrates both frontend and backend seamlessly.

---

## 🚀 Quick Start Guide

### 1. Installation
Install dependencies in both root and client:
```bash
npm install
npm --prefix client install
```

### 2. Run Both Frontend and Backend Concurrently
```bash
npm run dev
```
- **Backend API**: `http://localhost:5000`
- **Frontend App**: `http://localhost:5173` (with `/api` proxy configured)

### 3. Alternative: Run in Production Mode
Build the client and serve directly from Express:
```bash
npm run build
npm start
```
Open **`http://localhost:5000`** in your browser.

### 4. Run Automated Test Suite
```bash
npm run test:api
```
Validates healthcheck, Maker submission, SoD self-approval prevention (HTTP 403), Checker authorization, and the CCM surveillance engine.

---

## 🏛️ Regulatory & Operating Principles (SOX 404 / Amex ICS Policy)
1. **Segregation of Duties (SoD)**: Origination and verification roles must be held by distinct individuals. The system enforces this both at the UI layer and at the API middleware layer.
2. **Threshold Delegation**: Frontline concessions above ¥10,000 JPY are prevented from settling without second-line sign-off.
3. **Continuous Auditing**: Detective surveillance runs continuously to ensure any unauthorized out-of-band database adjustments or legacy bypasses are caught within 24 hours.

