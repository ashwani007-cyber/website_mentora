import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../db.json');

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    passedCount++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedCount++;
    console.error(`  ✗ FAIL: ${testName}`);
    if (details) console.error(`    Details: ${details}`);
  }
}

async function request(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, rawBody: body });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, rawBody: body });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log('Starting Test Suite: Global Platform Charge Dynamic Synchronization');
  console.log('===============================================================\n');

  // Baseline preparation: Ensure expert JK rate is 1000
  const dbBefore = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const jkExp = (dbBefore.experts || []).find(e => e.id === 'usr-1788974684441');
  if (jkExp) {
    jkExp.projectRate = 1000;
  }
  // Initialize platform charge to 200
  dbBefore.platformCharge = {
    feeType: 'fixed',
    feeValue: 200,
    currency: 'INR',
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin-governance'
  };
  dbBefore.projectReviewConfig = { ...dbBefore.platformCharge };
  fs.writeFileSync(DB_PATH, JSON.stringify(dbBefore, null, 2), 'utf8');

  // -------------------------------------------------------------------------
  // TEST 1: Database = ₹200 -> Client Project Review shows ₹200
  // -------------------------------------------------------------------------
  console.log('\n--- Test 1: Initial Database Platform Charge = ₹200 ---');
  {
    const resGet1 = await request('/api/platform-settings');
    assert(resGet1.status === 200, 'GET /api/platform-settings returns HTTP 200');
    assert(resGet1.data?.platformCharge?.feeValue === 200, 'GET /api/platform-settings returns feeValue = 200', JSON.stringify(resGet1.data));
    assert(resGet1.data?.platformCharge?.feeType === 'fixed', 'GET /api/platform-settings returns feeType = fixed');
    assert(resGet1.data?.platformCharge?.currency === 'INR', 'GET /api/platform-settings returns currency = INR');

    const resFee1 = await request('/api/project-reviews/platform-fee?role=admin');
    assert(resFee1.status === 200, 'GET /api/project-reviews/platform-fee returns HTTP 200');
    assert(resFee1.data?.config?.feeValue === 200, 'GET /api/project-reviews/platform-fee returns config.feeValue = 200');

    const resPrice1 = await request('/api/project-reviews/pricing?expertId=usr-1788974684441');
    assert(resPrice1.status === 200, 'GET /api/project-reviews/pricing returns HTTP 200');
    assert(resPrice1.data?.projectRate === 1000, 'Expert Project Rate is ₹1,000');
    assert(resPrice1.data?.platformFee === 200, 'Platform Charge is ₹200');
    assert(resPrice1.data?.clientPrice === 1200, 'Client Price is ₹1,200 (1000 + 200)');
  }

  // -------------------------------------------------------------------------
  // TEST 2: Admin changes ₹200 -> ₹300, Save
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: Admin changes ₹200 -> ₹300 ---');
  {
    const resUpdate1 = await request('/api/platform-settings', {
      method: 'PUT',
      body: {
        feeType: 'fixed',
        feeValue: 300,
        role: 'admin',
        userId: 'admin-governance'
      }
    });
    assert(resUpdate1.status === 200, 'PUT /api/platform-settings returns HTTP 200');
    assert(resUpdate1.data?.success === true, 'PUT /api/platform-settings success is true');
    assert(resUpdate1.data?.message === '✓ Platform charge updated successfully', 'Success message matches expected: ✓ Platform charge updated successfully');
    assert(resUpdate1.data?.platformCharge?.feeValue === 300, 'Saved config returned has feeValue = 300');

    // Verify Database on disk
    const dbDisk1 = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    assert(dbDisk1.platformCharge?.feeValue === 300, 'Database db.json has platformCharge.feeValue = 300');
    assert(dbDisk1.projectReviewConfig?.feeValue === 300, 'Database db.json has projectReviewConfig.feeValue = 300');

    // Verify Admin query
    const resAdminQuery = await request('/api/project-reviews/platform-fee?role=admin');
    assert(resAdminQuery.data?.config?.feeValue === 300, 'Admin query returns feeValue = 300');

    // Verify Client Project Review query and calculation
    const resClientQuery = await request('/api/project-reviews/pricing?expertId=usr-1788974684441');
    assert(resClientQuery.data?.projectRate === 1000, 'Client query has Project Price = ₹1,000');
    assert(resClientQuery.data?.platformFee === 300, 'Client query has Platform Charge = ₹300');
    assert(resClientQuery.data?.clientPrice === 1300, 'Client query calculation Total = ₹1,300');
  }

  // -------------------------------------------------------------------------
  // TEST 3: Reload the browser (simulated fresh queries)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 3: Reload / fresh queries ---');
  {
    const resFreshSettings = await request('/api/platform-settings');
    assert(resFreshSettings.data?.platformCharge?.feeValue === 300, 'Fresh GET /api/platform-settings returns 300');

    const resFreshPrice = await request('/api/project-reviews/pricing?expertId=usr-1788974684441');
    assert(resFreshPrice.data?.platformFee === 300, 'Fresh GET /api/project-reviews/pricing returns platformFee = 300');
    assert(resFreshPrice.data?.clientPrice === 1300, 'Fresh GET /api/project-reviews/pricing returns Total = 1300');
  }

  // -------------------------------------------------------------------------
  // TEST 4: Close and reopen application (disk reload check)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 4: Persisted state survival across simulated restart ---');
  {
    const dbRestart = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    assert(dbRestart.platformCharge?.feeValue === 300, 'Disk read confirms platformCharge.feeValue is still 300');
    assert(dbRestart.projectReviewConfig?.feeValue === 300, 'Disk read confirms projectReviewConfig.feeValue is still 300');
    assert(typeof dbRestart.platformCharge?.updatedAt === 'string', 'platformCharge.updatedAt is stored as ISO string');
  }

  // -------------------------------------------------------------------------
  // TEST 5: Change again ₹300 -> ₹500 via POST /api/project-reviews/platform-fee
  // -------------------------------------------------------------------------
  console.log('\n--- Test 5: Change again ₹300 -> ₹500 ---');
  {
    const resUpdate2 = await request('/api/project-reviews/platform-fee', {
      method: 'POST',
      body: {
        feeType: 'fixed',
        feeValue: 500,
        role: 'admin',
        userId: 'admin-governance'
      }
    });
    assert(resUpdate2.status === 200, 'POST /api/project-reviews/platform-fee returns HTTP 200');
    assert(resUpdate2.data?.message === '✓ Platform charge updated successfully', 'Success message matches');
    assert(resUpdate2.data?.platformCharge?.feeValue === 500, 'Response feeValue is 500');

    // Verify DB
    const dbDisk2 = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    assert(dbDisk2.platformCharge?.feeValue === 500, 'Database db.json has platformCharge.feeValue = 500');

    // Verify Client calculation
    const resClient500 = await request('/api/project-reviews/pricing?expertId=usr-1788974684441');
    assert(resClient500.data?.projectRate === 1000, 'Client query has Project Price = ₹1,000');
    assert(resClient500.data?.platformFee === 500, 'Client query has Platform Charge = ₹500');
    assert(resClient500.data?.clientPrice === 1500, 'Client query Total = ₹1,500 (1000 + 500)');
  }

  // -------------------------------------------------------------------------
  // TEST 6: Validation of invalid values
  // -------------------------------------------------------------------------
  console.log('\n--- Test 6: Input Validation ---');
  {
    // Negative fee value
    const resNeg = await request('/api/platform-settings', {
      method: 'PUT',
      body: { feeType: 'fixed', feeValue: -50, role: 'admin' }
    });
    assert(resNeg.status === 400, 'Negative fee value rejected with HTTP 400');

    // Non-numeric string fee value
    const resStr = await request('/api/platform-settings', {
      method: 'PUT',
      body: { feeType: 'fixed', feeValue: 'invalid', role: 'admin' }
    });
    assert(resStr.status === 400, 'String fee value rejected with HTTP 400');

    // Missing feeType
    const resNoType = await request('/api/platform-settings', {
      method: 'PUT',
      body: { feeValue: 200, role: 'admin' }
    });
    assert(resNoType.status === 400, 'Missing feeType rejected with HTTP 400');

    // Percentage fee > 100%
    const resOverPct = await request('/api/platform-settings', {
      method: 'PUT',
      body: { feeType: 'percentage', feeValue: 120, role: 'admin' }
    });
    assert(resOverPct.status === 400, 'Percentage fee > 100% rejected with HTTP 400');

    // Non-admin role unauthorized
    const resClientRole = await request('/api/platform-settings', {
      method: 'PUT',
      body: { feeType: 'fixed', feeValue: 100, role: 'client' }
    });
    assert(resClientRole.status === 403, 'Client role mutation rejected with HTTP 403');
  }

  // -------------------------------------------------------------------------
  // TEST 7: Historical Transactions & Snapshot Immutability
  // -------------------------------------------------------------------------
  console.log('\n--- Test 7: Historical Transaction Immutability ---');
  {
    // Reset fee to 250 for booking test
    await request('/api/platform-settings', {
      method: 'PUT',
      body: { feeType: 'fixed', feeValue: 250, role: 'admin', userId: 'admin' }
    });

    const uniqueEmail = `testclient-${Date.now()}@example.com`;
    const bookingPayload = {
      clientId: `cli-${Date.now()}`,
      clientName: 'Test Client',
      clientEmail: uniqueEmail,
      expertId: 'usr-1788974684441',
      expertName: 'JK',
      expertEmail: 'jk@domain.com',
      expectedScope: 'Snapshot Verification Audit',
      reviewType: 'Technical & Architecture Review',
      requestNotes: 'Testing immutability of snapshot',
      clientWalletBalance: 10000,
      price: 50 // Malicious client attempt to pay 50 instead of 1250
    };

    const resBook = await request('/api/project-reviews/request', {
      method: 'POST',
      body: bookingPayload
    });

    assert(resBook.status === 200, 'Booking request created with HTTP 200');
    assert(resBook.data?.success === true, 'Booking request successful');
    const reviewId = resBook.data?.projectReview?.projectReviewId;
    assert(!!reviewId, `Booking created with reviewId: ${reviewId}`);

    // Authoritative calculation check: 1000 expert + 250 fee = 1250 total
    assert(resBook.data?.projectReview?.price === 1250, 'Authoritative price is 1250 (ignoring client 50)');
    assert(resBook.data?.projectReview?.paidAmount === 1250, 'Authoritative paidAmount is 1250');
    assert(resBook.data?.projectReview?.expertCharge === 1000, 'expertCharge snapshotted at 1000');
    assert(resBook.data?.projectReview?.platformFee === 250, 'platformFee snapshotted at 250');
    assert(resBook.data?.projectReview?.platformCharge === 250, 'platformCharge synonym snapshotted at 250');

    // Now Admin changes global platform fee: 250 -> 400
    console.log('  Admin updating global fee from 250 -> 400...');
    await request('/api/platform-settings', {
      method: 'PUT',
      body: { feeType: 'fixed', feeValue: 400, role: 'admin', userId: 'admin' }
    });

    // Check newly booked review snapshot
    const resReviewQuery = await request(`/api/project-reviews?id=${reviewId}`);
    assert(resReviewQuery.status === 200, 'Query review by ID returns HTTP 200');
    const existingReview = resReviewQuery.data?.projectReview;
    assert(existingReview?.price === 1250, 'Existing review price preserved at 1250 (not updated to 1400)');
    assert(existingReview?.paidAmount === 1250, 'Existing review paidAmount preserved at 1250');
    assert(existingReview?.platformFee === 250, 'Existing review platformFee preserved at 250');
    assert(existingReview?.platformCharge === 250, 'Existing review platformCharge preserved at 250');
    assert(existingReview?.expertCharge === 1000, 'Existing review expertCharge preserved at 1000');

    // But a NEW booking would use 400
    const resNewPrice = await request('/api/project-reviews/pricing?expertId=usr-1788974684441');
    assert(resNewPrice.data?.platformFee === 400, 'New booking uses new active fee 400');
    assert(resNewPrice.data?.clientPrice === 1400, 'New booking has total price 1400');
  }

  // -------------------------------------------------------------------------
  // TEST 8: Audit Logging in Database
  // -------------------------------------------------------------------------
  console.log('\n--- Test 8: Audit History Verification ---');
  {
    const dbAudit = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    assert(Array.isArray(dbAudit.pricingAuditLogs), 'pricingAuditLogs is an array in db.json');
    const latestLog = dbAudit.pricingAuditLogs.find(l => l.changeType === 'platform_charge');
    assert(!!latestLog, 'pricingAuditLogs contains platform_charge entry');
    assert(latestLog?.oldValue !== undefined, 'Audit log records oldValue');
    assert(latestLog?.newValue !== undefined, 'Audit log records newValue');
    assert(latestLog?.changedBy !== undefined, 'Audit log records changedBy');
    assert(latestLog?.changedAt !== undefined, 'Audit log records changedAt');
  }

  // -------------------------------------------------------------------------
  // TEST 9: Service Isolation - 1-Hour Call rates remain untouched
  // -------------------------------------------------------------------------
  console.log('\n--- Test 9: 1-Hour Call Rates Isolation ---');
  {
    const dbIso = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const exp1After = (dbIso.experts || []).find(e => e.id === 'exp-1');
    const exp2After = (dbIso.experts || []).find(e => e.id === 'exp-2');
    const exp1Before = (dbBefore.experts || []).find(e => e.id === 'exp-1');
    const exp2Before = (dbBefore.experts || []).find(e => e.id === 'exp-2');
    assert(exp1After?.rate === exp1Before?.rate, `exp-1 (Sunita Rao) 1-Hour Call rate untouched at ${exp1Before?.rate}`);
    assert(exp2After?.rate === exp2Before?.rate, `exp-2 (Krishnan Iyer) 1-Hour Call rate untouched at ${exp2Before?.rate}`);
    assert(exp1After?.baseRate === exp1Before?.baseRate, `exp-1 baseRate untouched at ${exp1Before?.baseRate}`);
    assert(exp2After?.baseRate === exp2Before?.baseRate, `exp-2 baseRate untouched at ${exp2Before?.baseRate}`);
  }

  console.log('\n===============================================================');
  console.log(`Test Results: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('===============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
