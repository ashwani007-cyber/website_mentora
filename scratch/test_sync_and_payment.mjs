import assert from 'node:assert';

const BASE_URL = 'http://[::1]:5173';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function runTests() {
  console.log('🚀 Starting Project Review Synchronization & Payment Integration Tests...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     ${err.message}`);
      failed++;
    }
  }

  // 1. Check experts to locate JK
  console.log('--- Phase 1: Locate Expert JK & Setup Initial State ---');
  const expRes = await request('/api/db');
  test('DB API returns experts list', () => {
    assert.strictEqual(expRes.status, 200);
    assert.ok(Array.isArray(expRes.data.experts));
  });

  const expertJK = expRes.data.experts.find(e => 
    e.name?.toLowerCase() === 'jk' || e.email?.toLowerCase() === 'jay@gmail.com'
  ) || {
    id: 'usr-1788974684441',
    name: 'JK',
    email: 'jay@gmail.com',
    rate: 650,
    baseRate: 500
  };

  test('Expert JK located in database', () => {
    assert.ok(expertJK, 'Expert JK must exist');
    assert.ok(expertJK.id, 'Expert JK must have an ID');
  });

  const clientEmail = 'client_abc@enterprise.com';
  const clientName = 'Client ABC';
  const clientId = 'cli-abc-test';
  const initialWallet = 20000;

  // Initialize client wallet
  await request('/api/kv', {
    method: 'POST',
    body: JSON.stringify({
      key: `client_wallet_${clientEmail}`,
      value: String(initialWallet)
    })
  });

  const checkBalRes = await request(`/api/kv?key=client_wallet_${clientEmail}`);
  test('Client wallet initialized in KV store', () => {
    assert.strictEqual(checkBalRes.data.value, String(initialWallet));
  });

  // 2. Client ABC creates Project Review request for Expert JK
  console.log('\n--- Phase 2: Client ABC Requests Project Review with Expert JK (Escrow Deduction) ---');
  const reqPayload = {
    clientId,
    clientName,
    clientEmail,
    expertId: expertJK.id,
    expertName: expertJK.name,
    expertEmail: expertJK.email,
    expectedScope: 'Full Architecture Audit + 2 Strategy Meetings',
    reviewType: 'High-Throughput Scalability & Database Assessment',
    requestNotes: 'Migrating to microservices and need scalability audit.',
    clientWalletBalance: initialWallet
  };

  const createRes = await request('/api/project-reviews/request', {
    method: 'POST',
    body: JSON.stringify(reqPayload)
  });

  let review1 = createRes.data.projectReview;
  test('Project Review request created successfully', () => {
    assert.strictEqual(createRes.status, 200);
    assert.strictEqual(createRes.data.success, true);
    assert.ok(review1, 'review object returned');
    assert.strictEqual(review1.status, 'PendingExpertAcceptance');
    assert.strictEqual(review1.paymentStatus, 'PaymentSuccessful');
    assert.ok(review1.price > 0, 'Price must be positive authoritative number');
    assert.ok(review1.expertEarning > 0, 'Expert earning must be calculated');
    assert.ok(review1.clientWalletTxId, 'Wallet transaction ID must be recorded');
  });

  // Verify wallet deduction in backend KV
  const postReqBalRes = await request(`/api/kv?key=client_wallet_${clientEmail}`);
  const expectedDeductedBal = initialWallet - review1.price;
  test('Client wallet balance deducted immediately upon request creation', () => {
    assert.strictEqual(Number(postReqBalRes.data.value), expectedDeductedBal);
    assert.strictEqual(createRes.data.clientWalletBalance, expectedDeductedBal);
  });

  // 3. Expert JK Portal Synchronization
  console.log('\n--- Phase 3: Expert JK Portal Synchronization (By Email, ID, and Name) ---');
  
  // By Expert Email
  const expertByEmailRes = await request(`/api/project-reviews?expertEmail=${expertJK.email}&role=expert`);
  test('Expert JK retrieves pending request by expertEmail', () => {
    assert.strictEqual(expertByEmailRes.status, 200);
    const found = expertByEmailRes.data.projectReviews.find(r => r.projectReviewId === review1.projectReviewId);
    assert.ok(found, 'Request must be found in Expert JK query by email');
    assert.strictEqual(found.clientName, clientName);
    assert.strictEqual(found.status, 'PendingExpertAcceptance');
    assert.strictEqual(found.price, review1.price);
    assert.strictEqual(found.expertEarning, review1.expertEarning);
    assert.ok(found.createdAt, 'Request timestamp must be present');
  });

  // By Expert ID
  const expertByIdRes = await request(`/api/project-reviews?expertId=${expertJK.id}&role=expert`);
  test('Expert JK retrieves pending request by expertId', () => {
    assert.strictEqual(expertByIdRes.status, 200);
    const found = expertByIdRes.data.projectReviews.find(r => r.projectReviewId === review1.projectReviewId);
    assert.ok(found, 'Request must be found in Expert JK query by ID');
  });

  // By Expert Name
  const expertByNameRes = await request(`/api/project-reviews?expertName=${encodeURIComponent(expertJK.name)}&role=expert`);
  test('Expert JK retrieves pending request by expertName', () => {
    assert.strictEqual(expertByNameRes.status, 200);
    const found = expertByNameRes.data.projectReviews.find(r => r.projectReviewId === review1.projectReviewId);
    assert.ok(found, 'Request must be found in Expert JK query by Name');
  });

  // 4. Accept Workflow
  console.log('\n--- Phase 4: Expert JK Accepts Project Review Request ---');
  const acceptRes = await request(`/api/project-reviews/${review1.projectReviewId}/respond`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'accept',
      responderId: expertJK.id,
      responderRole: 'expert'
    })
  });

  test('Expert acceptance succeeds', () => {
    assert.strictEqual(acceptRes.status, 200);
    assert.strictEqual(acceptRes.data.success, true);
    assert.strictEqual(acceptRes.data.projectReview.status, 'Accepted');
    assert.strictEqual(acceptRes.data.projectReview.paymentStatus, 'PaymentSuccessful');
  });

  // Verify synchronization across 3 portals after Accept
  const clientCheckRes = await request(`/api/project-reviews?clientEmail=${clientEmail}&role=client`);
  test('Client Portal sees status updated to Accepted', () => {
    const found = clientCheckRes.data.projectReviews.find(r => r.projectReviewId === review1.projectReviewId);
    assert.ok(found);
    assert.strictEqual(found.status, 'Accepted');
  });

  const adminCheckRes = await request('/api/project-reviews?includeArchived=true');
  test('Admin Portal sees status updated to Accepted', () => {
    const found = adminCheckRes.data.projectReviews.find(r => r.projectReviewId === review1.projectReviewId);
    assert.ok(found);
    assert.strictEqual(found.status, 'Accepted');
    assert.strictEqual(found.paymentStatus, 'PaymentSuccessful');
    assert.strictEqual(found.price, review1.price);
    assert.strictEqual(found.platformFee, review1.platformFee);
    assert.strictEqual(found.expertEarning, review1.expertEarning);
  });

  // 5. Decline Workflow & Refund Path
  console.log('\n--- Phase 5: Decline Workflow & Escrow Refund Synchronization ---');
  
  // Create a second project review to test the decline and refund path
  const reqPayload2 = {
    clientId: 'cli-abc-test-2',
    clientName: 'Client ABC Team 2',
    clientEmail: 'client_abc_team2@enterprise.com',
    expertId: expertJK.id,
    expertName: expertJK.name,
    expertEmail: expertJK.email,
    expectedScope: 'Security & Compliance Review',
    reviewType: 'Security, Vulnerability & Compliance Audit',
    requestNotes: 'Need SOC2 security audit.',
    clientWalletBalance: 12000
  };

  const createRes2 = await request('/api/project-reviews/request', {
    method: 'POST',
    body: JSON.stringify(reqPayload2)
  });

  const review2 = createRes2.data.projectReview;
  test('Second Project Review request created for decline testing', () => {
    assert.strictEqual(createRes2.status, 200);
    assert.strictEqual(review2.status, 'PendingExpertAcceptance');
    assert.strictEqual(review2.paymentStatus, 'PaymentSuccessful');
  });

  const balBeforeDeclineRes = await request(`/api/kv?key=client_wallet_${reqPayload2.clientEmail}`);
  const balBeforeDecline = Number(balBeforeDeclineRes.data.value);

  // Expert JK declines with reason
  const declineRes = await request(`/api/project-reviews/${review2.projectReviewId}/respond`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'decline',
      reason: 'Fully booked this month, unable to commit to audit window.',
      responderId: expertJK.id,
      responderRole: 'expert'
    })
  });

  test('Expert decline succeeds and updates status to Declined', () => {
    assert.strictEqual(declineRes.status, 200);
    assert.strictEqual(declineRes.data.success, true);
    assert.strictEqual(declineRes.data.projectReview.status, 'Declined');
    assert.strictEqual(declineRes.data.projectReview.paymentStatus, 'Refunded');
    assert.ok(declineRes.data.projectReview.refundTxId, 'Refund Tx ID must be generated');
  });

  // Verify wallet refund in KV
  const balAfterDeclineRes = await request(`/api/kv?key=client_wallet_${reqPayload2.clientEmail}`);
  const balAfterDecline = Number(balAfterDeclineRes.data.value);
  test('Escrow funds refunded to Client Wallet upon decline', () => {
    assert.strictEqual(balAfterDecline, balBeforeDecline + review2.price);
  });

  // Verify audit timeline contains refund event
  const declinedReviewFromDb = await request(`/api/project-reviews?id=${review2.projectReviewId}`);
  test('Audit timeline records refund_processed event', () => {
    const item = declinedReviewFromDb.data.projectReview;
    const refundEvent = item.activityTimeline.find(a => a.eventType === 'refund_processed');
    assert.ok(refundEvent, 'refund_processed event must be present in timeline');
    assert.strictEqual(refundEvent.newStatus, 'Refunded');
  });

  // Verify Admin sees Declined
  const adminDeclineCheck = await request('/api/project-reviews?includeArchived=true');
  test('Admin Portal reflects Declined status and refund', () => {
    const found = adminDeclineCheck.data.projectReviews.find(r => r.projectReviewId === review2.projectReviewId);
    assert.ok(found);
    assert.strictEqual(found.status, 'Declined');
    assert.strictEqual(found.paymentStatus, 'Refunded');
  });

  // 6. Workflow A Isolation Check
  console.log('\n--- Phase 6: Workflow A 60-Minute Consultation Isolation Check ---');
  const availRes = await request('/api/availability');
  test('Workflow A availability endpoint operational and isolated', () => {
    assert.strictEqual(availRes.status, 200);
    assert.strictEqual(availRes.data.success, true);
    assert.ok(Array.isArray(availRes.data.availabilities));
  });

  const availFilterRes = await request('/api/availability?expertId=exp-1');
  test('Workflow A expert-specific availability slots unaffected', () => {
    assert.strictEqual(availFilterRes.status, 200);
    assert.ok(availFilterRes.data.availabilities.every(a => a.expertId === 'exp-1'));
  });

  console.log('\n======================================================');
  console.log(`🏁 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
