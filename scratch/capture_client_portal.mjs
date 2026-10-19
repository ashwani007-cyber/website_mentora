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

  console.log("Setting localStorage for Client ABC...");
  await send('Runtime.evaluate', {
    expression: `(() => {
      localStorage.setItem("current_user_role", "client");
      localStorage.setItem("current_page", "client");
      localStorage.setItem("current_logged_in_client", JSON.stringify({
        id: "cli-abc-test",
        name: "Client ABC",
        email: "client_abc@enterprise.com",
        company: "ABC Enterprise Corp",
        walletBalance: 25000
      }));
      localStorage.setItem("client_wallet_client_abc@enterprise.com", "25000");
      window.location.reload();
    })()`
  });

  await new Promise(r => setTimeout(r, 3000));

  // Check what's rendered
  const pageInfo = await send('Runtime.evaluate', {
    expression: `(() => ({
      headings: Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => h.textContent.trim()),
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(Boolean).slice(0, 15),
      reviewsSection: Array.from(document.querySelectorAll('.border, [class*="card"]'))
        .filter(c => c.textContent.includes('Dedicated Project Review') || c.textContent.includes('JK') || c.textContent.includes('Declined'))
        .map(c => c.innerText.slice(0, 200))
    }))()`,
    returnByValue: true
  });

  console.log("Client Page Info:", JSON.stringify(pageInfo.result?.value, null, 2));

  // Click on Dedicated Project Reviews tab if present
  await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const prTab = buttons.find(b => b.textContent && b.textContent.includes('Dedicated Project Reviews'));
      if (prTab) prTab.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 2000));

  // Save screenshot of Client ABC dashboard showing declined/refunded or active reviews
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const outPath = "C:\\Users\\kushw\\.gemini\\antigravity\\brain\\39df65e9-97a5-40cc-874d-9ffcc6245c91\\screenshots\\walkthrough_05_client_declined_and_refunded.png";
  fs.writeFileSync(outPath, Buffer.from(ss.data, 'base64'));
  console.log(`Saved screenshot to ${outPath} (${fs.statSync(outPath).size} bytes)`);

  ws.close();
}

main().catch(console.error);
