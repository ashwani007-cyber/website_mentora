import { spawn } from 'child_process';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-find-cyan";

async function run() {
  const chrome = spawn(CHROME_EXE, [
    '--remote-debugging-port=9258',
    `--user-data-dir=${USER_DATA}`,
    '--headless=new',
    '--window-size=1440,1100',
    'http://localhost:5173/'
  ]);
  await new Promise(r => setTimeout(r, 2500));
  const res = await fetch('http://127.0.0.1:9258/json');
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

  // Scroll wave into view
  await send('Runtime.evaluate', {
    expression: `
      const wave = document.querySelector('.mentora-wave-layer-primary');
      if (wave) wave.closest('div.relative').scrollIntoView({ behavior: 'instant', block: 'center' });
    `
  });
  await new Promise(r => setTimeout(r, 1000));

  const result = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const wave = document.querySelector('.mentora-wave-layer-primary')?.closest('div.relative');
        const waveRect = wave.getBoundingClientRect();
        
        // Check elements at bottom of wave
        const elAtBottom = document.elementFromPoint(720, waveRect.bottom - 1);
        const elJustBelow = document.elementFromPoint(720, waveRect.bottom + 2);
        
        // Find all SVG lines or borders
        const allSVGs = Array.from(document.querySelectorAll('svg')).map(s => ({
          class: s.className.baseVal || s.className,
          rect: s.getBoundingClientRect(),
          paths: Array.from(s.querySelectorAll('path')).map(p => ({
            d: p.getAttribute('d')?.slice(0, 40),
            stroke: p.getAttribute('stroke'),
            strokeWidth: p.getAttribute('stroke-width') || p.getAttribute('strokeWidth'),
            rect: p.getBoundingClientRect()
          }))
        }));

        return {
          waveRect,
          elAtBottom: { tag: elAtBottom?.tagName, class: elAtBottom?.className },
          elJustBelow: { tag: elJustBelow?.tagName, class: elJustBelow?.className },
          allSVGs
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Result:', JSON.stringify(result.result?.value, null, 2));
  chrome.kill();
  process.exit(0);
}

run();
