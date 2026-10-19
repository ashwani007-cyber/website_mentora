import http from 'http';

const BASE_API = 'http://localhost:3000';
const BASE_VITE = 'http://localhost:5173';

const ADMIN_CREDS = {
  email: 'kushwahaashwani12@gmail.com',
  password: 'H@a#n&u*m$a%n/J!i12/07/2006'
};

async function fetchUrl(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.text();
  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body
  };
}

async function runIteration(iterationNumber) {
  const t0 = Date.now();
  const checks = [];

  // 1. Admin Login
  const adminLoginRes = await fetchUrl(`${BASE_API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ADMIN_CREDS)
  });
  if (adminLoginRes.status !== 200) {
    console.error("Admin Login Error Body:", adminLoginRes.body);
    throw new Error(`Admin login failed: HTTP ${adminLoginRes.status} - ${adminLoginRes.body}`);
  }
  const adminJson = JSON.parse(adminLoginRes.body);
  if (!adminJson.success || adminJson.user?.role !== 'admin') {
    throw new Error(`Admin login payload invalid: ${adminLoginRes.body}`);
  }
  checks.push('API: Admin Login (200 OK)');

  // 2. Client Registration & Login
  const tempEmail = `test_client_i${iterationNumber}_${Date.now()}@mentora-test.io`;
  const registerRes = await fetchUrl(`${BASE_API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: tempEmail,
      password: 'TestPassword123!',
      fullName: `Test Client ${iterationNumber}`,
      role: 'client',
      company: 'Test Enterprise Inc'
    })
  });
  if (registerRes.status !== 200) throw new Error(`Client register failed: HTTP ${registerRes.status}`);
  const regJson = JSON.parse(registerRes.body);
  if (!regJson.success) throw new Error(`Client register error: ${registerRes.body}`);
  checks.push('API: Client Register (200 OK)');

  const clientLoginRes = await fetchUrl(`${BASE_API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: tempEmail,
      password: 'TestPassword123!'
    })
  });
  if (clientLoginRes.status !== 200) throw new Error(`Client login failed: HTTP ${clientLoginRes.status}`);
  checks.push('API: Client Login (200 OK)');

  // 3. Database & System Endpoints
  const dbRes = await fetchUrl(`${BASE_API}/api/db`);
  if (dbRes.status !== 200) throw new Error(`DB endpoint failed: HTTP ${dbRes.status}`);
  const dbJson = JSON.parse(dbRes.body);
  if (!Array.isArray(dbJson.experts)) throw new Error('DB experts missing');
  checks.push(`API: GET /api/db (200 OK, ${dbJson.experts.length} experts)`);

  const availRes = await fetchUrl(`${BASE_API}/api/availability`);
  if (availRes.status !== 200) throw new Error(`Availability endpoint failed: HTTP ${availRes.status}`);
  checks.push('API: GET /api/availability (200 OK)');

  const prRes = await fetchUrl(`${BASE_API}/api/project-reviews`);
  if (prRes.status !== 200) throw new Error(`Project Reviews failed: HTTP ${prRes.status}`);
  const prJson = JSON.parse(prRes.body);
  if (!prJson.success) throw new Error('Project reviews call failed');
  checks.push('API: GET /api/project-reviews (200 OK)');

  const settingsRes = await fetchUrl(`${BASE_API}/api/platform-settings`);
  if (settingsRes.status !== 200) throw new Error(`Platform settings failed: HTTP ${settingsRes.status}`);
  checks.push('API: GET /api/platform-settings (200 OK)');

  // 4. Frontend Routes (Served by Vite)
  const routes = [
    { path: '/', name: 'Landing' },
    { path: '/client', name: 'Client Portal' },
    { path: '/expert', name: 'Expert Portal' },
    { path: '/about', name: 'About' },
    { path: '/blogs', name: 'Blogs' },
    { path: '/login', name: 'Login' },
    { path: '/?portal=admin', name: 'Admin Portal' }
  ];

  for (const r of routes) {
    const pageRes = await fetchUrl(`${BASE_VITE}${r.path}`);
    if (pageRes.status !== 200) throw new Error(`Route ${r.path} failed: HTTP ${pageRes.status}`);
    if (!pageRes.body.includes('<div id="root"></div>') || !pageRes.body.includes('Mentora')) {
      throw new Error(`Route ${r.path} missing root or Mentora title`);
    }
    checks.push(`Page: ${r.name} (${r.path}) (200 OK)`);
  }

  const durationMs = Date.now() - t0;
  return { iteration: iterationNumber, checksCount: checks.length, durationMs };
}

async function run50Tests() {
  console.log("===============================================================");
  console.log("🚀 STARTING 50 ITERATION COMPREHENSIVE STRESS TEST");
  console.log("Testing Frontend, Backend, Database, Auth & All Routes");
  console.log("===============================================================\n");

  const totalRuns = 50;
  let passedCount = 0;
  const startTime = Date.now();

  for (let i = 1; i <= totalRuns; i++) {
    try {
      const result = await runIteration(i);
      passedCount++;
      if (i % 5 === 0 || i === 1 || i === totalRuns) {
        console.log(`[PASS] Iteration ${String(i).padStart(2, ' ')}/${totalRuns} completed in ${result.durationMs}ms (${result.checksCount} checks passed)`);
      }
    } catch (err) {
      console.error(`[FAIL] Iteration ${i} failed:`, err.message);
      process.exit(1);
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n===============================================================");
  console.log(`🎉 ALL 50/50 TEST ITERATIONS PASSED PERFECTLY in ${totalDuration}s!`);
  console.log(`Total checks executed: ${passedCount * 14} assertions`);
  console.log("Backend status: 100% HEALTHY");
  console.log("Frontend routes: 100% HEALTHY");
  console.log("Auth & Registration: 100% HEALTHY");
  console.log("===============================================================");
}

run50Tests().catch(err => {
  console.error("Fatal Test Suite Error:", err);
  process.exit(1);
});
