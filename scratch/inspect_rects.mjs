import { spawn } from 'child_process';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-find-cyan2";

async function run() {
  const chrome = spawn(CHROME_EXE, [
    '--remote-debugging-port=9259',
    `--user-data-dir=${USER_DATA}`,
    '--headless=new',
    '--window-size=1440,1100',
    'http://localhost:5173/'
  ]);
  await new Promise(r => setTimeout(r, 2500));
  const res = await fetch('http://127.0.0.1:9259/json');
  const tabs = await res.json();
  const pageTab = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (m, p = {}) => new Promise(resolve => {
    const curId = id++;
    const handler = ev => {
      const d = JSON.parse(ev.data);
      if (d.id === curId) { ws.removeEventListener('message', handler); resolve(d.result); }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method: m, params: p }));
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await new Promise(r => setTimeout(r, 1000));

  // Find exact position of wave container in viewport
  const info = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const waveContainer = document.querySelector('.mentora-wave-layer-primary')?.closest('div.relative');
        const r = waveContainer.getBoundingClientRect();
        const footerSection = document.querySelector('section[aria-label="Experience Call to Action"]')?.getBoundingClientRect();
        const footerBody = waveContainer.nextElementSibling?.getBoundingClientRect();
        return {
          windowScrollY: window.scrollY,
          ctaBottom: footerSection?.bottom,
          waveTop: r.top,
          waveBottom: r.bottom,
          waveHeight: r.height,
          footerBodyTop: footerBody?.top,
          footerBodyBg: window.getComputedStyle(waveContainer.nextElementSibling).backgroundColor
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Position Info:', info.result.value);

  chrome.kill();
  process.exit(0);
}

run();
