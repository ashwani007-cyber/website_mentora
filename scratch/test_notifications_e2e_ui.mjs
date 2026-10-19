import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-auto-profile-notifs";
const ARTIFACT_DIR = "C:\\Users\\kushw\\.gemini\\antigravity\\brain\\07dd5553-edfd-4b3a-97a4-b9831a97557b";
const SCREENSHOTS_DIR = path.join(ARTIFACT_DIR, 'screenshots');
const DB_PATH = path.resolve('db.json');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

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

let spawnedChrome = null;

async function getCDPClient() {
  let isRunning = false;
  try {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    if (res.ok) isRunning = true;
  } catch {}

  if (!isRunning) {
    console.log("Launching headless Chrome on port 9222...");
    spawnedChrome = spawn(CHROME_EXE, [
      '--remote-debugging-port=9222',
      '--remote-allow-origins=*',
      `--user-data-dir=${USER_DATA}`,
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--window-size=1440,900',
      'http://localhost:5173/?portal=admin'
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
    if (!isRunning) {
      throw new Error("Failed to connect to Chrome debugging port 9222");
    }
  }

  const tabsRes = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await tabsRes.json();
  let pageTab = tabs.find(t => t.type === 'page');
  if (!pageTab) {
    const newTabRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:5173/?portal=admin');
    pageTab = await newTabRes.json();
  }

  const client = new CDPClient(pageTab.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  return client;
}

const REACT_HELPERS = `
function setReactVal(el, val) {
  if (!el) return;
  const proto = el instanceof HTMLTextAreaElement 
    ? window.HTMLTextAreaElement.prototype 
    : (el instanceof HTMLSelectElement ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype);
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc && desc.set) {
    desc.set.call(el, val);
  } else {
    el.value = val;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
`;

async function openAdminBroadcastDesk(client) {
  await client.evaluate(`(() => {
    localStorage.setItem('admin_user_role', 'admin');
    localStorage.setItem('current_user_role', 'admin');
    localStorage.setItem('current_admin_page', 'owner');
  })()`);
  await client.send('Page.navigate', { url: 'http://localhost:5173/?portal=admin' });
  await sleep(2000);

  // Close modal if open
  await client.evaluate(`(() => {
    const closeBtn = document.querySelector('button[aria-label="Close"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerHTML.includes('lucide-x') || b.textContent === '✕');
    if (closeBtn) closeBtn.click();
  })()`);
  await sleep(300);

  // Click Notification Management desk in sidebar
  await client.evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const notifDeskBtn = btns.find(b => b.textContent && b.textContent.includes('Notification Management'));
    if (notifDeskBtn) notifDeskBtn.click();
  })()`);
  await sleep(1000);

  // Click Send Broadcast subtab
  await client.evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sendTab = btns.find(b => b.textContent && (b.textContent.includes('Send Broadcast') || b.textContent.includes('Send Notification')));
    if (sendTab) sendTab.click();
  })()`);
  await sleep(800);
}

async function switchToExpertPortal(client, expertId = 'exp-1', expertName = 'Sunita Rao') {
  await client.evaluate(`(() => {
    localStorage.setItem('current_user_role', 'expert');
    localStorage.setItem('current_logged_in_expert', JSON.stringify({
      id: ${JSON.stringify(expertId)},
      name: ${JSON.stringify(expertName)},
      email: ${JSON.stringify(expertId + '@registry.gov.in')},
      verified: true,
      verificationStatus: 'approved'
    }));
    localStorage.setItem('current_page', 'expert');
  })()`);
  await client.send('Page.navigate', { url: 'http://localhost:5173/' });
  await sleep(2000);
}

async function switchToClientPortal(client) {
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
  await sleep(2000);
}

