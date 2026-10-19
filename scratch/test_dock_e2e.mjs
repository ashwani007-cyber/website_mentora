import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-dock-e2e";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runE2E() {
  console.log("Starting Chrome for E2E Dock validation...");
  const chromeProcess = spawn(CHROME_EXE, [
    `--remote-debugging-port=9255`,
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1440,900',
    'http://localhost:5173'
  ]);

  await sleep(2500);
  try {
    const res = await fetch('http://127.0.0.1:9255/json');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const send = (m, p = {}) => new Promise((resolve) => {
      const curId = id++;
      const handler = (ev) => {
        const data = JSON.parse(ev.data);
        if (data.id === curId) {
          ws.removeEventListener('message', handler);
          resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method: m, params: p }));
    });

    await send('Page.enable');
    await send('DOM.enable');
    await send('Runtime.enable');
    await sleep(1500);

    // 1. Initial State (Landing Page active)
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/dock_1_landing.png', Buffer.from(shot.data, 'base64'));
    console.log("Captured 1_landing");

    // 2. Test Hover Magnification: find position of 'Client Portal' button and move mouse over it
    const evalPos = await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('nav[aria-label="Main Navigation Dock"] button'));
        return btns.map(b => {
          const r = b.getBoundingClientRect();
          return { text: b.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2, width: r.width, height: r.height };
        });
      })()`,
      returnByValue: true
    });
    console.log("Dock buttons detected:", JSON.stringify(evalPos.result.value, null, 2));

    const clientBtn = evalPos.result.value.find(b => b.text.includes("Client Portal"));
    if (clientBtn) {
      console.log("Simulating mouse hover at Client Portal:", clientBtn.x, clientBtn.y);
      // Dispatch mouse move to trigger Framer Motion magnification
      await send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: clientBtn.x,
        y: clientBtn.y
      });
      await sleep(400); // Allow spring physics to settle

      shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('scratch/dock_2_hover_client.png', Buffer.from(shot.data, 'base64'));
      console.log("Captured 2_hover_client");

      // Click Client Portal
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: clientBtn.x,
        y: clientBtn.y,
        button: 'left',
        clickCount: 1
      });
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: clientBtn.x,
        y: clientBtn.y,
        button: 'left',
        clickCount: 1
      });
      await sleep(1000);

      shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('scratch/dock_3_client_page.png', Buffer.from(shot.data, 'base64'));
      console.log("Captured 3_client_page");
    }

    // 3. Click Expert Portal
    const expertEval = await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('nav[aria-label="Main Navigation Dock"] button'));
        const exp = btns.find(b => b.textContent.includes("Expert Portal"));
        if (exp) {
          const r = exp.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
        return null;
      })()`,
      returnByValue: true
    });

    if (expertEval.result.value) {
      const expPos = expertEval.result.value;
      console.log("Clicking Expert Portal at:", expPos.x, expPos.y);
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: expPos.x,
        y: expPos.y,
        button: 'left',
        clickCount: 1
      });
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: expPos.x,
        y: expPos.y,
        button: 'left',
        clickCount: 1
      });
      await sleep(1000);

      shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('scratch/dock_4_expert_page.png', Buffer.from(shot.data, 'base64'));
      console.log("Captured 4_expert_page");
    }

    // 4. Return to Landing Page
    const landEval = await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('nav[aria-label="Main Navigation Dock"] button'));
        const land = btns.find(b => b.textContent.includes("Landing Page"));
        if (land) {
          const r = land.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
        return null;
      })()`,
      returnByValue: true
    });

    if (landEval.result.value) {
      const landPos = landEval.result.value;
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: landPos.x,
        y: landPos.y,
        button: 'left',
        clickCount: 1
      });
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: landPos.x,
        y: landPos.y,
        button: 'left',
        clickCount: 1
      });
      await sleep(1000);
    }

    // 5. Test Light Mode
    console.log("Toggling theme to light mode...");
    await send('Runtime.evaluate', {
      expression: `(() => {
        const themeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Dark') || b.textContent.includes('Light') || b.title?.includes('theme') || b.querySelector('svg.lucide-sun, svg.lucide-moon'));
        if (themeBtn) themeBtn.click();
      })()`
    });
    await sleep(800);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/dock_5_light_mode.png', Buffer.from(shot.data, 'base64'));
    console.log("Captured 5_light_mode");

    // 6. Test Mobile Viewport (375x812 iPhone)
    console.log("Resizing to mobile viewport (375x812)...");
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(600);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/dock_6_mobile.png', Buffer.from(shot.data, 'base64'));
    console.log("Captured 6_mobile");

    // 7. Test Tablet Viewport (768x1024 iPad)
    console.log("Resizing to tablet viewport (768x1024)...");
    await send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      mobile: false
    });
    await sleep(600);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/dock_7_tablet.png', Buffer.from(shot.data, 'base64'));
    console.log("Captured 7_tablet");

    console.log("All E2E dock validation steps completed successfully!");
    ws.close();
  } catch (err) {
    console.error("E2E test error:", err);
  } finally {
    chromeProcess.kill();
  }
}

runE2E();
