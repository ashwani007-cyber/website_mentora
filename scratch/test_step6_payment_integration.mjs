import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log("🚀 Starting Step 6: Payment Integration & Historical Price Snapshot Tests...\n");
  const server = await createServer({
    configFile: './vite.config.ts',
    server: { port: 5185, strictPort: false }
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

    // 1. Establish Known Active Pricing: Expert JK rate = ₹1,500, Platform fee = 15%
    console.log("\n--- Phase 1: Setup Known Active Rate (₹1,500) and Fee (15%) ---");
    await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expertId: targetExpertId, projectRate: 1500, role: 'admin', userId: 'admin' })
    });

    await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeType: 'percentage', feeValue: 15, role: 'admin', userId: 'admin' })
    });

    // 2. Setup Client Wallet
    const clientEmail = `client_snap_${Date.now()}@test.com`;
    const clientId = `cli-${Date.now()}`;
    const initialWallet = 10000;

    await fetch(`${baseUrl}/api/kv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: `client_wallet_${clientEmail}`, value: String(initialWallet) })
    });

    // 3. Client creates Project Review booking (attempting tampering: sending price = 250 in payload)
    console.log("\n--- Phase 2: Client Creates Booking with Backend-Authoritative Price ---");
    const bookRes = await fetch(`${baseUrl}/api/project-reviews/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        clientName: 'Enterprise Client Snap',
        clientEmail,
        expertId: targetExpertId,
        expertName: expertJK.name,
        expertEmail: targetExpertEmail,
        price: 250, // TAMPER ATTEMPT: Backend must ignore this and use ₹1,500!
        expectedScope: 'Full Code Review + 2 Meetings',
        reviewType: 'Architecture Audit',
        requestNotes: 'Snapshot integrity test'
      })
    });
    const bookData = await bookRes.json();
    assert(bookRes.status === 200, "Booking created successfully (HTTP 200)");
    assert(bookData.success === true, "Response has success: true");

    const review1 = bookData.projectReview;
    assert(review1.price === 1500, "Backend calculated authoritative price ₹1,500 (tampered ₹250 was ignored)");
    assert(review1.paidAmount === 1500, "paidAmount is ₹1,500");
    assert(review1.platformFee === 225, "platformFee is ₹225 (15% of ₹1,500)");
    assert(review1.expertEarning === 1275, "expertEarning is ₹1,275 (₹1,500 - ₹225)");
    assert(review1.status === 'PendingExpertAcceptance', "Initial status is 'PendingExpertAcceptance'");

    // Check wallet deduction
    const checkBalRes = await fetch(`${baseUrl}/api/kv?key=client_wallet_${clientEmail}`);
    const checkBalData = await checkBalRes.json();
    const expectedRemaining = initialWallet - 1500;
    assert(Number(checkBalData.value) === expectedRemaining, `Client wallet deducted by ₹1,500 (now ₹${expectedRemaining})`);

    // 4. Duplicate request prevention check (HTTP 409)
    console.log("\n--- Phase 3: Duplicate Request Protection ---");
    const dupRes = await fetch(`${baseUrl}/api/project-reviews/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        clientName: 'Enterprise Client Snap',
        clientEmail,
        expertId: targetExpertId,
        expertName: expertJK.name,
        expertEmail: targetExpertEmail
      })
    });
    assert(dupRes.status === 409, "Duplicate active review request rejected with HTTP 409 Conflict");

    // 5. Dynamic rate change AFTER booking: Admin changes rate to ₹900, Fee to Fixed ₹100
    console.log("\n--- Phase 4: Rate & Fee Changes Occur (Rate -> ₹900, Fee -> Fixed ₹100) ---");
    await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expertId: targetExpertId, projectRate: 900, role: 'admin', userId: 'admin' })
    });
    await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeType: 'fixed', feeValue: 100, role: 'admin', userId: 'admin' })
    });

    // 6. Verify Historical Snapshot of review1 is IMMUTABLE
    console.log("\n--- Phase 5: Historical Snapshot Immutability Verification ---");
    const getReviewRes = await fetch(`${baseUrl}/api/project-reviews?id=${review1.projectReviewId}`);
    const getReviewData = await getReviewRes.json();
    const historicalReview = getReviewData.projectReview;

    assert(historicalReview.price === 1500, "Historical price remains ₹1,500 (NOT changed to ₹900)");
    assert(historicalReview.paidAmount === 1500, "Historical paidAmount remains ₹1,500");
    assert(historicalReview.platformFee === 225, "Historical platformFee remains ₹225 (NOT changed to ₹100)");
    assert(historicalReview.expertEarning === 1275, "Historical expertEarning remains ₹1,275");

    // 7. Complete the lifecycle and verify escrow payout uses original snapshot
    console.log("\n--- Phase 6: Complete Review & Verify Snapshot Escrow Release ---");
    // Accept review
    await fetch(`${baseUrl}/api/project-reviews/${review1.projectReviewId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', responderId: targetExpertId, responderRole: 'expert' })
    });

    // Submit project
    await fetch(`${baseUrl}/api/project-reviews/${review1.projectReviewId}/submit-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Architecture files uploaded', questions: 'Audit check' })
    });

    // Capture expert wallet balance before completion
    const expWalletKey = `expert_wallet_${targetExpertEmail.toLowerCase()}`;
    const expBalBeforeRes = await fetch(`${baseUrl}/api/kv?key=${expWalletKey}`);
    const expBalBeforeData = await expBalBeforeRes.json();
    const expBalBefore = Number(expBalBeforeData.value || 0);

    // Expert completes review
    const completeRes = await fetch(`${baseUrl}/api/project-reviews/${review1.projectReviewId}/complete-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        expertName: expertJK.name,
        finalReportNotes: 'Detailed assessment completed.'
      })
    });
    const completeData = await completeRes.json();
    assert(completeRes.status === 200, "Complete review returns HTTP 200");
    assert(completeData.projectReview.status === 'Completed', "Status transitioned to 'Completed'");
    assert(completeData.projectReview.expertEarningStatus === 'EarningReleased', "Expert earning status is 'EarningReleased'");

    // Verify expert wallet received exact snapshot earning (₹1,275), not recalculated
    const expBalAfterRes = await fetch(`${baseUrl}/api/kv?key=${expWalletKey}`);
    const expBalAfterData = await expBalAfterRes.json();
    const expBalAfter = Number(expBalAfterData.value || 0);
    assert(expBalAfter === expBalBefore + 1275, `Expert wallet credited with exact snapshot earning ₹1,275 (before: ${expBalBefore}, after: ${expBalAfter})`);

    // 8. New Client booking uses newly active price (₹900)
    console.log("\n--- Phase 7: New Booking Uses Newly Active Price (₹900) ---");
    const client2Email = `client2_snap_${Date.now()}@test.com`;
    await fetch(`${baseUrl}/api/kv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: `client_wallet_${client2Email}`, value: '5000' })
    });

    const book2Res = await fetch(`${baseUrl}/api/project-reviews/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: `cli-2-${Date.now()}`,
        clientName: 'Second Client',
        clientEmail: client2Email,
        expertId: targetExpertId,
        expertName: expertJK.name,
        expertEmail: targetExpertEmail,
        reviewType: 'Second Review'
      })
    });
    const book2Data = await book2Res.json();
    assert(book2Res.status === 200, "Second booking succeeds with HTTP 200");
    const review2 = book2Data.projectReview;
    assert(review2.price === 900, "Second review uses new active rate ₹900");
    assert(review2.platformFee === 100, "Second review uses new active fixed fee ₹100");
    assert(review2.expertEarning === 800, "Second review calculates expert earning ₹800 (900 - 100)");

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
