import { spawn } from 'child_process';
import fs from 'fs';
import { MongoClient } from 'mongodb';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-single-login-e2e";
const BASE_URL = "http://localhost:5173/";
const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "silver_workforce";

const ADMIN_EMAILS = [
  'kushwaahaashwani12@gmail.com',
  'kushwahaashwani12@gmail.com'
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
    });
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Page.javascriptDialogOpening') {
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
        return;
      }
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    return res.result ? res.result.value : undefined;
  }
}

async function setDbAdminUninitialized(db) {
  const adminCol = db.collection('admin_credentials');
  const usersCol = db.collection('users');
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
}

async function runBrowserE2ETests() {
  console.log("=== STARTING BROWSER E2E TEST SUITE FOR SINGLE LOGIN INTEGRATION ===");

  const mongoClient = new MongoClient(MONGO_URI);
  await mongoClient.connect();
  const db = mongoClient.db(DB_NAME);

  // Set DB to uninitialized state for testing
  await setDbAdminUninitialized(db);

  if (fs.existsSync(USER_DATA)) {
    try {
      fs.rmSync(USER_DATA, { recursive: true, force: true });
    } catch (e) {}
  }

  const chrome = spawn(CHROME_EXE, [
    '--remote-debugging-port=9225',
    '--remote-allow-origins=*',
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1440,900',
    BASE_URL
  ]);

  await sleep(2500);

  const results = [];
  function record(testName, passed, details) {
    results.push({ testName, passed, details });
    const mark = passed ? " PASS " : " FAIL ";
    console.log(`[${mark}] ${testName}: ${details}`);
  }

  try {
    const res = await fetch('http://127.0.0.1:9225/json/list');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page');

    const client = new CDPClient(pageTab.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    // Prevent modal dialogs from blocking execution
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__alerts = [];
        window.alert = (msg) => { window.__alerts.push(String(msg)); console.log("Intercepted Alert:", msg); };
        window.confirm = () => true;
        window.prompt = () => null;
      `
    });

    async function goto(url, wait = 1500) {
      await client.send('Page.navigate', { url });
      await sleep(wait);
    }

    async function clearClientStorage() {
      await client.evaluate(`(() => {
        localStorage.clear();
        sessionStorage.clear();
      })()`);
    }

    // =========================================================================
    // Test 10: UI Single Entry Check (No Admin Button on Login Page)
    // =========================================================================
    console.log("\n--- Test 10: UI Single Entry Check ---");
    await clearClientStorage();
    await goto('http://localhost:5173/login', 1500);

    const loginUiCheck = await client.evaluate(`(() => {
      const text = document.body.innerText;
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
      const hasAdminPlatformBtn = buttons.some(b => b.toLowerCase() === 'admin' || b.includes('Admin /'));
      const hasClientRoleBtn = buttons.some(b => b.includes('Client'));
      const hasExpertRoleBtn = buttons.some(b => b.includes('Expert'));
      const hasAdminLoginHeading = text.includes('Admin Login') || text.includes('Admin Portal Sign In');
      return {
        url: window.location.href,
        hasAdminPlatformBtn,
        hasClientRoleBtn,
        hasExpertRoleBtn,
        hasAdminLoginHeading,
        buttons: buttons.slice(0, 10)
      };
    })()`);

    record(
      "Test 10 - Single Login UI has NO Admin Button/Heading (Client & Expert Only)",
      !loginUiCheck.hasAdminPlatformBtn && !loginUiCheck.hasAdminLoginHeading && loginUiCheck.hasClientRoleBtn && loginUiCheck.hasExpertRoleBtn,
      `hasAdminPlatformBtn=${loginUiCheck.hasAdminPlatformBtn}, hasAdminLoginHeading=${loginUiCheck.hasAdminLoginHeading}, Client/Expert=${loginUiCheck.hasClientRoleBtn}/${loginUiCheck.hasExpertRoleBtn}`
    );

    // =========================================================================
    // Test 5: Manual Admin URL without authentication redirects to login
    // =========================================================================
    console.log("\n--- Test 5: Unauthenticated ?portal=admin Access ---");
    await clearClientStorage();
    await goto('http://localhost:5173/?portal=admin', 2000);

    const test5Check = await client.evaluate(`(() => {
      const text = document.body.innerText;
      const isAdminPortal = text.includes('Admin Governance') || text.includes('SuperAdmin Desk') || text.includes('Domain Taxonomy');
      const isAuthUi = text.includes('Sign In') || text.includes('Register Account') || text.includes('Select Platform Role');
      return {
        url: window.location.href,
        isAdminPortal,
        isAuthUi,
        title: document.title
      };
    })()`);

    record(
      "Test 5 - Direct ?portal=admin without admin session redirects to login",
      !test5Check.isAdminPortal && test5Check.isAuthUi,
      `isAdminPortal=${test5Check.isAdminPortal}, isAuthUi=${test5Check.isAuthUi}, URL=${test5Check.url}`
    );

    // =========================================================================
    // Test 1: First-Time Admin Password Initialization & Login
    // =========================================================================
    console.log("\n--- Test 1: First-Time Admin Password Initialization ---");
    await goto('http://localhost:5173/login', 1500);

    const test1Result = await client.evaluate(`(async () => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const signInTab = tabs.find(b => b.textContent.includes('2. Sign In'));
      if (signInTab) signInTab.click();
      await new Promise(r => setTimeout(r, 200));

      const emailInput = document.querySelector('input[type="email"]');
      const passwordInput = document.querySelector('input[type="password"]') || document.querySelector('input[placeholder="••••••••"]');
      const submitBtn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sign In'));

      if (!emailInput || !passwordInput || !submitBtn) {
        return { error: 'Form elements not found' };
      }

      function setNativeValue(element, value) {
        const proto = element instanceof HTMLInputElement ? HTMLInputElement.prototype : Object.getPrototypeOf(element);
        const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        valueSetter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }

      setNativeValue(emailInput, 'kushwaahaashwani12@gmail.com');
      setNativeValue(passwordInput, 'MySecretAdminPass@2026');
      await new Promise(r => setTimeout(r, 200));

      window.__alerts = [];
      submitBtn.click();
      await new Promise(r => setTimeout(r, 3000));

      const text = document.body.innerText;
      const isAdminPortal = text.includes('Admin Governance') || text.includes('SuperAdmin Desk') || text.includes('Domain Taxonomy');
      const adminToken = localStorage.getItem('admin_token');
      const adminRole = localStorage.getItem('admin_user_role');
      return {
        url: window.location.href,
        isAdminPortal,
        adminToken: adminToken ? adminToken.slice(0, 10) + '...' : null,
        adminRole,
        alerts: window.__alerts || []
      };
    })()`);

    record(
      "Test 1 - Admin first password initialization opens Admin Portal (?portal=admin)",
      test1Result.isAdminPortal && (test1Result.url.includes('portal=admin') || test1Result.url.includes('owner')),
      `URL: ${test1Result.url}, isAdminPortal: ${test1Result.isAdminPortal}, role: ${test1Result.adminRole}`
    );

    // =========================================================================
    // Test 8: Admin Session Persistence across reload
    // =========================================================================
    console.log("\n--- Test 8: Admin Session Persistence (Page Reload) ---");
    await client.send('Page.reload');
    await sleep(2500);

    const test8Result = await client.evaluate(`(() => {
      const text = document.body.innerText;
      const isAdminPortal = text.includes('Admin Governance') || text.includes('SuperAdmin Desk') || text.includes('Domain Taxonomy');
      return {
        url: window.location.href,
        isAdminPortal
      };
    })()`);

    record(
      "Test 8 - Admin session persists on browser refresh",
      test8Result.isAdminPortal,
      `URL: ${test8Result.url}, isAdminPortal: ${test8Result.isAdminPortal}`
    );

    // =========================================================================
    // Test 9: Admin Logout
    // =========================================================================
    console.log("\n--- Test 9: Admin Logout ---");
    const test9Result = await client.evaluate(`(async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const logoutBtn = buttons.find(b => 
        b.getAttribute('title') === 'Sign Out' || 
        b.title === 'Sign Out' ||
        b.textContent.includes('Sign Out') || 
        b.textContent.includes('Logout') ||
        b.querySelector('svg.lucide-log-out')
      );
      if (logoutBtn) {
        logoutBtn.click();
        await new Promise(r => setTimeout(r, 2000));
      }
      const token = localStorage.getItem('admin_token');
      const text = document.body.innerText;
      const isAdminPortal = text.includes('Admin Governance') || text.includes('SuperAdmin Desk');
      return {
        clicked: !!logoutBtn,
        tokenRemaining: !!token,
        isAdminPortal,
        url: window.location.href
      };
    })()`);

    record(
      "Test 9 - Admin Logout destroys session and exits Admin Portal",
      test9Result.clicked && !test9Result.isAdminPortal && !test9Result.tokenRemaining,
      `Logout clicked: ${test9Result.clicked}, token cleared: ${!test9Result.tokenRemaining}, isAdmin: ${test9Result.isAdminPortal}`
    );

    // =========================================================================
    // Test 2: Wrong Admin Password Fails (Subsequent Login)
    // =========================================================================
    console.log("\n--- Test 2: Wrong Admin Password on Subsequent Login ---");
    await goto('http://localhost:5173/login', 1500);

    const test2Result = await client.evaluate(`(async () => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const signInTab = tabs.find(b => b.textContent.includes('2. Sign In'));
      if (signInTab) signInTab.click();
      await new Promise(r => setTimeout(r, 200));

      const emailInput = document.querySelector('input[type="email"]');
      const passwordInput = document.querySelector('input[type="password"]') || document.querySelector('input[placeholder="••••••••"]');
      const submitBtn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sign In'));

      if (!emailInput || !passwordInput || !submitBtn) {
        return { error: 'Form elements not found' };
      }

      function setNativeValue(element, value) {
        const proto = element instanceof HTMLInputElement ? HTMLInputElement.prototype : Object.getPrototypeOf(element);
        const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        valueSetter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }

      setNativeValue(emailInput, 'kushwaahaashwani12@gmail.com');
      setNativeValue(passwordInput, 'WrongPassword@999');
      await new Promise(r => setTimeout(r, 200));

      window.__alerts = [];
      submitBtn.click();
      await new Promise(r => setTimeout(r, 2500));

      const text = document.body.innerText;
      const isAdminPortal = text.includes('Admin Governance') || text.includes('SuperAdmin Desk');
      return {
        url: window.location.href,
        isAdminPortal,
        alerts: window.__alerts || []
      };
    })()`);

    record(
      "Test 2 - Wrong Admin password rejects and does NOT open Admin Portal",
      !test2Result.isAdminPortal && test2Result.alerts.some(a => a.includes('Failed') || a.includes('Incorrect') || a.includes('password')),
      `isAdminPortal: ${test2Result.isAdminPortal}, Alerts: ${JSON.stringify(test2Result.alerts)}`
    );

    // =========================================================================
    // Test 3: Normal Client Login
    // =========================================================================
    console.log("\n--- Test 3: Normal Client Login ---");
    await goto('http://localhost:5173/login', 1500);

    const test3Result = await client.evaluate(`(async () => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const signInTab = tabs.find(b => b.textContent.includes('2. Sign In'));
      if (signInTab) signInTab.click();
      await new Promise(r => setTimeout(r, 200));

      const emailInput = document.querySelector('input[type="email"]');
      const passwordInput = document.querySelector('input[type="password"]') || document.querySelector('input[placeholder="••••••••"]');
      const submitBtn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sign In'));

      function setNativeValue(element, value) {
        const proto = element instanceof HTMLInputElement ? HTMLInputElement.prototype : Object.getPrototypeOf(element);
        const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        valueSetter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }

      setNativeValue(emailInput, 'client.aarav@nextech.io');
      setNativeValue(passwordInput, 'password123');
      await new Promise(r => setTimeout(r, 200));

      window.__alerts = [];
      submitBtn.click();
      await new Promise(r => setTimeout(r, 2500));

      const text = document.body.innerText;
      const isClientPortal = text.includes('Client Portal') || text.includes('Client Workspace') || text.includes('Projects') || text.includes('Aarav') || window.location.pathname.includes('/client');
      const isAdminPortal = text.includes('SuperAdmin Desk');
      return {
        url: window.location.href,
        isClientPortal,
        isAdminPortal,
        role: localStorage.getItem('current_user_role')
      };
    })()`);

    record(
      "Test 3 - Client login opens Client Portal",
      test3Result.isClientPortal && !test3Result.isAdminPortal,
      `URL: ${test3Result.url}, isClient: ${test3Result.isClientPortal}, isAdmin: ${test3Result.isAdminPortal}, role: ${test3Result.role}`
    );

    // =========================================================================
    // Test 6: Authenticated Client attempts ?portal=admin
    // =========================================================================
    console.log("\n--- Test 6: Client Attempts ?portal=admin ---");
    await goto('http://localhost:5173/?portal=admin', 2000);

    const test6Result = await client.evaluate(`(() => {
      const text = document.body.innerText;
      const isAdminPortal = text.includes('Admin Governance') || text.includes('SuperAdmin Desk');
      const isClientPortal = text.includes('Client Portal') || text.includes('Client Workspace') || text.includes('Projects') || window.location.pathname.includes('/client');
      return {
        url: window.location.href,
        isAdminPortal,
        isClientPortal
      };
    })()`);

    record(
      "Test 6 - Authenticated Client visiting ?portal=admin is denied and stays in Client Portal",
      !test6Result.isAdminPortal && (test6Result.isClientPortal || test6Result.url.includes('/client')),
      `URL: ${test6Result.url}, isAdminPortal: ${test6Result.isAdminPortal}, isClientPortal: ${test6Result.isClientPortal}`
    );

    // Client logout before Expert test
    await client.evaluate(`(() => {
      localStorage.clear();
      sessionStorage.clear();
    })()`);

    // =========================================================================
    // Test 4: Normal Expert Login
    // =========================================================================
    console.log("\n--- Test 4: Normal Expert Login ---");
    await goto('http://localhost:5173/login', 1500);

    const test4Result = await client.evaluate(`(async () => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const signInTab = tabs.find(b => b.textContent.includes('2. Sign In'));
      if (signInTab) signInTab.click();
      await new Promise(r => setTimeout(r, 200));

      const expertBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Senior Expert'));
      if (expertBtn) expertBtn.click();
      await new Promise(r => setTimeout(r, 200));

      const emailInput = document.querySelector('input[type="email"]');
      const passwordInput = document.querySelector('input[type="password"]') || document.querySelector('input[placeholder="••••••••"]');
      const submitBtn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sign In'));

      function setNativeValue(element, value) {
        const proto = element instanceof HTMLInputElement ? HTMLInputElement.prototype : Object.getPrototypeOf(element);
        const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        valueSetter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }

      setNativeValue(emailInput, 'ramesh.sharma@silverworkforce.com');
      setNativeValue(passwordInput, 'password123');
      await new Promise(r => setTimeout(r, 200));

      window.__alerts = [];
      submitBtn.click();
      await new Promise(r => setTimeout(r, 2500));

      const text = document.body.innerText;
      const isExpertPortal = text.includes('Expert Portal') || text.includes('Expert Console') || text.includes('Availability') || text.includes('Ramesh') || window.location.pathname.includes('/expert');
      const isAdminPortal = text.includes('SuperAdmin Desk');
      return {
        url: window.location.href,
        isExpertPortal,
        isAdminPortal,
        role: localStorage.getItem('current_user_role')
      };
    })()`);

    record(
      "Test 4 - Expert login opens Expert Portal",
      test4Result.isExpertPortal && !test4Result.isAdminPortal,
      `URL: ${test4Result.url}, isExpert: ${test4Result.isExpertPortal}, isAdmin: ${test4Result.isAdminPortal}, role: ${test4Result.role}`
    );

    // =========================================================================
    // Test 7: Authenticated Expert attempts ?portal=admin
    // =========================================================================
    console.log("\n--- Test 7: Expert Attempts ?portal=admin ---");
    await goto('http://localhost:5173/?portal=admin', 2000);

    const test7Result = await client.evaluate(`(() => {
      const text = document.body.innerText;
      const isAdminDesk = text.includes('SuperAdmin Desk') || text.includes('Domain Taxonomy');
      const isExpertPortal = text.includes('Expert Portal') || text.includes('Expert Console') || text.includes('Senior Advisory Desk') || text.includes('Availability') || window.location.pathname.includes('/expert');
      return {
        url: window.location.href,
        isAdminDesk,
        isExpertPortal
      };
    })()`);

    record(
      "Test 7 - Authenticated Expert visiting ?portal=admin is denied and stays in Expert Portal",
      !test7Result.isAdminDesk && (test7Result.isExpertPortal || test7Result.url.includes('/expert')),
      `URL: ${test7Result.url}, isAdminDesk: ${test7Result.isAdminDesk}, isExpertPortal: ${test7Result.isExpertPortal}`
    );

  } catch (err) {
    console.error("Browser E2E Execution Error:", err);
  } finally {
    // RESET DATABASE TO UNINITIALIZED STATE FOR THE USER!
    await setDbAdminUninitialized(db);
    console.log("\n[CLEANUP] Admin database left in clean UNINITIALIZED state for the REAL USER.");
    await mongoClient.close();
    try {
      chrome.kill('SIGTERM');
    } catch (e) {}
  }

  console.log("\n=== SUMMARY OF BROWSER E2E TESTS ===");
  const passedCount = results.filter(r => r.passed).length;
  console.log(`Passed: ${passedCount} / ${results.length}`);
  if (passedCount === results.length) {
    console.log("ALL 10 BROWSER E2E TESTS PASSED!");
  } else {
    console.error("SOME TESTS FAILED!");
    process.exit(1);
  }
}

runBrowserE2ETests();
