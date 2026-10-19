async function testAcceptReview() {
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

  console.log("Clicking 'Accept Review' button...");
  const clicked = await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const acceptBtn = buttons.find(b => b.textContent && b.textContent.includes('Accept Review'));
      if (acceptBtn) {
        acceptBtn.click();
        return "Clicked Accept Review";
      }
      return "Accept Review button not found";
    })()`,
    returnByValue: true
  });
  console.log(clicked.result?.value);

  // Wait for workspace to open
  await new Promise(r => setTimeout(r, 4000));

  const workspaceState = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        headings: Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => h.textContent.trim()),
        tabs: Array.from(document.querySelectorAll('button, div')).map(e => e.textContent?.trim()).filter(t => t && ['Workspace', 'Private Chat', 'Documents & Code', 'Google Meet', 'Findings Report', 'Activity Log'].includes(t))
      };
    })()`,
    returnByValue: true
  });
  console.log("Workspace State:", JSON.stringify(workspaceState.result?.value, null, 2));

  // Capture screenshot
  const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
  const fs = await import('fs');
  const path = await import('path');
  const outPath = path.join("C:\\Users\\kushw\\.gemini\\antigravity\\brain\\39df65e9-97a5-40cc-874d-9ffcc6245c91\\screenshots", "walkthrough_03_expert_workspace_active.png");
  fs.writeFileSync(outPath, Buffer.from(screenshotRes.data, 'base64'));
  console.log(`Saved screenshot to ${outPath} (${fs.statSync(outPath).size} bytes)`);

  ws.close();
}

testAcceptReview().catch(console.error);
