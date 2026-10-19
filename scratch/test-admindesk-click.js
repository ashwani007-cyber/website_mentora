import { spawn } from 'child_process';
import http from 'http';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9226;

async function testAdminDeskFromClient() {
  console.log("🚀 Testing: Clicking 'Admin Desk' from /client in browser...");
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:\\temp\\edge-admindesk-click-profile',
    'http://localhost:5173/client'
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

    // First, seed the state exactly like the user's screenshot: on /client with client data AND admin token from previous login
    await sendCommand("Runtime.evaluate", {
      expression: `
        localStorage.setItem("current_user_role", "client");
        localStorage.setItem("admin_user_role", "admin");
        localStorage.setItem("admin_token", "test-admin-session-token");
        localStorage.setItem("admin_session_token", "test-admin-session-token");
      `
    });

    await sendCommand("Page.navigate", { url: "http://localhost:5173/client" });
    await new Promise(r => setTimeout(r, 2500));

    console.log("On client page. Now clicking 'Admin Desk' button...");
    const clickRes = await sendCommand("Runtime.evaluate", {
      expression: `(() => {
        const adminButtons = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Admin Desk') || b.innerText.includes('Admin'));
        if (adminButtons.length === 0) return { error: "No Admin button found" };
        
        console.log("Found admin buttons:", adminButtons.length);
        adminButtons[0].click();
        return { success: true, clicked: adminButtons[0].innerText };
      })()`,
      returnByValue: true
    });

    console.log("Click result:", clickRes?.result?.value);

    await new Promise(r => setTimeout(r, 3000));

    const finalState = await sendCommand("Runtime.evaluate", {
      expression: `({
        currentUrl: window.location.href,
        currentPath: window.location.pathname,
        currentSearch: window.location.search,
        local_current_user_role: localStorage.getItem('current_user_role'),
        local_admin_user_role: localStorage.getItem('admin_user_role'),
        rootLen: document.getElementById('root')?.innerHTML.length || 0,
        hasGovernanceDesk: !!document.querySelector('header')?.innerText.includes('Governance HQ') || document.body.innerText.includes('Executive Command Center') || document.body.innerText.includes('Overview & KPIs'),
        bodySnippet: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 300)
      })`,
      returnByValue: true
    });

    console.log("\nFINAL STATE AFTER CLICKING ADMIN DESK:", JSON.stringify(finalState?.result?.value, null, 2));

    ws.close();
  } finally {
    edge.kill();
  }
}

testAdminDeskFromClient().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
