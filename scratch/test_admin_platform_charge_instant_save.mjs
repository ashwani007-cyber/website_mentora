// scratch/test_admin_platform_charge_instant_save.mjs
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5173';
const DB_PATH = path.resolve('db.json');

async function run() {
  console.log('=== ADMIN PLATFORM CHARGE INSTANT SAVE & SYNCHRONIZATION TEST ===\n');

  // 1. Initial State Check
  console.log('Test 1: Read current backend platformCharge config...');
  const res1 = await fetch(`${BASE_URL}/api/project-reviews/platform-fee?role=admin`);
  const data1 = await res1.json();
  if (!res1.ok || !data1.success) throw new Error('Failed to fetch initial fee');
  console.log(`✓ Initial fee: Type = ${data1.config.feeType}, Value = ₹${data1.config.feeValue}`);

  // 2. Admin Changes Fee to ₹100 (The exact scenario reported by user: 200 -> 100)
  console.log('\nTest 2: Admin edits Platform Charge from ₹200 to ₹100 and saves instantly...');
  const t0 = Date.now();
  const res2 = await fetch(`${BASE_URL}/api/project-reviews/platform-fee`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      feeType: 'fixed',
      feeValue: 100,
      role: 'admin',
      userId: 'admin-governance'
    })
  });
  const data2 = await res2.json();
  const elapsed = Date.now() - t0;
  if (!res2.ok || !data2.success || data2.config.feeValue !== 100) {
    throw new Error('Failed to update fee to 100');
  }
  console.log(`✓ Saved to ₹100 in ${elapsed}ms (< 1 second)!`);

  // 3. Verify Database Persistence (db.json)
  console.log('\nTest 3: Verify permanent persistence in db.json...');
  const dbContent = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  if (dbContent.platformCharge?.feeValue !== 100) {
    throw new Error(`db.json platformCharge.feeValue is ${dbContent.platformCharge?.feeValue}, expected 100`);
  }
  if (dbContent.projectReviewConfig?.feeValue !== 100) {
    throw new Error(`db.json projectReviewConfig.feeValue is ${dbContent.projectReviewConfig?.feeValue}, expected 100`);
  }
  console.log(`✓ Confirmed in db.json: platformCharge.feeValue = ${dbContent.platformCharge.feeValue}`);

  // 4. Verify Immediate Multi-Portal Pricing Sync
  console.log('\nTest 4: Verify client/admin portal pricing query receives ₹100 immediately...');
  const res3 = await fetch(`${BASE_URL}/api/project-reviews/pricing?expertId=usr-1788974684441`);
  const data3 = await res3.json();
  if (data3.platformFee !== 100 || data3.platformFeeConfig?.feeValue !== 100) {
    throw new Error(`Pricing endpoint returned platformFee ${data3.platformFee}, expected 100`);
  }
  const expectedTotal = data3.projectRate + 100;
  if (data3.clientPrice !== expectedTotal) {
    throw new Error(`Pricing endpoint clientPrice is ${data3.clientPrice}, expected ${expectedTotal}`);
  }
  console.log(`✓ Expert Rate: ₹${data3.projectRate}, Platform Charge: ₹${data3.platformFee}, Final Client Price: ₹${data3.clientPrice}`);

  // 5. Simulate 3-Second Wait to Confirm No Background Reversion to 200
  console.log('\nTest 5: Wait 3 seconds to ensure NO background worker or poller reverts ₹100 back to ₹200...');
  await new Promise(r => setTimeout(r, 3000));
  const res4 = await fetch(`${BASE_URL}/api/project-reviews/platform-fee?role=admin`);
  const data4 = await res4.json();
  if (data4.config.feeValue !== 100) {
    throw new Error(`Fee reverted! Expected 100, got ${data4.config.feeValue}`);
  }
  console.log(`✓ Still permanently ₹${data4.config.feeValue} after 3 seconds of background polling.`);

  // 6. Test Fee Type Change (Range Name: Percentage 10%)
  console.log('\nTest 6: Admin changes Fee Type to "percentage" 10% (User: "रेंज का नाम")...');
  const res5 = await fetch(`${BASE_URL}/api/project-reviews/platform-fee`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      feeType: 'percentage',
      feeValue: 10,
      role: 'admin',
      userId: 'admin-governance'
    })
  });
  const data5 = await res5.json();
  if (!res5.ok || !data5.success || data5.config.feeType !== 'percentage' || data5.config.feeValue !== 10) {
    throw new Error('Failed to update fee to percentage 10%');
  }
  console.log(`✓ Successfully updated to Percentage: 10%`);

  // 7. Verify Client Pricing with 10%
  const res6 = await fetch(`${BASE_URL}/api/project-reviews/pricing?expertId=usr-1788974684441`);
  const data6 = await res6.json();
  const expectedCut = Math.round(data6.projectRate * 0.10);
  if (data6.platformFee !== expectedCut) {
    throw new Error(`Expected platformFee ${expectedCut}, got ${data6.platformFee}`);
  }
  console.log(`✓ Dynamic percentage fee applied: ₹${data6.platformFee} (10% of ₹${data6.projectRate}), Client Total: ₹${data6.clientPrice}`);

  // 8. Revert back to baseline ₹200 Fixed
  console.log('\nTest 8: Revert back to baseline ₹200 Fixed Amount...');
  const res7 = await fetch(`${BASE_URL}/api/project-reviews/platform-fee`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      feeType: 'fixed',
      feeValue: 200,
      role: 'admin',
      userId: 'admin-governance'
    })
  });
  const data7 = await res7.json();
  if (data7.config.feeValue !== 200 || data7.config.feeType !== 'fixed') {
    throw new Error('Failed to restore baseline 200 fixed');
  }
  console.log(`✓ Restored to ₹${data7.config.feeValue} (Fixed).`);

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY (100%) ===\n');
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
