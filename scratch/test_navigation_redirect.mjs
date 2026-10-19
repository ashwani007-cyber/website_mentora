import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-nav-test";
const BASE_URL = "http://127.0.0.1:5173/";

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

async function testNav() {
  const chrome = spawn(CHROME_EXE, [
    '--remote-debugging-port=9222',
    '--remote-allow-origins=*',
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1440,900',
    BASE_URL
  ]);

  await sleep(2500);

  try {
    const res = await fetch('http://127.0.0.1:9222/json/list');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page');

    const client = new CDPClient(pageTab.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    // Preset logged-in client in localStorage and reload
    await client.evaluate(`(() => {
      localStorage.setItem('current_user_role', 'client');
      localStorage.setItem('current_page', 'client');
      localStorage.setItem('current_logged_in_client', JSON.stringify({
        name: 'Acme Corp Exec',
        company: 'Acme Corp',
        email: 'testclient@acme.com',
        phone: '+91 99999 88888',
        field: 'Corporate Advisory',
        bio: 'Testing navigation',
        initials: 'AC'
      }));
    })()`);

    await client.send('Page.navigate', { url: BASE_URL });
    await sleep(2000);

    let state = await client.evaluate(`({
      url: window.location.href,
      pageText: document.body.innerText.slice(0, 300),
      current_page: localStorage.getItem('current_page'),
      current_user_role: localStorage.getItem('current_user_role'),
      isClientPage: !!document.querySelector('button') && document.body.innerText.includes('Acme Corp Exec')
    })`);
    console.log("Client page loaded state:", state);

    // Now let's try various actions on Client Page:
    // 1. Switch a tab (e.g. Project Reviews or category tabs)
    console.log("\n--- Testing Tab Switching ---");
    const switchTabRes = await client.evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const prTab = btns.find(b => b.textContent.includes('Project Reviews') || b.textContent.includes('Finance') || b.textContent.includes('Tax'));
      if (prTab) {
        prTab.click();
        return prTab.textContent.trim();
      }
      return 'not found';
    })()`);
    console.log("Clicked tab:", switchTabRes);
    await sleep(1000);
    let tabState = await client.evaluate(`({
      url: window.location.href,
      current_page: localStorage.getItem('current_page'),
      isClientPage: document.body.innerText.includes('Acme Corp Exec'),
      isLanding: document.body.innerText.includes('WELCOME TO THE REGISTRY') || document.body.innerText.includes('The Silver Workforce Platform')
    })`);
    console.log("State after tab switch:", tabState);

    // 2. Open a modal (e.g. Edit Profile or Wallet or Filter or Booking)
    console.log("\n--- Testing Modal Opening ---");
    const openModalRes = await client.evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const editBtn = btns.find(b => b.textContent.includes('Edit Profile') || b.getAttribute('title')?.includes('Edit Profile') || b.textContent.includes('Wallet'));
      if (editBtn) {
        editBtn.click();
        return editBtn.textContent.trim() || editBtn.getAttribute('title');
      }
      return 'not found';
    })()`);
    console.log("Clicked modal trigger:", openModalRes);
    await sleep(1000);
    let modalState = await client.evaluate(`({
      url: window.location.href,
      current_page: localStorage.getItem('current_page'),
      hasModal: !!document.querySelector('div[role=\"dialog\"]') || !!document.querySelector('form'),
      isLanding: document.body.innerText.includes('WELCOME TO THE REGISTRY')
    })`);
    console.log("State after modal open:", modalState);

    // 3. Submit a form inside modal / Edit Content
    console.log("\n--- Testing Form Submission inside Modal ---");
    const submitRes = await client.evaluate(`(() => {
      const form = document.querySelector('form');
      if (form) {
        const submitBtn = form.querySelector('button[type=\"submit\"]') || Array.from(form.querySelectorAll('button')).find(b => b.textContent.includes('Save') || b.textContent.includes('Update') || b.textContent.includes('Add'));
        if (submitBtn) {
          submitBtn.click();
          return submitBtn.textContent.trim();
        }
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        return 'form submitted';
      }
      return 'no form found';
    })()`);
    console.log("Submitted form:", submitRes);
    await sleep(1500);
    let afterSubmitState = await client.evaluate(`({
      url: window.location.href,
      current_page: localStorage.getItem('current_page'),
      isLanding: document.body.innerText.includes('WELCOME TO THE REGISTRY'),
      pageText: document.body.innerText.slice(0, 200)
    })`);
    console.log("State after submit:", afterSubmitState);

  } catch (err) {
    console.error("Test error:", err);
  } finally {
    chrome.kill();
  }
}

testNav();
