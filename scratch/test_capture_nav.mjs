import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-nav-test";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function capture() {
  const chromeProcess = spawn(CHROME_EXE, [
    `--remote-debugging-port=9244`,
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1440,900',
    'http://localhost:5173'
  ]);

  await sleep(2500);
  try {
    const res = await fetch('http://127.0.0.1:9244/json');
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
    await sleep(1500);

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/nav_before.png', Buffer.from(shot.data, 'base64'));
    console.log("Screenshot saved to scratch/nav_before.png");

    ws.close();
  } catch (err) {
    console.error("Error capturing:", err);
  } finally {
    chromeProcess.kill();
  }
}

capture();
