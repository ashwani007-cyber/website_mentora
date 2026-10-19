import { spawn } from 'child_process';
import http from 'http';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9228;

async function diagnose() {
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=C:\\temp\\edge-diag-${Date.now()}`,
    'http://localhost:5173/'
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

    const tab = tabs.find(t => t.type === 'page');
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

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === "Runtime.consoleAPICalled") {
        console.log(`[CONSOLE ${msg.params.type.toUpperCase()}]:`, msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' '));
      }
      if (msg.method === "Runtime.exceptionThrown") {
        console.log(`[EXCEPTION]:`, msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
      }
    });

    await sendCommand("Runtime.enable");
    await sendCommand("Page.enable");
    await sendCommand("Log.enable");

    await sendCommand("Page.navigate", { url: "http://localhost:5173/" });
    await new Promise(r => setTimeout(r, 4000));

    const html = await sendCommand("Runtime.evaluate", {
      expression: "document.getElementById('root')?.innerHTML.length"
    });
    console.log("Root innerHTML length:", html?.result?.value);

    ws.close();
  } finally {
    edge.kill();
  }
}

diagnose().catch(console.error);
