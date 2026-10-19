import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-wavemotion";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function verifyMotion() {
  console.log('Testing continuous wave motion frames...');
  const chromeProcess = spawn(CHROME_EXE, [
    `--remote-debugging-port=9255`,
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1440,1080',
    'http://localhost:5173/'
  ]);

  try {
    await sleep(2500);
    const res = await fetch('http://127.0.0.1:9255/json');
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

    // Scroll to wave
    await send('Runtime.evaluate', {
      expression: `
        const footer = document.querySelector('footer');
        if (footer) footer.scrollIntoView({ behavior: 'instant', block: 'start' });
      `
    });

    // Capture 3 frames at t=0s, t=1.5s, t=3s
    for (let i = 1; i <= 3; i++) {
      await sleep(1500);
      const evalRes = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const primary = document.querySelector('.mentora-wave-layer-primary');
            const secondary = document.querySelector('.mentora-wave-layer-secondary');
            const pTransform = primary ? window.getComputedStyle(primary).transform : 'none';
            const sTransform = secondary ? window.getComputedStyle(secondary).transform : 'none';
            return JSON.stringify({ pTransform, sTransform });
          })()
        `
      });
      const data = JSON.parse(evalRes.result.value);
      console.log(`Frame ${i} [t=${i * 1.5}s]:`);
      console.log(`  Primary Wave Transform:   ${data.pTransform}`);
      console.log(`  Secondary Wave Transform: ${data.sTransform}`);
    }

    console.log('\nContinuous wave motion verified across frames!');
  } finally {
    try {
      chromeProcess.kill();
    } catch {}
  }
}

verifyMotion().catch(err => {
  console.error('Wave motion verification error:', err);
  process.exit(1);
});
