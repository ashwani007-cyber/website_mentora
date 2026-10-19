async function testExpertPortal() {
  const res = await fetch('http://127.0.0.1:9222/json/list');
  const tabs = await res.json();
  const pageTab = tabs.find(t => t.type === 'page' && t.url && t.url.includes('localhost:5173'));
  if (!pageTab) {
    console.log("No localhost:5173 tab found");
    return;
  }
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

  console.log("Setting localStorage for Expert JK...");
  await send('Runtime.evaluate', {
    expression: `(() => {
      localStorage.setItem("current_user_role", "expert");
      localStorage.setItem("current_page", "expert");
      localStorage.setItem("current_logged_in_expert", JSON.stringify({
        id: "usr-1788974684441",
        name: "JK",
        email: "jay@gmail.com",
        title: "HR & Talent",
        field: "HR & Talent",
        rate: 650,
        baseRate: 500,
        verified: true,
        verificationStatus: "approved"
      }));
      window.location.reload();
    })()`,
    returnByValue: true
  });

  await new Promise(r => setTimeout(r, 3000));

  // Click on "Dedicated Project Reviews" tab
  console.log("Clicking 'Dedicated Project Reviews' tab...");
  await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const prTab = buttons.find(b => b.textContent && b.textContent.includes('Dedicated Project Reviews'));
      if (prTab) {
        prTab.click();
        return "Clicked PR Tab";
      }
      return "PR Tab not found. Buttons: " + buttons.map(b => b.textContent.trim()).join(', ');
    })()`,
    returnByValue: true
  });

  await new Promise(r => setTimeout(r, 2000));

  const pageInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        url: window.location.href,
        headings: Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => h.textContent.trim()),
        projectReviewCards: Array.from(document.querySelectorAll('.border, [class*="card"]'))
          .filter(c => c.textContent.includes('Client ABC') || c.textContent.includes('Dedicated Project Review') || c.textContent.includes('Accept Review'))
          .map(c => c.innerText.slice(0, 300))
      };
    })()`,
    returnByValue: true
  });

  console.log("Page Info:", JSON.stringify(pageInfo.result?.value, null, 2));

  // Take screenshot
  const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
  const fs = await import('fs');
  const path = await import('path');
  const outPath = path.join("C:\\Users\\kushw\\.gemini\\antigravity\\brain\\39df65e9-97a5-40cc-874d-9ffcc6245c91\\screenshots", "walkthrough_02_expert_incoming_request_card.png");
  fs.writeFileSync(outPath, Buffer.from(screenshotRes.data, 'base64'));
  console.log(`Saved screenshot to ${outPath} (${fs.statSync(outPath).size} bytes)`);

  ws.close();
}

testExpertPortal().catch(console.error);
