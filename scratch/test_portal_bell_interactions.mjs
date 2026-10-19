import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-auto-profile-notifs";
const ARTIFACT_DIR = "C:\\Users\\kushw\\.gemini\\antigravity\\brain\\07dd5553-edfd-4b3a-97a4-b9831a97557b";
const SCREENSHOTS_DIR = path.join(ARTIFACT_DIR, 'screenshots');

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
    if (res.exceptionDetails) {
      console.error('Eval error:', res.exceptionDetails);
    }
    return res.result ? res.result.value : null;
  }

  async captureScreenshot(fileName) {
    const filePath = path.join(SCREENSHOTS_DIR, fileName);
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`  [Screenshot Saved] -> ${fileName} (${fs.statSync(filePath).size} bytes)`);
    return filePath;
  }

  close() {
    this.ws.close();
  }
}

async function getCDPClient() {
  let isRunning = false;
  try {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    if (res.ok) isRunning = true;
  } catch {}

  if (!isRunning) {
    console.log("Launching headless Chrome on port 9222...");
    spawn(CHROME_EXE, [
      '--remote-debugging-port=9222',
      '--remote-allow-origins=*',
      `--user-data-dir=${USER_DATA}`,
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--window-size=1440,900',
      'http://localhost:5173/'
    ], {
      detached: false,
      stdio: 'ignore'
    });

    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch('http://127.0.0.1:9222/json/version');
        if (res.ok) {
          isRunning = true;
          break;
        }
      } catch {}
    }
  }

  const tabsRes = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await tabsRes.json();
  let pageTab = tabs.find(t => t.type === 'page');
  if (!pageTab) {
    const newTabRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:5173/');
    pageTab = await newTabRes.json();
  }
  const client = new CDPClient(pageTab.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  return client;
}

