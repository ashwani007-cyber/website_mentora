import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = "C:\\Users\\kushw\\.gemini\\antigravity\\brain\\39df65e9-97a5-40cc-874d-9ffcc6245c91";
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

async function run() {
  const freshClientEmail = `client_demo_${Date.now()}@enterprise.com`;
  const expertEmail = 'jay@gmail.com';
  const expertId = 'usr-1788974684441';

  // 1. Create a truly fresh pending request
  const createRes = await fetch('http://[::1]:5173/api/project-reviews/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: `cli-${Date.now()}`,
      clientName: 'Alpha Corp Technologies',
      clientEmail: freshClientEmail,
      expertId,
      expertName: 'JK',
      expertEmail,
      expectedScope: 'Comprehensive Microservices & Kubernetes Audit + 2 Strategy Sessions',
      reviewType: 'High-Throughput Scalability & Database Assessment',
      requestNotes: 'Need urgent scalability review for upcoming high-traffic deployment. Infrastructure is deployed on AWS EKS with RDS PostgreSQL.',
      clientWalletBalance: 20000
    })
  });
  const data = await createRes.json();
  console.log("Created fresh pending review:", data.projectReview?.projectReviewId, "Status:", data.projectReview?.status);

  const res = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await res.json();
  const target = tabs.find(t => t.type === 'page' && t.url && t.url.includes('localhost:5173')) || tabs[0];
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

  // Open Expert Portal as Expert JK
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

  // Switch to Expert Portal -> Dedicated Project Reviews tab
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

  // Now click Accept Review
  console.log("Expert JK clicking Accept Review...");
  await client.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const acceptBtn = buttons.find(b => b.textContent && b.textContent.includes('Accept Review'));
      if (acceptBtn) acceptBtn.click();
    })()
  `);
  await sleep(3500);

  await client.captureScreenshot('walkthrough_03_expert_workspace_active.png');

  client.close();
  console.log("Done capturing fresh pending & accepted screenshots!");
}

run().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
