import http from 'http';

// Helper to query targets
async function getPageTarget() {
  const res = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await res.json();
  const page = tabs.find(t => t.type === 'page' && t.url.includes('localhost:5173'));
  return page || tabs.find(t => t.type === 'page');
}

export class CDPClient {
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
    return await this.send('Page.navigate', { url });
  }

  async captureScreenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const fs = await import('fs');
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  const target = await getPageTarget();
  console.log('Target found:', target.title, target.url);
  const client = new CDPClient(target.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  
  const title = await client.evaluate('document.title');
  console.log('Evaluated document title:', title);

  client.close();
}

if (process.argv[1]?.endsWith('test_browser_features.mjs')) {
  main().catch(console.error);
}
