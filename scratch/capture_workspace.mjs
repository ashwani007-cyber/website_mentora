import fs from 'fs';
import path from 'path';

async function main() {
  const res = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await res.json();
  const pageTab = tabs.find(t => t.type === 'page' && t.url && t.url.includes('localhost:5173'));
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = Math.floor(Math.random() * 100000);
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // 1. Click "Dedicated Project Reviews" tab
  console.log("Clicking 'Dedicated Project Reviews'...");
  await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const prTab = buttons.find(b => b.textContent && b.textContent.includes('Dedicated Project Reviews'));
      if (prTab) prTab.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 2000));

  // 2. Find the workspace button for Kubernetes Architecture Review
  console.log("Looking for Open Workspace button...");
  const info = await send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('.border, [class*="card"]'))
        .filter(c => c.textContent.includes('Kubernetes Architecture Review'));
      return {
        cardCount: cards.length,
        cardText: cards.map(c => c.innerText.slice(0, 200))
      };
    })()`,
    returnByValue: true
  });
  console.log("Found cards:", JSON.stringify(info.result?.value, null, 2));

  // 3. Click Open Workspace on the accepted Kubernetes Architecture Review
  await send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('.border, div'))
        .filter(c => c.textContent.includes('Kubernetes Architecture Review'));
      for (const card of cards) {
        const openBtn = Array.from(card.querySelectorAll('button')).find(b => b.textContent.includes('Open Workspace'));
        if (openBtn) {
          openBtn.click();
          return "Clicked Open Workspace";
        }
      }
      return "Open Workspace button not found";
    })()`,
    returnByValue: true
  });
  await new Promise(r => setTimeout(r, 3000));

  // 4. Check workspace content
  const wsCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        hasWorkspace: !!document.querySelector('[class*="ProjectReviewWorkspace"], [class*="workspace"]'),
        headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5')).map(h => h.textContent.trim()),
        tabs: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => ['Overview', 'Documents & Code', 'Private Chat', 'Consultation Calls', 'Submit Findings', 'Escrow & Financials', 'Activity Log'].some(tab => t.includes(tab)))
      };
    })()`,
    returnByValue: true
  });
  console.log("Workspace check:", JSON.stringify(wsCheck.result?.value, null, 2));

  // 5. Screenshot
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const outPath = "C:\\Users\\kushw\\.gemini\\antigravity\\brain\\39df65e9-97a5-40cc-874d-9ffcc6245c91\\screenshots\\walkthrough_03_expert_workspace_active.png";
  fs.writeFileSync(outPath, Buffer.from(ss.data, 'base64'));
  console.log(`Saved screenshot to ${outPath} (${fs.statSync(outPath).size} bytes)`);

  ws.close();
}

main().catch(console.error);
