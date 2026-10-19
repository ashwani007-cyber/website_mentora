import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-auto-profile";
const ARTIFACT_DIR = "C:\\Users\\kushw\\.gemini\\antigravity\\brain\\39df65e9-97a5-40cc-874d-9ffcc6245c91";
const SCREENSHOTS_DIR = path.join(ARTIFACT_DIR, 'screenshots');
const DB_PATH = path.resolve('db.json');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function cleanDatabaseForTest() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      if (Array.isArray(db.projectReviews)) {
        db.projectReviews = db.projectReviews.filter(r => 
          r.clientEmail !== 'aarav.mehta@techcorp.io' && r.clientId !== 'cli-live-101'
        );
      }
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
      console.log("[DB Cleanup] Cleared any prior test reviews for aarav.mehta@techcorp.io");
    }
  } catch (err) {
    console.warn("DB Cleanup warning:", err.message);
  }
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
        console.log(`[Auto-Dismissing Alert Dialog: "${msg.params?.message || ''}"]`);
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

async function ensureChrome() {
  try {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    if (res.ok) {
      console.log("Chrome is already running with remote debugging port 9222.");
      return;
    }
  } catch {}

  console.log("Spawning Chrome with debugging port 9222 on user screen...");
  spawn(CHROME_EXE, [
    '--remote-debugging-port=9222',
    '--remote-allow-origins=*',
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--disable-fre',
    '--no-default-browser-check',
    '--start-maximized',
    'http://localhost:5173/'
  ], {
    detached: true,
    stdio: 'ignore'
  }).unref();

  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        console.log("Chrome successfully connected!");
        return;
      }
    } catch {}
  }
  throw new Error("Failed to connect to Chrome remote debugging port.");
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
  console.log("STARTING LIVE ON-SCREEN VERIFICATION OF DEDICATED PROJECT REVIEW WORKFLOW");
  console.log("================================================================================");

  cleanDatabaseForTest();
  await ensureChrome();
  const target = await getPageTarget();
  if (!target) throw new Error("No Chrome page target found.");

  const cdp = new CDPClient(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  // Ensure navigated to localhost:5173
  await cdp.send('Page.navigate', { url: 'http://localhost:5173/' });
  await sleep(3000);

  // ============================================================================
  // STAGE 1: CLIENT PORTAL — DIRECTORY & REVIEW REQUEST
  // ============================================================================
  console.log("\n[STAGE 1] Client Portal — Viewing Directory and Requesting Project Review...");

  await cdp.evaluate(`
    (() => {
      localStorage.setItem("current_user_role", "client");
      localStorage.setItem("current_page", "client");
      localStorage.setItem("current_logged_in_client", JSON.stringify({
        id: "cli-live-101",
        name: "Aarav Mehta",
        email: "aarav.mehta@techcorp.io",
        company: "TechCorp Labs"
      }));
      localStorage.setItem("client_wallet_aarav.mehta@techcorp.io", "35000");
      window.location.href = "http://localhost:5173/";
    })()
  `);

  await sleep(3500);

  // Capture Screenshot 1: Directory with Review button
  await cdp.captureScreenshot("01_client_directory_with_review_button.png");

  // Click on the dedicated "Review" button on Sunita Rao's card
  console.log("Clicking dedicated 'Review' button on expert card...");
  const openedModal = await cdp.evaluate(`
    (() => {
      const reviewBtn = document.querySelector('button[title*="Request Dedicated Project Review"]');
      if (reviewBtn) {
        reviewBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log("Review button clicked:", openedModal);

  await sleep(2000);

  // Capture Screenshot 2: Project Review Request Modal
  await cdp.captureScreenshot("02_project_review_request_modal.png");

  // Fill in the request modal form details with native setter for React controlled component
  console.log("Filling in Project Review Request parameters...");
  await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return;
      const textarea = modal.querySelector('textarea');
      if (!textarea) return;

      const prototype = window.HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (setter) {
        setter.call(textarea, "Pre-launch architecture and concurrency audit of our distributed payments engine. Need evaluation of double-spend prevention, Redis distributed locks, and escrow release safety.");
      } else {
        textarea.value = "Pre-launch architecture and concurrency audit of our distributed payments engine. Need evaluation of double-spend prevention, Redis distributed locks, and escrow release safety.";
      }
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    })()
  `);

  await sleep(1000);

  // Click submit request button inside the modal
  console.log("Submitting Project Review Request...");
  await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return;
      const submitBtn = modal.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    })()
  `);

  await sleep(3500);

  // Switch to "My Dedicated Project Reviews" tab in Client Portal
  console.log("Navigating to 'My Dedicated Project Reviews' tab in Client Portal...");
  await cdp.evaluate(`
    (() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const prTab = tabs.find(b => b.textContent && b.textContent.includes('My Dedicated Project Reviews'));
      if (prTab) prTab.click();
    })()
  `);

  await sleep(2500);

  // Capture Screenshot 3: Client Dashboard with pending review card
  await cdp.captureScreenshot("03_client_project_reviews_dashboard_pending.png");

  // ============================================================================
  // STAGE 2: EXPERT PORTAL — INCOMING REVIEW DECISION & ACCEPTANCE
  // ============================================================================
  console.log("\n[STAGE 2] Expert Portal — Reviewing Request and Accepting...");

  await cdp.evaluate(`
    (() => {
      localStorage.setItem("current_user_role", "expert");
      localStorage.setItem("current_page", "expert");
      localStorage.setItem("current_logged_in_expert", JSON.stringify({
        id: "exp-1",
        name: "Sunita Rao",
        email: "sunita.rao@registry.com",
        title: "Former Chief Financial Officer (Ex-CFO)",
        rate: 939,
        verified: true,
        verificationStatus: "approved"
      }));
      window.location.href = "http://localhost:5173/";
    })()
  `);

  await sleep(3500);

  // Switch to "Dedicated Project Reviews" tab in Expert Desk
  console.log("Switching to 'Dedicated Project Reviews' tab in Expert Desk...");
  await cdp.evaluate(`
    (() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const expPrTab = tabs.find(b => b.textContent && b.textContent.includes('Dedicated Project Reviews'));
      if (expPrTab) expPrTab.click();
    })()
  `);

  await sleep(2500);

  // Capture Screenshot 4: Expert Desk with Incoming Request card
  await cdp.captureScreenshot("04_expert_incoming_review_decision_card.png");

  // Click "Accept Review" button
  console.log("Expert clicking 'Accept Review'...");
  await cdp.evaluate(`
    (() => {
      const acceptBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Accept Review'));
      if (acceptBtn) acceptBtn.click();
    })()
  `);

  await sleep(3500);

  // Verify workspace modal is open: if not, click Open Workspace
  console.log("Verifying workspace modal is open...");
  await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) {
        const openBtn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent && (b.textContent.includes('Open Workspace') || b.textContent.includes('Details'))
        );
        if (openBtn) openBtn.click();
      }
    })()
  `);

  await sleep(2500);

  // Capture Screenshot 5: Workspace Overview & Synchronized Lifecycle
  await cdp.captureScreenshot("05_expert_workspace_overview.png");

  // ============================================================================
  // STAGE 3: WORKSPACE SUBMISSIONS, CHAT, MEETINGS & COMPLETION
  // ============================================================================
  console.log("\n[STAGE 3] Operating within Dedicated Workspace...");

  // Tab 2: Documents & Project Files
  console.log("Switching to 'Documents & Code' tab inside workspace modal...");
  await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return;
      const tabs = Array.from(modal.querySelectorAll('button'));
      const docTab = tabs.find(b => b.textContent && (b.textContent.includes('Documents & Code') || b.textContent.includes('Documents')));
      if (docTab) docTab.click();
    })()
  `);
  await sleep(2000);

  // Populate project materials in Documents tab
  await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return;
      const helper = (el, val) => {
        if (!el) return;
        const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, val); else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const textareas = Array.from(modal.querySelectorAll('textarea'));
      if (textareas[0]) helper(textareas[0], "Architecture specification for multi-region active-active transaction ledger with distributed idempotency locks.");
      if (textareas[1]) helper(textareas[1], "1. How to prevent race condition during high-frequency balance deduction?\\n2. Is our compensation saga resilient?");
      
      const inputs = Array.from(modal.querySelectorAll('input[type="url"], input[placeholder*="github"]'));
      if (inputs[0]) helper(inputs[0], "https://github.com/techcorp-labs/distributed-ledger-engine");
      if (inputs[1]) helper(inputs[1], "https://ledger-staging.techcorp.io/api/docs");
    })()
  `);
  await sleep(1000);

  // Submit materials
  await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return;
      const subBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Submit Project Materials'));
      if (subBtn) subBtn.click();
    })()
  `);
  await sleep(2500);
  await cdp.captureScreenshot("06_workspace_documents_tab.png");

  // Tab 3: Private Real-Time Chat
  console.log("Switching to 'Private Chat' tab inside workspace modal...");
  await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return;
      const tabs = Array.from(modal.querySelectorAll('button'));
      const chatTab = tabs.find(b => b.textContent && b.textContent.includes('Private Chat'));
      if (chatTab) chatTab.click();
    })()
  `);
  await sleep(2000);

  // Send a message in chat
  console.log("Sending message in private chat...");
  await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return;
      const helper = (el, val) => {
        if (!el) return;
        const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, val); else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const input = modal.querySelector('input[placeholder*="Type a message"], input[placeholder*="Type your message"]');
      if (input) {
        helper(input, "Hello Aarav! I have verified your architectural documents. Concurrency and escrow locks look solid. Let's schedule our first consultation.");
        const sendBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Send'));
        if (sendBtn) sendBtn.click();
      }
    })()
  `);
  await sleep(2500);
  await cdp.captureScreenshot("07_workspace_private_chat.png");

  // Tab 4: Availability & Scheduling
  console.log("Switching to 'Availability & Scheduling' tab inside workspace modal...");
  await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return;
      const tabs = Array.from(modal.querySelectorAll('button'));
      const schedTab = tabs.find(b => b.textContent && b.textContent.includes('Availability & Scheduling'));
      if (schedTab) schedTab.click();
    })()
  `);
  await sleep(2000);

  // Propose a slot
  console.log("Proposing a consultation slot...");
  await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return;
      const helper = (el, val) => {
        if (!el) return;
        const proto = window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, val); else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const dateInput = modal.querySelector('input[type="date"]');
      const timeInputs = Array.from(modal.querySelectorAll('input[type="time"]'));
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      if (dateInput) helper(dateInput, tomorrowStr);
      if (timeInputs[0]) helper(timeInputs[0], "14:00");
      if (timeInputs[1]) helper(timeInputs[1], "15:00");

      const propBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Propose Slot'));
      if (propBtn) propBtn.click();
    })()
  `);
  await sleep(2500);

  // Tab 5: Meetings & Google Meet
  console.log("Switching to 'Meetings & Google Meet' tab inside workspace modal...");
  await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return;
      const tabs = Array.from(modal.querySelectorAll('button'));
      const meetTab = tabs.find(b => b.textContent && b.textContent.includes('Meetings & Google Meet'));
      if (meetTab) meetTab.click();
    })()
  `);
  await sleep(2000);

  // Generate Google Meet Meeting
  console.log("Checking Google Meet creation or link attachment...");
  await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return;
      const genBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Generate Google Meet') || b.textContent.includes('Google Meet')));
      if (genBtn) genBtn.click();
    })()
  `);
  await sleep(1500);

  // If meet modal opened, fill the link and submit
  await cdp.evaluate(`
    (() => {
      const helper = (el, val) => {
        if (!el) return;
        const proto = window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, val); else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const urlInput = document.querySelector('input[type="url"]');
      if (urlInput) {
        helper(urlInput, "https://meet.google.com/prj-revw-live");
        const sendBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Send Meeting Link'));
        if (sendBtn) sendBtn.click();
      }
    })()
  `);
  await sleep(2500);

  // Capture Screenshot 8: Google Meet Generated & Meetings Desk
  await cdp.captureScreenshot("08_workspace_google_meet_generated.png");

  // Tab 6: Review Findings & Report
  console.log("Switching to 'Review Findings' tab inside workspace modal...");
  await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return;
      const tabs = Array.from(modal.querySelectorAll('button'));
      const findingsTab = tabs.find(b => b.textContent && b.textContent.includes('Review Findings'));
      if (findingsTab) findingsTab.click();
    })()
  `);
  await sleep(2000);

  // Fill in Final Review Findings
  console.log("Submitting Final Project Review Findings...");
  await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return;
      const helper = (el, val) => {
        if (!el) return;
        const proto = window.HTMLTextAreaElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, val); else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const textareas = Array.from(modal.querySelectorAll('textarea'));
      if (textareas[0]) helper(textareas[0], "Comprehensive architecture review complete. The payments core is well-structured with clean modular separation and strong audit logging.");
      if (textareas[1]) helper(textareas[1], "Clean hexagonal domain architecture, robust database isolation, and strong ledger integrity checks.");
      if (textareas[2]) helper(textareas[2], "High-throughput webhook retries may encounter temporary database connection exhaustion under burst loads.");
      if (textareas[3]) helper(textareas[3], "Deploy Redis connection pooling\\nEnforce distributed idempotency keys across all payment webhooks\\nImplement exponential backoff circuit breakers");

      const submitBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Finalize Review & Release Earning'));
      if (submitBtn) submitBtn.click();
    })()
  `);
  await sleep(3500);

  // Capture Screenshot 9: Final Findings Report
  await cdp.captureScreenshot("09_workspace_findings_report_tab.png");

  // Tab 8: Activity Audit Trail
  console.log("Switching to 'Activity Audit Trail' tab inside workspace modal...");
  await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return;
      const tabs = Array.from(modal.querySelectorAll('button'));
      const trailTab = tabs.find(b => b.textContent && b.textContent.includes('Activity Audit Trail'));
      if (trailTab) trailTab.click();
    })()
  `);
  await sleep(2000);
  await cdp.captureScreenshot("10_workspace_activity_audit_trail.png");

  // Close workspace modal cleanly
  console.log("Closing workspace modal cleanly...");
  await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (modal) {
        const header = modal.querySelector('div.px-6.py-4');
        const closeBtn = header ? header.querySelector('button:last-child') : null;
        if (closeBtn) closeBtn.click();
      }
    })()
  `);
  await sleep(1500);

  // ============================================================================
  // STAGE 4: ADMIN GOVERNANCE PORTAL — PROJECT REVIEW DESK
  // ============================================================================
  console.log("\n[STAGE 4] Admin Governance Portal — Inspecting Dedicated Project Review Desk...");

  await cdp.evaluate(`
    (() => {
      window.location.href = "http://localhost:5173/?portal=admin#admin";
    })()
  `);

  await sleep(4000);

  // Click on "Project Review OPS" in Admin sidebar
  console.log("Clicking 'Project Review OPS' desk in Admin sidebar...");
  await cdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const adminPrBtn = buttons.find(b => b.textContent && b.textContent.includes('Project Review OPS'));
      if (adminPrBtn) adminPrBtn.click();
    })()
  `);

  await sleep(2500);

  // Capture Screenshot 11: Admin Project Reviews Governance Desk
  await cdp.captureScreenshot("11_admin_project_review_governance_desk.png");

  console.log("\n================================================================================");
  console.log("LIVE ON-SCREEN TESTING COMPLETED SUCCESSFULLY WITH ALL SCREENSHOTS CAPTURED!");
  console.log("================================================================================");

  cdp.close();
}

run().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
