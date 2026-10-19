import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-dock-responsive-dark";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  const chromeProcess = spawn(CHROME_EXE, [
    `--remote-debugging-port=9266`,
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1440,900',
    'http://localhost:5173'
  ]);

  await sleep(2500);
  try {
    const res = await fetch('http://127.0.0.1:9266/json');
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

    // 1. Mobile Dark (375x812)
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(600);
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/dock_mobile_dark.png', Buffer.from(shot.data, 'base64'));

    // 2. Tablet Dark (768x1024)
    await send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      mobile: false
    });
    await sleep(600);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/dock_tablet_dark.png', Buffer.from(shot.data, 'base64'));

    // 3. Desktop Dark (1440x900)
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(600);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/dock_desktop_dark.png', Buffer.from(shot.data, 'base64'));

    console.log("Captured dark mode responsive shots successfully");
    ws.close();
  } catch (err) {
    console.error("Error:", err);
  } finally {
    chromeProcess.kill();
  }
}

run();
