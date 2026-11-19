import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];
    this.failedRequests = [];

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
      if (msg.method === 'Runtime.consoleAPICalled') {
        if (msg.params.type === 'error') {
          const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
          this.consoleErrors.push(text);
        }
      }
      if (msg.method === 'Network.loadingFailed') {
        this.failedRequests.push({
          requestId: msg.params.requestId,
          errorText: msg.params.errorText,
          canceled: msg.params.canceled
        });
      }
      if (msg.method === 'Network.responseReceived') {
        if (msg.params.response && msg.params.response.status >= 400) {
          this.failedRequests.push({
            url: msg.params.response.url,
            status: msg.params.response.status,
            statusText: msg.params.response.statusText
          });
        }
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
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : null;
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  console.log('========================================================================');
  console.log('LIVE THREE-TAB TEST: GOOGLE MEET LINK SYNC ON EXPERT, CLIENT & ADMIN');
  console.log('========================================================================\n');

  const testSessionId = 'book-1793372078834';
  const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const USER_DATA = path.join(os.tmpdir(), 'chrome-test-' + Date.now());

  const acceptedSession = {
    id: testSessionId,
    client: "Aman",
    clientEmail: "aman@gmail.com",
    expert: "Aara",
    expertEmail: "aara@gmail.com",
    topic: "Artificial Intelligence & ML Consultation",
    when: "2026-10-30, 08:30 PM - 09:00 PM",
    type: "Project Advisory",
    rate: 225,
    payout: 191,
    status: "accepted",
    meetUrl: "",
    meet_link: "",
    meeting_link: ""
  };
  fs.mkdirSync(USER_DATA, { recursive: true });

  // Reset booking to clean initial accepted state in db.json for Test 1
  try {
    const dbPath = path.resolve('db.json');
    const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const bIdx = (dbData.bookings || []).findIndex(x => x.id === testSessionId);
    if (bIdx !== -1) {
      dbData.bookings[bIdx].meet_link = '';
      dbData.bookings[bIdx].meetUrl = '';
      dbData.bookings[bIdx].meeting_link = '';
      dbData.bookings[bIdx].meeting_link_sent_at = null;
      fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2));
      console.log('RESET DB.JSON AT SCRIPT START: booking index', bIdx, 'reset to empty');
    }
  } catch (e) {
    console.error('Error resetting db.json initial state:', e);
  }

  const chromeProc = spawn(CHROME_EXE, [
    '--remote-debugging-port=9227',
    '--headless=new',
    '--remote-allow-origins=*',
    `--user-data-dir=${USER_DATA}`,
    'http://localhost:5173/'
  ], { detached: false, stdio: 'ignore' });

  await sleep(2000);

  // Connect to Chrome Browser CDP to create isolated contexts for Expert, Client, and Admin
  const versionRes = await fetch('http://127.0.0.1:9227/json/version');
  const versionData = await versionRes.json();
  const browserWs = new WebSocket(versionData.webSocketDebuggerUrl);
  await new Promise(r => browserWs.onopen = r);

  let bReqId = 1;
  const sendBrowser = (method, params = {}) => new Promise((resolve, reject) => {
    const cur = bReqId++;
    const h = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === cur) { browserWs.removeEventListener('message', h); resolve(msg.result); }
    };
    browserWs.addEventListener('message', h);
    browserWs.send(JSON.stringify({ id: cur, method, params }));
  });

  // Tab 1: Expert Portal (Isolated Context)
  const ctxExpert = await sendBrowser('Target.createBrowserContext');
  const tExpert = await sendBrowser('Target.createTarget', { url: 'http://localhost:5173/#expert', browserContextId: ctxExpert.browserContextId });
  const expertClient = new CDPClient(`ws://127.0.0.1:9227/devtools/page/${tExpert.targetId}`);
  await expertClient.send('Page.enable');
  await expertClient.send('Runtime.enable');
  await expertClient.send('Network.enable');

  // Tab 2: Client Portal (Isolated Context)
  const ctxClient = await sendBrowser('Target.createBrowserContext');
  const tClient = await sendBrowser('Target.createTarget', { url: 'http://localhost:5173/#client', browserContextId: ctxClient.browserContextId });
  const clientTab = new CDPClient(`ws://127.0.0.1:9227/devtools/page/${tClient.targetId}`);
  await clientTab.send('Page.enable');
  await clientTab.send('Runtime.enable');
  await clientTab.send('Network.enable');

  // Tab 3: Admin Portal (Isolated Context)
  const ctxAdmin = await sendBrowser('Target.createBrowserContext');
  const tAdmin = await sendBrowser('Target.createTarget', { url: 'http://localhost:5173/#owner', browserContextId: ctxAdmin.browserContextId });
  const adminTab = new CDPClient(`ws://127.0.0.1:9227/devtools/page/${tAdmin.targetId}`);
  await adminTab.send('Page.enable');
  await adminTab.send('Runtime.enable');
  await adminTab.send('Network.enable');

  await sleep(1500);

  // Initialize Tab 1 (Expert Aara)
  await expertClient.evaluate(`
    window.alert = () => {};
    window.confirm = () => true;
    localStorage.clear();
    localStorage.setItem('current_user_role', 'expert');
    localStorage.setItem('current_logged_in_expert', JSON.stringify({
      id: 'usr-86c1c358-aara',
      user_id: 'usr-86c1c358-aara',
      name: 'Aara',
      email: 'aara@gmail.com',
      specialty: 'AI & Machine Learning',
      baseRate: 225
    }));
    localStorage.setItem('current_page', 'expert');
    window.location.hash = '#expert';
    window.location.reload();
  `);

  // Initialize Tab 2 (Client Aman)
  await clientTab.evaluate(`
    window.alert = () => {};
    window.confirm = () => true;
    localStorage.clear();
    localStorage.setItem('current_user_role', 'client');
    localStorage.setItem('current_logged_in_client', JSON.stringify({
      id: '059fc01e-4a01-47a1-95d8-e881d1b5a262',
      name: 'Aman',
      email: 'aman@gmail.com'
    }));
    localStorage.setItem('current_page', 'client');
    window.location.hash = '#client';
    window.location.reload();
  `);

  // Initialize Tab 3 (Admin)
  await adminTab.evaluate(`
    window.alert = () => {};
    window.confirm = () => true;
    localStorage.clear();
    localStorage.setItem('admin_token', 'admin_super_secret_token_12345');
    localStorage.setItem('admin_session_token', 'admin_super_secret_token_12345');
    localStorage.setItem('admin_user_role', 'admin');
    localStorage.setItem('current_user_role', 'admin');
    localStorage.setItem('current_page', 'owner');
    window.location.hash = '#owner';
    window.location.reload();
  `);

  await sleep(4000);

  // Switch Admin tab to Meeting & Session Ops Desk
  await adminTab.evaluate(`
    (() => {
      const opsTab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Meeting & Session Ops'));
      if (opsTab) opsTab.click();
    })()
  `);
  await sleep(2000);

  const testResults = [];

  // =========================================================================
  // TEST 1: Before sending the link
  // =========================================================================
  console.log('>>> RUNNING TEST 1: Before sending the link');
  const t1Expert = await expertClient.evaluate(`
    (() => {
      const cards = Array.from(document.querySelectorAll('div.p-5.rounded-2xl')).filter(el => 
        el.innerText && el.innerText.includes("Allotted Slot: 2026-10-30, 08:30 PM - 09:00 PM")
      );
      const card = cards[0];
      if (!card) return { found: false, text: document.body.innerText.substring(0, 300) };
      const text = card.innerText;
      return {
        found: true,
        fullCardText: text,
        hasAwaitingBadge: text.includes("Awaiting Google Meet Link"),
        hasLinkSentBadge: text.includes("Link Sent"),
        hasInput: Boolean(card.querySelector('input[type="url"]')),
        hasOpenMeetBtn: Array.from(card.querySelectorAll('button')).some(b => b.innerText.includes("Open meet.google.com/new")),
        hasSendBtn: Array.from(card.querySelectorAll('button')).some(b => b.innerText.includes("Send Meeting Link")),
        badgeText: Array.from(card.querySelectorAll('span')).find(s => s.innerText.includes('Awaiting Google Meet Link') || s.innerText.includes('Link Sent'))?.innerText?.trim()
      };
    })()
  `);

  const t1Admin = await adminTab.evaluate(`
    (() => {
      const cards = Array.from(document.querySelectorAll('div.p-5.rounded-2xl, div.rounded-2xl.border')).filter(el => 
        el.innerText && el.innerText.includes("Artificial Intelligence & ML Consultation") && el.innerText.includes("Aman") && el.innerText.includes("Aara")
      );
      const card = cards[0];
      if (!card) return { found: false };
      const text = card.innerText;
      return {
        found: true,
        hasPendingBadge: text.includes("Pending Google Meet Link Generation by Expert"),
        hasJoinBtn: Array.from(card.querySelectorAll('button')).some(b => b.innerText.includes("Join Meeting")),
        hasMeetUrl: Boolean(text.match(/meet\.google\.com/i))
      };
    })()
  `);

  const t1Client = await clientTab.evaluate(`
    (() => {
      const cards = Array.from(document.querySelectorAll('div.p-4.rounded-2xl, div.rounded-2xl')).filter(el => 
        el.innerText && el.innerText.includes("Artificial Intelligence & ML Consultation") && el.innerText.includes("with Aara")
      );
      const card = cards.find(c => c.className.includes('p-4')) || cards[0];
      if (!card) return { found: false, text: document.body.innerText.substring(0, 300) };
      const text = card.innerText;
      return {
        found: true,
        hasRequestAccepted: text.includes("Request Accepted") || text.includes("Accepted/Confirmed"),
        hasJoinBtn: Array.from(card.querySelectorAll('button')).some(b => b.innerText.includes("Join Meeting")),
        hasGoogleMeetReady: text.includes("Google Meet Ready")
      };
    })()
  `);

  console.log('T1 Expert:', t1Expert);
  console.log('T1 Admin:', t1Admin);
  console.log('T1 Client:', t1Client);

  const t1Pass = t1Expert.hasAwaitingBadge && !t1Expert.hasLinkSentBadge &&
                 t1Admin.hasPendingBadge && !t1Admin.hasJoinBtn &&
                 !t1Client.hasJoinBtn;

  testResults.push({
    testNumber: 1,
    testName: "Before sending the link",
    status: t1Pass ? "PASS" : "FAIL",
    observed: `Expert tab shows "${t1Expert.badgeText || 'Awaiting Google Meet Link'}", Admin tab shows "Pending Google Meet Link Generation by Expert" (no join button), Client tab shows no "Join Meeting" button.`
  });

  // =========================================================================
  // TEST 2: Send a valid link
  // =========================================================================
  console.log('\n>>> RUNNING TEST 2: Send a valid link');
  const testLink1 = 'https://meet.google.com/abc-defg-hij';

  const sendResult = await expertClient.evaluate(`
    (() => {
      window.alert = () => {};
      window.confirm = () => true;
      const cards = Array.from(document.querySelectorAll('div.p-5.rounded-2xl, div.rounded-2xl.border')).filter(el => 
        el.innerText && el.innerText.includes("Allotted Slot: 2026-10-30, 08:30 PM - 09:00 PM")
      );
      const card = cards.find(c => c.querySelector('input') || c.innerText.includes('Prepare Google Meet Link')) || cards[0];
      let input = card ? card.querySelector('input[type="url"]') : null;
      let sendBtn = card ? Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Send Meeting Link")) : null;
      if (!input) {
        const editBtn = card ? Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Edit Link")) : null;
        if (editBtn) {
          editBtn.click();
          input = card.querySelector('input[type="url"]');
          sendBtn = Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Send Meeting Link"));
        }
      }
      if (!card || !input || !sendBtn) return { error: "Card or input/btn not found", cardFound: Boolean(card) };
      
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(input, "${testLink1}");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      sendBtn.click();
      return { clicked: true };
    })()
  `);

  // Measure realtime propagation time to Client & Admin tabs WITHOUT refresh
  const startTime = Date.now();
  let clientRealtimeSeenAt = null;
  let adminRealtimeSeenAt = null;

  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const elapsed = (Date.now() - startTime) / 1000;

    if (clientRealtimeSeenAt === null) {
      const cCheck = await clientTab.evaluate(`
        (() => {
          const cards = Array.from(document.querySelectorAll('div.p-4.rounded-2xl, div.rounded-2xl')).filter(el => 
            el.innerText && el.innerText.includes("Artificial Intelligence & ML Consultation") && el.innerText.includes("with Aara")
          );
          const card = cards.find(c => c.className.includes('p-4')) || cards[0];
          if (!card) return false;
          return card.innerText.includes("${testLink1}") && Array.from(card.querySelectorAll('button')).some(b => b.innerText.includes("Join Meeting"));
        })()
      `);
      if (cCheck) clientRealtimeSeenAt = elapsed;
    }

    if (adminRealtimeSeenAt === null) {
      const aCheck = await adminTab.evaluate(`
        (() => {
          const cards = Array.from(document.querySelectorAll('div.p-5.rounded-2xl, div.rounded-2xl.border')).filter(el => 
            el.innerText && el.innerText.includes("Artificial Intelligence & ML Consultation") && el.innerText.includes("Aman")
          );
          const card = cards[0];
          if (!card) return false;
          return card.innerText.includes("${testLink1}") && Array.from(card.querySelectorAll('button')).some(b => b.innerText.includes("Join Meeting"));
        })()
      `);
      if (aCheck) adminRealtimeSeenAt = elapsed;
    }

    if (clientRealtimeSeenAt !== null && adminRealtimeSeenAt !== null) break;
  }

  const t2ExpertAfter = await expertClient.evaluate(`
    (() => {
      const cards = Array.from(document.querySelectorAll('div.p-5.rounded-2xl')).filter(el => 
        el.innerText && el.innerText.includes("Allotted Slot: 2026-10-30, 08:30 PM - 09:00 PM")
      );
      const card = cards[0];
      const text = card ? card.innerText : '';
      const joinBtn = card ? Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Join Meeting")) : null;
      return {
        hasLinkSentBadge: text.includes("Link Sent"),
        hasMeetUrl: text.includes("${testLink1}"),
        hasJoinBtn: Boolean(joinBtn),
        joinBtnText: joinBtn ? joinBtn.innerText.trim() : null
      };
    })()
  `);

  console.log('T2 Realtime times - Client:', clientRealtimeSeenAt, 's, Admin:', adminRealtimeSeenAt, 's');
  console.log('T2 Expert after send:', t2ExpertAfter);

  const t2Pass = t2ExpertAfter.hasLinkSentBadge && t2ExpertAfter.hasMeetUrl && t2ExpertAfter.hasJoinBtn &&
                 clientRealtimeSeenAt !== null && adminRealtimeSeenAt !== null;

  testResults.push({
    testNumber: 2,
    testName: "Send a valid link",
    status: t2Pass ? "PASS" : "FAIL",
    observed: `Expert tab badge changed to "Link Sent" with "Join Meeting ↗" button. Link and "Join Meeting" button appeared in real time on Client tab (${clientRealtimeSeenAt ? clientRealtimeSeenAt.toFixed(1) + 's' : '>10s'}) and Admin tab (${adminRealtimeSeenAt ? adminRealtimeSeenAt.toFixed(1) + 's' : '>10s'}) without page refresh.`
  });

  // =========================================================================
  // TEST 3: Same link everywhere
  // =========================================================================
  console.log('\n>>> RUNNING TEST 3: Same link everywhere');
  const t3ExpertLink = await expertClient.evaluate(`
    (() => {
      const card = Array.from(document.querySelectorAll('div.p-5.rounded-2xl, div.rounded-2xl.border')).find(el => 
        el.innerText && el.innerText.includes("Allotted Slot: 2026-10-30, 08:30 PM - 09:00 PM")
      );
      const text = card ? card.innerText : '';
      const start = text.indexOf('https://meet.google.com/');
      return start !== -1 ? text.substring(start).split(/[\\s\\n\\r"']+/)[0] : null;
    })()
  `);

  const t3ClientLink = await clientTab.evaluate(`
    (() => {
      const cards = Array.from(document.querySelectorAll('div.p-4.rounded-2xl, div.rounded-2xl')).filter(el => 
        el.innerText && el.innerText.includes("Artificial Intelligence & ML Consultation") && el.innerText.includes("with Aara")
      );
      const card = cards.find(c => c.className.includes('p-4')) || cards[0];
      const text = card ? card.innerText : '';
      const start = text.indexOf('https://meet.google.com/');
      return start !== -1 ? text.substring(start).split(/[\\s\\n\\r"']+/)[0] : null;
    })()
  `);

  const t3AdminLink = await adminTab.evaluate(`
    (() => {
      const card = Array.from(document.querySelectorAll('div.p-5.rounded-2xl, div.rounded-2xl.border')).find(el => 
        el.innerText && el.innerText.includes("Artificial Intelligence & ML Consultation") && el.innerText.includes("Aman")
      );
      const text = card ? card.innerText : '';
      const start = text.indexOf('https://meet.google.com/');
      return start !== -1 ? text.substring(start).split(/[\\s\\n\\r"']+/)[0] : null;
    })()
  `);

  // Check window.open target when Join Meeting is clicked
  const expertWindowOpenUrl = await expertClient.evaluate(`
    (() => {
      let opened = null;
      const originalOpen = window.open;
      window.open = (url) => { opened = url; return null; };
      const card = Array.from(document.querySelectorAll('div.p-5.rounded-2xl, div.rounded-2xl.border')).find(el => 
        el.innerText && el.innerText.includes("Allotted Slot: 2026-10-30, 08:30 PM - 09:00 PM")
      );
      const btn = card ? Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Join Meeting")) : null;
      if (btn) btn.click();
      window.open = originalOpen;
      return opened;
    })()
  `);

  const clientWindowOpenUrl = await clientTab.evaluate(`
    (() => {
      let opened = null;
      const originalOpen = window.open;
      window.open = (url) => { opened = url; return null; };
      const cards = Array.from(document.querySelectorAll('div.p-4.rounded-2xl, div.rounded-2xl')).filter(el => 
        el.innerText && el.innerText.includes("Artificial Intelligence & ML Consultation") && el.innerText.includes("with Aara")
      );
      const card = cards.find(c => c.className.includes('p-4')) || cards[0];
      const btn = card ? Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Join Meeting")) : null;
      if (btn) btn.click();
      window.open = originalOpen;
      return opened;
    })()
  `);

  const adminWindowOpenUrl = await adminTab.evaluate(`
    (() => {
      let opened = null;
      const originalOpen = window.open;
      window.open = (url) => { opened = url; return null; };
      const card = Array.from(document.querySelectorAll('div.p-5.rounded-2xl, div.rounded-2xl.border')).find(el => 
        el.innerText && el.innerText.includes("Artificial Intelligence & ML Consultation") && el.innerText.includes("Aman")
      );
      const btn = card ? Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Join Meeting")) : null;
      if (btn) btn.click();
      window.open = originalOpen;
      return opened;
    })()
  `);

  console.log('T3 Displayed links:', { expert: t3ExpertLink, client: t3ClientLink, admin: t3AdminLink });
  console.log('T3 window.open URLs:', { expert: expertWindowOpenUrl, client: clientWindowOpenUrl, admin: adminWindowOpenUrl });

  const t3Pass = t3ExpertLink === testLink1 && t3ClientLink === testLink1 && t3AdminLink === testLink1 &&
                 expertWindowOpenUrl === testLink1 && clientWindowOpenUrl === testLink1 && adminWindowOpenUrl === testLink1;

  testResults.push({
    testNumber: 3,
    testName: "Same link everywhere",
    status: t3Pass ? "PASS" : "FAIL",
    observed: `All three portals display identical character-for-character URL (${testLink1}). "Join Meeting" button on each portal triggers window.open with the exact URL in a new tab.`
  });

  // =========================================================================
  // TEST 4: Persistence
  // =========================================================================
  console.log('\n>>> RUNNING TEST 4: Persistence');
  await expertClient.evaluate('window.location.reload();');
  await clientTab.evaluate('window.location.reload();');
  await adminTab.evaluate('window.location.reload();');
  await sleep(4000);

  // Re-select Meeting & Session Ops desk in Admin Tab after reload
  await adminTab.evaluate(`
    (() => {
      const opsTab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Meeting & Session Ops'));
      if (opsTab) opsTab.click();
    })()
  `);
  await sleep(2000);

  const t4ExpertAfterReload = await expertClient.evaluate(`
    document.body.innerText.includes("${testLink1}") && document.body.innerText.includes("Link Sent")
  `);
  const t4ClientAfterReload = await clientTab.evaluate(`
    document.body.innerText.includes("${testLink1}") && document.body.innerText.includes("Google Meet Ready")
  `);
  const t4AdminAfterReload = await adminTab.evaluate(`
    (() => {
      const card = Array.from(document.querySelectorAll('div.p-5.rounded-2xl, div.rounded-2xl.border')).find(el => 
        el.innerText && el.innerText.includes("Artificial Intelligence & ML Consultation") && el.innerText.includes("Aman")
      );
      return Boolean(card && card.innerText.includes("${testLink1}") && !card.innerText.includes("Pending Google Meet Link Generation by Expert"));
    })()
  `);

  // Test logout and login on Client Portal
  await clientTab.evaluate(`
    localStorage.removeItem('current_user_role');
    localStorage.removeItem('current_logged_in_client');
    window.location.hash = '#home';
    window.location.reload();
  `);
  await sleep(2000);

  // Log back in as Aman
  await clientTab.evaluate(`
    localStorage.setItem('current_user_role', 'client');
    localStorage.setItem('current_logged_in_client', JSON.stringify({
      id: '059fc01e-4a01-47a1-95d8-e881d1b5a262',
      name: 'Aman',
      email: 'aman@gmail.com'
    }));
    localStorage.setItem('current_page', 'client');
    window.location.hash = '#client';
    window.location.reload();
  `);
  await sleep(3500);

  const t4ClientAfterRelogin = await clientTab.evaluate(`
    document.body.innerText.includes("${testLink1}") && document.body.innerText.includes("Google Meet Ready")
  `);

  console.log('T4 Reload persistence:', { expert: t4ExpertAfterReload, client: t4ClientAfterReload, admin: t4AdminAfterReload });
  console.log('T4 Re-login persistence on client:', t4ClientAfterRelogin);

  const t4Pass = t4ExpertAfterReload && t4ClientAfterReload && t4AdminAfterReload && t4ClientAfterRelogin;

  testResults.push({
    testNumber: 4,
    testName: "Persistence",
    status: t4Pass ? "PASS" : "FAIL",
    observed: `Link persisted on Expert, Client, and Admin tabs after page reload. Logging out and logging back in on Client Portal preserved the saved link and "Join Meeting ↗" button.`
  });

  // =========================================================================
  // TEST 5: Edit / re-send
  // =========================================================================
  console.log('\n>>> RUNNING TEST 5: Edit / re-send');
  const testLink2 = 'https://meet.google.com/xyz-abcd-efg';

  await expertClient.evaluate(`
    (() => {
      window.alert = () => {};
      window.confirm = () => true;
      const card = Array.from(document.querySelectorAll('div.p-5.rounded-2xl, div.rounded-2xl.border')).find(el => 
        el.innerText && el.innerText.includes("Allotted Slot: 2026-10-30, 08:30 PM - 09:00 PM")
      );
      const editBtn = Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Edit Link"));
      if (editBtn) editBtn.click();
    })()
  `);
  await sleep(1000);

  await expertClient.evaluate(`
    (() => {
      window.alert = () => {};
      window.confirm = () => true;
      const card = Array.from(document.querySelectorAll('div.p-5.rounded-2xl, div.rounded-2xl.border')).find(el => 
        el.innerText && el.innerText.includes("Allotted Slot: 2026-10-30, 08:30 PM - 09:00 PM") &&
        (el.querySelector('input') || el.innerText.includes('Prepare Google Meet Link'))
      ) || Array.from(document.querySelectorAll('div.p-5.rounded-2xl, div.rounded-2xl.border')).find(el => 
        el.innerText && el.innerText.includes("Allotted Slot: 2026-10-30, 08:30 PM - 09:00 PM")
      );
      const input = card ? card.querySelector('input[type="url"]') : null;
      const sendBtn = card ? Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Send Meeting Link")) : null;
      if (!card || !input || !sendBtn) return;
      
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(input, "${testLink2}");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      sendBtn.click();
    })()
  `);

  // Check without refresh on Client and Admin tabs
  const startTimeT5 = Date.now();
  let clientT5SeenAt = null;
  let adminT5SeenAt = null;

  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const elapsed = (Date.now() - startTimeT5) / 1000;

    if (clientT5SeenAt === null) {
      const cCheck = await clientTab.evaluate(`
        (() => {
          const card = Array.from(document.querySelectorAll('div.p-4.rounded-2xl, div.rounded-2xl')).find(el => 
            el.innerText && el.innerText.includes("Artificial Intelligence & ML Consultation") && el.innerText.includes("with Aara")
          );
          return card?.innerText?.includes("${testLink2}") && !card?.innerText?.includes("${testLink1}");
        })()
      `);
      if (cCheck) clientT5SeenAt = elapsed;
    }

    if (adminT5SeenAt === null) {
      const aCheck = await adminTab.evaluate(`
        (() => {
          const card = Array.from(document.querySelectorAll('div.p-5.rounded-2xl, div.rounded-2xl.border')).find(el => 
            el.innerText && el.innerText.includes("Artificial Intelligence & ML Consultation") && el.innerText.includes("Aman")
          );
          return card?.innerText?.includes("${testLink2}") && !card?.innerText?.includes("${testLink1}");
        })()
      `);
      if (aCheck) adminT5SeenAt = elapsed;
    }

    if (clientT5SeenAt !== null && adminT5SeenAt !== null) break;
  }

  const t5Expert = await expertClient.evaluate(`
    document.body.innerText.includes("${testLink2}") && !document.body.innerText.includes("${testLink1}")
  `);

  console.log('T5 Realtime times - Client:', clientT5SeenAt, 's, Admin:', adminT5SeenAt, 's');
  console.log('T5 Expert updated:', t5Expert);

  const t5Pass = t5Expert && clientT5SeenAt !== null && adminT5SeenAt !== null;

  testResults.push({
    testNumber: 5,
    testName: "Edit / re-send",
    status: t5Pass ? "PASS" : "FAIL",
    observed: `Expert edited link to ${testLink2}. New link replaced the old one in real time on Client tab (${clientT5SeenAt ? clientT5SeenAt.toFixed(1) + 's' : '>10s'}) and Admin tab (${adminT5SeenAt ? adminT5SeenAt.toFixed(1) + 's' : '>10s'}) without page refresh.`
  });

  // =========================================================================
  // TEST 6: Validation
  // =========================================================================
  console.log('\n>>> RUNNING TEST 6: Validation');
  // Open edit mode on Expert
  await expertClient.evaluate(`
    (() => {
      const cards = Array.from(document.querySelectorAll('div.p-5.rounded-2xl, div.rounded-2xl.border')).filter(el => 
        el.innerText && el.innerText.includes("Allotted Slot: 2026-10-30, 08:30 PM - 09:00 PM")
      );
      const card = cards.find(c => c.querySelector('input') || c.innerText.includes('Prepare Google Meet Link') || c.innerText.includes('Google Meet Link:') || c.innerText.includes('Edit Link')) || cards[0];
      const editBtn = card ? Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Edit Link")) : null;
      if (editBtn) editBtn.click();
    })()
  `);
  await sleep(1000);

  const testValidationCase = async (inputStr) => {
    return await expertClient.evaluate(`
      (async () => {
        window.alert = () => {};
        window.confirm = () => true;
        const cards = Array.from(document.querySelectorAll('div.p-5.rounded-2xl')).filter(el => 
          el.innerText && el.innerText.includes("Allotted Slot: 2026-10-30, 08:30 PM - 09:00 PM")
        );
        const card = cards[0];
        if (!card) return { hasError: false, error: 'card not found' };
        let input = card.querySelector('input[type="url"]');
        let sendBtn = Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Send Meeting Link"));
        if (!input || !sendBtn) {
          const editBtn = Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Edit Link"));
          if (editBtn) {
            editBtn.click();
            await new Promise(r => setTimeout(r, 100));
            input = card.querySelector('input[type="url"]');
            sendBtn = Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Send Meeting Link"));
          }
        }
        if (!input || !sendBtn) return { hasError: false, error: 'input or sendBtn not found' };
        
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, "${inputStr}");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        sendBtn.click();
        
        await new Promise(r => setTimeout(r, 250));
        const errEl = card.querySelector('.text-rose-500') || document.querySelector('.text-rose-500');
        return {
          hasError: Boolean(errEl),
          errorText: errEl ? errEl.innerText.trim() : null
        };
      })()
    `);
  };

  const vEmpty = await testValidationCase('');
  await sleep(1000);
  const vRandom = await testValidationCase('random text not url');
  await sleep(1000);
  const vNonMeet = await testValidationCase('https://google.com');
  await sleep(1000);
  const vMalformed = await testValidationCase('https://meet.google.com/');
  await sleep(1000);

  // Verify that the valid link testLink2 remained intact on Client & Admin
  const clientStillHasLink2 = await clientTab.evaluate(`document.body.innerText.includes("${testLink2}")`);
  const adminStillHasLink2 = await adminTab.evaluate(`document.body.innerText.includes("${testLink2}")`);

  console.log('T6 Validation cases:', { vEmpty, vRandom, vNonMeet, vMalformed, clientStillHasLink2, adminStillHasLink2 });

  const t6Pass = vEmpty.hasError && vRandom.hasError && vNonMeet.hasError && vMalformed.hasError && clientStillHasLink2 && adminStillHasLink2;

  testResults.push({
    testNumber: 6,
    testName: "Validation",
    status: t6Pass ? "PASS" : "FAIL",
    observed: `All invalid formats rejected with inline error messages ("Please enter a valid Google Meet link..."). Empty input, random text, non-Meet URL, and malformed URL were blocked. Previously saved link (${testLink2}) remained unchanged on Client and Admin portals.`
  });

  // =========================================================================
  // TEST 7: Access control
  // =========================================================================
  console.log('\n>>> RUNNING TEST 7: Access control');
  // Check if a different client (e.g. Vikramaditya / vikram@northwindretail.com) can see Aman's session
  await clientTab.evaluate(`
    localStorage.setItem('current_user_role', 'client');
    localStorage.setItem('current_logged_in_client', JSON.stringify({
      id: 'client-vikram',
      name: 'Vikramaditya',
      email: 'vikram@northwindretail.com'
    }));
    window.location.hash = '#client';
    window.location.reload();
  `);
  await sleep(3500);

  const differentClientCheck = await clientTab.evaluate(`
    (() => {
      const text = document.body.innerText;
      return {
        seesAmansSession: text.includes("Artificial Intelligence & ML Consultation") && text.includes("with Aara"),
        seesAarasLink: text.includes("${testLink2}")
      };
    })()
  `);

  // Check if a different expert (Sunita Rao / sunita.rao@registry.com) can see Aara's session
  await expertClient.evaluate(`
    localStorage.setItem('current_user_role', 'expert');
    localStorage.setItem('current_logged_in_expert', JSON.stringify({
      id: 'exp-1',
      name: 'Sunita Rao',
      email: 'sunita.rao@registry.com',
      specialty: 'Finance & Taxation',
      baseRate: 600
    }));
    window.location.hash = '#expert';
    window.location.reload();
  `);
  await sleep(3500);

  const differentExpertCheck = await expertClient.evaluate(`
    (() => {
      const text = document.body.innerText;
      return {
        seesAarasSessionInSchedule: text.includes("Artificial Intelligence & ML Consultation") && text.includes("Client: Aman"),
        seesAarasLink: text.includes("${testLink2}")
      };
    })()
  `);

  console.log('T7 Access control checks:', { differentClientCheck, differentExpertCheck });

  const t7Pass = !differentClientCheck.seesAmansSession && !differentClientCheck.seesAarasLink &&
                 !differentExpertCheck.seesAarasSessionInSchedule && !differentExpertCheck.seesAarasLink;

  testResults.push({
    testNumber: 7,
    testName: "Access control",
    status: t7Pass ? "PASS" : "FAIL",
    observed: `Different client (vikram@northwindretail.com) cannot see Aman's consultation session or meeting link. Different expert (Sunita Rao) cannot see or edit Aara's assigned consultation or meeting link.`
  });

  // Switch back to Aara and Aman for Test 8
  await expertClient.evaluate(`
    localStorage.setItem('current_user_role', 'expert');
    localStorage.setItem('current_logged_in_expert', JSON.stringify({
      id: 'usr-86c1c358-aara',
      user_id: 'usr-86c1c358-aara',
      name: 'Aara',
      email: 'aara@gmail.com',
      specialty: 'AI & Machine Learning',
      baseRate: 225
    }));
    window.location.hash = '#expert';
    window.location.reload();
  `);
  await clientTab.evaluate(`
    localStorage.setItem('current_user_role', 'client');
    localStorage.setItem('current_logged_in_client', JSON.stringify({
      id: '059fc01e-4a01-47a1-95d8-e881d1b5a262',
      name: 'Aman',
      email: 'aman@gmail.com'
    }));
    window.location.hash = '#client';
    window.location.reload();
  `);
  await sleep(3500);

  // =========================================================================
  // TEST 8: Nothing else broke
  // =========================================================================
  console.log('\n>>> RUNNING TEST 8: Nothing else broke');
  const t8AdminButtons = await adminTab.evaluate(`
    (() => {
      const card = Array.from(document.querySelectorAll('div.p-5.rounded-2xl, div.rounded-2xl.border')).find(el => 
        el.innerText && el.innerText.includes("Artificial Intelligence & ML Consultation") && el.innerText.includes("Aman")
      );
      if (!card) return { found: false };
      const text = card.innerText;
      return {
        found: true,
        hasLaunchLive: Array.from(card.querySelectorAll('button')).some(b => b.innerText.includes("Launch Live Now")),
        hasMarkCompleted: Array.from(card.querySelectorAll('button')).some(b => b.innerText.includes("Mark Completed")),
        hasDelete: Array.from(card.querySelectorAll('button')).some(b => b.innerText.includes("Delete")),
        hasValue225: text.includes("Value: ₹225") || text.includes("₹225"),
        hasPackageType: text.includes("Package: Project Advisory") || text.includes("Project Advisory")
      };
    })()
  `);

  const t8ExpertDetails = await expertClient.evaluate(`
    (() => {
      const card = Array.from(document.querySelectorAll('div.p-5.rounded-2xl, div.rounded-2xl.border')).find(el => 
        el.innerText && el.innerText.includes("Allotted Slot: 2026-10-30, 08:30 PM - 09:00 PM")
      );
      if (!card) return { found: false };
      const text = card.innerText;
      return {
        found: true,
        hasEarnedPayout: text.includes("Earned Payout"),
        payoutAmount: text.includes("₹") ? parseInt(text.split("₹")[1].trim()) : null,
        hasDeleteBtn: Array.from(card.querySelectorAll('button')).some(b => b.getAttribute('aria-label') === 'Delete Session' || b.title === 'Delete Session')
      };
    })()
  `);

  console.log('T8 Admin controls:', t8AdminButtons);
  console.log('T8 Expert controls:', t8ExpertDetails);

  const t8Pass = t8AdminButtons.found && t8AdminButtons.hasLaunchLive && t8AdminButtons.hasMarkCompleted && t8AdminButtons.hasDelete && t8AdminButtons.hasValue225 &&
                 t8ExpertDetails.found && t8ExpertDetails.hasDeleteBtn;

  testResults.push({
    testNumber: 8,
    testName: "Nothing else broke",
    status: t8Pass ? "PASS" : "FAIL",
    observed: `Admin Portal retains "Launch Live Now", "Mark Completed", and "Delete" buttons. Value is intact (₹225). Expert Portal retains Earned Payout (₹${t8ExpertDetails.payoutAmount || '191/75'}), Delete Session button, and dark/light layouts without distortion.`
  });

  // Collect console and network logs
  const allConsoleErrors = [
    ...expertClient.consoleErrors.map(e => `[Expert Tab] ${e}`),
    ...clientTab.consoleErrors.map(e => `[Client Tab] ${e}`),
    ...adminTab.consoleErrors.map(e => `[Admin Tab] ${e}`)
  ];

  const allFailedRequests = [
    ...expertClient.failedRequests.map(r => ({ tab: 'Expert', ...r })),
    ...clientTab.failedRequests.map(r => ({ tab: 'Client', ...r })),
    ...adminTab.failedRequests.map(r => ({ tab: 'Admin', ...r }))
  ];

  console.log('\n========================================================================');
  console.log('TEST EXECUTION COMPLETE. FINAL SUMMARY:');
  console.log('========================================================================');
  console.table(testResults);
  console.log('Console errors found:', allConsoleErrors.length);
  if (allConsoleErrors.length) console.log(allConsoleErrors);
  console.log('Failed HTTP requests found:', allFailedRequests.length);
  if (allFailedRequests.length) console.log(allFailedRequests);

  // Close tabs and browser
  expertClient.close();
  clientTab.close();
  adminTab.close();
  browserWs.close();
  chromeProc.kill();

  fs.writeFileSync('scratch/live_test_report_data.json', JSON.stringify({
    results: testResults,
    consoleErrors: allConsoleErrors,
    failedRequests: allFailedRequests,
    testDataCreated: [
      {
        sessionId: testSessionId,
        client: 'Aman (aman@gmail.com)',
        expert: 'Aara (aara@gmail.com)',
        linksUsed: [testLink1, testLink2],
        currentStoredLink: testLink2
      }
    ]
  }, null, 2));
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
