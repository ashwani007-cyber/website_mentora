import { spawn } from 'child_process';
import http from 'http';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9224;

async function testLoginFlow() {
  console.log("🚀 Testing real user login flow in browser...");
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:\\temp\\edge-login-test-profile',
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

    // Override window.alert to not block execution
    await sendCommand("Runtime.evaluate", {
      expression: `
        window.__alert_calls = [];
        window.alert = function(msg) {
          console.log("ALERT:", msg);
          window.__alert_calls.push(msg);
        };
      `
    });

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === "Runtime.consoleAPICalled") {
        console.log("BROWSER CONSOLE:", msg.params.args.map(a => a.value || a.description).join(' '));
      } else if (msg.method === "Runtime.exceptionThrown") {
        console.error("BROWSER EXCEPTION:", JSON.stringify(msg.params.exceptionDetails));
      }
    });

    await new Promise(r => setTimeout(r, 2000));

    // Fill in email and password and submit
    console.log("Filling in login credentials...");
    const fillRes = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        // Find email input and password input
        const emailInput = document.querySelector('input[type="email"]') || document.querySelector('input[placeholder*="email" i]');
        const passInput = document.querySelector('input[type="password"]') || document.querySelectorAll('input')[document.querySelectorAll('input').length - 1];
        
        // Find 'Sign In' tab if on signup mode
        const buttons = Array.from(document.querySelectorAll('button'));
        const signInTab = buttons.find(b => b.innerText.includes('Sign In') || b.innerText.includes('2.'));
        if (signInTab) {
          signInTab.click();
        }

        await new Promise(r => setTimeout(r, 400));

        const emailInp = document.querySelector('input[type="email"]');
        const passInp = document.querySelector('input[type="password"]');

        if (!emailInp || !passInp) {
          return { error: "Inputs not found", foundButtons: buttons.map(b => b.innerText.slice(0, 30)) };
        }

        // Set values using React setter simulation
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(emailInp, 'kushwahaashwani12@gmail.com');
        emailInp.dispatchEvent(new Event('input', { bubbles: true }));

        nativeInputValueSetter.call(passInp, 'H@a#n&u*m$a%n/J!i12/07/2006');
        passInp.dispatchEvent(new Event('input', { bubbles: true }));

        await new Promise(r => setTimeout(r, 400));

        // Find submit button
        const submitBtn = Array.from(document.querySelectorAll('button[type="submit"]'))[0] || 
                          Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sign In') || b.innerText.includes('Step 2') || b.innerText.includes('Access'));
        
        if (!submitBtn) {
          return { error: "Submit button not found" };
        }

        console.log("Clicking submit button:", submitBtn.innerText);
        submitBtn.click();
        return { success: true, submitBtnText: submitBtn.innerText };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    console.log("Fill and submit result:", fillRes?.result?.value);

    // Wait for login processing and navigation
    console.log("Waiting 5s for navigation...");
    await new Promise(r => setTimeout(r, 5000));

    // Check state now
    const stateRes = await sendCommand("Runtime.evaluate", {
      expression: `({
        currentUrl: window.location.href,
        currentPath: window.location.pathname,
        currentSearch: window.location.search,
        alerts: window.__alert_calls,
        local_admin_token: localStorage.getItem('admin_token'),
        local_admin_user_role: localStorage.getItem('admin_user_role'),
        local_current_user_role: localStorage.getItem('current_user_role'),
        local_current_page: localStorage.getItem('current_page'),
        local_current_admin_page: localStorage.getItem('current_admin_page'),
        rootLen: document.getElementById('root')?.innerHTML.length || 0,
        bodyTextSnippet: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 300),
        hasAuthModal: !!document.querySelector('div[class*="fixed inset-0"]'),
        visibleModalText: document.querySelector('div[class*="fixed inset-0"]')?.innerText.replace(/\\s+/g, ' ').slice(0, 200) || null
      })`,
      returnByValue: true
    });

    console.log("\nSTATE AFTER LOGIN:", JSON.stringify(stateRes?.result?.value, null, 2));

    ws.close();
  } finally {
    edge.kill();
  }
}

testLoginFlow().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
