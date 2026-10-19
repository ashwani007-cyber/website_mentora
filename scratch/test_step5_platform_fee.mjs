import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log("🚀 Starting Step 5: Admin-Only Platform Fee Management & Isolation Tests...\n");
  const server = await createServer({
    configFile: './vite.config.ts',
    server: { port: 5184, strictPort: false }
  });
  await server.listen();
  const port = server.config.server.port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Test server active at ${baseUrl}`);

  let passed = 0;
  let failed = 0;

  function assert(cond, desc) {
    if (cond) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✕ FAIL: ${desc}`);
      failed++;
    }
  }

  try {
    const dbPath = path.resolve(process.cwd(), 'db.json');
    const rawDbBefore = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    // Capture expert 1-Hour Call rates before tests to verify isolation
    const hourlyRatesBefore = (rawDbBefore.experts || []).map(e => ({
      id: e.id,
      rate: e.rate,
      baseRate: e.baseRate,
      adminMarkup: e.adminMarkup
    }));

    // Test 1: Admin can view Project Review platform fee
    console.log("\n--- Test 1: Admin Fee Query ---");
    const adminGetRes = await fetch(`${baseUrl}/api/project-reviews/platform-fee?role=admin`);
    const adminGetData = await adminGetRes.json();
    assert(adminGetRes.status === 200, "Admin can GET platform fee (HTTP 200)");
    assert(adminGetData.success === true, "Response success is true");
    assert(adminGetData.config !== undefined, "Returns platform fee config");
    assert(typeof adminGetData.config.feeValue === 'number', "feeValue is a number");

    // Test 2: Role Authorization - Client & Expert cannot view or modify platform fee
    console.log("\n--- Test 2: Role-based Authorization Restrictions ---");
    const clientGet = await fetch(`${baseUrl}/api/project-reviews/platform-fee?role=client`);
    assert(clientGet.status === 403, "Client role GET platform fee rejected with HTTP 403 Forbidden");

    const expertGet = await fetch(`${baseUrl}/api/project-reviews/platform-fee?role=expert`);
    assert(expertGet.status === 403, "Expert role GET platform fee rejected with HTTP 403 Forbidden");

    const noRoleGet = await fetch(`${baseUrl}/api/project-reviews/platform-fee`);
    assert(noRoleGet.status === 403, "Unauthenticated GET platform fee rejected with HTTP 403 Forbidden");

    const clientPost = await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeType: 'percentage', feeValue: 10, role: 'client' })
    });
    assert(clientPost.status === 403, "Client role POST platform fee rejected with HTTP 403 Forbidden");

    const expertPost = await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeType: 'percentage', feeValue: 10, role: 'expert' })
    });
    assert(expertPost.status === 403, "Expert role POST platform fee rejected with HTTP 403 Forbidden");

    // Test 3: Admin updates fee to percentage (e.g. 20%)
    console.log("\n--- Test 3: Admin sets Percentage Platform Fee (20%) ---");
    const updatePctRes = await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feeType: 'percentage',
        feeValue: 20,
        role: 'admin',
        userId: 'admin-governance'
      })
    });
    const updatePctData = await updatePctRes.json();
    assert(updatePctRes.status === 200, "Admin can update percentage fee (HTTP 200)");
    assert(updatePctData.config.feeType === 'percentage', "Config feeType is 'percentage'");
    assert(updatePctData.config.feeValue === 20, "Config feeValue is 20");

    // Test 4: Admin updates fee to fixed amount (e.g. ₹150)
    console.log("\n--- Test 4: Admin sets Fixed Platform Fee (₹150) ---");
    const updateFixedRes = await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feeType: 'fixed',
        feeValue: 150,
        role: 'admin',
        userId: 'admin-governance'
      })
    });
    const updateFixedData = await updateFixedRes.json();
    assert(updateFixedRes.status === 200, "Admin can update fixed fee (HTTP 200)");
    assert(updateFixedData.config.feeType === 'fixed', "Config feeType is 'fixed'");
    assert(updateFixedData.config.feeValue === 150, "Config feeValue is 150");

    // Test 5: Validation - Negative, Malformed, and >100% Percentage
    console.log("\n--- Test 5: Platform Fee Boundary Validations ---");
    const negFee = await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeType: 'fixed', feeValue: -50, role: 'admin' })
    });
    assert(negFee.status === 400, "Negative fee rejected with HTTP 400");

    const over100Pct = await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeType: 'percentage', feeValue: 120, role: 'admin' })
    });
    assert(over100Pct.status === 400, "Percentage fee > 100% rejected with HTTP 400");

    const invalidType = await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeType: 'tiered', feeValue: 15, role: 'admin' })
    });
    assert(invalidType.status === 400, "Invalid feeType ('tiered') rejected with HTTP 400");

    // Reset fee back to standard 15% percentage
    await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeType: 'percentage', feeValue: 15, role: 'admin', userId: 'admin' })
    });

    // Test 6: Verify Other Services' Pricing Unchanged (Isolation)
    console.log("\n--- Test 6: Isolation Verification (1-Hour Call rates untouched) ---");
    const rawDbAfter = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const hourlyRatesAfter = (rawDbAfter.experts || []).map(e => ({
      id: e.id,
      rate: e.rate,
      baseRate: e.baseRate,
      adminMarkup: e.adminMarkup
    }));

    let allHourlyMatch = true;
    for (const b of hourlyRatesBefore) {
      const a = hourlyRatesAfter.find(x => x.id === b.id);
      if (!a || a.rate !== b.rate || a.baseRate !== b.baseRate || a.adminMarkup !== b.adminMarkup) {
        allHourlyMatch = false;
        break;
      }
    }
    assert(allHourlyMatch, "1-Hour Call rates and markups remain 100% isolated and unchanged");

  } catch (err) {
    console.error("Test execution exception:", err);
    failed++;
  } finally {
    await server.close();
  }

  console.log(`\n========================================`);
  console.log(`TOTAL PASSED: ${passed}`);
  console.log(`TOTAL FAILED: ${failed}`);
  console.log(`========================================`);
  if (failed > 0) process.exit(1);
}

runTests();
