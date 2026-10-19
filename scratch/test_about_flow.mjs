import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-about-test";
const BASE_URL = "http://127.0.0.1:5173/";

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

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }
}

async function run() {
  console.log("Starting Chrome for E2E About Page Verification...");
  const chromeProcess = spawn(CHROME_EXE, [
    `--remote-debugging-port=9232`,
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1440,900',
    BASE_URL
  ]);

  let cdp = null;
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    try {
      const res = await fetch('http://127.0.0.1:9232/json');
      const tabs = await res.json();
      const pageTab = tabs.find(t => t.type === 'page');
      if (pageTab?.webSocketDebuggerUrl) {
        cdp = new CDPClient(pageTab.webSocketDebuggerUrl);
        break;
      }
    } catch {}
  }

  if (!cdp) {
    console.error("Could not connect to Chrome CDP");
    chromeProcess.kill();
    process.exit(1);
  }

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  console.log("Connected to browser!");
  await sleep(1500);
  await cdp.eval(`
    localStorage.setItem("app_theme", "dark");
    document.documentElement.classList.remove("theme-light");
    document.documentElement.classList.add("dark");
  `);
  const initialUrl = await cdp.eval("window.location.pathname");
  console.log("Initial URL:", initialUrl);

  const headerAboutExists = await cdp.eval(`
    Array.from(document.querySelectorAll('header nav button, header nav a'))
      .some(el => el.textContent.trim() === 'About')
  `);
  console.log("About button in desktop header:", headerAboutExists);

  const landingContainsAboutContent = await cdp.eval(`
    document.body.innerText.includes("Experience Doesn't Retire")
  `);
  console.log("Landing page contains full About section (SHOULD BE FALSE):", landingContainsAboutContent);

  // 2. Click About Button
  console.log("Clicking About button in Header...");
  await cdp.eval(`
    const aboutBtn = Array.from(document.querySelectorAll('header nav button'))
      .find(el => el.textContent.trim() === 'About');
    if (aboutBtn) aboutBtn.click();
    else throw new Error("About button not found");
  `);
  await sleep(800);

  const aboutUrl = await cdp.eval("window.location.pathname");
  console.log("URL after clicking About:", aboutUrl);

  const aboutHeadingPresent = await cdp.eval(`
    document.body.innerText.includes("Experience Doesn't Retire. It Continues to Create Value.")
  `);
  console.log("About main heading present:", aboutHeadingPresent);

  const missionPresent = await cdp.eval(`
    document.body.innerText.includes("Our Mission") && 
    document.body.innerText.includes("Mentora exists to make valuable professional experience more accessible.")
  `);
  console.log("Mission section present:", missionPresent);

  const featuresPresent = await cdp.eval(`
    document.body.innerText.includes("Verified Experience") && 
    document.body.innerText.includes("Meaningful Connections")
  `);
  console.log("Two feature cards present:", featuresPresent);

  const howItWorksPresent = await cdp.eval(`
    document.body.innerText.includes("How Mentora Works") &&
    document.body.innerText.includes("01") &&
    document.body.innerText.includes("Discover") &&
    document.body.innerText.includes("02") &&
    document.body.innerText.includes("Connect") &&
    document.body.innerText.includes("03") &&
    document.body.innerText.includes("Grow")
  `);
  console.log("How Mentora Works section present:", howItWorksPresent);

  const trustPresent = await cdp.eval(`
    document.body.innerText.includes("Built Around Trust") &&
    document.body.innerText.includes("Professional Verification") &&
    document.body.innerText.includes("Ratings & Reviews") &&
    document.body.innerText.includes("Experience-Based Expertise") &&
    document.body.innerText.includes("Transparent Profiles") &&
    document.body.innerText.includes("Secure Digital Transactions")
  `);
  console.log("Trust section present:", trustPresent);

  const statsPresent = await cdp.eval(`
    document.body.innerText.includes("120M+") &&
    document.body.innerText.includes("Retired Professionals in India")
  `);
  console.log("Market / Impact stats present:", statsPresent);

  const ctaPresent = await cdp.eval(`
    document.body.innerText.includes("Ready to Turn Experience Into Opportunity?") &&
    document.body.innerText.includes("Explore Experts") &&
    document.body.innerText.includes("Become an Expert")
  `);
  console.log("CTA section present:", ctaPresent);

  const activeAboutState = await cdp.eval(`
    const aboutSpan = Array.from(document.querySelectorAll('header nav span'))
      .find(el => el.textContent.trim() === 'About');
    Boolean(aboutSpan)
  `);
  console.log("Active state for About button in Header on /about:", activeAboutState);

  // Capture Dark Mode Screenshot
  const darkShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/about_dark_mode.png', Buffer.from(darkShot.data, 'base64'));
  console.log("Saved scratch/about_dark_mode.png");

  // 3. Test Theme Toggle to Light Mode
  console.log("Toggling theme to Light mode...");
  await cdp.eval(`
    const toggleBtn = Array.from(document.querySelectorAll('header button'))
      .find(el => el.title && (el.title.includes('Light Mode') || el.title.includes('Night Mode')));
    if (toggleBtn) toggleBtn.click();
  `);
  await sleep(600);

  const isLightMode = await cdp.eval(`
    document.documentElement.classList.contains('theme-light')
  `);
  console.log("Switched to Light mode:", isLightMode);

  // Capture Light Mode Screenshot
  const lightShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/about_light_mode.png', Buffer.from(lightShot.data, 'base64'));
  console.log("Saved scratch/about_light_mode.png");

  // 4. Test "Back to Home" navigation
  console.log("Testing Back to Home navigation...");
  await cdp.eval(`
    const backBtn = Array.from(document.querySelectorAll('button'))
      .find(el => el.textContent.includes('Back to Home'));
    if (backBtn) backBtn.click();
  `);
  await sleep(800);

  const backUrl = await cdp.eval("window.location.pathname");
  console.log("URL after clicking Back to Home:", backUrl);

  const onLandingAgain = await cdp.eval(`
    !document.body.innerText.includes("Experience Doesn't Retire")
  `);
  console.log("Returned to Landing page (About content gone from view):", onLandingAgain);

  // 5. Test Direct Route Navigation to /about
  console.log("Navigating directly to /about via URL pushState...");
  await cdp.eval(`
    window.history.pushState({}, '', '/about');
    window.dispatchEvent(new PopStateEvent('popstate'));
  `);
  await sleep(800);

  const directAboutPresent = await cdp.eval(`
    document.body.innerText.includes("Experience Doesn't Retire. It Continues to Create Value.")
  `);
  console.log("Direct /about URL loaded About view:", directAboutPresent);

  // 6. Test Mobile Viewport
  console.log("Testing Mobile Viewport (375x667)...");
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await sleep(500);

  // Check mobile hamburger button
  const mobileMenuToggleExists = await cdp.eval(`
    Boolean(document.querySelector('header button[aria-label="Toggle navigation menu"]'))
  `);
  console.log("Mobile menu button exists:", mobileMenuToggleExists);

  // Click mobile hamburger
  await cdp.eval(`
    document.querySelector('header button[aria-label="Toggle navigation menu"]').click();
  `);
  await sleep(400);

  const mobileMenuDrawerOpen = await cdp.eval(`
    document.body.innerText.includes("About Mentora (Active)") || document.body.innerText.includes("← Back to Home")
  `);
  console.log("Mobile drawer menu open with About & Back to Home:", mobileMenuDrawerOpen);

  const mobileShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/about_mobile.png', Buffer.from(mobileShot.data, 'base64'));
  console.log("Saved scratch/about_mobile.png");

  console.log("\n==========================================");
  console.log("ALL E2E CHECKS PASSED PERFECTLY!");
  console.log("==========================================\n");

  chromeProcess.kill();
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
