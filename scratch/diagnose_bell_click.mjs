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

async function runDiagnosis() {
  const client = await getCDPClient();

  console.log("\n--- TEST: Checking Client Portal Header Bell Button ---");
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

  const clientHeaderInfo = await client.evaluate(`(() => {
    // Find all bell buttons
    const bells = Array.from(document.querySelectorAll('button[title*="Notification"], button[aria-label="Notifications"]'));
    return bells.map(b => {
      const rect = b.getBoundingClientRect();
      const header = b.closest('header');
      return {
        text: b.textContent,
        inHeader: !!header,
        headerOverflow: header ? window.getComputedStyle(header).overflow : null,
        rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
      };
    });
  })()`);
  console.log("Client Portal Bells found:", JSON.stringify(clientHeaderInfo, null, 2));

  // Now click the bell that is inside <header>
  const clickResult = await client.evaluate(`(() => {
    const header = document.querySelector('header');
    if (!header) return { error: 'No header found' };
    const bellBtn = header.querySelector('button[title*="Notification"], button[aria-label="Notifications"]');
    if (!bellBtn) return { error: 'No bell button in header' };
    bellBtn.click();
    return { clicked: true };
  })()`);
  console.log("Click result on header bell:", clickResult);

  await sleep(1000);

  // Check if drawer is rendered and its visibility / overflow
  const drawerInfo = await client.evaluate(`(() => {
    const header = document.querySelector('header');
    const drawer = document.querySelector('div[style*="max-height"], div[style*="maxHeight"]') || 
                   Array.from(document.querySelectorAll('div')).find(d => d.textContent.includes('Notification Preferences') || d.textContent.includes('Notifications'));
    if (!drawer) return { drawerFound: false };
    const rect = drawer.getBoundingClientRect();
    const style = window.getComputedStyle(drawer);
    const headerRect = header ? header.getBoundingClientRect() : null;
    return {
      drawerFound: true,
      drawerRect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      headerRect: headerRect ? { x: headerRect.x, y: headerRect.y, w: headerRect.width, h: headerRect.height } : null,
      headerOverflow: header ? window.getComputedStyle(header).overflow : null,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      zIndex: style.zIndex
    };
  })()`);
  console.log("Drawer Info after click:", JSON.stringify(drawerInfo, null, 2));

  await client.captureScreenshot('client_bell_clicked_before_fix.png');

  console.log("\n--- TEST: Checking Expert Portal Header Bell Button ---");
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
  await sleep(2000);

  const expertClickResult = await client.evaluate(`(() => {
    const header = document.querySelector('header');
    if (!header) return { error: 'No header found' };
    const bellBtn = header.querySelector('button[title*="Notification"], button[aria-label="Notifications"]');
    if (!bellBtn) return { error: 'No bell button in header' };
    bellBtn.click();
    return { clicked: true };
  })()`);
  console.log("Expert click result on header bell:", expertClickResult);

  await sleep(1000);
  await client.captureScreenshot('expert_bell_clicked_before_fix.png');

  process.exit(0);
}

runDiagnosis().catch(e => {
  console.error("Diagnosis error:", e);
  process.exit(1);
});
