import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-wave-screenshots";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function capture() {
  const chromeProcess = spawn(CHROME_EXE, [
    `--remote-debugging-port=9262`,
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1440,1100',
    'http://localhost:5173/'
  ]);

  try {
    await sleep(2500);
    const res = await fetch('http://127.0.0.1:9262/json');
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
    await sleep(1000);

    // 1. Force Dark Mode
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('app_theme', 'dark');
        document.documentElement.classList.add('dark');
      `
    });
    await send('Page.reload');
    await sleep(2500);

    await send('Runtime.evaluate', {
      expression: `
        const cta = document.querySelector('section[aria-label="Experience Call to Action"]');
        if (cta) cta.scrollIntoView({ behavior: 'instant', block: 'start' });
      `
    });
    await sleep(1000);

    const darkShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve('scratch/footer_interactive_wave_dark.png'), Buffer.from(darkShot.data, 'base64'));
    console.log('Saved scratch/footer_interactive_wave_dark.png (True Dark Mode)');

    // 2. Force Light Mode
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('app_theme', 'light');
        document.documentElement.classList.remove('dark');
      `
    });
    await send('Page.reload');
    await sleep(2500);

    await send('Runtime.evaluate', {
      expression: `
        const cta = document.querySelector('section[aria-label="Experience Call to Action"]');
        if (cta) cta.scrollIntoView({ behavior: 'instant', block: 'start' });
      `
    });
    await sleep(1000);

    const lightShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve('scratch/footer_interactive_wave_light.png'), Buffer.from(lightShot.data, 'base64'));
    console.log('Saved scratch/footer_interactive_wave_light.png (True Light Mode)');

    ws.close();
  } finally {
    try {
      chromeProcess.kill();
    } catch (e) {}
  }
}

capture().then(() => {
  console.log('Done');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
