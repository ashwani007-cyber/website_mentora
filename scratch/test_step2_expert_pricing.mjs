import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log("🚀 Starting Step 2: Expert Price Configuration & Synchronization Tests...\n");
  const server = await createServer({
    configFile: './vite.config.ts',
    server: { port: 5181, strictPort: false }
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
    // 1. Locate Expert JK
    const dbPath = path.resolve(process.cwd(), 'db.json');
    const rawDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    let expertJK = (rawDb.experts || []).find(e =>
      e.name?.toLowerCase() === 'jk' || e.email?.toLowerCase() === 'jay@gmail.com'
    );
    if (!expertJK) {
      expertJK = (rawDb.experts || [])[0];
    }
    const targetExpertId = expertJK.id;
    const targetExpertEmail = expertJK.email;
    console.log(`Target Expert: ${expertJK.name} (${targetExpertId})`);

    // Reset initial price to 1000 for clean baseline
    await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: 1000,
        role: 'admin',
        userId: 'admin'
      })
    });

    // Test 1: Expert can see current price
    console.log("\n--- Test 1: Expert can see current price ---");
    const getRes1 = await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=expert`);
    const getData1 = await getRes1.json();
    assert(getRes1.status === 200, "GET /api/project-reviews/pricing returns HTTP 200");
    assert(getData1.success === true, "Response has success: true");
    assert(getData1.expertId === targetExpertId, "Response contains correct expertId");
    assert(getData1.projectRate === 1000, "Expert sees current baseline price ₹1,000");
    assert(getData1.minPrice === 0 && getData1.maxPrice === 2000, "Response specifies 0 to 2000 price bounds");

    // Test 2: ₹0 is accepted (boundary test)
    console.log("\n--- Test 2: ₹0 boundary validation ---");
    const zeroRes = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: 0,
        role: 'expert',
        userId: targetExpertId,
        userEmail: targetExpertEmail
      })
    });
    const zeroData = await zeroRes.json();
    assert(zeroRes.status === 200, "Price of ₹0 accepted with HTTP 200");
    assert(zeroData.projectRate === 0, "projectRate returned is 0");

    // Test 3: ₹2,000 is accepted (maximum boundary test)
    console.log("\n--- Test 3: ₹2,000 maximum boundary validation ---");
    const maxRes = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: 2000,
        role: 'expert',
        userId: targetExpertId,
        userEmail: targetExpertEmail
      })
    });
    const maxData = await maxRes.json();
    assert(maxRes.status === 200, "Price of ₹2,000 accepted with HTTP 200");
    assert(maxData.projectRate === 2000, "projectRate returned is 2000");

    // Test 4: ₹2,001 is rejected
    console.log("\n--- Test 4: Out-of-bounds rejection (₹2,001, ₹5,000, ₹12,000, negative, malformed) ---");
    const over2001 = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: 2001,
        role: 'expert',
        userId: targetExpertId,
        userEmail: targetExpertEmail
      })
    });
    assert(over2001.status === 400, "₹2,001 rejected with HTTP 400");

    // Test 5: ₹5,000 is rejected
    const over5000 = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: 5000,
        role: 'expert',
        userId: targetExpertId,
        userEmail: targetExpertEmail
      })
    });
    assert(over5000.status === 400, "₹5,000 rejected with HTTP 400");

    // Test 6: ₹12,000 is rejected
    const over12000 = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: 12000,
        role: 'expert',
        userId: targetExpertId,
        userEmail: targetExpertEmail
      })
    });
    assert(over12000.status === 400, "₹12,000 rejected with HTTP 400");

    // Test 7: Negative values rejected
    const negRes = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: -500,
        role: 'expert',
        userId: targetExpertId,
        userEmail: targetExpertEmail
      })
    });
    assert(negRes.status === 400, "Negative price rejected with HTTP 400");

    // Test 8: Non-numeric / malformed values rejected
    const strRes = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: "invalid-price",
        role: 'expert',
        userId: targetExpertId,
        userEmail: targetExpertEmail
      })
    });
    assert(strRes.status === 400, "Non-numeric price string rejected with HTTP 400");

    // Test 9: Unauthorized - Expert cannot modify another Expert's price
    console.log("\n--- Test 9: Security & Authorization ---");
    const otherExpert = (rawDb.experts || []).find(e => e.id !== targetExpertId);
    if (otherExpert) {
      const unauthorizedExp = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expertId: otherExpert.id,
          projectRate: 1200,
          role: 'expert',
          userId: targetExpertId,
          userEmail: targetExpertEmail
        })
      });
      assert(unauthorizedExp.status === 403, "Expert cannot modify another expert's price (HTTP 403 Forbidden)");
    }

    // Test 10: Unauthorized - Client cannot modify price
    const clientMod = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: 500,
        role: 'client',
        userId: 'client-1'
      })
    });
    assert(clientMod.status === 403, "Client cannot modify price (HTTP 403 Forbidden)");

    // Test 11: Expert updates price: ₹1,000 -> ₹1,500 and verify two-way sync
    console.log("\n--- Test 11: Dynamic Synchronization (Expert changes ₹1,000 -> ₹1,500) ---");
    const set1500Res = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
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
    const set1500Data = await set1500Res.json();
    assert(set1500Res.status === 200, "Expert update to ₹1,500 succeeds with HTTP 200");
    assert(set1500Data.projectRate === 1500, "Newly active price is ₹1,500");

    // Check Expert Portal query
    const expertQuery = await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=expert`);
    const expertData = await expertQuery.json();
    assert(expertData.projectRate === 1500, "Expert Portal immediately sees ₹1,500");

    // Check Admin Portal query
    const adminQuery = await fetch(`${baseUrl}/api/project-reviews/pricing?all=true&role=admin`);
    const adminData = await adminQuery.json();
    const adminExpRecord = (adminData.experts || []).find(e => e.id === targetExpertId);
    assert(adminExpRecord && adminExpRecord.projectRate === 1500, "Admin Portal immediately sees ₹1,500 for this expert");

    // Check Client Portal query
    const clientQuery = await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=client`);
    const clientData = await clientQuery.json();
    assert(clientData.projectRate === 1500, "Client Portal immediately sees ₹1,500");

    // Persistence Check: Disk verification
    const reloadedDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const diskExp = (reloadedDb.experts || []).find(e => e.id === targetExpertId);
    assert(diskExp && diskExp.projectRate === 1500, "Price ₹1,500 persisted to db.json disk storage");

    // Check audit log
    const auditLogs = reloadedDb.pricingAuditLogs || [];
    const latestLog = auditLogs.find(l => l.targetExpertId === targetExpertId && l.newValue === 1500);
    assert(latestLog !== undefined, "Audit trail recorded price change in pricingAuditLogs");
    assert(latestLog.changedByRole === 'expert', "Audit trail specifies changedByRole: 'expert'");
    assert(latestLog.context === 'project_review', "Audit trail specifies context: 'project_review'");

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
