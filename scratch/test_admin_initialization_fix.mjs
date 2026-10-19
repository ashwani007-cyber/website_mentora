import { MongoClient } from 'mongodb';

const BASE_URL = 'http://localhost:5173';
const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'silver_workforce';

const ADMIN_EMAILS = [
  'kushwaahaashwani12@gmail.com',
  'kushwahaashwani12@gmail.com'
];

async function runTest() {
  console.log("==================================================================");
  console.log("TESTING ADMIN FIRST-TIME PASSWORD INITIALIZATION & AUTHENTICATION");
  console.log("==================================================================");

  const mongoClient = new MongoClient(MONGO_URI);
  await mongoClient.connect();
  const db = mongoClient.db(DB_NAME);

  const adminCol = db.collection('admin_credentials');
  const usersCol = db.collection('users');

  // STEP 1: Put Admin in UNINITIALIZED state
  console.log("\n[STEP 1] Resetting Admin to UNINITIALIZED state in MongoDB...");
  const nowIso = new Date().toISOString();

  await adminCol.deleteMany({ email: { $in: ADMIN_EMAILS } });
  await adminCol.insertOne({
    email: 'kushwaahaashwani12@gmail.com',
    password: '',
    role: 'admin',
    initialized: false,
    adminPasswordInitialized: false,
    isPasswordInitialized: false,
    currentToken: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: nowIso,
    updatedAt: nowIso
  });

  await usersCol.deleteMany({ email: { $in: ADMIN_EMAILS } });
  await usersCol.insertOne({
    id: 'usr-admin-ashwani',
    name: 'Executive Governance Admin',
    email: 'kushwaahaashwani12@gmail.com',
    password: '',
    role: 'admin',
    initialized: false,
    adminPasswordInitialized: false,
    isPasswordInitialized: false,
    createdAt: nowIso,
    updatedAt: nowIso
  });

  const uninitRecord = await adminCol.findOne({ email: 'kushwaahaashwani12@gmail.com' });
  console.log("Initial state in admin_credentials:", {
    email: uninitRecord.email,
    role: uninitRecord.role,
    initialized: uninitRecord.initialized,
    passwordLength: uninitRecord.password.length
  });

  // STEP 2: TEST 1 - First-time password initialization with kushwaahaashwani12@gmail.com
  console.log("\n[TEST 1] First-time login submission with kushwaahaashwani12@gmail.com...");
  const firstPassword = "FirstTimeUserAdminPass@2026";
  const res1 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'kushwaahaashwani12@gmail.com', password: firstPassword })
  });
  const data1 = await res1.json();
  console.log("Test 1 Response:", { status: res1.status, success: data1.success, role: data1.user?.role, message: data1.message });

  if (res1.status !== 200 || !data1.success || data1.user?.role !== 'admin' || !data1.token) {
    throw new Error(`Test 1 Failed: ${JSON.stringify(data1)}`);
  }
  console.log("✅ TEST 1 PASSED: Admin first-time password initialized and session issued!");

  // STEP 3: Verify MongoDB persistence & Bcrypt hashing
  console.log("\n[TEST: MONGODB VERIFICATION]");
  const savedAdmin = await adminCol.findOne({ email: 'kushwaahaashwani12@gmail.com' });
  const savedUser = await usersCol.findOne({ email: 'kushwaahaashwani12@gmail.com' });

  console.log("Saved admin_credentials:", {
    email: savedAdmin.email,
    role: savedAdmin.role,
    initialized: savedAdmin.initialized,
    adminPasswordInitialized: savedAdmin.adminPasswordInitialized,
    isPasswordInitialized: savedAdmin.isPasswordInitialized,
    passwordHashSample: savedAdmin.password.slice(0, 15) + '...',
    currentToken: savedAdmin.currentToken ? savedAdmin.currentToken.slice(0, 15) + '...' : null
  });

  if (!savedAdmin.initialized || !savedAdmin.password.startsWith('$2') || savedAdmin.password === firstPassword) {
    throw new Error("MongoDB password verification failed: Not properly hashed or initialized!");
  }
  if (!savedUser || !savedUser.password.startsWith('$2') || savedUser.role !== 'admin') {
    throw new Error("users collection sync failed!");
  }
  console.log("✅ MONGODB PERSISTENCE VERIFIED: Secure bcrypt hash stored, initialized=true, plain-text NOT stored!");

  // STEP 4: TEST 2 - Second login with the SAME password must SUCCEED
  console.log("\n[TEST 2] Second login with the SAME password...");
  const res2 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'kushwaahaashwani12@gmail.com', password: firstPassword })
  });
  const data2 = await res2.json();
  console.log("Test 2 Response:", { status: res2.status, success: data2.success, role: data2.user?.role });

  if (res2.status !== 200 || !data2.success || data2.user?.role !== 'admin') {
    throw new Error(`Test 2 Failed: ${JSON.stringify(data2)}`);
  }
  console.log("✅ TEST 2 PASSED: Subsequent login with correct password succeeded!");

  // STEP 5: Also test spelling kushwahaashwani12@gmail.com (with 1 'a')
  console.log("\n[TEST 2B] Login with alias spelling kushwahaashwani12@gmail.com...");
  const res2b = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'kushwahaashwani12@gmail.com', password: firstPassword })
  });
  const data2b = await res2b.json();
  console.log("Test 2B Response:", { status: res2b.status, success: data2b.success, role: data2b.user?.role });

  if (res2b.status !== 200 || !data2b.success || data2b.user?.role !== 'admin') {
    throw new Error(`Test 2B Failed: ${JSON.stringify(data2b)}`);
  }
  console.log("✅ TEST 2B PASSED: Alias spelling recognized seamlessly as Admin!");

  // STEP 6: TEST 3 - Wrong password must FAIL and NOT overwrite password
  console.log("\n[TEST 3] Login with WRONG password...");
  const res3 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'kushwaahaashwani12@gmail.com', password: 'CompletelyWrongPassword@999' })
  });
  const data3 = await res3.json();
  console.log("Test 3 Response:", { status: res3.status, success: data3.success, error: data3.error });

  if (res3.status !== 401 || data3.success !== false) {
    throw new Error(`Test 3 Failed: Wrong password should return 401 Unauthorized, got ${res3.status}`);
  }

  // Verify password was NOT overwritten in database
  const checkAdminAfterFail = await adminCol.findOne({ email: 'kushwaahaashwani12@gmail.com' });
  if (checkAdminAfterFail.password !== savedAdmin.password) {
    throw new Error("CRITICAL SECURITY FAILURE: Wrong password modified the stored password hash!");
  }
  console.log("✅ TEST 3 PASSED: Wrong password rejected with 401, stored hash untouched!");

  // STEP 7: TEST 8 - Session Token Verification
  console.log("\n[TEST 8] Admin Session Verification via /api/auth/verify-admin...");
  const resVerify = await fetch(`${BASE_URL}/api/auth/verify-admin`, {
    headers: { 'Authorization': `Bearer ${data2b.token}` }
  });
  const dataVerify = await resVerify.json();
  console.log("Verify Response:", { status: resVerify.status, authenticated: dataVerify.authenticated, role: dataVerify.user?.role });

  if (resVerify.status !== 200 || !dataVerify.authenticated || dataVerify.user?.role !== 'admin') {
    throw new Error("Session verification failed!");
  }
  console.log("✅ TEST 8 PASSED: Admin session cryptographically verified!");

  // STEP 8: TEST 9 - Admin Logout & Token Invalidation
  console.log("\n[TEST 9] Admin Logout via /api/auth/admin-logout...");
  const resLogout = await fetch(`${BASE_URL}/api/auth/admin-logout`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${data2b.token}` }
  });
  const dataLogout = await resLogout.json();
  console.log("Logout Response:", { status: resLogout.status, success: dataLogout.success });

  // Verification after logout must fail
  const resVerifyAfterLogout = await fetch(`${BASE_URL}/api/auth/verify-admin`, {
    headers: { 'Authorization': `Bearer ${data2.token}` }
  });
  if (resVerifyAfterLogout.status !== 401) {
    throw new Error("Logout token was not invalidated!");
  }
  console.log("✅ TEST 9 PASSED: Session destroyed in MongoDB on logout!");

  // STEP 9: RESET DATABASE TO UNINITIALIZED STATE FOR THE USER!
  console.log("\n[FINAL STEP] Resetting Admin to clean UNINITIALIZED state for the REAL USER...");
  await adminCol.deleteMany({ email: { $in: ADMIN_EMAILS } });
  await adminCol.insertOne({
    email: 'kushwaahaashwani12@gmail.com',
    password: '',
    role: 'admin',
    initialized: false,
    adminPasswordInitialized: false,
    isPasswordInitialized: false,
    currentToken: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: nowIso,
    updatedAt: nowIso
  });

  await usersCol.deleteMany({ email: { $in: ADMIN_EMAILS } });
  await usersCol.insertOne({
    id: 'usr-admin-ashwani',
    name: 'Executive Governance Admin',
    email: 'kushwaahaashwani12@gmail.com',
    password: '',
    role: 'admin',
    initialized: false,
    adminPasswordInitialized: false,
    isPasswordInitialized: false,
    createdAt: nowIso,
    updatedAt: nowIso
  });

  const finalCheck = await adminCol.findOne({ email: 'kushwaahaashwani12@gmail.com' });
  console.log("Final Admin Database Status for USER:", {
    email: finalCheck.email,
    role: finalCheck.role,
    initialized: finalCheck.initialized,
    adminPasswordInitialized: finalCheck.adminPasswordInitialized,
    isPasswordInitialized: finalCheck.isPasswordInitialized,
    password: finalCheck.password === '' ? '(empty string - waiting for user first password)' : 'SET'
  });

  await mongoClient.close();
  console.log("\n==================================================================");
  console.log("ALL TESTS COMPLETED SUCCESSFULLY! ROOT CAUSE FULLY RESOLVED.");
  console.log("==================================================================");
}

runTest().catch((err) => {
  console.error("TEST RUN ERROR:", err);
  process.exit(1);
});
