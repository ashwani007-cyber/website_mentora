import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-fullshot";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function capture() {
  const chromeProcess = spawn(CHROME_EXE, [
    `--remote-debugging-port=9233`,
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1440,2500',
    'http://127.0.0.1:5173/about'
  ]);

  await sleep(2000);
  const res = await fetch('http://127.0.0.1:9233/json');
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

  // Dark full page
  const darkShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync('scratch/about_full_dark.png', Buffer.from(darkShot.data, 'base64'));
  console.log('Saved scratch/about_full_dark.png');

  // Switch to light
  await send('Runtime.evaluate', {
    expression: `
      document.documentElement.classList.add('theme-light');
      document.documentElement.classList.remove('dark');
      const toggle = Array.from(document.querySelectorAll('header button')).find(b => b.title && b.title.includes('Light Mode'));
      if (toggle) toggle.click();
    `
  });
  await sleep(800);

  // Light full page
  const lightShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync('scratch/about_full_light.png', Buffer.from(lightShot.data, 'base64'));
  console.log('Saved scratch/about_full_light.png');

  chromeProcess.kill();
}

capture().catch(console.error);
