import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log("🚀 Starting Step 4: Full Alternating Two-Way Dynamic Synchronization Tests...\n");
  const server = await createServer({
    configFile: './vite.config.ts',
    server: { port: 5183, strictPort: false }
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
    const rawDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    let expertJK = (rawDb.experts || []).find(e =>
      e.name?.toLowerCase() === 'jk' || e.email?.toLowerCase() === 'jay@gmail.com'
    ) || (rawDb.experts || [])[0];

    const targetExpertId = expertJK.id;
    const targetExpertEmail = expertJK.email;
    console.log(`Target Expert: ${expertJK.name} (${targetExpertId})`);

    // Helper to query all 3 perspectives
    async function verifyPortals(expectedPrice, stepName) {
      // 1. Expert Portal query
      const expRes = await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=expert`);
      const expData = await expRes.json();
      assert(expData.projectRate === expectedPrice, `${stepName} -> Expert Portal shows ₹${expectedPrice}`);

      // 2. Admin Portal query
      const admRes = await fetch(`${baseUrl}/api/project-reviews/pricing?all=true&role=admin`);
      const admData = await admRes.json();
      const admItem = (admData.experts || []).find(e => e.id === targetExpertId);
      assert(admItem && admItem.projectRate === expectedPrice, `${stepName} -> Admin Portal shows ₹${expectedPrice}`);

      // 3. Client Portal query
      const cliRes = await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=client`);
      const cliData = await cliRes.json();
      assert(cliData.projectRate === expectedPrice, `${stepName} -> Client Portal shows ₹${expectedPrice}`);
    }

    // Phase 0: Baseline at ₹1,000
    console.log("\n--- Phase 0: Establish Baseline at ₹1,000 ---");
    await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expertId: targetExpertId, projectRate: 1000, role: 'admin', userId: 'admin' })
    });
    await verifyPortals(1000, "Phase 0 (Baseline)");

    // Step 1: Expert changes ₹1,000 -> ₹1,500
    console.log("\n--- Step 1: Expert changes price ₹1,000 -> ₹1,500 ---");
    const s1Res = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: 1500,
        role: 'expert',
        userId: targetExpertId,
        userEmail: targetExpertEmail
      })
    });
    assert(s1Res.status === 200, "Step 1: Expert update saved successfully");
    await verifyPortals(1500, "Step 1 (Expert: 1000 -> 1500)");

    // Step 2: Admin changes ₹1,500 -> ₹1,200
    console.log("\n--- Step 2: Admin changes price ₹1,500 -> ₹1,200 ---");
    const s2Res = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: 1200,
        role: 'admin',
        userId: 'admin'
      })
    });
    assert(s2Res.status === 200, "Step 2: Admin update saved successfully");
    await verifyPortals(1200, "Step 2 (Admin: 1500 -> 1200)");

    // Step 3: Expert changes ₹1,200 -> ₹1,800
    console.log("\n--- Step 3: Expert changes price ₹1,200 -> ₹1,800 ---");
    const s3Res = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: 1800,
        role: 'expert',
        userId: targetExpertId,
        userEmail: targetExpertEmail
      })
    });
    assert(s3Res.status === 200, "Step 3: Expert update saved successfully");
    await verifyPortals(1800, "Step 3 (Expert: 1200 -> 1800)");

    // Step 4: Admin changes ₹1,800 -> ₹900
    console.log("\n--- Step 4: Admin changes price ₹1,800 -> ₹900 ---");
    const s4Res = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: 900,
        role: 'admin',
        userId: 'admin'
      })
    });
    assert(s4Res.status === 200, "Step 4: Admin update saved successfully");
    await verifyPortals(900, "Step 4 (Admin: 1800 -> 900)");

    // Verification of Survival:
    // A. Re-read disk file directly (survives process / restart / reload)
    console.log("\n--- Survival Checks ---");
    const diskDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const expOnDisk = (diskDb.experts || []).find(e => e.id === targetExpertId);
    assert(expOnDisk && expOnDisk.projectRate === 900, "Disk db.json reflects active price ₹900");

    // B. Simulate concurrent tabs / multi-client queries
    const tabQueries = await Promise.all([
      fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=expert`).then(r => r.json()),
      fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=client`).then(r => r.json()),
      fetch(`${baseUrl}/api/project-reviews/pricing?all=true&role=admin`).then(r => r.json()),
      fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=client`).then(r => r.json()),
      fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=expert`).then(r => r.json())
    ]);
    const allConsistent = tabQueries.every(q => {
      if (q.projectRate !== undefined) return q.projectRate === 900;
      const found = (q.experts || []).find(e => e.id === targetExpertId);
      return found?.projectRate === 900;
    });
    assert(allConsistent, "5 simulated concurrent tab queries all consistently return ₹900");

    // C. Verify full audit sequence
    const auditLogs = diskDb.pricingAuditLogs || [];
    const recentLogs = auditLogs.filter(l => l.targetExpertId === targetExpertId).slice(0, 4);
    assert(recentLogs.length >= 4, "All alternating sync transitions logged to audit trail");

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
