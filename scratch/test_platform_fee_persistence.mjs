import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 Running Test Suite: Project Review Platform Fee Persistence & Synchronization");
  console.log("================================================================================\n");

  const server = await createServer({
    configFile: './vite.config.ts',
    server: { port: 5188, strictPort: false }
  });
  await server.listen();
  const port = server.config.server.port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`✓ Test server running at ${baseUrl}\n`);

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

  const dbPath = path.resolve(process.cwd(), 'db.json');

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Baseline Verification
    // -------------------------------------------------------------------------
    console.log("--- Test 1: Baseline Platform Fee Query ---");
    const baseGetRes = await fetch(`${baseUrl}/api/project-reviews/platform-fee?role=admin`);
    const baseGetData = await baseGetRes.json();
    assert(baseGetRes.status === 200, "Admin can query platform fee config (HTTP 200)");
    assert(baseGetData.success === true, "Response reports success: true");
    console.log(`  Initial fee config: ${JSON.stringify(baseGetData.config)}`);

    // Ensure expert JK has projectRate = 1000
    const rawDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    let expertJK = (rawDb.experts || []).find(e =>
      e.name?.toLowerCase() === 'jk' || e.email?.toLowerCase() === 'jay@gmail.com'
    ) || (rawDb.experts || [])[0];
    const expertId = expertJK.id;
    const initial1HourRate = expertJK.rate;

    await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expertId, projectRate: 1000, role: 'admin', userId: 'admin' })
    });

    // -------------------------------------------------------------------------
    // TEST 2: Admin edits Platform Fee ₹150 -> ₹200 and clicks "Save Platform Charge"
    // -------------------------------------------------------------------------
    console.log("\n--- Test 2: Admin Edits Platform Fee to ₹200 and Saves ---");
    const save200Res = await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feeType: 'fixed',
        feeValue: 200,
        role: 'admin',
        userId: 'admin-governance'
      })
    });
    const save200Data = await save200Res.json();
    assert(save200Res.status === 200, "Save Platform Charge returns HTTP 200 OK");
    assert(save200Data.success === true, "Save Platform Charge reports success: true");
    assert(save200Data.config.feeType === 'fixed', "Saved feeType is 'fixed'");
    assert(save200Data.config.feeValue === 200, "Saved feeValue is 200");

    // -------------------------------------------------------------------------
    // TEST 3: Permanent Disk Persistence in db.json
    // -------------------------------------------------------------------------
    console.log("\n--- Test 3: Permanent Disk Persistence in db.json ---");
    const diskDb1 = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    assert(diskDb1.projectReviewConfig !== undefined, "projectReviewConfig exists on disk");
    assert(diskDb1.projectReviewConfig.feeType === 'fixed', "Disk projectReviewConfig.feeType is 'fixed'");
    assert(diskDb1.projectReviewConfig.feeValue === 200, "Disk projectReviewConfig.feeValue is 200");

    // Verify audit log
    const latestAudit = (diskDb1.pricingAuditLogs || [])[0];
    assert(latestAudit && latestAudit.changeType === 'platform_fee', "Audit log entry created for platform_fee");
    assert(latestAudit && latestAudit.newValue?.feeValue === 200, "Audit log records new value 200");

    // -------------------------------------------------------------------------
    // TEST 4: Page Refresh Simulation (Fresh GET Requests)
    // -------------------------------------------------------------------------
    console.log("\n--- Test 4: Page Refresh Simulation ---");
    const refreshFeeRes = await fetch(`${baseUrl}/api/project-reviews/platform-fee?role=admin`);
    const refreshFeeData = await refreshFeeRes.json();
    assert(refreshFeeRes.status === 200, "Fresh GET /api/project-reviews/platform-fee HTTP 200");
    assert(refreshFeeData.config.feeValue === 200, "Platform Fee remains ₹200 after refresh");

    const refreshPricingRes = await fetch(`${baseUrl}/api/project-reviews/pricing?all=true&role=admin`);
    const refreshPricingData = await refreshPricingRes.json();
    assert(refreshPricingData.platformFeeConfig.feeValue === 200, "Pricing platformFeeConfig remains ₹200");
    const expRow = (refreshPricingData.experts || []).find(e => e.id === expertId);
    assert(expRow && expRow.platformFee === 200, "Admin table shows Platform Charge: ₹200");
    assert(expRow && expRow.clientPrice === 1200, "Admin table shows Client Final Price: ₹1,200 (1000 + 200)");

    // -------------------------------------------------------------------------
    // TEST 5: Logout / Login Simulation
    // -------------------------------------------------------------------------
    console.log("\n--- Test 5: Logout / Login Simulation ---");
    // Simulate unauthenticated / public query failing
    const anonRes = await fetch(`${baseUrl}/api/project-reviews/platform-fee`);
    assert(anonRes.status === 403, "Anonymous request cannot access platform fee config (HTTP 403)");

    // Re-login as Admin
    const loginAdminRes = await fetch(`${baseUrl}/api/project-reviews/platform-fee?role=admin`);
    const loginAdminData = await loginAdminRes.json();
    assert(loginAdminRes.status === 200, "Admin login query returns HTTP 200");
    assert(loginAdminData.config.feeValue === 200, "Platform fee remains ₹200 after logout/login cycle");

    // -------------------------------------------------------------------------
    // TEST 6: Client Synchronization (Transparent Breakdown & Calculation)
    // -------------------------------------------------------------------------
    console.log("\n--- Test 6: Client Portal Dynamic Synchronization ---");
    const clientPricingRes = await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${expertId}&role=client`);
    const clientPricingData = await clientPricingRes.json();
    assert(clientPricingRes.status === 200, "Client pricing query returns HTTP 200");
    assert(clientPricingData.projectRate === 1000, "Client sees Expert Review Charge: ₹1,000");
    assert(clientPricingData.platformFee === 200, "Client sees Platform Charge: ₹200");
    assert(clientPricingData.clientPrice === 1200, "Client sees Total Amount: ₹1,200 (1000 + 200)");

    // Client initiates a project review request
    const uniqueClientId = `cli-test-fee-${Date.now()}`;
    const clientReqPayload = {
      clientId: uniqueClientId,
      clientName: 'Alpha Client',
      clientEmail: `${uniqueClientId}@test.com`,
      expertId: expertId,
      expertName: expertJK.name,
      expertEmail: expertJK.email,
      expectedScope: 'Platform Fee Persistence Audit',
      reviewType: 'Architecture Review',
      requestNotes: 'Testing fee persistence',
      clientWalletBalance: 10000,
      price: 500 // Tampered client payload to verify authoritative calculation
    };

    const reqRes = await fetch(`${baseUrl}/api/project-reviews/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientReqPayload)
    });
    const reqData = await reqRes.json();
    assert(reqRes.status === 200, "Client request created successfully (HTTP 200)");
    assert(reqData.projectReview.expertCharge === 1000, "Created review has expertCharge = ₹1,000");
    assert(reqData.projectReview.platformFee === 200, "Created review has platformFee = ₹200");
    assert(reqData.projectReview.price === 1200, "Created review has price = ₹1,200 (1000 + 200)");
    assert(reqData.projectReview.paidAmount === 1200, "Created review has paidAmount = ₹1,200");

    // -------------------------------------------------------------------------
    // TEST 7: Change ₹200 -> another value (₹250) and repeat full cycle
    // -------------------------------------------------------------------------
    console.log("\n--- Test 7: Change ₹200 -> ₹250 and Repeat Verification Cycle ---");
    const save250Res = await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feeType: 'fixed',
        feeValue: 250,
        role: 'admin',
        userId: 'admin-governance'
      })
    });
    const save250Data = await save250Res.json();
    assert(save250Res.status === 200, "Admin saves new fee ₹250 (HTTP 200)");
    assert(save250Data.config.feeValue === 250, "Response config has feeValue = 250");

    // Check disk persistence
    const diskDb2 = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    assert(diskDb2.projectReviewConfig.feeValue === 250, "Disk db.json immediately persisted feeValue = 250");

    // Check fresh query after refresh
    const refresh250Res = await fetch(`${baseUrl}/api/project-reviews/platform-fee?role=admin`);
    const refresh250Data = await refresh250Res.json();
    assert(refresh250Data.config.feeValue === 250, "Fee remains ₹250 after refresh");

    // Check Client Portal sync with new fee ₹250
    const clientSync250Res = await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${expertId}&role=client`);
    const clientSync250Data = await clientSync250Res.json();
    assert(clientSync250Data.projectRate === 1000, "Client sees Expert Charge: ₹1,000");
    assert(clientSync250Data.platformFee === 250, "Client sees updated Platform Charge: ₹250");
    assert(clientSync250Data.clientPrice === 1250, "Client Total automatically updated to ₹1,250 (1000 + 250)");

    // -------------------------------------------------------------------------
    // TEST 8: Full Server Restart Simulation
    // -------------------------------------------------------------------------
    console.log("\n--- Test 8: Full Server Restart Simulation ---");
    await server.close();

    const restartedServer = await createServer({
      configFile: './vite.config.ts',
      server: { port: 5189, strictPort: false }
    });
    await restartedServer.listen();
    const restartedPort = restartedServer.config.server.port;
    const restartedBaseUrl = `http://localhost:${restartedPort}`;

    const restartQueryRes = await fetch(`${restartedBaseUrl}/api/project-reviews/platform-fee?role=admin`);
    const restartQueryData = await restartQueryRes.json();
    assert(restartQueryRes.status === 200, "Restarted server responds to admin query (HTTP 200)");
    assert(restartQueryData.config.feeValue === 250, "Platform Fee survives complete server restart (still ₹250)");
    assert(restartQueryData.config.feeValue !== 150, "Confirmed: No fallback/default reset fee back to ₹150");

    const restartedClientRes = await fetch(`${restartedBaseUrl}/api/project-reviews/pricing?expertId=${expertId}&role=client`);
    const restartedClientData = await restartedClientRes.json();
    assert(restartedClientData.platformFee === 250, "Client pricing on restarted server uses persisted ₹250");
    assert(restartedClientData.clientPrice === 1250, "Client total on restarted server is ₹1,250");

    // -------------------------------------------------------------------------
    // TEST 9: Service Isolation Verification (1-Hour Call Rate Untouched)
    // -------------------------------------------------------------------------
    console.log("\n--- Test 9: 1-Hour Call Service Isolation ---");
    const freshDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const verifyExpert = (freshDb.experts || []).find(e => e.id === expertId);
    assert(verifyExpert.rate === initial1HourRate, `Expert 1-Hour Call rate remains exactly ₹${initial1HourRate} (untouched)`);

    // Reset fee back to 200 as required by user prompt
    await fetch(`${restartedBaseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeType: 'fixed', feeValue: 200, role: 'admin', userId: 'admin' })
    });
    const finalDisk = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    assert(finalDisk.projectReviewConfig.feeValue === 200, "Final persisted feeValue in db.json is ₹200");

    await restartedServer.close();

    console.log("\n================================================================================");
    console.log(`📊 Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log("================================================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution error:", err);
    try { await server.close(); } catch {}
    process.exit(1);
  }
}

runTests();
