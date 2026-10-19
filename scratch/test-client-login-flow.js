import { spawn } from 'child_process';
import http from 'http';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9225;

async function testClientLogin() {
  console.log("🚀 Testing Client login flow in browser...");
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:\\temp\\edge-client-test-profile',
    'http://localhost:5173/login'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const tabs = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${PORT}/json`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const tab = tabs.find(t => t.url.includes('localhost:5173') || t.type === 'page') || tabs[0];
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });

    let msgId = 1;
    function sendCommand(method, params = {}) {
      const id = ++msgId;
      return new Promise((resolve, reject) => {
        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === id) {
            ws.removeEventListener('message', handler);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await sendCommand("Runtime.enable");
    await sendCommand("Page.enable");

    await sendCommand("Runtime.evaluate", {
      expression: `
        window.__alert_calls = [];
        window.alert = function(msg) {
          console.log("ALERT:", msg);
          window.__alert_calls.push(msg);
        };
      `
    });

    await new Promise(r => setTimeout(r, 1500));

    // Register a fresh test client account
    const testEmail = `testclient_${Date.now()}@corporate.com`;
    console.log(`Registering new client: ${testEmail}...`);

    await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const regTab = buttons.find(b => b.innerText.includes('Register') || b.innerText.includes('1.'));
        if (regTab) regTab.click();

        await new Promise(r => setTimeout(r, 300));

        const nameInp = document.querySelector('input[placeholder*="Name" i]') || document.querySelectorAll('input')[0];
        const emailInp = document.querySelector('input[type="email"]');
        const passInp = document.querySelector('input[type="password"]');

        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        if (nameInp) {
          nativeInputValueSetter.call(nameInp, 'Enterprise Test Client');
          nameInp.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (emailInp) {
          nativeInputValueSetter.call(emailInp, '${testEmail}');
          emailInp.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (passInp) {
          nativeInputValueSetter.call(passInp, 'ClientPass123!');
          passInp.dispatchEvent(new Event('input', { bubbles: true }));
        }

        await new Promise(r => setTimeout(r, 300));
        const submitBtn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Register') || b.innerText.includes('Step 1'));
        if (submitBtn) submitBtn.click();
      })()`,
      awaitPromise: true
    });

    console.log("Waiting 5s for registration and redirect to Client Advisory...");
    await new Promise(r => setTimeout(r, 5000));

    const clientState = await sendCommand("Runtime.evaluate", {
      expression: `({
        currentUrl: window.location.href,
        currentPath: window.location.pathname,
        alerts: window.__alert_calls,
        local_current_user_role: localStorage.getItem('current_user_role'),
        local_current_page: localStorage.getItem('current_page'),
        rootLen: document.getElementById('root')?.innerHTML.length || 0,
        hasAuthModal: !!document.querySelector('div[class*="fixed inset-0"]'),
        bodySnippet: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 250)
      })`,
      returnByValue: true
    });

    console.log("\nCLIENT PORTAL STATE:", JSON.stringify(clientState?.result?.value, null, 2));

    ws.close();
  } finally {
    edge.kill();
  }
}

testClientLogin().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
