import { spawn } from 'child_process';
import http from 'http';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9222;

async function run() {
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:\\temp\\edge-test-profile',
    'http://localhost:5173/client'
  ]);

  console.log("Edge started, waiting for debugging port...");

  await new Promise(r => setTimeout(r, 2000));

  // Get WebSocket debugger URL
  const tabs = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}/json`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  console.log("Found tabs:", tabs.length);
  const tab = tabs.find(t => t.url.includes('localhost:5173') || t.type === 'page') || tabs[0];
  if (!tab || !tab.webSocketDebuggerUrl) {
    console.error("No debuggable tab found!");
    edge.kill();
    return;
  }

  const ws = new WebSocket(tab.webSocketDebuggerUrl);

  ws.addEventListener('open', () => {
    console.log("Connected to CDP WebSocket.");
    ws.send(JSON.stringify({ id: 1, method: "Runtime.enable" }));
    ws.send(JSON.stringify({ id: 2, method: "Log.enable" }));
    ws.send(JSON.stringify({ id: 3, method: "Page.enable" }));
  });

  const errors = [];
  const logs = [];

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === "Runtime.exceptionThrown") {
      console.error("PAGE RUNTIME EXCEPTION:", JSON.stringify(msg.params.exceptionDetails, null, 2));
      errors.push(msg.params.exceptionDetails);
    } else if (msg.method === "Runtime.consoleAPICalled") {
      const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      logs.push(`[${msg.params.type}] ${text}`);
      if (msg.params.type === 'error') {
        console.error("CONSOLE ERROR:", text);
        errors.push(text);
      } else {
        console.log("CONSOLE LOG:", text);
      }
    }
  });

  await new Promise(r => setTimeout(r, 4000));

  // Evaluate DOM state
  ws.send(JSON.stringify({
    id: 10,
    method: "Runtime.evaluate",
    params: {
      expression: `({
        title: document.title,
        rootHtmlLength: document.getElementById('root')?.innerHTML.length || 0,
        hasError: !!window.__last_react_error || !!window.__last_window_error,
        reactError: window.__last_react_error,
        windowError: window.__last_window_error,
        bodyText: document.body.innerText.slice(0, 300)
      })`,
      returnByValue: true
    }
  }));

  await new Promise(resolve => {
    const listener = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 10) {
        console.log("EVALUATION RESULT:", JSON.stringify(msg.result?.result?.value || msg, null, 2));
        ws.removeEventListener('message', listener);
        resolve();
      }
    };
    ws.addEventListener('message', listener);
  });

  ws.close();
  edge.kill();
  process.exit(0);
}

run().catch(err => {
  console.error("Script error:", err);
  process.exit(1);
});
