import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-footershot";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('Launching headless Chrome for Footer visual verification...');
  const chromeProcess = spawn(CHROME_EXE, [
    `--remote-debugging-port=9244`,
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1440,1080',
    'http://localhost:5173/'
  ]);

  try {
    await sleep(2500);
    const res = await fetch('http://127.0.0.1:9244/json');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page');
    if (!pageTab) {
      throw new Error('No page tab found in Chrome');
    }

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
    await send('Runtime.enable');
    await send('DOM.enable');
    await sleep(2000);

    // 1. Scroll to footer in Desktop Dark Mode
    console.log('Capturing Desktop Dark Mode...');
    await send('Runtime.evaluate', {
      expression: `
        const footer = document.querySelector('footer');
        if (footer) {
          footer.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      `
    });
    await sleep(800);

    const darkShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/footer_desktop_dark.png', Buffer.from(darkShot.data, 'base64'));
    console.log('Saved scratch/footer_desktop_dark.png');

    // 2. Switch to Light Mode
    console.log('Switching to Light Mode and capturing Desktop Light Mode...');
    await send('Runtime.evaluate', {
      expression: `
        const toggleBtn = document.querySelector('button[aria-label="Toggle Theme Mode"]');
        if (toggleBtn) {
          toggleBtn.click();
        } else {
          localStorage.setItem('app_theme', 'light');
          window.location.reload();
        }
      `
    });
    await sleep(1500);

    await send('Runtime.evaluate', {
      expression: `
        const footer = document.querySelector('footer');
        if (footer) {
          footer.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      `
    });
    await sleep(800);

    const lightShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/footer_desktop_light.png', Buffer.from(lightShot.data, 'base64'));
    console.log('Saved scratch/footer_desktop_light.png');

    // 3. Test Newsletter validation (empty submit -> error)
    console.log('Testing Newsletter validation error...');
    await send('Runtime.evaluate', {
      expression: `
        const footer = document.querySelector('footer');
        const form = footer ? footer.querySelector('form') : null;
        if (form) {
          const btn = form.querySelector('button[type="submit"]');
          if (btn) btn.click();
        }
      `
    });
    await sleep(500);

    const errShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/footer_newsletter_error.png', Buffer.from(errShot.data, 'base64'));
    console.log('Saved scratch/footer_newsletter_error.png');

    // 4. Test Newsletter valid submit -> success
    console.log('Testing Newsletter valid submission success...');
    await send('Runtime.evaluate', {
      expression: `
        const footer = document.querySelector('footer');
        const input = footer ? footer.querySelector('input[type="email"]') : null;
        const form = footer ? footer.querySelector('form') : null;
        if (input && form) {
          input.value = "subscriber@mentora.com";
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          const btn = form.querySelector('button[type="submit"]');
          if (btn) btn.click();
        }
      `
    });
    await sleep(900);

    const successShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/footer_newsletter_success.png', Buffer.from(successShot.data, 'base64'));
    console.log('Saved scratch/footer_newsletter_success.png');

    // 5. Tablet Breakpoint (768px)
    console.log('Setting viewport to Tablet (768x1024)...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(400);
    await send('Runtime.evaluate', {
      expression: `window.scrollTo(0, document.body.scrollHeight);`
    });
    await sleep(800);

    const tabletShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/footer_tablet.png', Buffer.from(tabletShot.data, 'base64'));
    console.log('Saved scratch/footer_tablet.png');

    // 6. Mobile Breakpoint (390px)
    console.log('Setting viewport to Mobile (390x844)...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(400);
    await send('Runtime.evaluate', {
      expression: `window.scrollTo(0, document.body.scrollHeight);`
    });
    await sleep(800);

    const mobileShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/footer_mobile.png', Buffer.from(mobileShot.data, 'base64'));
    console.log('Saved scratch/footer_mobile.png');

    // 7. Legal Modal Click & Capture
    console.log('Testing Legal Modal click...');
    await send('Runtime.evaluate', {
      expression: `
        const privacyBtn = Array.from(document.querySelectorAll('footer button')).find(b => b.innerText.includes('Privacy Policy'));
        if (privacyBtn) privacyBtn.click();
      `
    });
    await sleep(600);
    const modalShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/footer_legal_modal.png', Buffer.from(modalShot.data, 'base64'));
    console.log('Saved scratch/footer_legal_modal.png');

    console.log('\nAll visual verification screenshots captured successfully!');
  } finally {
    try {
      chromeProcess.kill();
    } catch {}
  }
}

run().catch(err => {
  console.error('Visual capture error:', err);
  process.exit(1);
});
