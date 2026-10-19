import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = "C:\\Users\\kushw\\.gemini\\antigravity\\brain\\39df65e9-97a5-40cc-874d-9ffcc6245c91";
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
        console.log(`[Auto-Dismissing Alert: "${msg.params?.message || ''}"]`);
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
    console.log(`[Screenshot Saved] -> ${fileName} (${fs.statSync(filePath).size} bytes)`);
    return filePath;
  }

  close() {
    this.ws.close();
  }
}

async function getPageTarget() {
  const res = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await res.json();
  const page = tabs.find(t => t.type === 'page' && t.url && t.url.includes('localhost:5173'));
  if (page) return page;
  const normalPage = tabs.find(t => t.type === 'page' && !t.url.startsWith('chrome://'));
  return normalPage || tabs[0];
}

async function run() {
  console.log("================================================================================");
  console.log("STARTING LIVE SCREENSHOT VERIFICATION: CLIENT ABC -> EXPERT JK SYNCHRONIZATION");
  console.log("================================================================================");

  // 1. Prepare DB state: Set Client ABC wallet to ₹15,000, ensure Expert JK exists
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const clientEmail = 'client_abc@enterprise.com';
  if (!db.kv) db.kv = {};
  db.kv[`client_wallet_${clientEmail}`] = "15000";
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log("Initialized DB: Client ABC wallet set to ₹15,000");

  const target = await getPageTarget();
  if (!target) throw new Error("No Chrome page target found.");
  console.log("Connecting CDP to tab:", target.title, target.url);
  const client = new CDPClient(target.webSocketDebuggerUrl);

  await client.send('Page.enable');
  await client.send('DOM.enable');
  await client.send('Runtime.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  // Navigate to Client Portal as Client ABC
  console.log("\n--- STEP 1: Client Portal - Open Project Review Modal for Expert JK ---");
  await client.evaluate(`
    localStorage.setItem("current_user_role", "client");
    localStorage.setItem("current_user_profile", JSON.stringify({
      id: "cli-abc-test",
      name: "Client ABC",
      email: "${clientEmail}",
      company: "ABC Enterprises",
      role: "client"
    }));
    localStorage.setItem("client_wallet_${clientEmail}", "15000");
    window.location.href = "http://localhost:5173/";
  `);
  await sleep(3000);

  // Switch to client page if not already
  await client.evaluate(`
    // Click Client Portal in ProtoBar
    const buttons = Array.from(document.querySelectorAll('button'));
    const clientBtn = buttons.find(b => b.textContent && b.textContent.includes('Client Portal'));
    if (clientBtn) clientBtn.click();
  `);
  await sleep(1500);

  // Find Expert JK card and click "Review" or trigger project review request modal
  const openedModal = await client.evaluate(`
    (() => {
      // Find cards or advisors
      const buttons = Array.from(document.querySelectorAll('button'));
      // Find buttons with "Review" text or specific expert
      const reviewBtns = buttons.filter(b => b.textContent && b.textContent.includes('Review') && !b.textContent.includes('Dedicated'));
      if (reviewBtns.length > 0) {
        reviewBtns[0].click();
        return true;
      }
      return false;
    })()
  `);
  await sleep(1500);

  await client.captureScreenshot('sync_01_client_request_modal.png');

  // Submit the request modal
  console.log("\n--- STEP 2: Client Submits Project Review Request ---");
  await client.evaluate(`
    (() => {
      const submitBtn = Array.from(document.querySelectorAll('button[type="submit"]')).find(b => 
        b.textContent && (b.textContent.includes('Submit') || b.textContent.includes('Request') || b.textContent.includes('Pay'))
      );
      if (submitBtn) {
        submitBtn.click();
      }
    })()
  `);
  await sleep(2500);

  // View Client's Project Reviews dashboard
  await client.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const prTab = buttons.find(b => b.textContent && b.textContent.includes('Project Reviews'));
      if (prTab) prTab.click();
    })()
  `);
  await sleep(2000);
  await client.captureScreenshot('sync_02_client_pending_dashboard.png');

  // STEP 3: Switch to Expert Portal as Expert JK
  console.log("\n--- STEP 3: Expert Portal (Expert JK) - Project Review Requests Area ---");
  await client.evaluate(`
    localStorage.setItem("current_user_role", "expert");
    localStorage.setItem("current_logged_in_expert", JSON.stringify({
      id: "usr-1788974684441",
      name: "JK",
      email: "jay@gmail.com",
      field: "HR & Talent",
      rate: 650,
      baseRate: 500,
      verified: true,
      verificationStatus: "approved"
    }));
    window.location.href = "http://localhost:5173/";
  `);
  await sleep(3000);

  // Navigate to Expert Portal and Dedicated Project Reviews Tab
  await client.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const expBtn = buttons.find(b => b.textContent && b.textContent.includes('Expert Portal'));
      if (expBtn) expBtn.click();
    })()
  `);
  await sleep(1500);

  await client.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const prTab = buttons.find(b => b.textContent && b.textContent.includes('Dedicated Project Reviews'));
      if (prTab) prTab.click();
    })()
  `);
  await sleep(2000);

  await client.captureScreenshot('sync_03_expert_requests_section.png');

  // STEP 4: Expert JK clicks "Accept Review"
  console.log("\n--- STEP 4: Expert JK Accepts Review Request -> Dedicated Workspace ---");
  const accepted = await client.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const acceptBtn = buttons.find(b => b.textContent && b.textContent.includes('Accept Review'));
      if (acceptBtn) {
        acceptBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log("Clicked Accept Review:", accepted);
  await sleep(3000);

  await client.captureScreenshot('sync_04_expert_accepted_workspace.png');

  // Close workspace modal if open
  await client.evaluate(`
    (() => {
      const closeBtn = document.querySelector('button[title="Refresh"]')?.nextElementSibling;
      if (closeBtn) closeBtn.click();
    })()
  `);
  await sleep(1500);

  // STEP 5: Admin Governance Portal
  console.log("\n--- STEP 5: Admin Desk - Multi-Party Governance Synchronization ---");
  await client.evaluate(`
    localStorage.setItem("current_user_role", "admin");
    window.location.href = "http://localhost:5173/?portal=admin";
  `);
  await sleep(3500);

  // Click Dedicated Project Reviews Tab in Admin
  await client.evaluate(`
    (() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const prAdminTab = tabs.find(b => b.textContent && b.textContent.includes('Project Reviews'));
      if (prAdminTab) prAdminTab.click();
    })()
  `);
  await sleep(2500);

  await client.captureScreenshot('sync_05_admin_synchronized_desk.png');

  console.log("\n================================================================================");
  console.log("ALL ON-SCREEN SCREENSHOTS SUCCESSFULLY CAPTURED!");
  console.log("================================================================================");
  client.close();
}

run().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
