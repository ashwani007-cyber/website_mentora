import { spawn } from 'child_process';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-inspect-line";

async function run() {
  const chrome = spawn(CHROME_EXE, [
    '--remote-debugging-port=9257',
    `--user-data-dir=${USER_DATA}`,
    '--headless=new',
    'http://localhost:5173/'
  ]);
  await new Promise(r => setTimeout(r, 2500));
  const res = await fetch('http://127.0.0.1:9257/json');
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

  const check = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const waveContainer = document.querySelector('.mentora-wave-layer-primary')?.closest('div.relative');
        const svgs = document.querySelectorAll('svg');
        const paths = Array.from(document.querySelectorAll('path')).map(p => ({
          d: p.getAttribute('d')?.slice(0, 50),
          fill: p.getAttribute('fill'),
          stroke: p.getAttribute('stroke'),
          strokeWidth: p.getAttribute('stroke-width') || p.style.strokeWidth
        }));
        return {
          waveContainerClass: waveContainer?.className,
          waveContainerStyle: waveContainer?.getAttribute('style'),
          waveContainerRect: waveContainer?.getBoundingClientRect(),
          waveNextSibling: waveContainer?.nextElementSibling?.className,
          paths: paths.filter(p => p.stroke && p.stroke !== 'none')
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Inspection:', JSON.stringify(check.value, null, 2));
  chrome.kill();
  process.exit(0);
}

run();
