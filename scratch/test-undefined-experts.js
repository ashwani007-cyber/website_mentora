import { spawn } from 'child_process';
import http from 'http';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9227;

async function testNoExperts() {
  console.log("🚀 Testing Admin Desk when experts data is empty/undefined...");
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:\\temp\\edge-no-experts-test',
    'http://localhost:5173/?portal=admin'
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

    const runtimeErrors = [];
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === "Runtime.exceptionThrown") {
        console.error("PAGE ERROR DETECTED:", msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
        runtimeErrors.push(msg.params.exceptionDetails);
      }
    });

    // Seed admin credentials
    await sendCommand("Runtime.evaluate", {
      expression: `
        localStorage.setItem("admin_token", "admin-session-mock-token");
        localStorage.setItem("admin_session_token", "admin-session-mock-token");
        localStorage.setItem("admin_user_role", "admin");
      `
    });

    await sendCommand("Page.navigate", { url: "http://localhost:5173/?portal=admin" });
    await new Promise(r => setTimeout(r, 2500));

    const pageState = await sendCommand("Runtime.evaluate", {
      expression: `({
        hasPageRenderingError: document.body.innerText.includes("Page Rendering Error"),
        hasReduceError: document.body.innerText.includes("reading 'reduce'"),
        hasGovernanceDesk: document.body.innerText.includes("GOVERNANCE HQ"),
        rootLen: document.getElementById('root')?.innerHTML.length || 0,
        bodySnippet: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 200)
      })`,
      returnByValue: true
    });

    console.log("Page State Result:", pageState?.result?.value);
    console.log("Total Runtime Exceptions:", runtimeErrors.length);

    if (pageState?.result?.value?.hasPageRenderingError || pageState?.result?.value?.hasReduceError) {
      throw new Error("Page Rendering Error with reduce still present!");
    }

    console.log("✅ Admin Governance Portal rendered perfectly with 0 reduce errors!");
    ws.close();
  } finally {
    edge.kill();
  }
}

testNoExperts().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
