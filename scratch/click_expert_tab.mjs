import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = "C:\\Users\\kushw\\.gemini\\antigravity\\brain\\04e30252-999f-4e46-80e2-e3335eee6ca2";

async function run() {
  const res = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await res.json();
  const page = tabs.find(t => t.type === 'page' && t.url.includes('localhost:5173'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  const evalCode = (code) => new Promise((resolve) => {
    const id = Math.floor(Math.random() * 100000);
    const handler = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        resolve(msg.result?.result?.value);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: { expression: code, returnByValue: true, awaitPromise: true }
    }));
  });

  // Ensure expert page
  console.log("Setting expert session...");
  await evalCode(`
    const expert = {
      id: "exp-1",
      name: "Dr. Sunita Rao",
      title: "Senior Tax & GST Specialist",
      category: "Finance & Taxation",
      email: "sunita.rao@example.com",
      phone: "+91 98765 43210",
      verified: true,
      verificationStatus: "approved",
      rate: 750
    };
    localStorage.setItem("current_user_role", "expert");
    localStorage.setItem("current_page", "expert");
    localStorage.setItem("current_logged_in_expert", JSON.stringify(expert));
    window.location.href = "http://localhost:5173/";
  `);

  await new Promise(r => setTimeout(r, 3000));

  console.log("Finding all Availability buttons...");
  const buttons = await evalCode(`
    Array.from(document.querySelectorAll('button'))
      .map((b, i) => ({ index: i, text: b.textContent.trim() }))
      .filter(b => b.text.includes('Availability'))
  `);
  console.log("Found buttons:", buttons);

  console.log("Clicking the top tab button...");
  const clicked = await evalCode(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Availability Management'));
      // The tab button is usually the second one (first is aside)
      const target = btns[btns.length - 1];
      if (target) {
        target.click();
        return target.textContent.trim();
      }
      return null;
    })()
  `);
  console.log("Clicked:", clicked);

  await new Promise(r => setTimeout(r, 2000));

  console.log("Capturing screenshot of Expert Availability screen...");
  const screenshotRes = await new Promise((resolve) => {
    const id = 999;
    const handler = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        resolve(msg.result.data);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method: 'Page.captureScreenshot', params: { format: 'png' } }));
  });

  fs.writeFileSync(path.join(ARTIFACT_DIR, 'screenshots', '1_expert_availability_screen.png'), Buffer.from(screenshotRes, 'base64'));
  console.log("Updated 1_expert_availability_screen.png!");

  ws.close();
}

run().catch(console.error);
