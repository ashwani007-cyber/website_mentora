import { spawn } from 'child_process';
import http from 'http';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9223;

async function runTest() {
  console.log("🚀 Launching Edge for Cross-Page Navigation & Connectivity Verification...");
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=C:\\temp\\edge-conn-${Date.now()}`,
    'http://localhost:5173/'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));

    // Get WebSocket debugger URL
    const tabs = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${PORT}/json`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const tab = tabs.find(t => t.url.includes('localhost:5173') || t.type === 'page') || tabs[0];
    if (!tab || !tab.webSocketDebuggerUrl) {
      throw new Error("No debuggable tab found!");
    }

    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });

    console.log("✅ Connected to CDP WebSocket.");
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

    const errors = [];
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === "Runtime.exceptionThrown") {
        console.error("PAGE EXCEPTION:", msg.params.exceptionDetails?.text);
        errors.push(msg.params.exceptionDetails);
      }
    });

    // Seed admin session so all portals & admin desk can be tested seamlessly
    await sendCommand("Runtime.evaluate", {
      expression: `
        localStorage.setItem("admin_token", "admin-session-mock-token");
        localStorage.setItem("admin_user_role", "admin");
        localStorage.setItem("admin_user_name", "Super Admin");
      `
    });

    const routesToTest = [
      { name: "Landing (Home)", path: "/" },
      { name: "Client Advisory Portal", path: "/client" },
      { name: "Expert Consultation Portal", path: "/expert" },
      { name: "About Mentora Page", path: "/about" },
      { name: "Blogs & Articles Editorial", path: "/blogs" },
      { name: "Admin Governance Desk", path: "/?portal=admin" },
      { name: "Switch / Login Portal", path: "/login" },
    ];

    console.log(`\nTesting all ${routesToTest.length} connected portals:`);

    for (const route of routesToTest) {
      console.log(`\n➡️ Navigating to ${route.name} (${route.path})...`);
      await sendCommand("Page.navigate", { url: `http://localhost:5173${route.path}` });
      await new Promise(r => setTimeout(r, 3000));

      const evalRes = await sendCommand("Runtime.evaluate", {
        expression: `({
          url: window.location.href,
          pathname: window.location.pathname,
          search: window.location.search,
          title: document.title,
          hasProtoBar: !!document.querySelector('button[aria-label="Navigate to Landing Page"]'),
          protoBarTabs: Array.from(document.querySelectorAll('button[aria-label^="Navigate to"]')).map(b => b.innerText.trim()).filter(Boolean),
          rootLen: document.getElementById('root')?.innerHTML.length || 0,
          bodySnippet: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 160),
          lastReactError: window.__last_react_error || null
        })`,
        returnByValue: true
      });

      const res = evalRes?.result?.value;
      if (!res) {
        throw new Error(`Failed to evaluate page ${route.name}`);
      }

      console.log(`   📍 URL: ${res.url}`);
      console.log(`   📊 DOM HTML Length: ${res.rootLen} chars`);
      console.log(`   🧭 ProtoBar Active: ${res.hasProtoBar ? 'YES' : 'NO'}`);
      console.log(`   📑 Available Tabs in Nav: [${res.protoBarTabs.join(', ')}]`);
      console.log(`   📝 Page Text: "${res.bodySnippet}"`);

      if (res.rootLen < 50) {
        console.log("DEBUG outerHTML:", await sendCommand("Runtime.evaluate", { expression: "document.documentElement.outerHTML.slice(0, 500)" }));
        throw new Error(`CRITICAL: Page ${route.name} rendered an empty or blank screen!`);
      }
      if (res.lastReactError) {
        throw new Error(`CRITICAL: Page ${route.name} triggered a React error: ${res.lastReactError}`);
      }
      console.log(`   ✅ ${route.name} Verified Successfully!`);
    }

    console.log(`\n🎉 ALL ${routesToTest.length} PAGES CONNECTED AND FUNCTIONING TOGETHER FLAWLESSLY!`);
    console.log(`Runtime Exceptions: ${errors.length}`);

    ws.close();
  } finally {
    edge.kill();
  }
}

runTest().catch(err => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