async function verifyInteractions() {
  const client = await getCDPClient();
  let passed = 0;
  let failed = 0;

  function assert(cond, desc) {
    if (cond) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      failed++;
    }
  }

  console.log("================================================================================");
  console.log("  VERIFYING NOTIFICATION DRAWER BEHAVIOR ON CLIENT & EXPERT PORTALS             ");
  console.log("================================================================================");

  // 1. Client Portal Check
  console.log("\n--- TEST: Client Portal Bell Click & Toggle Behavior ---");
  await client.evaluate(`(() => {
    localStorage.setItem('current_user_role', 'client');
    localStorage.setItem('current_logged_in_client', JSON.stringify({
      name: 'Aarav Mehta',
      email: 'aarav.mehta@techcorp.io',
      company: 'TechCorp Industries'
    }));
    localStorage.setItem('current_page', 'client');
  })()`);
  await client.send('Page.navigate', { url: 'http://localhost:5173/' });
  await sleep(1500);

  // Check initial state: drawer not open
  let isDrawerOpen = await client.evaluate(`(() => {
    const header = document.querySelector('header');
    return !!header && !!header.querySelector('div[style*="max-height"], div[style*="maxHeight"]');
  })()`);
  assert(!isDrawerOpen, "Client Portal drawer is initially closed");

  // Click header bell
  await client.evaluate(`(() => {
    const header = document.querySelector('header');
    const bellBtn = header.querySelector('button[title*="Notification"]');
    bellBtn.click();
  })()`);
  await sleep(500);

  isDrawerOpen = await client.evaluate(`(() => {
    const header = document.querySelector('header');
    const drawer = header.querySelector('div[style*="max-height"], div[style*="maxHeight"]');
    if (!drawer) return false;
    const rect = drawer.getBoundingClientRect();
    return rect.width > 200 && rect.height > 100;
  })()`);
  assert(isDrawerOpen, "Client Portal drawer opens visibly on bell click");
  await client.captureScreenshot('client_portal_bell_drawer_open.png');

  // Click bell again -> should toggle closed
  await client.evaluate(`(() => {
    const header = document.querySelector('header');
    const bellBtn = header.querySelector('button[title*="Notification"]');
    bellBtn.click();
  })()`);
  await sleep(500);

  isDrawerOpen = await client.evaluate(`(() => {
    const header = document.querySelector('header');
    return !!header && !!header.querySelector('div[style*="max-height"], div[style*="maxHeight"]');
  })()`);
  assert(!isDrawerOpen, "Client Portal drawer toggles closed when bell is clicked again");

  // Open again and click outside -> should close
  await client.evaluate(`(() => {
    const header = document.querySelector('header');
    const bellBtn = header.querySelector('button[title*="Notification"]');
    bellBtn.click();
  })()`);
  await sleep(500);

  // Click outside (e.g. on body background)
  await client.evaluate(`(() => {
    const evt = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
    document.body.dispatchEvent(evt);
  })()`);
  await sleep(500);

  isDrawerOpen = await client.evaluate(`(() => {
    const header = document.querySelector('header');
    return !!header && !!header.querySelector('div[style*="max-height"], div[style*="maxHeight"]');
  })()`);
  assert(!isDrawerOpen, "Client Portal drawer closes on outside mousedown");

  // 2. Expert Portal Check
  console.log("\n--- TEST: Expert Portal Bell Click & Toggle Behavior ---");
  await client.evaluate(`(() => {
    localStorage.setItem('current_user_role', 'expert');
    localStorage.setItem('current_logged_in_expert', JSON.stringify({
      id: 'exp-1',
      name: 'Sunita Rao',
      email: 'exp-1@registry.gov.in',
      verified: true,
      verificationStatus: 'approved'
    }));
    localStorage.setItem('current_page', 'expert');
  })()`);
  await client.send('Page.navigate', { url: 'http://localhost:5173/' });
  await sleep(1500);

  // Check initial state
  isDrawerOpen = await client.evaluate(`(() => {
    const header = document.querySelector('header');
    return !!header && !!header.querySelector('div[style*="max-height"], div[style*="maxHeight"]');
  })()`);
  assert(!isDrawerOpen, "Expert Portal drawer is initially closed");

  // Click header bell
  await client.evaluate(`(() => {
    const header = document.querySelector('header');
    const bellBtn = header.querySelector('button[title*="Notification"]');
    bellBtn.click();
  })()`);
  await sleep(500);

  isDrawerOpen = await client.evaluate(`(() => {
    const header = document.querySelector('header');
    const drawer = header.querySelector('div[style*="max-height"], div[style*="maxHeight"]');
    if (!drawer) return false;
    const rect = drawer.getBoundingClientRect();
    return rect.width > 200 && rect.height > 100;
  })()`);
  assert(isDrawerOpen, "Expert Portal drawer opens visibly on bell click");
  await client.captureScreenshot('expert_portal_bell_drawer_open.png');

  // Click bell again -> should toggle closed
  await client.evaluate(`(() => {
    const header = document.querySelector('header');
    const bellBtn = header.querySelector('button[title*="Notification"]');
    bellBtn.click();
  })()`);
  await sleep(500);

  isDrawerOpen = await client.evaluate(`(() => {
    const header = document.querySelector('header');
    return !!header && !!header.querySelector('div[style*="max-height"], div[style*="maxHeight"]');
  })()`);
  assert(!isDrawerOpen, "Expert Portal drawer toggles closed when bell is clicked again");

  // 3. Test in Light Theme
  console.log("\n--- TEST: Expert Portal Bell Drawer in Light Theme ---");
  await client.evaluate(`(() => {
    // Click theme toggle button to switch to light
    const header = document.querySelector('header');
    const themeBtn = header.querySelector('button[aria-label*="theme" i], button:has(svg.lucide-sun), button:has(svg.lucide-moon)');
    if (themeBtn) themeBtn.click();
  })()`);
  await sleep(500);

  // Click bell in Light Theme
  await client.evaluate(`(() => {
    const header = document.querySelector('header');
    const bellBtn = header.querySelector('button[title*="Notification"]');
    bellBtn.click();
  })()`);
  await sleep(500);

  isDrawerOpen = await client.evaluate(`(() => {
    const header = document.querySelector('header');
    const drawer = header.querySelector('div[style*="max-height"], div[style*="maxHeight"]');
    if (!drawer) return false;
    const rect = drawer.getBoundingClientRect();
    return rect.width > 200 && rect.height > 100;
  })()`);
  assert(isDrawerOpen, "Expert Portal drawer opens visibly in Light Mode");
  await client.captureScreenshot('expert_portal_light_drawer_open.png');

  console.log(`\n================================================================================`);
  console.log(`  SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================================================================`);

  process.exit(failed > 0 ? 1 : 0);
}

verifyInteractions().catch(e => {
  console.error(e);
  process.exit(1);
});
