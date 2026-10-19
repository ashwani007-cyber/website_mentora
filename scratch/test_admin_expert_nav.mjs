import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-nav-test-admin";
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

async function testAdminAndExpert() {
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

    // 1. Test Admin Portal
    console.log("=== Testing Admin Portal ===");
    await client.evaluate(`(() => {
      localStorage.setItem('admin_user_role', 'admin');
      localStorage.setItem('current_admin_page', 'owner');
      localStorage.setItem('current_admin_authenticated', 'true');
    })()`);

    await client.send('Page.navigate', { url: "http://127.0.0.1:5173/?portal=admin" });
    await sleep(2000);

    let adminState = await client.evaluate(`({
      url: window.location.href,
      pageText: document.body.innerText.slice(0, 200),
      isOwnerPage: document.body.innerText.includes('Admin Governance') || document.body.innerText.includes('SuperAdmin Desk'),
      isLanding: document.body.innerText.includes('WELCOME TO THE REGISTRY')
    })`);
    console.log("Admin initial state:", adminState);

    // Switch desk in admin
    console.log("Switching desk in admin...");
    const deskSwitched = await client.evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const deskBtn = btns.find(b => b.textContent.includes('Domain Taxonomy') || b.textContent.includes('Taxonomy') || b.textContent.includes('Availability') || b.textContent.includes('Notification'));
      if (deskBtn) {
        deskBtn.click();
        return deskBtn.textContent.trim();
      }
      return 'not found';
    })()`);
    console.log("Clicked desk:", deskSwitched);
    await sleep(1000);

    let afterDeskSwitch = await client.evaluate(`({
      url: window.location.href,
      pageText: document.body.innerText.slice(0, 200),
      isLanding: document.body.innerText.includes('WELCOME TO THE REGISTRY')
    })`);
    console.log("State after desk switch:", afterDeskSwitch);

    // Click an action button or form submit
    console.log("Testing action / button click in admin...");
    const adminAction = await client.evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const actBtn = btns.find(b => b.textContent.includes('Inspect') || b.textContent.includes('Sync') || b.textContent.includes('Filter'));
      if (actBtn) {
        actBtn.click();
        return actBtn.textContent.trim();
      }
      return 'not found';
    })()`);
    console.log("Clicked admin action:", adminAction);
    await sleep(1000);

    let afterAdminAction = await client.evaluate(`({
      url: window.location.href,
      isLanding: document.body.innerText.includes('WELCOME TO THE REGISTRY')
    })`);
    console.log("State after admin action:", afterAdminAction);

  } catch (err) {
    console.error("Test error:", err);
  } finally {
    chrome.kill();
  }
}

testAdminAndExpert();
