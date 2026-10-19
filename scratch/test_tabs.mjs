import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-tabs-test";

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  const chromeProcess = spawn(CHROME_EXE, [
    '--remote-debugging-port=9299',
    '--user-data-dir=' + USER_DATA,
    '--headless=new',
    '--window-size=1440,900',
    'http://localhost:5173/expert'
  ]);

  await sleep(3000);
  try {
    const res = await fetch('http://127.0.0.1:9299/json');
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
    await sleep(2000);

    // 1. Click Availability Management Tab
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Availability Management'));
        if (btn) btn.click();
      })()`
    });
    await sleep(1000);
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/expert_availability_tab.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved availability tab screenshot');

    // 2. Click Dedicated Project Reviews Tab
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Dedicated Project Reviews'));
        if (btn) btn.click();
      })()`
    });
    await sleep(1000);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/expert_project_reviews_tab.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved project reviews tab screenshot');

    ws.close();
  } catch (err) {
    console.error(err);
  } finally {
    chromeProcess.kill();
  }
}

run();
