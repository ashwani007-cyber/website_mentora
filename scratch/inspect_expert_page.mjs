import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-auto-profile";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  try {
    await fetch('http://127.0.0.1:9222/json/version');
  } catch {
    spawn(CHROME_EXE, [
      '--remote-debugging-port=9222',
      '--remote-allow-origins=*',
      `--user-data-dir=${USER_DATA}`,
      '--start-maximized',
      'http://localhost:5173/'
    ], { detached: true, stdio: 'ignore' }).unref();
    await sleep(2000);
  }

  const res = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await res.json();
  const page = tabs.find(t => t.url.includes('localhost:5173')) || tabs[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise(r => ws.onopen = r);

  function evalExpression(expr) {
    return new Promise((resolve) => {
      const id = Math.floor(Math.random() * 100000);
      const onMsg = (evt) => {
        const d = JSON.parse(evt.data);
        if (d.id === id) {
          ws.removeEventListener('message', onMsg);
          resolve(d.result?.result?.value);
        }
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }));
    });
  }

  console.log("Navigating to Expert Desk as Sunita Rao...");
  await evalExpression(`
    localStorage.setItem("current_user_role", "expert");
    localStorage.setItem("current_page", "expert");
    localStorage.setItem("current_logged_in_expert", JSON.stringify({
      id: "exp-1",
      name: "Sunita Rao",
      email: "sunita.rao@registry.com",
      title: "Former Chief Financial Officer (Ex-CFO)",
      rate: 939,
      verified: true,
      verificationStatus: "approved"
    }));
    window.location.href = "http://localhost:5173/";
  `);

  await sleep(3000);

  console.log("Switching to Dedicated Project Reviews tab...");
  await evalExpression(`
    const tabs = Array.from(document.querySelectorAll('button'));
    const prTab = tabs.find(b => b.textContent && b.textContent.includes('Dedicated Project Reviews'));
    if (prTab) prTab.click();
  `);

  await sleep(2000);

  const domSummary = await evalExpression(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
      const headings = Array.from(document.querySelectorAll('h2, h3, h4')).map(h => h.textContent.trim());
      const cards = Array.from(document.querySelectorAll('.rounded-2xl')).map(c => c.textContent.trim().slice(0, 80));
      return { buttons, headings, cardCount: cards.length, cards: cards.slice(0, 5) };
    })()
  `);

  console.log("DOM Summary:", JSON.stringify(domSummary, null, 2));

  // Take screenshot
  const screenshotRes = await new Promise((resolve) => {
    const id = 999;
    const onMsg = (evt) => {
      const d = JSON.parse(evt.data);
      if (d.id === id) {
        ws.removeEventListener('message', onMsg);
        resolve(d.result?.data);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method: 'Page.captureScreenshot', params: { format: 'png' } }));
  });

  if (screenshotRes) {
    fs.writeFileSync("C:\\Users\\kushw\\.gemini\\antigravity\\brain\\39df65e9-97a5-40cc-874d-9ffcc6245c91\\screenshots\\test_inspect_desk.png", Buffer.from(screenshotRes, 'base64'));
    console.log("Saved test_inspect_desk.png");
  }

  ws.close();
}

run().catch(console.error);
