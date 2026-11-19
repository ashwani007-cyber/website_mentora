import { spawn } from 'child_process';
import fs from 'fs';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-debug-inspect";
  fs.mkdirSync(USER_DATA, { recursive: true });

  const p = spawn(CHROME_EXE, [
    '--remote-debugging-port=9224',
    '--headless=new',
    '--remote-allow-origins=*',
    `--user-data-dir=${USER_DATA}`,
    'http://localhost:5173/'
  ], { detached: false, stdio: 'ignore' });

  await sleep(1500);
  const res = await fetch('http://127.0.0.1:9224/json/list');
  const tabs = await res.json();
  const page = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });

  let reqId = 1;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = reqId++;
    const handler = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('current_user_role', 'expert');
      localStorage.setItem('current_logged_in_expert', JSON.stringify({
        id: 'usr-86c1c358-aara',
        user_id: 'usr-86c1c358-aara',
        name: 'Aara',
        email: 'aara@gmail.com',
        specialty: 'AI & Machine Learning',
        baseRate: 225
      }));
      localStorage.setItem('current_page', 'expert');
      window.location.hash = '#expert';
      window.location.reload();
    `
  });

  await sleep(3500);

  const evalRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        return {
          url: window.location.href,
          title: document.title,
          expertStorage: localStorage.getItem('current_logged_in_expert'),
          currentUserRole: localStorage.getItem('current_user_role'),
          h1: document.querySelector('h1')?.innerText,
          meetInputCards: Array.from(document.querySelectorAll('input[placeholder*="meet.google.com"]')).map(inp => {
            let el = inp.parentElement;
            while (el && !el.innerText.includes('Allotted Slot')) el = el.parentElement;
            return el ? el.innerText : 'NO ALLOTTED PARENT';
          }),
          allInputs: Array.from(document.querySelectorAll('input')).map(i => ({ placeholder: i.placeholder, value: i.value, type: i.type })),
          allButtons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean)
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Result:', JSON.stringify(evalRes.result.value, null, 2));

  ws.close();
  p.kill();
}

run().catch(console.error);
