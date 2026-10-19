import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-test-anim";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  const chromeProcess = spawn(CHROME_EXE, [
    `--remote-debugging-port=9277`,
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1440,900',
    'http://localhost:5173'
  ]);

  await sleep(2500);
  try {
    const res = await fetch('http://127.0.0.1:9277/json');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const send = (m, p = {}) => new Promise((resolve) => {
      const curId = id++;
      const handler = (ev) => {
        const data = JSON.parse(ev.data);
        if (data.id === curId) {
          ws.removeEventListener('message', handler);
          resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method: m, params: p }));
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await sleep(1500);

    // Test animating a button
    const result = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('button');
        return {
          tag: btn.tagName,
          classes: btn.className,
          computedTransform: window.getComputedStyle(btn).transform
        };
      })()`,
      returnByValue: true
    });
    console.log("Button sample:", result.result.value);

    ws.close();
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    chromeProcess.kill();
  }
}

run();
