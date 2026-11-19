import { spawn } from 'child_process';

async function run() {
  const CHROME_EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const p = spawn(CHROME_EXE, ['--remote-debugging-port=9230', '--headless=new', '--remote-allow-origins=*']);
  await new Promise(r => setTimeout(r, 1500));
  const v = await fetch('http://127.0.0.1:9230/json/version').then(r => r.json());
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
  const t = await send('Target.createTarget', { url: 'http://localhost:5173/#client', browserContextId: c.browserContextId });
  const pws = new WebSocket('ws://127.0.0.1:9230/devtools/page/' + t.targetId);
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
      localStorage.clear();
      localStorage.setItem('current_user_role', 'client');
      localStorage.setItem('current_logged_in_client', JSON.stringify({
        id: '059fc01e-4a01-47a1-95d8-e881d1b5a262',
        name: 'Aman',
        email: 'aman@gmail.com'
      }));
      localStorage.setItem('current_page', 'client');
      window.location.hash = '#client';
      window.location.reload();
    `
  });
  await new Promise(r => setTimeout(r, 4000));
  const res = await psend('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('div')).filter(d => d.innerText && d.innerText.includes('Artificial Intelligence & ML Consultation'));
      return {
        url: window.location.href,
        hasClientHeader: document.body.innerText.includes('CLIENT PARTNER DESK'),
        cardsCount: cards.length,
        cards: cards.map(c => ({ cls: c.className, text: c.innerText.slice(0, 150) }))
      };
    })()`,
    returnByValue: true
  });
  console.log('Client result:', JSON.stringify(res.result.value, null, 2));
  pws.close();
  ws.close();
  p.kill();
}

run().catch(console.error);