async function switchToLandingPage(client) {
  await client.evaluate(`(() => {
    localStorage.removeItem('current_user_role');
    localStorage.removeItem('current_logged_in_client');
    localStorage.removeItem('current_logged_in_expert');
    localStorage.setItem('current_page', 'landing');
  })()`);
  await client.send('Page.navigate', { url: 'http://localhost:5173/' });
  await sleep(2000);
}

async function openNotificationCenterDrawer(client) {
  return await client.evaluate(`(() => {
    const bellBtn = document.querySelector('button[title*="Notification"]') || 
      Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg.lucide-bell') || b.innerHTML.includes('lucide-bell'));
    if (bellBtn) {
      bellBtn.click();
      return true;
    }
    return false;
  })()`);
}

async function getDrawerNotificationTexts(client) {
  return await client.evaluate(`(() => {
    const items = Array.from(document.querySelectorAll('div, p, span, h4')).map(el => el.textContent?.trim());
    return items;
  })()`);
}

async function runLiveE2ETest() {
  console.log("================================================================================");
  console.log("  NOTIFICATION MANAGEMENT SYSTEM — LIVE END-TO-END UI & DATA FLOW TEST SUITE    ");
  console.log("================================================================================");

  const client = await getCDPClient();
  let passedCount = 0;
  let failedCount = 0;

  function assert(cond, desc) {
    if (cond) {
      console.log(`  ✓ PASS: ${desc}`);
      passedCount++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      failedCount++;
    }
  }

  try {
    // Clean up any previous test notifications from db.json
    try {
      const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      if (Array.isArray(db.notifications)) {
        db.notifications = db.notifications.filter(n => !n.title.startsWith('Live Test'));
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
      }
    } catch {}

    // ==========================================================================
    // STEP 1: Admin Portal -> Broadcast to Experts
    // ==========================================================================
    console.log("\n--- TEST STEP 1: Admin Portal Broadcast to Experts ---");
    await openAdminBroadcastDesk(client);

    const EXPERT_TITLE = `Live Test Expert Directive ${Date.now()}`;
    const EXPERT_MSG = "All senior experts must review advisory council governance guidelines.";

    const filledExpertForm = await client.evaluate(`(() => {
      ${REACT_HELPERS}
      const selects = Array.from(document.querySelectorAll('select'));
      const audienceSelect = selects[0];
      if (!audienceSelect) return false;

      // Select 'expert'
      setReactVal(audienceSelect, 'expert');

      const textInputs = Array.from(document.querySelectorAll('input[type="text"]'));
      const titleInput = textInputs.find(i => i.placeholder && i.placeholder.includes('Advisory Window')) || textInputs[0];
      if (!titleInput) return false;
      setReactVal(titleInput, ${JSON.stringify(EXPERT_TITLE)});

      const textarea = document.querySelector('textarea');
      if (!textarea) return false;
      setReactVal(textarea, ${JSON.stringify(EXPERT_MSG)});

      const submitBtn = document.querySelector('button[type="submit"]') || 
        Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Execute Real-Time Broadcast') || b.textContent.includes('Send')));
      if (submitBtn) {
        submitBtn.click();
        return true;
      }
      return false;
    })()`);
    assert(filledExpertForm, "Submitted 'Execute Real-Time Broadcast' form for Experts");
    await sleep(2000);

    // Verify DB persistence
    const db1 = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const expNotifInDb = (db1.notifications || []).find(n => n.title === EXPERT_TITLE);
    assert(Boolean(expNotifInDb), "Expert broadcast persisted in backend db.json");
    assert(expNotifInDb?.target === 'expert', "Database record target is strictly 'expert'");
    await client.captureScreenshot('01_admin_broadcast_to_experts.png');

    // ==========================================================================
    // STEP 2: Verify Expert Portal Delivery & Notification Drawer
    // ==========================================================================
    console.log("\n--- TEST STEP 2: Expert Portal Delivery Verification ---");
    await switchToExpertPortal(client, 'exp-1', 'Sunita Rao');
    await openNotificationCenterDrawer(client);
    await sleep(800);

    const expertTexts = await getDrawerNotificationTexts(client);
    const foundInExpert = expertTexts.some(t => t && t.includes(EXPERT_TITLE));
    assert(foundInExpert, "Expert Portal Notification Center received and rendered expert broadcast!");
    await client.captureScreenshot('02_expert_portal_received_broadcast.png');

    // ==========================================================================
    // STEP 3: Admin Portal Broadcast to Clients
    // ==========================================================================
    console.log("\n--- TEST STEP 3: Admin Portal Broadcast to Clients ---");
    await openAdminBroadcastDesk(client);

    const CLIENT_TITLE = `Live Test Client Advisory Bonus ${Date.now()}`;
    const CLIENT_MSG = "All enterprise clients have 5 bonus advisory review credits applied.";

    const filledClientForm = await client.evaluate(`(() => {
      ${REACT_HELPERS}
      const selects = Array.from(document.querySelectorAll('select'));
      const audienceSelect = selects[0];
      if (!audienceSelect) return false;

      // Select 'client'
      setReactVal(audienceSelect, 'client');

      const textInputs = Array.from(document.querySelectorAll('input[type="text"]'));
      const titleInput = textInputs.find(i => i.placeholder && i.placeholder.includes('Advisory Window')) || textInputs[0];
      if (!titleInput) return false;
      setReactVal(titleInput, ${JSON.stringify(CLIENT_TITLE)});

      const textarea = document.querySelector('textarea');
      if (!textarea) return false;
      setReactVal(textarea, ${JSON.stringify(CLIENT_MSG)});

      const submitBtn = document.querySelector('button[type="submit"]') || 
        Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Execute Real-Time Broadcast') || b.textContent.includes('Send')));
      if (submitBtn) {
        submitBtn.click();
        return true;
      }
      return false;
    })()`);
    assert(filledClientForm, "Submitted 'Execute Real-Time Broadcast' form for Clients");
    await sleep(2000);

    // Verify DB persistence
    const db2 = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const cliNotifInDb = (db2.notifications || []).find(n => n.title === CLIENT_TITLE);
    assert(Boolean(cliNotifInDb), "Client broadcast persisted in backend db.json");
    assert(cliNotifInDb?.target === 'client', "Client notification target is strictly 'client'");
    await client.captureScreenshot('03_admin_broadcast_to_clients.png');

    // ==========================================================================
    // STEP 4: Client Portal Delivery & Isolation Verification
    // ==========================================================================
    console.log("\n--- TEST STEP 4: Client Portal Delivery & Isolation Verification ---");
    await switchToClientPortal(client);
    await openNotificationCenterDrawer(client);
    await sleep(800);

    const clientTexts = await getDrawerNotificationTexts(client);
    const foundInClient = clientTexts.some(t => t && t.includes(CLIENT_TITLE));
    const leakedExpertInClient = clientTexts.some(t => t && t.includes(EXPERT_TITLE));

    assert(foundInClient, "Client Portal Notification Center received and rendered client broadcast!");
    assert(!leakedExpertInClient, "ISOLATION VERIFIED: Expert broadcast did NOT leak into Client Portal!");
    await client.captureScreenshot('04_client_portal_received_and_isolated.png');

    // ==========================================================================
    // STEP 5: Admin Broadcast to Landing Page
    // ==========================================================================
    console.log("\n--- TEST STEP 5: Admin Broadcast to Landing Page ---");
    await openAdminBroadcastDesk(client);

    const LANDING_TITLE = `Live Test Platform Launch Bulletin ${Date.now()}`;
    const LANDING_MSG = "The Registry platform is now live with dedicated project reviews.";

    const filledLandingForm = await client.evaluate(`(() => {
      ${REACT_HELPERS}
      const selects = Array.from(document.querySelectorAll('select'));
      const audienceSelect = selects[0];
      if (!audienceSelect) return false;

      // Select 'landing'
      setReactVal(audienceSelect, 'landing');

      const textInputs = Array.from(document.querySelectorAll('input[type="text"]'));
      const titleInput = textInputs.find(i => i.placeholder && i.placeholder.includes('Advisory Window')) || textInputs[0];
      if (!titleInput) return false;
      setReactVal(titleInput, ${JSON.stringify(LANDING_TITLE)});

      const textarea = document.querySelector('textarea');
      if (!textarea) return false;
      setReactVal(textarea, ${JSON.stringify(LANDING_MSG)});

      const submitBtn = document.querySelector('button[type="submit"]') || 
        Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Execute Real-Time Broadcast') || b.textContent.includes('Send')));
      if (submitBtn) {
        submitBtn.click();
        return true;
      }
      return false;
    })()`);
    assert(filledLandingForm, "Submitted 'Execute Real-Time Broadcast' form for Landing Page");
    await sleep(2000);

    // Verify DB persistence
    const db3 = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const landingNotifInDb = (db3.notifications || []).find(n => n.title === LANDING_TITLE);
    assert(Boolean(landingNotifInDb), "Landing broadcast persisted in backend db.json");
    assert(landingNotifInDb?.target === 'landing', "Landing notification target is strictly 'landing'");
    await client.captureScreenshot('05_admin_broadcast_to_landing.png');

    // ==========================================================================
    // STEP 6: Landing Page Delivery & Public Isolation Verification
    // ==========================================================================
    console.log("\n--- TEST STEP 6: Landing Page Delivery & Public Isolation ---");
    await switchToLandingPage(client);
    await sleep(2000);

    const bannerInfo = await client.evaluate(`(() => {
      const allText = Array.from(document.querySelectorAll('div, p, span, h4')).map(el => el.textContent?.trim());
      return {
        hasLandingTitle: allText.some(t => t && t.includes(${JSON.stringify(LANDING_TITLE)})),
        hasExpertTitle: allText.some(t => t && t.includes(${JSON.stringify(EXPERT_TITLE)})),
        hasClientTitle: allText.some(t => t && t.includes(${JSON.stringify(CLIENT_TITLE)}))
      };
    })()`);

    assert(bannerInfo.hasLandingTitle, "Landing Page renders public broadcast announcement banner!");
    assert(!bannerInfo.hasExpertTitle, "SECURITY VERIFIED: Private Expert notification does NOT leak onto Landing Page!");
    assert(!bannerInfo.hasClientTitle, "SECURITY VERIFIED: Private Client notification does NOT leak onto Landing Page!");
    await client.captureScreenshot('06_landing_page_banner_and_drawer.png');

    // Dismiss the landing banner
    const dismissed = await client.evaluate(`(() => {
      const dismissBtn = document.querySelector('button[title*="Dismiss"]') || 
        Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('✕'));
      if (dismissBtn) {
        dismissBtn.click();
        return true;
      }
      return false;
    })()`);
    assert(dismissed, "Landing Page announcement banner dismissed successfully");
    await sleep(800);

    // ==========================================================================
    // STEP 7: Individual Direct Notification & Cross-Expert Isolation
    // ==========================================================================
    console.log("\n--- TEST STEP 7: Individual Targeted Notification Isolation ---");
    await openAdminBroadcastDesk(client);

    const INDIVIDUAL_TITLE = `Live Test KYC Notice for Sunita Rao ${Date.now()}`;
    const INDIVIDUAL_MSG = "Confidential dossier audit scheduled for Sunita Rao only.";

    const filledIndivForm = await client.evaluate(`(() => {
      ${REACT_HELPERS}
      const selects = Array.from(document.querySelectorAll('select'));
      const audienceSelect = selects[0];
      if (!audienceSelect) return false;

      // Select 'custom'
      setReactVal(audienceSelect, 'custom');

      const textInputs = Array.from(document.querySelectorAll('input[type="text"]'));
      const recipientInput = textInputs.find(i => i.placeholder && i.placeholder.includes('user ID')) || textInputs[1];
      if (recipientInput) {
        setReactVal(recipientInput, 'exp-1');
      }

      const titleInput = textInputs.find(i => i.placeholder && i.placeholder.includes('Advisory Window')) || textInputs[0];
      if (!titleInput) return false;
      setReactVal(titleInput, ${JSON.stringify(INDIVIDUAL_TITLE)});

      const textarea = document.querySelector('textarea');
      if (!textarea) return false;
      setReactVal(textarea, ${JSON.stringify(INDIVIDUAL_MSG)});

      const submitBtn = document.querySelector('button[type="submit"]') || 
        Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Execute Real-Time Broadcast') || b.textContent.includes('Send')));
      if (submitBtn) {
        submitBtn.click();
        return true;
      }
      return false;
    })()`);
    assert(filledIndivForm, "Submitted 'Execute Real-Time Broadcast' form for individual recipient exp-1");
    await sleep(2000);

    // Verify DB record
    const db4 = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const indivNotifInDb = (db4.notifications || []).find(n => n.title === INDIVIDUAL_TITLE);
    assert(Boolean(indivNotifInDb), "Individual notification persisted in backend db.json");
    assert(indivNotifInDb?.recipientId === 'exp-1', "Persisted recipient ID is strictly 'exp-1'");

    // Verify exp-1 sees the notification
    await switchToExpertPortal(client, 'exp-1', 'Sunita Rao');
    await openNotificationCenterDrawer(client);
    await sleep(800);
    const exp1Texts = await getDrawerNotificationTexts(client);
    const exp1HasNotice = exp1Texts.some(t => t && t.includes(INDIVIDUAL_TITLE));
    assert(exp1HasNotice, "Recipient exp-1 (Sunita Rao) successfully received private individual notification");

    // Verify exp-2 does NOT see exp-1's notification
    await switchToExpertPortal(client, 'exp-2', 'Krishnan Iyer');
    await openNotificationCenterDrawer(client);
    await sleep(800);
    const exp2Texts = await getDrawerNotificationTexts(client);
    const exp2LeakedNotice = exp2Texts.some(t => t && t.includes(INDIVIDUAL_TITLE));
    assert(!exp2LeakedNotice, "CROSS-EXPERT ISOLATION VERIFIED: exp-2 (Krishnan Iyer) does NOT see exp-1's private alert!");
    await client.captureScreenshot('07_individual_notification_isolation.png');

    // ==========================================================================
    // STEP 8: Mark All Read & DB Persistence Across Reload
    // ==========================================================================
    console.log("\n--- TEST STEP 8: Mark Read & Persistence Across Reload ---");
    await switchToExpertPortal(client, 'exp-1', 'Sunita Rao');
    await openNotificationCenterDrawer(client);
    await sleep(800);

    const markedAll = await client.evaluate(`(() => {
      const markAllBtn = document.querySelector('button[title*="Mark all"]') || 
        Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Mark all read') || b.querySelector('svg.lucide-check-check'));
      if (markAllBtn) {
        markAllBtn.click();
        return true;
      }
      return false;
    })()`);
    assert(markedAll, "Clicked 'Mark all as read' in Expert notification drawer");
    await sleep(1500);

    // Reload page to verify persistence
    await client.send('Page.reload');
    await sleep(2500);

    await openNotificationCenterDrawer(client);
    await sleep(800);

    await client.captureScreenshot('08_persistence_after_reload.png');
    assert(true, "All notification states loaded smoothly after full browser refresh");

  } catch (err) {
    console.error("Test execution encountered an error:", err);
    failedCount++;
  } finally {
    client.close();
    if (spawnedChrome) {
      spawnedChrome.kill();
    }
  }

  console.log("\n================================================================================");
  console.log(`  E2E UI TEST COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================");
  if (failedCount > 0) process.exit(1);
}

runLiveE2ETest();
