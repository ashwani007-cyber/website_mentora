import fs from 'fs';
import path from 'path';

async function main() {
  const freshClientEmail = `client_abc_prod_${Date.now()}@enterprise.com`;
  const expertEmail = 'jay@gmail.com';
  const expertId = 'usr-1788974684441';

  // 1. Client creates request
  console.log("Creating new project review request...");
  const createRes = await fetch('http://localhost:5173/api/project-reviews/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: `cli-${Date.now()}`,
      clientName: 'Client ABC Corp',
      clientEmail: freshClientEmail,
      expertId,
      expertName: 'JK',
      expertEmail,
      expectedScope: 'High-Throughput Kubernetes & Multi-Region Database Architecture Audit',
      reviewType: 'Production Scalability & Reliability Audit',
      requestNotes: 'Need senior expert review of active-active failover architecture and latency optimization.',
      clientWalletBalance: 30000
    })
  });
  const data = await createRes.json();
  console.log("Created review:", data.projectReview?.projectReviewId, "Status:", data.projectReview?.status);

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

  // --- Step A: Client Portal View ---
  console.log("Loading Client Portal...");
  await send('Runtime.evaluate', {
    expression: `(() => {
      localStorage.setItem("current_user_role", "client");
      localStorage.setItem("current_page", "client");
      localStorage.setItem("current_logged_in_client", JSON.stringify({
        id: "cli-abc-corp",
        name: "Client ABC Corp",
        email: "${freshClientEmail}",
        company: "ABC Enterprise Holdings",
        walletBalance: ${data.clientWalletBalance}
      }));
      localStorage.setItem("client_wallet_${freshClientEmail}", "${data.clientWalletBalance}");
      window.location.reload();
    })()`
  });
  await new Promise(r => setTimeout(r, 3000));

  await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const prTab = buttons.find(b => b.textContent && b.textContent.includes('My Dedicated Project Reviews'));
      if (prTab) prTab.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 2000));

  let ss = await send('Page.captureScreenshot', { format: 'png' });
  let outPath = "C:\\Users\\kushw\\.gemini\\antigravity\\brain\\39df65e9-97a5-40cc-874d-9ffcc6245c91\\screenshots\\walkthrough_01_client_pending_review.png";
  fs.writeFileSync(outPath, Buffer.from(ss.data, 'base64'));
  console.log(`Saved walkthrough_01 to ${outPath}`);

  // --- Step B: Expert Portal View ---
  console.log("Switching to Expert Portal (JK)...");
  await send('Runtime.evaluate', {
    expression: `(() => {
      localStorage.setItem("current_user_role", "expert");
      localStorage.setItem("current_page", "expert");
      localStorage.setItem("current_logged_in_expert", JSON.stringify({
        id: "${expertId}",
        name: "JK",
        email: "${expertEmail}",
        title: "HR & Talent",
        field: "HR & Talent",
        rate: 650,
        baseRate: 500,
        verified: true,
        verificationStatus: "approved"
      }));
      window.location.reload();
    })()`
  });
  await new Promise(r => setTimeout(r, 3000));

  await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const prTab = buttons.find(b => b.textContent && b.textContent.includes('Dedicated Project Reviews'));
      if (prTab) prTab.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 2000));

  ss = await send('Page.captureScreenshot', { format: 'png' });
  outPath = "C:\\Users\\kushw\\.gemini\\antigravity\\brain\\39df65e9-97a5-40cc-874d-9ffcc6245c91\\screenshots\\walkthrough_02_expert_incoming_request_card.png";
  fs.writeFileSync(outPath, Buffer.from(ss.data, 'base64'));
  console.log(`Saved walkthrough_02 to ${outPath}`);

  ws.close();
}

main().catch(console.error);
