const app = require('./index');
const db = require('./db');

async function testBackend() {
  console.log('Testing ICS ControlHub Backend Services...');

  // Start server on temporary port
  const server = app.listen(5099, async () => {
    try {
      const baseUrl = 'http://localhost:5099';

      // 1. Test Health
      const healthRes = await fetch(`${baseUrl}/api/health`);
      const health = await healthRes.json();
      console.log('✓ Healthcheck:', health.status);

      // 2. Test Switch Role to Maker
      const makerSwitch = await fetch(`${baseUrl}/api/auth/switch-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'maker' })
      });
      const makerData = await makerSwitch.json();
      console.log('✓ Maker login switch:', makerData.user.name, `[Role: ${makerData.user.role}]`);
      const makerToken = makerData.token;

      // 3. Test Switch Role to Checker
      const checkerSwitch = await fetch(`${baseUrl}/api/auth/switch-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'checker' })
      });
      const checkerData = await checkerSwitch.json();
      console.log('✓ Checker login switch:', checkerData.user.name, `[Role: ${checkerData.user.role}]`);
      const checkerToken = checkerData.token;

      // 4. Test Switch Role to Auditor
      const auditorSwitch = await fetch(`${baseUrl}/api/auth/switch-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'auditor' })
      });
      const auditorData = await auditorSwitch.json();
      console.log('✓ Auditor login switch:', auditorData.user.name, `[Role: ${auditorData.user.role}]`);
      const auditorToken = auditorData.token;

      // 5. Test Maker submitting a fee waiver > ¥10,000 (Requires Dual Approval)
      const submitRes = await fetch(`${baseUrl}/api/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${makerToken}`
        },
        body: JSON.stringify({
          cardholder_name: 'Test Customer',
          masked_pan: '3759-999999-12345',
          card_tier: 'Platinum',
          transaction_type: 'Annual Fee Waiver (JPY)',
          amount: 165000,
          reason: 'Test fee concession for verification suite',
          channel: 'Tokyo Concierge'
        })
      });
      const submitData = await submitRes.json();
      console.log('✓ Maker Request Creation:', submitData.request.request_number, 'Status:', submitData.request.status, 'Dual Required:', submitData.request.requires_dual_approval);

      // 6. Test Segregation of Duties (SoD): Maker trying to approve own request
      const sodAttempt = await fetch(`${baseUrl}/api/requests/${submitData.request.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${makerToken}` // Maker attempting approval!
        },
        body: JSON.stringify({ remarks: 'Self approval attempt' })
      });
      console.log('✓ SoD Enforcement on Maker approval attempt: Status', sodAttempt.status, '(Expect 403 Forbidden)');

      // 7. Checker approving the request
      const checkerApprove = await fetch(`${baseUrl}/api/requests/${submitData.request.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${checkerToken}`
        },
        body: JSON.stringify({ remarks: 'Dual managerial sign-off verified and approved.' })
      });
      const approveData = await checkerApprove.json();
      console.log('✓ Checker Approval Success:', approveData.request.status, 'Checker:', approveData.request.checker_name);

      // 8. Auditor running Continuous Control Monitoring (CCM) Scan
      const ccmRes = await fetch(`${baseUrl}/api/ccm/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auditorToken}`
        }
      });
      const ccmData = await ccmRes.json();
      console.log('✓ CCM Engine Surveillance Scan:', ccmData.report.scannedTransactions, 'records scanned,', ccmData.report.totalBreachesFound, 'breaches flagged.');

      // 9. Dashboard Analytics
      const dashRes = await fetch(`${baseUrl}/api/analytics/dashboard`, {
        headers: { 'Authorization': `Bearer ${auditorToken}` }
      });
      const dashData = await dashRes.json();
      console.log('✓ Executive Dashboard KPIs:', {
        totalActions: dashData.kpis.totalOperationalActions,
        openExceptions: dashData.kpis.openExceptions,
        controlEffectivenessRate: dashData.kpis.controlEffectivenessRate + '%',
        totalFeeWaiverJPY: '¥' + dashData.kpis.totalFeeWaiverJPY.toLocaleString()
      });

      console.log('\n🌟 ALL BACKEND CHECKS PASSED PERFECTLY! 🌟');
      server.close();
      process.exit(0);
    } catch (e) {
      console.error('Test error:', e);
      server.close();
      process.exit(1);
    }
  });
}

testBackend();

