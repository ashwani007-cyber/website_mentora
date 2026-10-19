import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-profile-comp-nav";
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

async function runTest() {
  console.log('--- Launching Chrome for Comprehensive Navigation Test ---');
  const chrome = spawn(CHROME_EXE, [
    '--remote-debugging-port=9223',
    '--remote-allow-origins=*',
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1440,900',
    `${BASE_HOST}/`
  ]);

  await sleep(3000);

  let passedAll = true;

  try {
    const res = await fetch('http://127.0.0.1:9223/json/list');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.type === 'page');

    const client = new CDPClient(pageTab.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    console.log('\n=== TEST 1: Direct Navigation to /client ===');
    await client.send('Page.navigate', { url: `${BASE_HOST}/client` });
    await sleep(2500);

    let state = await client.evaluate(`({
      pathname: window.location.pathname,
      hasClientPortal: document.body.innerText.includes('Client Portal') || document.body.innerText.includes('Directory') || document.body.innerText.includes('Enterprise Advisory'),
      textSnippet: document.body.innerText.slice(0, 150)
    })`);
    console.log('Direct /client result:', state);
    if (state.pathname !== '/client') {
      console.error('FAIL: Expected pathname /client, got', state.pathname);
      passedAll = false;
    } else {
      console.log('PASS: Directly navigated to /client');
    }

    console.log('\n=== TEST 2: Tab Switching in Client Portal ===');
    // Find all tab buttons in client view
    const tabLabels = ['Upcoming Sessions', 'Deposit & Wallet', 'Client Profile', 'Project Reviews', 'Expert Directory'];
    for (const label of tabLabels) {
      const clickRes = await client.evaluate(`(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => b.innerText.includes('${label}'));
        if (target) {
          target.click();
          return { clicked: true, text: target.innerText.trim() };
        }
        return { clicked: false };
      })()`);
      await sleep(600);
      const curState = await client.evaluate(`({
        pathname: window.location.pathname,
        isHome: window.location.pathname === '/' && !document.body.innerText.includes('Client')
      })`);
      console.log(`Clicked tab [${label}]:`, clickRes, '-> Pathname:', curState.pathname);
      if (curState.pathname !== '/client') {
        console.error(`FAIL: Tab [${label}] caused redirect to ${curState.pathname}`);
        passedAll = false;
      } else {
        console.log(`PASS: Tab [${label}] preserved route /client`);
      }
    }

    console.log('\n=== TEST 3: Modal Interaction in Client Portal ===');
    // Switch to wallet and open deposit modal
    await client.evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const walletBtn = btns.find(b => b.innerText.includes('Deposit & Wallet') || b.innerText.includes('Wallet'));
      if (walletBtn) walletBtn.click();
    })()`);
    await sleep(600);

    const openModalRes = await client.evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const addFundBtn = btns.find(b => b.innerText.includes('Add Funds') || b.innerText.includes('Top Up') || b.innerText.includes('Deposit'));
      if (addFundBtn) {
        addFundBtn.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()`);
    await sleep(600);

    // Close any open modal
    await client.evaluate(`(() => {
      const closeBtn = document.querySelector('button[title*="Close"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText === '✕' || b.innerText === 'Cancel');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(600);

    let modalNavState = await client.evaluate(`({
      pathname: window.location.pathname
    })`);
    console.log('After modal open/close -> Pathname:', modalNavState.pathname);
    if (modalNavState.pathname !== '/client') {
      console.error('FAIL: Modal open/close caused redirect');
      passedAll = false;
    } else {
      console.log('PASS: Modal open/close kept route /client');
    }

    console.log('\n=== TEST 4: Direct Navigation to /expert ===');
    await client.send('Page.navigate', { url: `${BASE_HOST}/expert` });
    await sleep(2500);

    let expState = await client.evaluate(`({
      pathname: window.location.pathname,
      hasExpertPortal: document.body.innerText.includes('Expert') || document.body.innerText.includes('Advisory Desk') || document.body.innerText.includes('Consultation Requests'),
      textSnippet: document.body.innerText.slice(0, 150)
    })`);
    console.log('Direct /expert result:', expState);
    if (expState.pathname !== '/expert') {
      console.error('FAIL: Expected pathname /expert, got', expState.pathname);
      passedAll = false;
    } else {
      console.log('PASS: Directly navigated to /expert');
    }

    console.log('\n=== TEST 5: Tab Switching in Expert Portal ===');
    const expertTabs = ['Consultation Requests', 'Availability Calendar', 'Verified Documentation', 'Project Reviews', 'Advisory Sessions'];
    for (const label of expertTabs) {
      const clickRes = await client.evaluate(`(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => b.innerText.includes('${label}'));
        if (target) {
          target.click();
          return { clicked: true, text: target.innerText.trim() };
        }
        return { clicked: false };
      })()`);
      await sleep(600);
      const curState = await client.evaluate(`({
        pathname: window.location.pathname
      })`);
      console.log(`Clicked expert tab [${label}]:`, clickRes, '-> Pathname:', curState.pathname);
      if (curState.pathname !== '/expert') {
        console.error(`FAIL: Tab [${label}] caused redirect to ${curState.pathname}`);
        passedAll = false;
      } else {
        console.log(`PASS: Tab [${label}] preserved route /expert`);
      }
    }

    console.log('\n=== TEST 6: Direct Navigation to /admin ===');
    await client.send('Page.navigate', { url: `${BASE_HOST}/admin` });
    await sleep(2500);

    let adminState = await client.evaluate(`({
      pathname: window.location.pathname,
      hasAdminPortal: document.body.innerText.includes('Admin') || document.body.innerText.includes('Executive') || document.body.innerText.includes('Pricing') || document.body.innerText.includes('Governance')
    })`);
    console.log('Direct /admin result:', adminState);
    if (!['/admin', '/owner'].includes(adminState.pathname) && !window.location?.search?.includes('portal=admin')) {
      console.error('FAIL: Expected /admin or /owner, got', adminState.pathname);
      passedAll = false;
    } else {
      console.log('PASS: Directly navigated to /admin');
    }

    console.log('\n=== TEST 7: Landing Page Anchor Clicks & Top Bar Navigation ===');
    await client.send('Page.navigate', { url: `${BASE_HOST}/` });
    await sleep(2500);

    // Test ProtoBar navigation buttons
    const navButtons = [
      { label: 'Client Portal', expectedPath: '/client' },
      { label: 'Expert Portal', expectedPath: '/expert' },
      { label: 'Landing Page', expectedPath: '/' }
    ];

    for (const { label, expectedPath } of navButtons) {
      const navRes = await client.evaluate(`(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => b.innerText.trim() === '${label}' || b.innerText.includes('${label}'));
        if (target) {
          target.click();
          return { clicked: true, text: target.innerText.trim() };
        }
        return { clicked: false };
      })()`);
      await sleep(1000);
      const cur = await client.evaluate(`({
        pathname: window.location.pathname
      })`);
      console.log(`ProtoBar clicked [${label}]:`, navRes, '-> Current Path:', cur.pathname);
      if (cur.pathname !== expectedPath) {
        console.error(`FAIL: Expected ${expectedPath}, got ${cur.pathname}`);
        passedAll = false;
      } else {
        console.log(`PASS: Navigation to ${expectedPath} verified`);
      }
    }

    console.log('\n=============================================');
    if (passedAll) {
      console.log('🎉 ALL COMPREHENSIVE NAVIGATION TESTS PASSED! 🎉');
    } else {
      console.error('❌ SOME NAVIGATION TESTS FAILED.');
    }
    console.log('=============================================\n');

  } catch (err) {
    console.error('Test execution error:', err);
    passedAll = false;
  } finally {
    try {
      chrome.kill('SIGKILL');
    } catch {}
    process.exit(passedAll ? 0 : 1);
  }
}

runTest();
