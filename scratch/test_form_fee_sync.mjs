// Automated Verification Suite for Project Review Form Fee Dynamic Synchronization
import assert from 'assert';
import fs from 'fs';

const BASE_URL = 'http://localhost:5173';

async function runTests() {
  console.log('--- STARTING FORM FEE DYNAMIC SYNCHRONIZATION TESTS ---');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`PASS [${total}]: ${name}`);
      passed++;
    } catch (e) {
      console.error(`FAIL [${total}]: ${name}`);
      console.error(e);
      process.exit(1);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`PASS [${total}]: ${name}`);
      passed++;
    } catch (e) {
      console.error(`FAIL [${total}]: ${name}`);
      console.error(e);
      process.exit(1);
    }
  }

  // 1. Initial State Check
  await asyncTest('Initial Platform Charge is configured in backend', async () => {
    const res = await fetch(`${BASE_URL}/api/platform-settings`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert(data.config || data.platformCharge);
  });

  // 2. Query Expert Pricing before update
  let initialExpertRate = 1000;
  await asyncTest('Query pricing for Expert JK (usr-1788974684441)', async () => {
    // First set JK to a known rate (e.g. 1000)
    const setRateRes = await fetch(`${BASE_URL}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: 'usr-1788974684441',
        projectRate: 1000,
        role: 'admin',
        userId: 'admin'
      })
    });
    assert.strictEqual(setRateRes.status, 200);

    const res = await fetch(`${BASE_URL}/api/project-reviews/pricing?expertId=usr-1788974684441&role=client`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.projectRate, 1000);
    initialExpertRate = data.projectRate;
    assert.strictEqual(typeof data.platformFee, 'number');
    assert(data.platformFeeConfig !== undefined);
    assert.strictEqual(data.clientPrice, initialExpertRate + data.platformFee);
  });

  // 3. Admin updates Platform Charge to Fixed ₹250
  await asyncTest('Admin updates Platform Charge to ₹250 (Fixed)', async () => {
    const res = await fetch(`${BASE_URL}/api/platform-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feeType: 'fixed',
        feeValue: 250,
        role: 'admin',
        userId: 'admin-governance'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.config.feeValue, 250);
  });

  // 4. Verify disk persistence in db.json
  test('db.json records updated feeValue: 250', () => {
    const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
    assert.strictEqual(db.platformCharge.feeValue, 250);
    assert.strictEqual(db.projectReviewConfig.feeValue, 250);
  });

  // 5. Client queries pricing for Expert JK -> Must return ₹250 platform fee and ₹1,250 clientPrice
  await asyncTest('Client pricing query reflects updated Platform Charge of ₹250 immediately', async () => {
    const res = await fetch(`${BASE_URL}/api/project-reviews/pricing?expertId=usr-1788974684441&role=client`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.projectRate, 1000);
    assert.strictEqual(data.platformFee, 250);
    assert.strictEqual(data.platformCharge, 250);
    assert.strictEqual(data.clientPrice, 1250);
    assert.strictEqual(data.platformFeeConfig.feeValue, 250);
  });

  // 6. Admin queries all experts pricing -> Directory table reflects updated Platform Charge of ₹250 across all experts
  await asyncTest('Admin all=true query reflects updated Platform Charge across all experts', async () => {
    const res = await fetch(`${BASE_URL}/api/project-reviews/pricing?all=true&role=admin`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.platformFeeConfig.feeValue, 250);
    assert(Array.isArray(data.experts));
    for (const exp of data.experts) {
      assert.strictEqual(exp.platformFee, 250);
      assert.strictEqual(exp.clientPrice, exp.projectRate + 250);
    }
  });

  // 7. Booking creation (/api/project-reviews/request) uses authoritative ₹250
  await asyncTest('Booking creation authoritatively calculates ₹250 Platform Fee and ₹1,250 final price', async () => {
    const res = await fetch(`${BASE_URL}/api/project-reviews/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'cli-test-sync-' + Date.now(),
        clientName: 'Sync Test Client',
        clientEmail: `client-${Date.now()}@sync.test`,
        expertId: 'usr-1788974684441',
        expertName: 'JK',
        expertEmail: 'jk@consulting.test',
        expectedScope: 'Test Sync Scope',
        reviewType: 'Architecture Audit',
        requestNotes: 'Testing dynamic platform fee sync',
        clientWalletBalance: 10000
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    const pr = data.projectReview;
    assert.strictEqual(pr.expertCharge, 1000);
    assert.strictEqual(pr.platformFee, 250);
    assert.strictEqual(pr.price, 1250);
    assert.strictEqual(pr.paidAmount, 1250);
    assert.strictEqual(pr.expertEarning, 1000);
  });

  // 8. Admin updates Platform Charge to Fixed ₹300
  await asyncTest('Admin updates Platform Charge from ₹250 to ₹300', async () => {
    const res = await fetch(`${BASE_URL}/api/platform-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feeType: 'fixed',
        feeValue: 300,
        role: 'admin',
        userId: 'admin-governance'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.config.feeValue, 300);
  });

  // 9. Client queries pricing -> Immediately gets ₹300 platform fee and ₹1,300 total
  await asyncTest('Client pricing query reflects updated Platform Charge of ₹300', async () => {
    const res = await fetch(`${BASE_URL}/api/project-reviews/pricing?expertId=usr-1788974684441&role=client`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.projectRate, 1000);
    assert.strictEqual(data.platformFee, 300);
    assert.strictEqual(data.clientPrice, 1300);
  });

  // 10. Admin updates to Percentage: 15%
  await asyncTest('Admin updates Platform Charge to Percentage: 15%', async () => {
    const res = await fetch(`${BASE_URL}/api/platform-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feeType: 'percentage',
        feeValue: 15,
        role: 'admin',
        userId: 'admin-governance'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.config.feeType, 'percentage');
    assert.strictEqual(data.config.feeValue, 15);
  });

  // 11. Client queries pricing -> 15% of 1000 = 150 platform fee, clientPrice = 1150
  await asyncTest('Client pricing dynamically computes 15% fee: ₹150 (Total ₹1,150)', async () => {
    const res = await fetch(`${BASE_URL}/api/project-reviews/pricing?expertId=usr-1788974684441&role=client`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.projectRate, 1000);
    assert.strictEqual(data.platformFee, 150);
    assert.strictEqual(data.clientPrice, 1150);
    assert.strictEqual(data.platformFeeConfig.feeType, 'percentage');
    assert.strictEqual(data.platformFeeConfig.feeValue, 15);
  });

  // 12. Reset to standard baseline (Fixed ₹200)
  await asyncTest('Admin resets Platform Charge to standard baseline: Fixed ₹200', async () => {
    const res = await fetch(`${BASE_URL}/api/platform-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feeType: 'fixed',
        feeValue: 200,
        role: 'admin',
        userId: 'admin-governance'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.config.feeValue, 200);
  });

  // 13. Verify client pricing at baseline ₹200
  await asyncTest('Client pricing query reflects baseline ₹200 (Total ₹1,200)', async () => {
    const res = await fetch(`${BASE_URL}/api/project-reviews/pricing?expertId=usr-1788974684441&role=client`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.projectRate, 1000);
    assert.strictEqual(data.platformFee, 200);
    assert.strictEqual(data.clientPrice, 1200);
  });

  // 14. Audit trail records all changes
  test('pricingAuditLogs contains all fee change logs', () => {
    const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
    assert(Array.isArray(db.pricingAuditLogs));
    const feeLogs = db.pricingAuditLogs.filter(l => l.changeType === 'platform_fee' || l.changeType === 'platform_charge');
    assert(feeLogs.length >= 3);
    console.log(`Found ${feeLogs.length} platform fee audit entries in pricingAuditLogs.`);
  });

  console.log(`\nALL ${passed} / ${total} TESTS PASSED SUCCESSFULLY (100%)!`);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
