import fs from 'fs';
import path from 'path';

async function main() {
  const clientEmail = 'client.abc@enterprise.com';
  const expertEmail = 'jay@gmail.com';
  const expertId = 'usr-1788974684441';

  // Create a pending review for Client ABC
  const createRes = await fetch('http://localhost:5173/api/project-reviews/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: 'cli-abc-production',
      clientName: 'Client ABC Corp',
      clientEmail: clientEmail,
      expertId,
      expertName: 'JK',
      expertEmail,
      expectedScope: 'High Availability Multi-Region Infrastructure Audit + 2 Strategy Sessions',
      reviewType: 'Production Scalability & Reliability Audit',
      requestNotes: 'Seeking executive review of multi-region failover and active-active DB clustering.',
      clientWalletBalance: 25000
    })
  });
  const resData = await createRes.json();
  console.log("Created review:", resData.projectReview?.projectReviewId);

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

  // Load Client ABC Corp
  await send('Runtime.evaluate', {
    expression: `(() => {
      localStorage.setItem("current_user_role", "client");
      localStorage.setItem("current_page", "client");
      localStorage.setItem("current_logged_in_client", JSON.stringify({
        id: "cli-abc-production",
        name: "Client ABC Corp",
        email: "${clientEmail}",
        company: "ABC Enterprise Holdings",
        walletBalance: 23947
      }));
      localStorage.setItem("client_wallet_${clientEmail}", "23947");
      window.location.reload();
    })()`
  });

  await new Promise(r => setTimeout(r, 3000));

  // Switch to My Dedicated Project Reviews
  await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const prTab = buttons.find(b => b.textContent && b.textContent.includes('My Dedicated Project Reviews'));
      if (prTab) prTab.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 2000));

  // Screenshot walkthrough_01_client_pending_review.png
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const outPath = "C:\\Users\\kushw\\.gemini\\antigravity\\brain\\39df65e9-97a5-40cc-874d-9ffcc6245c91\\screenshots\\walkthrough_01_client_pending_review.png";
  fs.writeFileSync(outPath, Buffer.from(ss.data, 'base64'));
  console.log(`Saved screenshot to ${outPath} (${fs.statSync(outPath).size} bytes)`);

  ws.close();
}

main().catch(console.error);
