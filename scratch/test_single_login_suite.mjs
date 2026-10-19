import { MongoClient } from 'mongodb';

const BASE_URL = 'http://localhost:5173';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const ADMIN_EMAIL = 'kushwahaashwani12@gmail.com';
const ADMIN_PASSWORD = 'AshwaniAdmin@2026';
const WRONG_PASSWORD = 'WrongPassword999!';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function run() {
  console.log('================================================================');
  console.log('RUNNING FULL SINGLE LOGIN INTEGRATION SUITE');
  console.log('================================================================\n');

  const mongo = new MongoClient(MONGO_URI);
  await mongo.connect();
  const db = mongo.db('silver_workforce');

  // STEP 0: Reset Admin to uninitialized state for First-Time Setup test
  console.log('[STEP 0] Resetting Admin to uninitialized state for clean first-password test...');
  await db.collection('admin_credentials').updateOne(
    { email: ADMIN_EMAIL },
    { $set: { initialized: false, password: null, currentToken: null, updatedAt: new Date().toISOString() } },
    { upsert: true }
  );
  await db.collection('users').updateOne(
    { email: ADMIN_EMAIL },
    { $set: { password: null, isPasswordInitialized: false, updatedAt: new Date().toISOString() } },
    { upsert: true }
  );

  // STEP 1: First-Time Password Setup via /api/auth/login
  console.log('\n[TEST: FIRST PASSWORD SETUP] Establishing admin password for the first time...');
  const firstRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  const firstData = await firstRes.json();
  assert(firstRes.status === 200, `First-time setup returns HTTP 200 (Got ${firstRes.status})`);
  assert(firstData.success === true, `First-time setup returns success: true`);
  assert(firstData.user?.role === 'admin', `First-time setup returns role: "admin" (Got "${firstData.user?.role}")`);
  assert(typeof firstData.token === 'string' && firstData.token.startsWith('adm_'), `First-time setup generates adm_ token`);

  // STEP 2: Verify First Password Persistence in MongoDB
  console.log('\n[TEST: FIRST PASSWORD PERSISTENCE IN MONGODB]');
  const adminRec1 = await db.collection('admin_credentials').findOne({ email: ADMIN_EMAIL });
  assert(adminRec1 !== null, `Admin record exists in admin_credentials collection`);
  assert(adminRec1.initialized === true, `Admin record is initialized: true`);
  assert(adminRec1.role === 'admin', `Admin record has role: "admin"`);
  assert(adminRec1.password && adminRec1.password.startsWith('$2'), `Admin password is valid bcrypt hash`);
  assert(adminRec1.password !== ADMIN_PASSWORD, `Plain-text password is NOT stored in MongoDB`);

  const userRec1 = await db.collection('users').findOne({ email: ADMIN_EMAIL });
  assert(userRec1 !== null, `Admin record exists in users collection`);
  assert(userRec1.role === 'admin', `users collection record has role: "admin"`);
  assert(userRec1.password && userRec1.password.startsWith('$2'), `users collection password is valid bcrypt hash`);

  // STEP 3: Test 1 — Admin Login (Subsequent login with correct configured password)
  console.log('\n[TEST 1: ADMIN LOGIN WITH CONFIGURED PASSWORD]');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  const loginData = await loginRes.json();
  assert(loginRes.status === 200, `Admin login returns HTTP 200`);
  assert(loginData.success === true, `Admin login returns success: true`);
  assert(loginData.user?.role === 'admin', `Admin login returns user.role: "admin"`);
  assert(loginData.user?.email === ADMIN_EMAIL, `Admin login returns correct email`);
  assert(typeof loginData.token === 'string' && loginData.token.startsWith('adm_'), `Admin login returns active session token`);
  const activeAdminToken = loginData.token;

  // STEP 4: Test 2 — Wrong Admin Password
  console.log('\n[TEST 2: WRONG ADMIN PASSWORD]');
  const wrongRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: WRONG_PASSWORD })
  });
  const wrongData = await wrongRes.json();
  assert(wrongRes.status === 401, `Wrong password returns HTTP 401 Unauthorized (Got ${wrongRes.status})`);
  assert(wrongData.success === false, `Wrong password returns success: false`);
  assert(!wrongData.token, `Wrong password does not issue a session token`);
  assert(wrongData.error.includes('Incorrect password'), `Wrong password returns clear error message`);

  // STEP 5: Test 3 — Client Login
  console.log('\n[TEST 3: CLIENT LOGIN]');
  const clientRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'client.aarav@nextech.io', password: 'password123' })
  });
  const clientData = await clientRes.json();
  assert(clientRes.status === 200, `Client login returns HTTP 200`);
  assert(clientData.success === true, `Client login returns success: true`);
  assert(clientData.user?.role === 'client', `Client login returns user.role: "client" (Got "${clientData.user?.role}")`);

  // STEP 6: Test 4 — Expert Login
  console.log('\n[TEST 4: EXPERT LOGIN]');
  const expertRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ramesh.sharma@silverworkforce.com', password: 'password123' })
  });
  const expertData = await expertRes.json();
  assert(expertRes.status === 200, `Expert login returns HTTP 200`);
  assert(expertData.success === true, `Expert login returns success: true`);
  assert(expertData.user?.role === 'expert', `Expert login returns user.role: "expert" (Got "${expertData.user?.role}")`);

  // STEP 7: Role Conflict Protection
  console.log('\n[TEST: ROLE & ACCOUNT CONFLICT PROTECTION]');
  const duplicateRegisterRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: 'newpass', role: 'client' })
  });
  const duplicateRegisterData = await duplicateRegisterRes.json();
  assert(duplicateRegisterRes.status === 409, `Registering duplicate account with admin email returns HTTP 409 Conflict (Got ${duplicateRegisterRes.status})`);
  assert(duplicateRegisterData.success === false, `Duplicate registration rejected with success: false`);

  // Check normal user cannot escalate to role=admin
  const testEscalateEmail = `fakeadmin_${Date.now()}@example.com`;
  const escalateRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEscalateEmail, password: 'password123', role: 'admin' })
  });
  const escalateData = await escalateRes.json();
  assert(escalateRes.status === 200 || escalateRes.status === 201, `Normal registration completed`);
  assert(escalateData.user?.role === 'client', `Role escalation to admin was blocked; role clamped to "client"`);
  // Cleanup test user
  await db.collection('users').deleteOne({ email: testEscalateEmail });

  // STEP 8: Test 8 — Session Verification (/api/auth/verify-admin)
  console.log('\n[TEST 8: ADMIN SESSION VERIFICATION]');
  const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-admin`, {
    headers: { 'Authorization': `Bearer ${activeAdminToken}` }
  });
  const verifyData = await verifyRes.json();
  assert(verifyRes.status === 200, `Valid admin token verification returns HTTP 200`);
  assert(verifyData.authenticated === true, `Valid admin token returns authenticated: true`);
  assert(verifyData.user?.role === 'admin', `Verified session role is "admin"`);

  // Test invalid token
  const badVerifyRes = await fetch(`${BASE_URL}/api/auth/verify-admin`, {
    headers: { 'Authorization': `Bearer adm_fake_invalid_token_123` }
  });
  assert(badVerifyRes.status === 401, `Fake admin token returns HTTP 401 Unauthorized`);

  // Test missing token
  const missingVerifyRes = await fetch(`${BASE_URL}/api/auth/verify-admin`);
  assert(missingVerifyRes.status === 401, `Missing admin token returns HTTP 401 Unauthorized`);

  // STEP 9: Test 9 — Admin Logout
  console.log('\n[TEST 9: ADMIN LOGOUT]');
  const logoutRes = await fetch(`${BASE_URL}/api/auth/admin-logout`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${activeAdminToken}` }
  });
  const logoutData = await logoutRes.json();
  assert(logoutRes.status === 200, `Admin logout returns HTTP 200`);
  assert(logoutData.success === true, `Admin logout returns success: true`);

  // Verify that the logged-out token is now invalid in MongoDB
  const postLogoutVerify = await fetch(`${BASE_URL}/api/auth/verify-admin`, {
    headers: { 'Authorization': `Bearer ${activeAdminToken}` }
  });
  assert(postLogoutVerify.status === 401, `Logged-out admin token is immediately rejected with HTTP 401 Unauthorized`);

  // STEP 10: Test 10 — MongoDB Verification
  console.log('\n[TEST 10: MONGODB VERIFICATION]');
  const finalAdmin = await db.collection('admin_credentials').findOne({ email: ADMIN_EMAIL });
  assert(finalAdmin !== null, `Admin account exists in MongoDB`);
  assert(finalAdmin.email === ADMIN_EMAIL, `Admin email is strictly kushwahaashwani12@gmail.com`);
  assert(finalAdmin.role === 'admin', `Admin role is strictly "admin"`);
  assert(finalAdmin.password && finalAdmin.password.startsWith('$2'), `Password remains securely hashed with bcrypt in MongoDB`);
  assert(finalAdmin.password !== ADMIN_PASSWORD, `No plain-text Admin password exists in MongoDB`);
  assert(finalAdmin.currentToken === null || finalAdmin.currentToken === undefined, `Current session token properly destroyed upon logout`);

  const clientCount = await db.collection('users').countDocuments({ role: 'client' });
  const expertCount = await db.collection('users').countDocuments({ role: 'expert' });
  assert(clientCount > 0, `Client records intact in MongoDB (count=${clientCount})`);
  assert(expertCount > 0, `Expert records intact in MongoDB (count=${expertCount})`);

  await mongo.close();

  console.log('\n================================================================');
  console.log(`SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error running suite:', err);
  process.exit(1);
});
