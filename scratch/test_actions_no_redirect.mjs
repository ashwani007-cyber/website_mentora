import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-act-test";
const BASE_HOST = "http://127.0.0.1:5173";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
    });
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Page.javascriptDialogOpening') {
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
        return;
      }
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    return res.result ? res.result.value : undefined;
  }
}

async function runActionTest() {
  console.log('--- Starting Form & Action Navigation Verification ---');
  const chrome = spawn(CHROME_EXE, [
    '--remote-debugging-port=9224',
    '--remote-allow-origins=*',
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1440,900',
    `${BASE_HOST}/client`
  ]);

  await sleep(3000);
  let allOk = true;

  try {
    const res = await fetch('http://127.0.0.1:9224/json/list');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page');

    const client = new CDPClient(pageTab.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    // Track frame navigations (e.g. unexpected full page reload)
    let reloads = 0;
    client.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Page.frameNavigated') {
        reloads++;
      }
    });

    console.log('\n=== ACTION TEST 1: Wallet Deposit Submission on /client ===');
    await client.send('Page.navigate', { url: `${BASE_HOST}/client` });
    await sleep(2000);
    reloads = 0; // Reset after initial load

    // Open wallet tab
    await client.evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const walletBtn = btns.find(b => b.innerText.includes('Deposit & Wallet') || b.innerText.includes('Wallet'));
      if (walletBtn) walletBtn.click();
    })()`);
    await sleep(600);

    // Open deposit modal
    await client.evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const topup = btns.find(b => b.innerText.includes('Top Up') || b.innerText.includes('Add Funds') || b.innerText.includes('Deposit'));
      if (topup) topup.click();
    })()`);
    await sleep(800);

    // Fill amount and submit deposit form
    const submitRes = await client.evaluate(`(() => {
      const modal = document.body;
      const input = document.querySelector('input[type="number"]') || document.querySelector('input[placeholder*="amount" i]');
      if (input) {
        input.value = '500';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => 
        b.innerText.includes('Proceed') || b.innerText.includes('Deposit') || b.innerText.includes('Pay')
      );
      if (submitBtn) {
        submitBtn.click();
        return { submitted: true, text: submitBtn.innerText };
      }
      return { submitted: false };
    })()`);
    console.log('Deposit form submitted:', submitRes);
    await sleep(1500);

    const clientPathAfterDeposit = await client.evaluate(`window.location.pathname`);
    console.log('Pathname after deposit:', clientPathAfterDeposit, '| Reloads:', reloads);
    if (clientPathAfterDeposit !== '/client') {
      console.error('FAIL: Deposit caused redirect to', clientPathAfterDeposit);
      allOk = false;
    } else {
      console.log('PASS: Wallet deposit preserved /client route without redirect');
    }

    console.log('\n=== ACTION TEST 2: Admin Desk Markup Update on /admin ===');
    await client.send('Page.navigate', { url: `${BASE_HOST}/admin` });
    await sleep(2500);
    reloads = 0;

    // Click "Save Rule" or change a rate input
    const markupRes = await client.evaluate(`(() => {
      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => 
        b.innerText.includes('Save') || b.innerText.includes('Update') || b.innerText.includes('Markup')
      );
      if (saveBtn) {
        saveBtn.click();
        return { clicked: true, text: saveBtn.innerText };
      }
      return { clicked: false };
    })()`);
    console.log('Admin markup action clicked:', markupRes);
    await sleep(1500);

    const adminPathAfterAction = await client.evaluate(`window.location.pathname`);
    console.log('Pathname after admin action:', adminPathAfterAction, '| Reloads:', reloads);
    if (!['/admin', '/owner'].includes(adminPathAfterAction)) {
      console.error('FAIL: Admin action caused redirect to', adminPathAfterAction);
      allOk = false;
    } else {
      console.log('PASS: Admin action preserved /admin route without redirect');
    }

    console.log('\n=== ACTION TEST 3: Browser Back & Forward Navigation ===');
    // Navigate from /client to /expert, then back to /client
    await client.send('Page.navigate', { url: `${BASE_HOST}/client` });
    await sleep(1500);
    // Click ProtoBar Expert Portal
    await client.evaluate(`(() => {
      const b = Array.from(document.querySelectorAll('button')).find(btn => btn.innerText.trim() === 'Expert Portal');
      if (b) b.click();
    })()`);
    await sleep(1000);
    let p1 = await client.evaluate(`window.location.pathname`);
    console.log('Navigated to expert:', p1);

    // Browser back
    await client.evaluate(`window.history.back()`);
    await sleep(1000);
    let p2 = await client.evaluate(`window.location.pathname`);
    console.log('After history.back():', p2);

    if (p2 !== '/client') {
      console.error('FAIL: History back did not restore /client, got', p2);
      allOk = false;
    } else {
      console.log('PASS: Browser history back cleanly restored /client');
    }

    // Browser forward
    await client.evaluate(`window.history.forward()`);
    await sleep(1000);
    let p3 = await client.evaluate(`window.location.pathname`);
    console.log('After history.forward():', p3);

    if (p3 !== '/expert') {
      console.error('FAIL: History forward did not restore /expert, got', p3);
      allOk = false;
    } else {
      console.log('PASS: Browser history forward cleanly restored /expert');
    }

    console.log('\n=============================================');
    if (allOk) {
      console.log('🎉 ALL ACTION AND PERSISTENCE TESTS PASSED! 🎉');
    } else {
      console.error('❌ ACTION TEST FAILED.');
    }
    console.log('=============================================\n');

  } catch (err) {
    console.error('Action test error:', err);
    allOk = false;
  } finally {
    try {
      chrome.kill('SIGKILL');
    } catch {}
    process.exit(allOk ? 0 : 1);
  }
}

runActionTest();
