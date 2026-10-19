import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-vite-reload-test";
const BASE_URL = "http://127.0.0.1:5173/";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.events = [];
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
    });
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method) {
        this.events.push(msg);
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
    return res.result ? res.result.value : undefined;
  }
}

async function checkViteReload() {
  const chrome = spawn(CHROME_EXE, [
    '--remote-debugging-port=9222',
    '--remote-allow-origins=*',
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1440,900',
    BASE_URL
  ]);

  await sleep(2500);

  try {
    const res = await fetch('http://127.0.0.1:9222/json/list');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page');

    const client = new CDPClient(pageTab.webSocketDebuggerUrl);
    await client.send('Page.enable');

    console.log("Listening to Page events...");
    let reloaded = false;
    client.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Page.frameNavigated') {
        console.log(">>> [EVENT] Page.frameNavigated!", msg.params.frame.url);
        reloaded = true;
      }
    });

    console.log("Simulating a write to db.json (touching timestamp in db.json)...");
    const dbPath = 'A:/Ashwani/db.json';
    const dbContent = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    dbContent._lastTouch = Date.now();
    fs.writeFileSync(dbPath, JSON.stringify(dbContent, null, 2), 'utf8');

    console.log("Waiting 3 seconds to see if Vite reloads page...");
    await sleep(3000);

    console.log("Did page reload when db.json was touched?", reloaded);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    chrome.kill();
  }
}

checkViteReload();
