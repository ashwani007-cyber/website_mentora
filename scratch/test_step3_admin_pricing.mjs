import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log("🚀 Starting Step 3: Admin Price Control & Cross-Portal Synchronization Tests...\n");
  const server = await createServer({
    configFile: './vite.config.ts',
    server: { port: 5182, strictPort: false }
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
    console.log(`Target Expert: ${expertJK.name} (${targetExpertId})`);

    // Ensure state starts at 1,500 (from Step 2)
    await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: 1500,
        role: 'admin',
        userId: 'admin'
      })
    });

    // Test 1: Admin views all experts' project rates
    console.log("\n--- Test 1: Admin directory view ---");
    const adminListRes = await fetch(`${baseUrl}/api/project-reviews/pricing?all=true&role=admin`);
    const adminListData = await adminListRes.json();
    assert(adminListRes.status === 200, "Admin directory GET returns HTTP 200");
    assert(Array.isArray(adminListData.experts), "Returns experts array");
    const foundJK = adminListData.experts.find(e => e.id === targetExpertId);
    assert(foundJK && foundJK.projectRate === 1500, "Admin sees Expert JK currently at ₹1,500");

    // Test 2: Admin changes price from ₹1,500 -> ₹1,200
    console.log("\n--- Test 2: Admin updates Expert JK price (₹1,500 -> ₹1,200) ---");
    const updateRes = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: 1200,
        role: 'admin',
        userId: 'admin-governance'
      })
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200, "Admin price update succeeds with HTTP 200");
    assert(updateData.projectRate === 1200, "Response confirms new active rate ₹1,200");

    // Test 3: Admin Portal sees ₹1,200
    console.log("\n--- Test 3: Verify cross-portal reflection ---");
    const adminVerifyRes = await fetch(`${baseUrl}/api/project-reviews/pricing?all=true&role=admin`);
    const adminVerifyData = await adminVerifyRes.json();
    const jkInAdmin = adminVerifyData.experts.find(e => e.id === targetExpertId);
    assert(jkInAdmin && jkInAdmin.projectRate === 1200, "Admin Portal immediately shows ₹1,200");

    // Test 4: Expert Portal sees ₹1,200
    const expertVerifyRes = await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=expert`);
    const expertVerifyData = await expertVerifyRes.json();
    assert(expertVerifyData.projectRate === 1200, "Expert Portal immediately sees newly active ₹1,200");

    // Test 5: Client Portal sees ₹1,200
    const clientVerifyRes = await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=client`);
    const clientVerifyData = await clientVerifyRes.json();
    assert(clientVerifyData.projectRate === 1200, "Client Portal immediately sees ₹1,200");

    // Test 6: Admin boundary checks (>2000, negative, malformed)
    console.log("\n--- Test 6: Admin boundary validation ---");
    const adminOver2000 = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: 2001,
        role: 'admin',
        userId: 'admin'
      })
    });
    assert(adminOver2000.status === 400, "Admin cannot set above ₹2,000 (HTTP 400 Bad Request)");

    const adminNegative = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: -100,
        role: 'admin',
        userId: 'admin'
      })
    });
    assert(adminNegative.status === 400, "Admin cannot set negative price (HTTP 400 Bad Request)");

    // Test 7: Multi-expert control - Admin updates other experts
    console.log("\n--- Test 7: Multi-expert control ---");
    const otherExperts = (rawDb.experts || []).filter(e => e.id !== targetExpertId);
    if (otherExperts.length > 0) {
      const exp1 = otherExperts[0];
      const adminOtherRes = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expertId: exp1.id,
          projectRate: 1800,
          role: 'admin',
          userId: 'admin'
        })
      });
      assert(adminOtherRes.status === 200, `Admin can update another expert ${exp1.name} (HTTP 200)`);
      const verifyOther = await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${exp1.id}&role=expert`);
      const verifyOtherData = await verifyOther.json();
      assert(verifyOtherData.projectRate === 1800, `Expert ${exp1.name} active rate is ₹1,800`);
    }

    // Test 8: Audit trail persistence
    console.log("\n--- Test 8: Audit log inspection ---");
    const diskDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const auditLogs = diskDb.pricingAuditLogs || [];
    const adminLog = auditLogs.find(l => l.targetExpertId === targetExpertId && l.newValue === 1200);
    assert(adminLog !== undefined, "Audit record for Admin update exists");
    assert(adminLog.changedByRole === 'admin', "Audit log changedByRole is 'admin'");
    assert(adminLog.previousValue === 1500, "Previous value recorded as 1500");
    assert(adminLog.newValue === 1200, "New value recorded as 1200");

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
