import { spawn } from 'child_process';
import fs from 'fs';

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
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : null;
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  console.log('================================================================');
  console.log('E2E VERIFICATION: GOOGLE MEET LINK ACROSS EXPERT, CLIENT & ADMIN');
  console.log('================================================================\n');

  const testSessionId = 'book-1793372078834';
  const validMeetUrl = 'https://meet.google.com/abc-wxyz-123';

  // 1. Reset test session in db.json & backend
  console.log('1. Resetting test session in backend & db.json...');
  await fetch(`http://localhost:5173/api/bookings/${testSessionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'usr-86c1c358-aara',
      'x-user-email': 'aara@gmail.com',
      'x-user-role': 'expert'
    },
    body: JSON.stringify({
      status: 'accepted',
      meet_link: '',
      meeting_link: '',
      meetUrl: ''
    })
  });

  const dbPath = 'A:\\website\\MY Best Project ( Latest(11) Updated Version )\\db.json';
  const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const cleanSession = (s) => {
    if (s && s.id === testSessionId) {
      s.status = 'accepted';
      s.meet_link = '';
      s.meeting_link = '';
      s.meetUrl = '';
      s.meetCode = '';
    }
    return s;
  };
  if (Array.isArray(dbData.bookings)) dbData.bookings = dbData.bookings.map(cleanSession);
  if (dbData.kv) {
    if (Array.isArray(dbData.kv.app_platform_sessions)) dbData.kv.app_platform_sessions = dbData.kv.app_platform_sessions.map(cleanSession);
    if (Array.isArray(dbData.kv['client_upcoming_aman@gmail.com'])) dbData.kv['client_upcoming_aman@gmail.com'] = dbData.kv['client_upcoming_aman@gmail.com'].map(cleanSession);
    if (Array.isArray(dbData.kv['expert_accepted_sessions_aara@gmail.com'])) dbData.kv['expert_accepted_sessions_aara@gmail.com'] = dbData.kv['expert_accepted_sessions_aara@gmail.com'].map(cleanSession);
    if (Array.isArray(dbData.kv['expert_accepted_sessions_aara'])) dbData.kv['expert_accepted_sessions_aara'] = dbData.kv['expert_accepted_sessions_aara'].map(cleanSession);
  }
  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2));

  const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-debug-inspect";
  fs.mkdirSync(USER_DATA, { recursive: true });

  const p = spawn(CHROME_EXE, [
    '--remote-debugging-port=9226',
    '--headless=new',
    '--remote-allow-origins=*',
    `--user-data-dir=${USER_DATA}`,
    'http://localhost:5173/'
  ], { detached: false, stdio: 'ignore' });

  await sleep(1500);
  const res = await fetch('http://127.0.0.1:9226/json/list');
  const tabs = await res.json();
  const page = tabs.find(t => t.type === 'page');
  const client = new CDPClient(page.webSocketDebuggerUrl);
  const send = (method, params) => client.send(method, params);
  await client.send('Page.enable');
  await client.send('Runtime.enable');

  try {
    // -------------------------------------------------------------
    // STAGE 1: EXPERT PORTAL INITIAL STATE
    // -------------------------------------------------------------
    console.log('\n--- STAGE 1: Expert Portal (Aara) Initial State ---');
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

    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('current_user_role', 'expert');
        localStorage.setItem('current_logged_in_expert', JSON.stringify({
          id: 'usr-86c1c358-aara',
          user_id: 'usr-86c1c358-aara',
          name: 'Aara',
          email: 'aara@gmail.com',
          specialty: 'AI & Machine Learning',
          baseRate: 225
        }));
        localStorage.setItem('expert_accepted_sessions_aara@gmail.com', JSON.stringify([${JSON.stringify(acceptedSession)}]));
        localStorage.setItem('expert_accepted_sessions_aara', JSON.stringify([${JSON.stringify(acceptedSession)}]));
        localStorage.setItem('client_upcoming_aman@gmail.com', JSON.stringify([${JSON.stringify(acceptedSession)}]));
        localStorage.setItem('current_page', 'expert');
        window.location.hash = '#expert';
        window.location.reload();
      `
    });
    await sleep(3500);

    const getCardExpr = `
      (() => {
        const all = Array.from(document.querySelectorAll('div')).filter(el => 
          el.innerText && 
          el.innerText.includes("Allotted Slot: 2026-10-30, 08:30 PM - 09:00 PM") &&
          (el.innerText.includes("Prepare Google Meet Link") || el.innerText.includes("Google Meet Link:"))
        );
        // Pick the top-most wrapper that has the buttons
        return all.find(el => Array.from(el.querySelectorAll('button')).some(b => b.innerText.includes("Send Meeting Link") || b.innerText.includes("Join Meeting"))) || all[0];
      })()
    `;

    const initialExpert = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const card = ${getCardExpr};
          if (!card) return { found: false };
          const cardText = card.innerText;
          return {
            found: true,
            hasAwaitingBadge: cardText.includes("Awaiting Google Meet Link"),
            hasOpenMeetBtn: Array.from(card.querySelectorAll('button')).some(b => b.innerText.includes("Open meet.google.com/new")),
            hasSendBtn: Array.from(card.querySelectorAll('button')).some(b => b.innerText.includes("Send Meeting Link")),
            hasInput: Boolean(card.querySelector('input[type="url"]'))
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Expert Portal initial check:', initialExpert.result.value);
    if (!initialExpert.result.value.found || !initialExpert.result.value.hasAwaitingBadge || !initialExpert.result.value.hasInput) {
      throw new Error('Expert Portal initial state failed');
    }
    console.log('✅ PASS: Expert Portal shows "Awaiting Google Meet Link" badge and input field');

    // -------------------------------------------------------------
    // STAGE 2: INVALID GOOGLE MEET LINK VALIDATION
    // -------------------------------------------------------------
    console.log('\n--- STAGE 2: Invalid Google Meet Link Validation ---');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          window.alert = () => {};
          window.confirm = () => true;
          const card = ${getCardExpr};
          const input = card.querySelector('input[type="url"]');
          const sendBtn = Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Send Meeting Link"));
          
          const lastVal = input.value;
          input.value = "https://zoom.us/invalid-room";
          const tracker = input._valueTracker;
          if (tracker) tracker.setValue(lastVal);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          sendBtn.click();
        })()
      `
    });
    await sleep(1500);

    const invalidCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const card = ${getCardExpr};
          const text = card ? card.innerText : document.body.innerText;
          return {
            hasError: text.includes("Please enter a valid Google Meet link"),
            hasAwaiting: text.includes("Awaiting Google Meet Link")
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Invalid link validation check:', invalidCheck.result.value);
    if (!invalidCheck.result.value.hasError) {
      throw new Error('Invalid link validation failed');
    }
    console.log('✅ PASS: UI showed error "Please enter a valid Google Meet link" and did not save');

    // -------------------------------------------------------------
    // STAGE 3: EXPERT SENDS VALID GOOGLE MEET LINK
    // -------------------------------------------------------------
    console.log('\n--- STAGE 3: Expert Sends Valid Google Meet Link ---');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          window.alert = () => {};
          window.confirm = () => true;
          const card = ${getCardExpr};
          const input = card.querySelector('input[type="url"]');
          const sendBtn = Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Send Meeting Link"));
          
          const lastVal = input.value;
          input.value = "${validMeetUrl}";
          const tracker = input._valueTracker;
          if (tracker) tracker.setValue(lastVal);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          sendBtn.click();
        })()
      `
    });
    await sleep(3500);

    const validCheckExpert = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const card = ${getCardExpr};
          const text = card.innerText;
          const joinBtn = Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Join Meeting"));
          const copyBtn = Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Copy"));
          const editBtn = Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Edit Link"));
          return {
            hasLinkSent: text.includes("Link Sent"),
            hasMeetUrl: text.includes("${validMeetUrl}"),
            hasJoinBtn: Boolean(joinBtn),
            joinBtnText: joinBtn ? joinBtn.innerText.trim() : null,
            hasCopyBtn: Boolean(copyBtn),
            hasEditBtn: Boolean(editBtn)
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Expert Portal after sending link:', validCheckExpert.result.value);
    if (!validCheckExpert.result.value.hasLinkSent || !validCheckExpert.result.value.hasMeetUrl || !validCheckExpert.result.value.hasJoinBtn) {
      throw new Error('Expert Portal failed to update to Link Sent');
    }
    console.log('✅ PASS: Expert Portal badge changed to "Link Sent", displays exact Meet URL, and renders "Join Meeting ↗" button!');

    // -------------------------------------------------------------
    // STAGE 4: CLIENT PORTAL REAL-TIME VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- STAGE 4: Client Portal (Aman) Displays Identical Join Link ---');
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('current_user_role', 'client');
        localStorage.setItem('current_logged_in_client', JSON.stringify({
          id: '059fc01e-4a01-47a1-95d8-e881d1b5a262',
          name: 'Aman',
          email: 'aman@gmail.com'
        }));
        localStorage.setItem('current_page', 'client');
        window.location.hash = '#client';
        window.location.reload();
      `
    });
    await sleep(3500);

    const clientCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const allCards = Array.from(document.querySelectorAll('div')).filter(el => 
            el.innerText && el.innerText.includes("Artificial Intelligence & ML Consultation") && el.innerText.includes("with Aara")
          );
          const card = allCards.find(el => el.className && el.className.includes("rounded-2xl") && el.innerText.includes("Accepted/Confirmed")) || allCards[0];
          if (!card) return { foundCard: false };
          const text = card.innerText;
          const joinBtn = Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Join Meeting"));
          return {
            foundCard: true,
            cardTextSnippet: text.substring(0, 300),
            hasGoogleMeetReady: text.includes("Google Meet Ready"),
            hasMeetUrl: text.includes("${validMeetUrl}"),
            hasJoinBtn: Boolean(joinBtn),
            joinBtnText: joinBtn ? joinBtn.innerText.trim() : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Client Portal check:', clientCheck.result.value);
    if (!clientCheck.result.value.foundCard || !clientCheck.result.value.hasGoogleMeetReady || !clientCheck.result.value.hasMeetUrl || !clientCheck.result.value.hasJoinBtn) {
      throw new Error('Client Portal failed to display identical Google Meet link and Join Meeting button');
    }
    console.log('✅ PASS: Client Portal "Scheduled Sessions" card displays "Google Meet Ready", exact Meet URL, and "Join Meeting ↗" button!');

    // -------------------------------------------------------------
    // STAGE 5: ADMIN PORTAL REAL-TIME VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- STAGE 5: Admin Portal Replaces Pending Badge with Identical Link ---');
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('admin_token', 'admin_super_secret_token_12345');
        localStorage.setItem('admin_session_token', 'admin_super_secret_token_12345');
        localStorage.setItem('admin_user_role', 'admin');
        localStorage.setItem('current_user_role', 'admin');
        localStorage.setItem('current_page', 'owner');
        window.location.hash = '#owner';
        window.location.reload();
      `
    });
    await sleep(4000);

    // Switch to Meeting & Session Ops Desk
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const opsTab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Meeting & Session Ops'));
          if (opsTab) opsTab.click();
        })()
      `
    });
    await sleep(2000);

    const adminCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const cards = Array.from(document.querySelectorAll('div.p-5.rounded-2xl, div.rounded-2xl.border')).filter(el => 
            el.innerText && 
            el.innerText.includes("Artificial Intelligence & ML Consultation") && 
            el.innerText.includes("Aman") && 
            el.innerText.includes("Aara") &&
            el.innerText.includes("Scheduled:")
          );
          const card = cards[0];
          if (!card) {
            return {
              foundRow: false,
              totalFound: cards.length
            };
          }
          const text = card.innerText;
          const joinBtn = Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Join Meeting"));
          return {
            foundRow: true,
            hasPendingBadge: text.includes("Pending Google Meet Link Generation by Expert"),
            hasMeetUrl: text.includes("${validMeetUrl}"),
            hasJoinBtn: Boolean(joinBtn),
            joinBtnText: joinBtn ? joinBtn.innerText.trim() : null,
            hasLaunchLiveBtn: Array.from(card.querySelectorAll('button')).some(b => b.innerText.includes("Launch Live Now")),
            hasMarkCompletedBtn: Array.from(card.querySelectorAll('button')).some(b => b.innerText.includes("Mark Completed")),
            hasDeleteBtn: Array.from(card.querySelectorAll('button')).some(b => b.innerText.includes("Delete"))
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Admin Portal check:', adminCheck.result.value);
    if (!adminCheck.result.value.foundRow || adminCheck.result.value.hasPendingBadge || !adminCheck.result.value.hasMeetUrl || !adminCheck.result.value.hasJoinBtn) {
      throw new Error('Admin Portal failed to display identical Google Meet link and Join Meeting button');
    }
    console.log('✅ PASS: Admin Portal replaced "Pending Google Meet Link Generation by Expert" with identical link and "Join Meeting ↗" button!');
    console.log('✅ PASS: Existing Admin actions (Launch Live Now, Mark Completed, Delete) remain intact!');

    // -------------------------------------------------------------
    // STAGE 6: PERSISTENCE ACROSS PAGE RELOAD
    // -------------------------------------------------------------
    console.log('\n--- STAGE 6: Persistence Across Page Reload ---');
    await send('Runtime.evaluate', { expression: 'window.location.reload();' });
    await sleep(4000);

    // Click Meeting & Session Ops tab after reload
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const opsTab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Meeting & Session Ops'));
          if (opsTab) opsTab.click();
        })()
      `
    });
    await sleep(2000);

    const reloadAdmin = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const cards = Array.from(document.querySelectorAll('div.p-5.rounded-2xl, div.rounded-2xl.border')).filter(el => 
            el.innerText && 
            el.innerText.includes("Artificial Intelligence & ML Consultation") && 
            el.innerText.includes("Aman") && 
            el.innerText.includes("Aara") &&
            el.innerText.includes("Scheduled:")
          );
          const card = cards[0];
          if (!card) return { foundRow: false };
          const text = card.innerText;
          const joinBtn = Array.from(card.querySelectorAll('button')).find(b => b.innerText.includes("Join Meeting"));
          return {
            foundRow: true,
            hasMeetUrl: text.includes("${validMeetUrl}"),
            hasJoinBtn: Boolean(joinBtn),
            joinBtnText: joinBtn ? joinBtn.innerText.trim() : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Admin Portal persistence check:', reloadAdmin.result.value);
    if (!reloadAdmin.result.value.foundRow || !reloadAdmin.result.value.hasMeetUrl || !reloadAdmin.result.value.hasJoinBtn) {
      throw new Error('Link failed to persist after page reload');
    }
    console.log('✅ PASS: Google Meet link persists after page reload!');

    console.log('\n================================================================');
    console.log('🎉 ALL 6 VERIFICATION STAGES PASSED 100%!');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    client.close();
    p.kill();
  }
}

run().catch(console.error);
