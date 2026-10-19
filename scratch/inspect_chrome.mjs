async function main() {
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

  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => ({
      userRole: localStorage.getItem('current_user_role'),
      expert: localStorage.getItem('current_logged_in_expert'),
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean),
      h1_h3: Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => h.textContent?.trim())
    }))()`,
    returnByValue: true
  });
  console.log("Page state:", JSON.stringify(evalRes.result ? evalRes.result.value : evalRes, null, 2));
  ws.close();
}

main().catch(console.error);
