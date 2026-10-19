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
  console.log("FULL WALKTHROUGH CAPTURE: CLIENT ABC -> EXPERT JK SYNCHRONIZATION & WORKSPACE");
  console.log("================================================================================");

  const clientEmail = 'client_abc@enterprise.com';
  const expertEmail = 'jay@gmail.com';
  const expertId = 'usr-1788974684441';

  // 1. Create fresh request via API to guarantee exact pending state
  const reqRes = await fetch('http://[::1]:5173/api/project-reviews/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: 'cli-abc-test',
      clientName: 'Client ABC',
      clientEmail,
      expertId,
      expertName: 'JK',
      expertEmail,
      expectedScope: 'Microservices Architecture & Scalability Audit + 2 Strategy Meetings',
      reviewType: 'High-Throughput Scalability & Database Assessment',
      requestNotes: 'High-concurrency e-commerce scale audit ahead of Diwali surge.',
      clientWalletBalance: 15000
    })
  });
  const reqData = await reqRes.json();
  const reviewId = reqData.projectReview?.projectReviewId;
  console.log("Created fresh review request:", reviewId, "Status:", reqData.projectReview?.status);

  const target = await getPageTarget();
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

  // STEP 1: Client Portal - View Pending Request on Project Reviews Tab
  console.log("\n--- CAPTURE 1: Client Portal - Pending Project Review ---");
  await client.evaluate(`
    localStorage.setItem("current_user_role", "client");
    localStorage.setItem("current_user_profile", JSON.stringify({
      id: "cli-abc-test",
      name: "Client ABC",
      email: "${clientEmail}",
      company: "ABC Enterprises",
      role: "client"
    }));
    window.location.href = "http://localhost:5173/";
  `);
  await sleep(3000);

  // Switch to Project Reviews tab in Client Portal
  await client.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const prTab = buttons.find(b => b.textContent && b.textContent.includes('Project Reviews'));
      if (prTab) prTab.click();
    })()
  `);
  await sleep(2500);
  await client.captureScreenshot('walkthrough_01_client_pending_review.png');

  // STEP 2: Expert Portal - View Incoming Request in "Project Review Requests"
  console.log("\n--- CAPTURE 2: Expert Portal (JK) - Project Review Requests Area ---");
  await client.evaluate(`
    localStorage.setItem("current_user_role", "expert");
    localStorage.setItem("current_logged_in_expert", JSON.stringify({
      id: "${expertId}",
      name: "JK",
      email: "${expertEmail}",
      field: "HR & Talent",
      rate: 650,
      baseRate: 500,
      verified: true,
      verificationStatus: "approved"
    }));
    window.location.href = "http://localhost:5173/";
  `);
  await sleep(3000);

  // Click Expert Portal -> Dedicated Project Reviews tab
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
  await sleep(2500);

  await client.captureScreenshot('walkthrough_02_expert_incoming_request_card.png');

  // STEP 3: Expert JK Accepts Request -> Dedicated Workspace
  console.log("\n--- CAPTURE 3: Expert JK Accepts Review -> Active Dedicated Workspace ---");
  await client.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const acceptBtn = buttons.find(b => b.textContent && b.textContent.includes('Accept Review'));
      if (acceptBtn) acceptBtn.click();
    })()
  `);
  await sleep(3500);

  await client.captureScreenshot('walkthrough_03_expert_workspace_active.png');

  // Close workspace modal
  await client.evaluate(`
    (() => {
      const closeBtn = document.querySelector('button[title="Refresh"]')?.nextElementSibling;
      if (closeBtn) closeBtn.click();
    })()
  `);
  await sleep(1500);

  // STEP 4: Admin Governance Desk -> Project Review OPS
  console.log("\n--- CAPTURE 4: Admin Governance Desk - Project Review OPS ---");
  await client.evaluate(`
    localStorage.setItem("current_user_role", "admin");
    window.location.href = "http://localhost:5173/?portal=admin";
  `);
  await sleep(3500);

  // Click Project Review OPS in the left sidebar
  await client.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const prOpsBtn = buttons.find(b => b.textContent && b.textContent.includes('Project Review OPS'));
      if (prOpsBtn) prOpsBtn.click();
    })()
  `);
  await sleep(2500);

  await client.captureScreenshot('walkthrough_04_admin_project_review_ops.png');

  // STEP 5: Decline Workflow Verification
  console.log("\n--- CAPTURE 5: Decline Workflow & Escrow Refund Verification ---");
  
  // Create another review to decline
  const req2Res = await fetch('http://[::1]:5173/api/project-reviews/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: 'cli-abc-test',
      clientName: 'Client ABC',
      clientEmail,
      expertId,
      expertName: 'JK',
      expertEmail,
      expectedScope: 'Rapid Security Penetration Audit',
      reviewType: 'Security, Vulnerability & Compliance Audit',
      requestNotes: 'Need urgent security audit before launch.',
      clientWalletBalance: 15000
    })
  });
  const req2Data = await req2Res.json();
  const review2Id = req2Data.projectReview?.projectReviewId;

  // Expert declines via API
  await fetch(`http://[::1]:5173/api/project-reviews/${review2Id}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'decline',
      reason: 'Schedule conflict due to active client sprint.',
      responderId: expertId,
      responderRole: 'expert'
    })
  });

  // Switch to Client Portal to capture the declined status and refunded escrow
  await client.evaluate(`
    localStorage.setItem("current_user_role", "client");
    window.location.href = "http://localhost:5173/";
  `);
  await sleep(3000);

  await client.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const prTab = buttons.find(b => b.textContent && b.textContent.includes('Project Reviews'));
      if (prTab) prTab.click();
    })()
  `);
  await sleep(2500);

  await client.captureScreenshot('walkthrough_05_client_declined_and_refunded.png');

  console.log("\n================================================================================");
  console.log("ALL WALKTHROUGH SCREENSHOTS SUCCESSFULLY CAPTURED!");
  console.log("================================================================================");
  client.close();
}

run().catch(err => {
  console.error("Walkthrough capture error:", err);
  process.exit(1);
});
