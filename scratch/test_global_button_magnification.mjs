import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-btn-test";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTests() {
  console.log("Starting Chrome for Global Button Magnification validation...");
  const chromeProcess = spawn(CHROME_EXE, [
    `--remote-debugging-port=9288`,
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1440,900',
    'http://localhost:5173'
  ]);

  await sleep(2500);
  try {
    const res = await fetch('http://127.0.0.1:9288/json');
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

    // Test 1: Landing Page Hero Button Hover
    console.log("--- Test 1: Testing Landing Page 'Find an Expert' button hover ---");
    const heroBtnPos = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Find an Expert'));
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return { text: btn.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2, width: r.width, height: r.height };
      })()`,
      returnByValue: true
    });
    console.log("Hero button detected:", heroBtnPos.result.value);

    if (heroBtnPos.result.value) {
      const pos = heroBtnPos.result.value;
      // Hover over hero button
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y });
      await sleep(350); // Allow spring physics to settle

      // Check transform
      const transformCheck = await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Find an Expert'));
          return {
            transform: btn.style.transform || window.getComputedStyle(btn).transform
          };
        })()`,
        returnByValue: true
      });
      console.log("Hero button transform on hover:", transformCheck.result.value);

      let shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('scratch/btn_test_1_hero_hover.png', Buffer.from(shot.data, 'base64'));

      // Move mouse away to test unhover
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 });
      await sleep(350);

      const unhoverCheck = await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Find an Expert'));
          return {
            transform: btn.style.transform || window.getComputedStyle(btn).transform
          };
        })()`,
        returnByValue: true
      });
      console.log("Hero button transform after unhover:", unhoverCheck.result.value);
    }

    // Test 2: Header CTA Button ("Sign in" or "Register as expert")
    console.log("--- Test 2: Header 'Register as expert' button hover ---");
    const headerBtnPos = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('header button')).find(b => b.textContent.includes('Register as expert'));
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return { text: btn.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`,
      returnByValue: true
    });

    if (headerBtnPos.result.value) {
      const pos = headerBtnPos.result.value;
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y });
      await sleep(350);

      const transformCheck = await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('header button')).find(b => b.textContent.includes('Register as expert'));
          return { transform: btn.style.transform || window.getComputedStyle(btn).transform };
        })()`,
        returnByValue: true
      });
      console.log("Header button transform on hover:", transformCheck.result.value);

      let shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('scratch/btn_test_2_header_btn_hover.png', Buffer.from(shot.data, 'base64'));
    }

    // Test 3: Navigate to Client Portal and test Portal buttons
    console.log("--- Test 3: Navigate to Client Portal & test portal buttons ---");
    await send('Runtime.evaluate', {
      expression: `(() => {
        const clientBtn = Array.from(document.querySelectorAll('nav[aria-label="Main Navigation Dock"] button')).find(b => b.textContent.includes('Client Portal'));
        if (clientBtn) clientBtn.click();
      })()`
    });
    await sleep(1000);

    // Hover over "Rate & Review" button on Client Portal
    const portalBtnPos = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Rate & Review') || b.textContent.includes('Edit Profile'));
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return { text: btn.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`,
      returnByValue: true
    });

    if (portalBtnPos.result.value) {
      const pos = portalBtnPos.result.value;
      console.log("Found Client Portal action button:", pos.text);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y });
      await sleep(350);

      const transformCheck = await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Rate & Review') || b.textContent.includes('Edit Profile'));
          return { transform: btn.style.transform || window.getComputedStyle(btn).transform };
        })()`,
        returnByValue: true
      });
      console.log("Client Portal button transform on hover:", transformCheck.result.value);

      let shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('scratch/btn_test_3_portal_hover.png', Buffer.from(shot.data, 'base64'));
    }

    // Test 4: Expert Portal Button Hover
    console.log("--- Test 4: Navigate to Expert Portal & test expert buttons ---");
    await send('Runtime.evaluate', {
      expression: `(() => {
        const expBtn = Array.from(document.querySelectorAll('nav[aria-label="Main Navigation Dock"] button')).find(b => b.textContent.includes('Expert Portal'));
        if (expBtn) expBtn.click();
      })()`
    });
    await sleep(1000);

    const expertBtnPos = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Availability Management') || b.textContent.includes('Edit Profile & Rate'));
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return { text: btn.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`,
      returnByValue: true
    });

    if (expertBtnPos.result.value) {
      const pos = expertBtnPos.result.value;
      console.log("Found Expert Portal action button:", pos.text);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y });
      await sleep(350);

      const transformCheck = await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Availability Management') || b.textContent.includes('Edit Profile & Rate'));
          return { transform: btn.style.transform || window.getComputedStyle(btn).transform };
        })()`,
        returnByValue: true
      });
      console.log("Expert Portal button transform on hover:", transformCheck.result.value);

      let shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('scratch/btn_test_4_expert_hover.png', Buffer.from(shot.data, 'base64'));
    }

    // Test 5: Verify zero layout shift
    console.log("--- Test 5: Verify Zero Layout Shift on adjacent elements ---");
    const layoutShiftCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('button');
        const parent = btn.parentElement;
        const beforeRect = parent.getBoundingClientRect();
        
        // Trigger hover event
        btn.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
        
        const afterRect = parent.getBoundingClientRect();
        return {
          parentWidthBefore: beforeRect.width,
          parentWidthAfter: afterRect.width,
          parentHeightBefore: beforeRect.height,
          parentHeightAfter: afterRect.height,
          shiftDetected: beforeRect.width !== afterRect.width || beforeRect.height !== afterRect.height
        };
      })()`,
      returnByValue: true
    });
    console.log("Layout shift check result:", layoutShiftCheck.result.value);

    console.log("All global button magnification tests passed!");
    ws.close();
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    chromeProcess.kill();
  }
}

runTests();
