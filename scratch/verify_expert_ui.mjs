import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = "C:\\Users\\kushw\\.gemini\\antigravity\\brain\\04e30252-999f-4e46-80e2-e3335eee6ca2";

async function verify() {
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

  const capture = (filename) => new Promise((resolve) => {
    const id = Math.floor(Math.random() * 100000);
    const handler = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'screenshots', filename), Buffer.from(msg.result.data, 'base64'));
        resolve();
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method: 'Page.captureScreenshot', params: { format: 'png' } }));
  });

  console.log("Navigating to Expert Portal (default main view)...");
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

  await new Promise(r => setTimeout(r, 3500));

  // Verify availability calendar & slots exist on default dashboard
  const defaultDashboardCheck = await evalCode(`
    (() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => h.textContent.trim());
      const hasSlotHeader = headings.some(h => h.includes('Slot Availability Management'));
      const hasConfiguredSlots = headings.some(h => h.includes('Configured Time Slots'));
      const hasCalendar = !!document.querySelector('button[title="Next Month"], button[title="Previous Month"]') || headings.some(h => h.includes('2026'));
      return { hasSlotHeader, hasConfiguredSlots, hasCalendar, headings };
    })()
  `);
  console.log("Check on default dashboard:", defaultDashboardCheck);

  await capture('verified_expert_dashboard_availability.png');
  console.log("Saved verified_expert_dashboard_availability.png!");

  // Now click Availability Management tab
  console.log("Clicking 'Availability Management' tab...");
  await evalCode(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Availability Management'));
      const tabBtn = btns[btns.length - 1];
      if (tabBtn) tabBtn.click();
    })()
  `);

  await new Promise(r => setTimeout(r, 2000));
  await capture('verified_expert_full_tab_availability.png');
  console.log("Saved verified_expert_full_tab_availability.png!");

  ws.close();
}

verify().catch(console.error);
