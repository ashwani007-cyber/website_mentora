import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log("================================================================================");
  console.log("🚀 Running Test Suite: Simple Dynamic Pricing & Cross-Portal Synchronization");
  console.log("   Model: Expert Price + Platform Charge = Final Client Price");
  console.log("================================================================================\n");

  const server = await createServer({
    configFile: './vite.config.ts',
    server: { port: 5186, strictPort: false }
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

  try {
    const dbPath = path.resolve(process.cwd(), 'db.json');
    const rawDbBefore = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    let expertJK = (rawDbBefore.experts || []).find(e =>
      e.name?.toLowerCase() === 'jk' || e.email?.toLowerCase() === 'jay@gmail.com'
    ) || (rawDbBefore.experts || [])[0];

    const targetExpertId = expertJK.id;
    const targetExpertEmail = expertJK.email;
    const targetExpertName = expertJK.name;
    const initialHourlyRate = expertJK.hourlyRate || expertJK.rate;

    console.log(`Target Expert: ${targetExpertName} (ID: ${targetExpertId}, Email: ${targetExpertEmail})`);
    console.log(`Initial 1-Hour Call Rate: ₹${initialHourlyRate}\n`);

    // Reset platform fee to default fixed ₹100
    await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeType: 'fixed', feeValue: 100, role: 'admin', userId: 'admin' })
    });

    // =========================================================================
    // SECTION 1: Baseline Establishment (Expert Price = ₹1,000, Platform Charge = ₹100)
    // =========================================================================
    console.log("--- Section 1: Baseline Setup (Expert = ₹1,000, Fee = ₹100) ---");
    const baselineRes = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expertId: targetExpertId, projectRate: 1000, role: 'admin', userId: 'admin' })
    });
    const baselineData = await baselineRes.json();
    assert(baselineRes.status === 200, "Baseline setup HTTP 200 OK");
    assert(baselineData.projectRate === 1000, "Expert price set to ₹1,000");
    assert(baselineData.platformFee === 100, "Platform charge is ₹100");
    assert(baselineData.clientPrice === 1100, "Final Client Price is ₹1,100 (1000 + 100)");

    // Verify portals at baseline
    const expBase = await (await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=expert`)).json();
    assert(expBase.projectRate === 1000, "Expert Portal reads ₹1,000");

    const admBase = await (await fetch(`${baseUrl}/api/project-reviews/pricing?all=true&role=admin`)).json();
    const admBaseExp = (admBase.experts || []).find(e => e.id === targetExpertId);
    assert(admBaseExp && admBaseExp.projectRate === 1000, "Admin Portal reads Expert Charge ₹1,000");
    assert(admBaseExp && admBaseExp.platformFee === 100, "Admin Portal reads Platform Charge ₹100");
    assert(admBaseExp && admBaseExp.clientPrice === 1100, "Admin Portal reads Client Price ₹1,100");

    const cliBase = await (await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=client`)).json();
    assert(cliBase.projectRate === 1000, "Client Portal reads Expert Charge ₹1,000");
    assert(cliBase.platformFee === 100, "Client Portal reads Platform Charge ₹100");
    assert(cliBase.clientPrice === 1100, "Client Portal reads Total Amount ₹1,100");

    // =========================================================================
    // SECTION 2: Flow A — Expert Changes Price (₹1,000 -> ₹1,500)
    // =========================================================================
    console.log("\n--- Section 2: Flow A — Expert Changes Price (₹1,000 -> ₹1,500) ---");
    const expUpdateRes = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
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
    const expUpdateData = await expUpdateRes.json();
    assert(expUpdateRes.status === 200, "Expert update returns HTTP 200 OK");
    assert(expUpdateData.projectRate === 1500, "Expert price updated to ₹1,500");
    assert(expUpdateData.platformFee === 100, "Platform charge remains ₹100");
    assert(expUpdateData.clientPrice === 1600, "Client price calculated as ₹1,600 (1500 + 100)");

    // Synchronized Portal Check
    const expP1 = await (await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=expert`)).json();
    assert(expP1.projectRate === 1500, "Expert Portal displays active price ₹1,500");

    const admP1 = await (await fetch(`${baseUrl}/api/project-reviews/pricing?all=true&role=admin`)).json();
    const admP1Exp = (admP1.experts || []).find(e => e.id === targetExpertId);
    assert(admP1Exp && admP1Exp.projectRate === 1500, "Admin Portal synchronized to Expert Charge ₹1,500");
    assert(admP1Exp && admP1Exp.platformFee === 100, "Admin Portal shows Platform Charge ₹100");
    assert(admP1Exp && admP1Exp.clientPrice === 1600, "Admin Portal shows Client Final Price ₹1,600");

    const cliP1 = await (await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=client`)).json();
    assert(cliP1.projectRate === 1500, "Client Portal synchronized to Expert Charge ₹1,500");
    assert(cliP1.platformFee === 100, "Client Portal synchronized to Platform Charge ₹100");
    assert(cliP1.clientPrice === 1600, "Client Portal synchronized to Total Amount ₹1,600");

    // =========================================================================
    // SECTION 3: Flow B — Admin Changes Expert Price (₹1,500 -> ₹1,200)
    // =========================================================================
    console.log("\n--- Section 3: Flow B — Admin Changes Expert Price (₹1,500 -> ₹1,200) ---");
    const admUpdateRes = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        projectRate: 1200,
        role: 'admin',
        userId: 'admin'
      })
    });
    const admUpdateData = await admUpdateRes.json();
    assert(admUpdateRes.status === 200, "Admin update returns HTTP 200 OK");
    assert(admUpdateData.projectRate === 1200, "Expert price updated to ₹1,200");
    assert(admUpdateData.platformFee === 100, "Platform charge remains ₹100");
    assert(admUpdateData.clientPrice === 1300, "Client price calculated as ₹1,300 (1200 + 100)");

    // Synchronized Portal Check
    const expP2 = await (await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=expert`)).json();
    assert(expP2.projectRate === 1200, "Expert Portal synchronized to active price ₹1,200");

    const admP2 = await (await fetch(`${baseUrl}/api/project-reviews/pricing?all=true&role=admin`)).json();
    const admP2Exp = (admP2.experts || []).find(e => e.id === targetExpertId);
    assert(admP2Exp && admP2Exp.projectRate === 1200, "Admin Portal shows Expert Charge ₹1,200");
    assert(admP2Exp && admP2Exp.platformFee === 100, "Admin Portal shows Platform Charge ₹100");
    assert(admP2Exp && admP2Exp.clientPrice === 1300, "Admin Portal shows Client Final Price ₹1,300");

    const cliP2 = await (await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=client`)).json();
    assert(cliP2.projectRate === 1200, "Client Portal shows Expert Charge ₹1,200");
    assert(cliP2.platformFee === 100, "Client Portal shows Platform Charge ₹100");
    assert(cliP2.clientPrice === 1300, "Client Portal shows Total Amount ₹1,300");

    // =========================================================================
    // SECTION 4: Platform Charge (Admin-Only) & Dynamic Client Recalculation
    // =========================================================================
    console.log("\n--- Section 4: Platform Charge Changes (Admin-Only) ---");

    // Case 4.1: Admin changes Platform Charge from ₹100 to ₹150 (Fixed)
    const feeUpdate1 = await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeType: 'fixed', feeValue: 150, role: 'admin', userId: 'admin' })
    });
    assert(feeUpdate1.status === 200, "Admin successfully updates Platform Charge to ₹150 (Fixed)");

    // Verify Expert price is unaffected, but Client price recalculates to ₹1,350
    const expP4 = await (await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=expert`)).json();
    assert(expP4.projectRate === 1200, "Expert price remains unaffected at ₹1,200");

    const cliP4 = await (await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=client`)).json();
    assert(cliP4.projectRate === 1200, "Client Portal shows Expert Charge ₹1,200");
    assert(cliP4.platformFee === 150, "Client Portal shows updated Platform Charge ₹150");
    assert(cliP4.clientPrice === 1350, "Client Portal shows updated Total Amount ₹1,350 (1200 + 150)");

    // Case 4.2: Admin changes Platform Charge to 10% (Percentage)
    const feeUpdate2 = await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeType: 'percentage', feeValue: 10, role: 'admin', userId: 'admin' })
    });
    assert(feeUpdate2.status === 200, "Admin successfully updates Platform Charge to 10% (Percentage)");

    const cliP4_pct = await (await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=client`)).json();
    assert(cliP4_pct.projectRate === 1200, "Expert price remains ₹1,200");
    assert(cliP4_pct.platformFee === 120, "Platform Charge dynamically calculated as ₹120 (10% of 1200)");
    assert(cliP4_pct.clientPrice === 1320, "Total Amount dynamically calculated as ₹1,320 (1200 + 120)");

    // Restore to Fixed ₹100 for payment tests
    await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeType: 'fixed', feeValue: 100, role: 'admin', userId: 'admin' })
    });

    // =========================================================================
    // SECTION 5: Role-Based Authorization Restrictions
    // =========================================================================
    console.log("\n--- Section 5: Role-Based Authorization Restrictions ---");

    // Client cannot change price
    const clientTamperRes = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expertId: targetExpertId, projectRate: 500, role: 'client', userId: 'cli-1' })
    });
    assert(clientTamperRes.status === 403, "Client role cannot update Expert price (HTTP 403 Forbidden)");

    // Expert cannot change another expert's price
    const otherExpert = (rawDbBefore.experts || []).find(e => e.id !== targetExpertId);
    const expertTamperRes = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expertId: otherExpert?.id || 'exp-other', projectRate: 500, role: 'expert', userId: targetExpertId })
    });
    assert(expertTamperRes.status === 403, "Expert role cannot update another Expert's price (HTTP 403 Forbidden)");

    // Client/Expert cannot view/modify platform fee configuration
    const clientFeeGet = await fetch(`${baseUrl}/api/project-reviews/platform-fee?role=client`);
    assert(clientFeeGet.status === 403, "Client cannot view platform fee configuration (HTTP 403 Forbidden)");

    const expertFeePost = await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeType: 'fixed', feeValue: 50, role: 'expert' })
    });
    assert(expertFeePost.status === 403, "Expert cannot modify platform fee configuration (HTTP 403 Forbidden)");

    // =========================================================================
    // SECTION 6: Price Boundaries (Strict ₹0 - ₹2,000)
    // =========================================================================
    console.log("\n--- Section 6: Price Boundaries (Strict ₹0 to ₹2,000) ---");

    // Valid boundary 1: ₹0 accepted
    const zeroRes = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expertId: targetExpertId, projectRate: 0, role: 'admin', userId: 'admin' })
    });
    const zeroData = await zeroRes.json();
    assert(zeroRes.status === 200, "Price of ₹0 accepted (HTTP 200)");
    assert(zeroData.projectRate === 0, "projectRate returned is 0");

    // Valid boundary 2: ₹2,000 accepted
    const maxRes = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expertId: targetExpertId, projectRate: 2000, role: 'admin', userId: 'admin' })
    });
    const maxData = await maxRes.json();
    assert(maxRes.status === 200, "Price of ₹2,000 accepted (HTTP 200)");
    assert(maxData.projectRate === 2000, "projectRate returned is 2000");

    // Out-of-bounds: ₹2,001 rejected with HTTP 400
    const overBoundRes = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expertId: targetExpertId, projectRate: 2001, role: 'admin', userId: 'admin' })
    });
    assert(overBoundRes.status === 400, "Price above ₹2,000 (₹2,001) is rejected with HTTP 400");

    // Out-of-bounds: Below ₹0 (-500) rejected with HTTP 400
    const underBoundRes = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expertId: targetExpertId, projectRate: -500, role: 'admin', userId: 'admin' })
    });
    assert(underBoundRes.status === 400, "Price below ₹0 (-500) is rejected with HTTP 400");

    // Out-of-bounds: Non-numeric price rejected with HTTP 400
    const nonNumRes = await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expertId: targetExpertId, projectRate: "invalid", role: 'admin', userId: 'admin' })
    });
    assert(nonNumRes.status === 400, "Non-numeric price is rejected with HTTP 400");

    // Reset back to ₹1,200 for payment tests
    await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expertId: targetExpertId, projectRate: 1200, role: 'admin', userId: 'admin' })
    });

    // =========================================================================
    // SECTION 7: Client Payment Integration & Authoritative Wallet Deduction
    // =========================================================================
    console.log("\n--- Section 7: Client Payment Integration & Authoritative Deduction ---");
    // Current Active Rate: Expert = ₹1,200, Fee = ₹100, Total = ₹1,300

    const testClientEmail = `client_sync_${Date.now()}@domain.com`;
    const testClientId = `cli-sync-${Date.now()}`;
    const initialClientBalance = 5000;

    // Set initial wallet balance in KV
    await fetch(`${baseUrl}/api/kv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: `client_wallet_${testClientEmail}`, value: String(initialClientBalance) })
    });

    // Client requests booking with tampered client-side price payload (e.g., price: 100)
    console.log("Submitting Project Review request with tampered client price payload (price: 100)...");
    const bookRes = await fetch(`${baseUrl}/api/project-reviews/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: testClientId,
        clientName: 'Sync Test Client',
        clientEmail: testClientEmail,
        expertId: targetExpertId,
        expertName: targetExpertName,
        expertEmail: targetExpertEmail,
        reviewType: 'Architecture & Scalability Audit',
        expectedScope: 'Full Codebase Review + 2 Strategy Meetings',
        requestNotes: 'Verify dynamic pricing sync integration',
        price: 100 // Tampered attempt!
      })
    });

    const bookData = await bookRes.json();
    assert(bookRes.status === 200, "Booking request succeeds (HTTP 200 OK)");
    assert(bookData.success === true, "Booking response success is true");
    const review1 = bookData.projectReview;
    assert(review1 !== undefined, "Review record created");

    // Authoritative calculations verification
    assert(review1.expertCharge === 1200, "Snapshot expertCharge is authoritatively ₹1,200");
    assert(review1.platformFee === 100, "Snapshot platformFee is authoritatively ₹100");
    assert(review1.price === 1300, "Snapshot price is authoritatively ₹1,300 (ignored client's ₹100)");
    assert(review1.paidAmount === 1300, "Snapshot paidAmount is ₹1,300");
    assert(review1.expertEarning === 1200, "Snapshot expertEarning is ₹1,200 (expert receives only Expert Price)");

    // Client Wallet Deduction verification
    const expectedClientBal = initialClientBalance - 1300; // 5000 - 1300 = 3700
    assert(bookData.clientWalletBalance === expectedClientBal, `Client wallet returned ₹${expectedClientBal}`);

    const walletKvRes = await (await fetch(`${baseUrl}/api/kv?key=client_wallet_${testClientEmail}`)).json();
    assert(Number(walletKvRes.value) === expectedClientBal, `Client wallet persisted in KV as ₹${expectedClientBal}`);

    // =========================================================================
    // SECTION 8: Subsequent Price Change & Historical Snapshot Immutability
    // =========================================================================
    console.log("\n--- Section 8: Subsequent Price Changes & Historical Snapshot Immutability ---");

    // Now Expert changes price to ₹1,800
    await fetch(`${baseUrl}/api/project-reviews/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expertId: targetExpertId, projectRate: 1800, role: 'admin', userId: 'admin' })
    });

    // Admin changes platform charge to ₹200
    await fetch(`${baseUrl}/api/project-reviews/platform-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeType: 'fixed', feeValue: 200, role: 'admin', userId: 'admin' })
    });

    // New active price check: 1800 + 200 = 2000
    const newPriceQuery = await (await fetch(`${baseUrl}/api/project-reviews/pricing?expertId=${targetExpertId}&role=client`)).json();
    assert(newPriceQuery.projectRate === 1800, "New active Expert price is ₹1,800");
    assert(newPriceQuery.platformFee === 200, "New active Platform Charge is ₹200");
    assert(newPriceQuery.clientPrice === 2000, "New active Total Amount is ₹2,000");

    // Historical Review 1 verification: MUST retain original snapshot!
    const histReviewRes = await fetch(`${baseUrl}/api/project-reviews?id=${review1.projectReviewId}`);
    const histReviewData = await histReviewRes.json();
    const histReview = histReviewData.projectReview || histReviewData;

    assert(histReview.price === 1300, "Historical Review 1 price remains strictly ₹1,300");
    assert(histReview.paidAmount === 1300, "Historical Review 1 paidAmount remains strictly ₹1,300");
    assert(histReview.expertCharge === 1200, "Historical Review 1 expertCharge remains strictly ₹1,200");
    assert(histReview.platformFee === 100, "Historical Review 1 platformFee remains strictly ₹100");
    assert(histReview.expertEarning === 1200, "Historical Review 1 expertEarning remains strictly ₹1,200");

    // Client's wallet must NOT have been changed by subsequent rate/fee changes
    const walletCheckAfter = await (await fetch(`${baseUrl}/api/kv?key=client_wallet_${testClientEmail}`)).json();
    assert(Number(walletCheckAfter.value) === expectedClientBal, `Client wallet remains strictly at ₹${expectedClientBal}`);

    // =========================================================================
    // SECTION 9: Escrow Release on Review Completion
    // =========================================================================
    console.log("\n--- Section 9: Escrow Release upon Review Completion ---");

    // Setup initial expert wallet balance
    const expWalletKey = `expert_wallet_${targetExpertEmail.toLowerCase().trim()}`;
    await fetch(`${baseUrl}/api/kv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: expWalletKey, value: '0' })
    });

    // Accept review
    const acceptRes = await fetch(`${baseUrl}/api/project-reviews/${review1.projectReviewId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', responderId: targetExpertId, responderRole: 'expert' })
    });
    assert(acceptRes.status === 200, "Review accepted successfully (HTTP 200)");

    // Submit project
    const submitRes = await fetch(`${baseUrl}/api/project-reviews/${review1.projectReviewId}/submit-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Ready for review',
        questions: 'Check performance'
      })
    });
    assert(submitRes.status === 200, "Project submitted successfully (HTTP 200)");

    // Finalize review (triggers escrow release to expert wallet)
    const completeRes = await fetch(`${baseUrl}/api/project-reviews/${review1.projectReviewId}/complete-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: targetExpertId,
        expertName: targetExpertName,
        finalReportNotes: 'Architecture audit completed successfully'
      })
    });
    const completeData = await completeRes.json();
    assert(completeRes.status === 200, "Review finalized successfully (HTTP 200 OK)");
    assert(completeData.projectReview.status === 'Completed', "Review transitioned to 'Completed'");
    assert(completeData.projectReview.expertEarningStatus === 'EarningReleased', "Expert earning status transitioned to 'EarningReleased'");

    // Verify expert received EXACTLY the snapshot expertCharge (₹1,200), NOT the new rate (₹1,800)
    const expertWalletRes = await (await fetch(`${baseUrl}/api/kv?key=${expWalletKey}`)).json();
    assert(Number(expertWalletRes.value) === 1200, `Expert wallet credited with original snapshot earning ₹1,200 (received: ₹${expertWalletRes.value})`);

    // =========================================================================
    // SECTION 10: Service Isolation Verification (1-Hour Call Rate Untouched)
    // =========================================================================
    console.log("\n--- Section 10: Service Isolation Verification ---");
    const freshDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const expertAfter = (freshDb.experts || []).find(e => e.id === targetExpertId);
    const hourlyRateAfter = expertAfter.hourlyRate || expertAfter.rate;
    assert(hourlyRateAfter === initialHourlyRate, `1-Hour Call rate remains 100% untouched: ₹${hourlyRateAfter} === ₹${initialHourlyRate}`);

  } catch (err) {
    console.error("Test execution failed with exception:", err);
    failed++;
  } finally {
    await server.close();
  }

  console.log("\n================================================================================");
  console.log(`Test Results Summary: Passed: ${passed} | Failed: ${failed}`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
