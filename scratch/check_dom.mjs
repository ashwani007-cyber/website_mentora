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
  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => ({
      title: document.title,
      headings: Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => h.textContent.trim()),
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(Boolean)
    }))()`,
    returnByValue: true
  });
  console.log(JSON.stringify(evalRes.result?.value, null, 2));
  ws.close();
}
main().catch(console.error);
