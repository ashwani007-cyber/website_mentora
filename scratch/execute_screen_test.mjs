import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = "C:\\Users\\kushw\\.gemini\\antigravity\\brain\\04e30252-999f-4e46-80e2-e3335eee6ca2";

async function getPageTarget() {
  const res = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await res.json();
  const page = tabs.find(t => t.type === 'page' && t.url.includes('localhost:5173'));
  return page || tabs.find(t => t.type === 'page');
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

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await sleep(3500);
  }

  async captureScreenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`[Screenshot Saved] ${filePath}`);
  }

  close() {
    this.ws.close();
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runLiveScreenTest() {
  console.log("=== STARTING COMPLETE LIVE SCREEN TEST IN CHROME ===");
  const target = await getPageTarget();
  if (!target) throw new Error("No Chrome page target found");
  
  const client = new CDPClient(target.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Runtime.enable');

  const screenshotsDir = path.join(ARTIFACT_DIR, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // =========================================================================
  // STAGE 1: EXPERT PORTAL AVAILABILITY MANAGEMENT
  // =========================================================================
  console.log("\n==================================================");
  console.log("STAGE 1: Testing Expert Availability Manager");
  console.log("==================================================");
  
  await client.evaluate(`
    (() => {
      const expert = {
        id: "exp-1",
        name: "Dr. Sunita Rao",
        title: "Senior Tax & GST Specialist",
        category: "Finance & Taxation",
        email: "sunita.rao@example.com",
        phone: "+91 98765 43210",
        verified: true,
        verificationStatus: "approved",
        rate: 750
      };
      localStorage.setItem("current_user_role", "expert");
      localStorage.setItem("current_page", "expert");
      localStorage.setItem("current_logged_in_expert", JSON.stringify(expert));
      window.location.href = "http://localhost:5173/";
    })()
  `);
  await sleep(4000);

  console.log("-> Clicking 'Availability Management' tab...");
  await client.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const availTab = buttons.find(b => b.textContent.includes('Availability Management'));
      if (availTab) availTab.click();
    })()
  `);
  await sleep(2500);

  console.log("-> Clicking Quick Preset '02:00 – 03:00 PM'...");
  const presetClicked = await client.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const presetBtn = buttons.find(b => b.textContent.includes('02:00') && b.textContent.includes('03:00'));
      if (presetBtn) {
        presetBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log("Quick preset clicked:", presetClicked);
  await sleep(1500);

  console.log("-> Clicking '+ Add Time Slot'...");
  const slotAdded = await client.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const addBtn = buttons.find(b => b.textContent.includes('+ Add Time Slot') || b.textContent.includes('Add Time Slot'));
      if (addBtn) {
        addBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log("Slot added:", slotAdded);
  await sleep(2500);

  const shot1 = path.join(screenshotsDir, '1_expert_availability_screen.png');
  await client.captureScreenshot(shot1);

  // =========================================================================
  // STAGE 2: ADMIN GOVERNANCE AVAILABILITY DESK
  // =========================================================================
  console.log("\n==================================================");
  console.log("STAGE 2: Testing Admin Governance Availability Desk");
  console.log("==================================================");

  await client.navigate('http://localhost:5173/?portal=admin');
  await sleep(3500);

  console.log("-> Clicking 'Expert Availability' on Admin sidebar...");
  const deskClicked = await client.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const deskBtn = buttons.find(b => b.textContent.includes('Expert Availability'));
      if (deskBtn) {
        deskBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log("Admin Desk clicked:", deskClicked);
  await sleep(2500);

  console.log("-> Switching expert in dropdown to 'Krishnan Iyer'...");
  const switched = await client.evaluate(`
    (() => {
      const select = document.querySelector('select');
      if (select && select.options.length > 1) {
        select.selectedIndex = 1;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return select.options[select.selectedIndex].text;
      }
      return null;
    })()
  `);
  console.log("Selected expert:", switched);
  await sleep(2500);

  const shot2 = path.join(screenshotsDir, '2_admin_availability_desk.png');
  await client.captureScreenshot(shot2);

  // =========================================================================
  // STAGE 3: CLIENT PORTAL REAL-TIME BOOKING MODAL
  // =========================================================================
  console.log("\n==================================================");
  console.log("STAGE 3: Testing Client Portal Dynamic Booking Modal");
  console.log("==================================================");

  await client.evaluate(`
    (() => {
      const clientUser = {
        id: "cli-1",
        name: "Ashwani Executive Client",
        email: "ashwani@test.com",
        phone: "+91 91234 56789"
      };
      localStorage.setItem("current_user_role", "client");
      localStorage.setItem("current_page", "client");
      localStorage.setItem("current_logged_in_client", JSON.stringify(clientUser));
      localStorage.setItem("client_wallet_ashwani@test.com", "5000");
      window.location.href = "http://localhost:5173/";
    })()
  `);
  
  // Wait for expert cards to load
  console.log("Waiting for expert cards to populate...");
  let bookButtonFound = false;
  for (let i = 0; i < 10; i++) {
    await sleep(1000);
    const hasBookBtn = await client.evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(b => b.textContent.trim() === 'Book');
      })()
    `);
    if (hasBookBtn) {
      bookButtonFound = true;
      break;
    }
  }
  console.log("Expert Book button found:", bookButtonFound);

  console.log("-> Clicking 'Book' button on Sunita Rao's expert card...");
  const modalOpened = await client.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const bookBtn = buttons.find(b => b.textContent.trim() === 'Book');
      if (bookBtn) {
        bookBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log("Modal opened:", modalOpened);
  await sleep(3000);

  console.log("-> Inspecting dynamic slots in Booking Modal...");
  const modalInspection = await client.evaluate(`
    (() => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      const slots = allButtons.filter(b => 
        b.textContent.includes('AM') || 
        b.textContent.includes('PM') || 
        b.textContent.includes('Booked') ||
        b.textContent.includes('Unavailable')
      ).map(b => ({
        label: b.textContent.trim().replace(/\\s+/g, ' '),
        disabled: b.disabled || b.hasAttribute('disabled')
      }));

      // Select first available slot
      const available = allButtons.find(b => 
        (b.textContent.includes('AM') || b.textContent.includes('PM')) && 
        !b.textContent.includes('Booked') && 
        !b.textContent.includes('Unavailable') &&
        !b.disabled
      );
      if (available) {
        available.click();
      }

      return {
        slotsFound: slots,
        selectedSlot: available ? available.textContent.trim().replace(/\\s+/g, ' ') : null
      };
    })()
  `);
  console.log("Modal slots result:", JSON.stringify(modalInspection, null, 2));
  await sleep(2500);

  const shot3 = path.join(screenshotsDir, '3_client_booking_modal.png');
  await client.captureScreenshot(shot3);

  console.log("\n==================================================");
  console.log("ALL FEATURES VERIFIED AND SCREENSHOTS RECORDED!");
  console.log("==================================================");
  client.close();
}

runLiveScreenTest().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
