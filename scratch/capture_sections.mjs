import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-section-shots";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function capture() {
  const chromeProcess = spawn(CHROME_EXE, [
    `--remote-debugging-port=9234`,
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1440,900',
    'http://127.0.0.1:5173/about'
  ]);

  await sleep(2000);
  const res = await fetch('http://127.0.0.1:9234/json');
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

  // Scroll to Mission and Features
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 700);' });
  await sleep(600);
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/section_mission_features.png', Buffer.from(shot1.data, 'base64'));

  // Scroll to How it Works & Trust
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 1550);' });
  await sleep(600);
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/section_how_trust.png', Buffer.from(shot2.data, 'base64'));

  // Scroll to Stat & CTA
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 3100);' });
  await sleep(600);
  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/section_stat_cta.png', Buffer.from(shot3.data, 'base64'));

  // Scroll to Footer & Final CTA
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 4200);' });
  await sleep(600);
  const shot4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/section_bottom.png', Buffer.from(shot4.data, 'base64'));

  console.log('Saved all section screenshots!');
  chromeProcess.kill();
}

capture().catch(console.error);
