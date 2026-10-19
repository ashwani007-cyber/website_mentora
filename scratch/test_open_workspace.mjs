import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = "C:\\Users\\kushw\\.gemini\\antigravity\\brain\\39df65e9-97a5-40cc-874d-9ffcc6245c91";
const SCREENSHOTS_DIR = path.join(ARTIFACT_DIR, 'screenshots');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-auto-profile";

async function ensureChrome() {
  try {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    if (res.ok) return;
  } catch {}

  spawn(CHROME_EXE, [
    '--remote-debugging-port=9222',
    '--remote-allow-origins=*',
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--disable-fre',
    '--no-default-browser-check',
    '--start-maximized',
    'http://localhost:5173/'
  ], { detached: true, stdio: 'ignore' }).unref();

  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) return;
    } catch {}
  }
}

async function run() {
  await ensureChrome();
  const res = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await res.json();
  const page = tabs.find(t => t.type === 'page' && t.url && t.url.includes('localhost:5173')) || tabs[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise(r => ws.onopen = r);

  function evalExpression(expr) {
    return new Promise((resolve) => {
      const id = Math.floor(Math.random() * 100000);
      const onMsg = (evt) => {
        const d = JSON.parse(evt.data);
        if (d.id === id) {
          ws.removeEventListener('message', onMsg);
          resolve(d.result?.result?.value);
        }
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }));
    });
  }

  async function captureScreenshot(fileName) {
    const filePath = path.join(SCREENSHOTS_DIR, fileName);
    const data = await new Promise((resolve) => {
      const id = Math.floor(Math.random() * 100000);
      const onMsg = (evt) => {
        const d = JSON.parse(evt.data);
        if (d.id === id) {
          ws.removeEventListener('message', onMsg);
          resolve(d.result?.data);
        }
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method: 'Page.captureScreenshot', params: { format: 'png' } }));
    });
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    console.log(`[Screenshot Saved] -> ${fileName} (${fs.statSync(filePath).size} bytes)`);
  }

  console.log("Setting up Expert Portal...");
  await evalExpression(`
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
  `);

  await sleep(3500);

  console.log("Clicking 'Dedicated Project Reviews' tab...");
  await evalExpression(`
    const tabs = Array.from(document.querySelectorAll('button'));
    const prTab = tabs.find(b => b.textContent && b.textContent.includes('Dedicated Project Reviews'));
    if (prTab) prTab.click();
  `);

  await sleep(2500);

  const reviewState = await evalExpression(`
    (() => {
      const activeBtns = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
      const openBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Open Workspace'));
      return {
        hasOpenWorkspaceBtn: !!openBtn,
        buttons: activeBtns
      };
    })()
  `);
  console.log("Desk State:", JSON.stringify(reviewState, null, 2));

  console.log("Clicking 'Open Workspace' button...");
  const opened = await evalExpression(`
    (() => {
      const openBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Open Workspace'));
      if (openBtn) {
        openBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log("Open Workspace clicked:", opened);

  await sleep(3000);

  const modalCheck = await evalExpression(`
    (() => {
      const modal = document.querySelector('#project-review-workspace-root');
      return {
        found: !!modal,
        text: modal ? modal.textContent.slice(0, 150) : null
      };
    })()
  `);
  console.log("Workspace Modal Check:", JSON.stringify(modalCheck, null, 2));

  await captureScreenshot("05_expert_workspace_overview.png");

  // Tab 2: Documents & Code
  console.log("Switching to Documents & Code tab...");
  await evalExpression(`
    (() => {
      const modal = document.querySelector('#project-review-workspace-root');
      if (!modal) return;
      const docTab = Array.from(modal.querySelectorAll('button')).find(b => b.textContent.includes('Documents & Code'));
      if (docTab) docTab.click();
    })()
  `);
  await sleep(2000);
  await captureScreenshot("06_workspace_documents_tab.png");

  // Tab 3: Private Chat
  console.log("Switching to Private Chat tab...");
  await evalExpression(`
    (() => {
      const modal = document.querySelector('#project-review-workspace-root');
      if (!modal) return;
      const chatTab = Array.from(modal.querySelectorAll('button')).find(b => b.textContent.includes('Private Chat'));
      if (chatTab) chatTab.click();
    })()
  `);
  await sleep(2000);
  await captureScreenshot("07_workspace_private_chat.png");

  // Tab 4: Availability & Scheduling
  console.log("Switching to Availability & Scheduling tab...");
  await evalExpression(`
    (() => {
      const modal = document.querySelector('#project-review-workspace-root');
      if (!modal) return;
      const schedTab = Array.from(modal.querySelectorAll('button')).find(b => b.textContent.includes('Availability & Scheduling'));
      if (schedTab) schedTab.click();
    })()
  `);
  await sleep(2000);

  // Tab 5: Meetings & Google Meet
  console.log("Switching to Meetings & Google Meet tab...");
  await evalExpression(`
    (() => {
      const modal = document.querySelector('#project-review-workspace-root');
      if (!modal) return;
      const meetTab = Array.from(modal.querySelectorAll('button')).find(b => b.textContent.includes('Meetings & Google Meet'));
      if (meetTab) meetTab.click();
    })()
  `);
  await sleep(2000);
  await captureScreenshot("08_workspace_google_meet_generated.png");

  // Tab 6: Review Findings
  console.log("Switching to Review Findings tab...");
  await evalExpression(`
    (() => {
      const modal = document.querySelector('#project-review-workspace-root');
      if (!modal) return;
      const findingsTab = Array.from(modal.querySelectorAll('button')).find(b => b.textContent.includes('Review Findings'));
      if (findingsTab) findingsTab.click();
    })()
  `);
  await sleep(2000);
  await captureScreenshot("09_workspace_findings_report_tab.png");

  // Tab 8: Activity Audit Trail
  console.log("Switching to Activity Audit Trail tab...");
  await evalExpression(`
    (() => {
      const modal = document.querySelector('#project-review-workspace-root');
      if (!modal) return;
      const trailTab = Array.from(modal.querySelectorAll('button')).find(b => b.textContent.includes('Activity Audit Trail'));
      if (trailTab) trailTab.click();
    })()
  `);
  await sleep(2000);
  await captureScreenshot("10_workspace_activity_audit_trail.png");

  ws.close();
  console.log("Verification finished successfully!");
}

run().catch(console.error);
