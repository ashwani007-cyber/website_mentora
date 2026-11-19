import { spawn } from 'child_process';

async function run() {
  const CHROME_EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const p = spawn(CHROME_EXE, ['--remote-debugging-port=9229', '--headless=new', '--remote-allow-origins=*']);
  await new Promise(r => setTimeout(r, 1500));
  const v = await fetch('http://127.0.0.1:9229/json/version').then(r => r.json());
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const send = (m, params = {}) => new Promise(res => {
    const cid = id++;
    const h = ev => { const msg = JSON.parse(ev.data); if (msg.id === cid) { ws.removeEventListener('message', h); res(msg.result); } };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: cid, method: m, params }));
  });
  const c = await send('Target.createBrowserContext');
  const t = await send('Target.createTarget', { url: 'http://localhost:5173/#expert', browserContextId: c.browserContextId });
  const pws = new WebSocket('ws://127.0.0.1:9229/devtools/page/' + t.targetId);
  await new Promise(r => pws.onopen = r);
  let pid = 1;
  const psend = (m, params = {}) => new Promise(res => {
    const cid = pid++;
    const h = ev => { const msg = JSON.parse(ev.data); if (msg.id === cid) { pws.removeEventListener('message', h); res(msg.result); } };
    pws.addEventListener('message', h);
    pws.send(JSON.stringify({ id: cid, method: m, params }));
  });
  await psend('Page.enable');
  await psend('Runtime.enable');
  await psend('Runtime.evaluate', {
    expression: `
      localStorage.setItem('current_user_role', 'expert');
      localStorage.setItem('current_logged_in_expert', JSON.stringify({
        id: 'usr-86c1c358-aara',
        user_id: 'usr-86c1c358-aara',
        name: 'Aara',
        email: 'aara@gmail.com',
        baseRate: 225
      }));
      localStorage.setItem('current_page', 'expert');
      window.location.hash = '#expert';
      window.location.reload();
    `
  });
  await new Promise(r => setTimeout(r, 3500));
  const res = await psend('Runtime.evaluate', {
    expression: `(() => {
      const all = Array.from(document.querySelectorAll('div')).filter(d => d.innerText && d.innerText.includes('Allotted Slot: 2026-10-30'));
      return all.map(d => ({
        cls: d.className,
        hasInput: Boolean(d.querySelector('input')),
        hasAwaiting: d.innerText.includes('Awaiting Google Meet Link'),
        hasLinkSent: d.innerText.includes('Link Sent'),
        text: d.innerText.slice(0, 150)
      }));
    })()`,
    returnByValue: true
  });
  console.log('DOM matches:', JSON.stringify(res.result.value, null, 2));
  pws.close();
  ws.close();
  p.kill();
}

run().catch(console.error);
