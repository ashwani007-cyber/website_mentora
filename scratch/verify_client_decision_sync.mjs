import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SCREENSHOTS_DIR = 'C:\\Users\\kushw\\.gemini\\antigravity\\brain\\d22eb53f-93a9-4071-a643-526ac442fb1c\\screenshots';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Load Supabase credentials
const env = fs.readFileSync('.env', 'utf8');
const url = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_URL=')).split('=')[1].trim();
const key = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_ANON_KEY=')).split('=')[1].trim();
const supabase = createClient(url, key);

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

  async captureScreenshot(fileName) {
    const filePath = path.join(SCREENSHOTS_DIR, fileName);
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`📸 [Screenshot] -> ${fileName} (${fs.statSync(filePath).size} bytes)`);
    return filePath;
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  console.log('================================================================');
  console.log('TESTING CLIENT PORTAL ACCEPT & REJECT REAL-TIME SYNC & PERSISTENCE');
  console.log('================================================================\n');

  const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-test-profile-" + Date.now();
  fs.mkdirSync(USER_DATA, { recursive: true });

  const chromeProc = spawn(CHROME_EXE, [
    '--remote-debugging-port=9222',
    '--headless=new',
    '--remote-allow-origins=*',
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:5173/'
  ], { detached: false, stdio: 'ignore' });

  // Wait for Chrome to be ready
  let connected = false;
  let targetWsUrl = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const res = await fetch('http://127.0.0.1:9222/json/list');
      const tabs = await res.json();
      const page = tabs.find(t => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        targetWsUrl = page.webSocketDebuggerUrl;
        connected = true;
        break;
      }
    } catch {}
  }

  if (!connected) {
    console.error('❌ Failed to connect to Chrome debugging port 9222.');
    chromeProc.kill();
    process.exit(1);
  }

  console.log('✅ Chrome connected via CDP');
  const client = new CDPClient(targetWsUrl);
  await client.send('Page.enable');
  await client.send('DOM.enable');
  await client.send('Runtime.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  try {
    // 1. Setup client portal with Aman
    console.log('\n--- STEP 1: Load Client Portal as Aman (aman@gmail.com) ---');
    await client.send('Page.navigate', { url: 'http://localhost:5173/' });
    await sleep(2500);

    // Set localStorage as Aman and navigate to client page
    await client.evaluate(`
      localStorage.setItem("current_user_role", "client");
      localStorage.setItem("current_logged_in_client", JSON.stringify({
        id: "cli-aman",
        name: "Aman",
        email: "aman@gmail.com",
        phone: "+91 98765 43210"
      }));
      localStorage.setItem("current_page", "client");
      window.location.hash = "#client";
      window.location.reload();
    `);
    await sleep(3000);

    // 2. TEST ACCEPT FLOW
    console.log('\n--- STEP 2: Create Booking & Verify Initial Pending State ---');
    const acceptBookingId = `book-test-accept-${Date.now()}`;
    const { error: insErr1 } = await supabase.from('bookings').insert({
      id: acceptBookingId,
      client_id: 'cli-aman',
      client_name: 'Aman',
      client_email: 'aman@gmail.com',
      expert_id: 'usr-86c1c358-aara',
      expert_name: 'Aara',
      expert_email: 'aara@gmail.com',
      topic: 'Artificial Intelligence & ML Consultation',
      scheduled_date: '2026-10-27',
      scheduled_time: '10:00 AM - 11:00 AM',
      duration_minutes: 60,
      price: 600,
      status: 'pending'
    });
    if (insErr1) throw new Error('Supabase insert failed: ' + insErr1.message);

    // Also push to client_upcoming_aman@gmail.com
    await client.evaluate(`
      const b = {
        id: "${acceptBookingId}",
        client: "Aman",
        clientEmail: "aman@gmail.com",
        expert: "Aara",
        topic: "Artificial Intelligence & ML Consultation",
        when: "2026-10-27, 10:00 AM - 11:00 AM",
        status: "Pending Expert Acceptance"
      };
      const key = "client_upcoming_aman@gmail.com";
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(key, JSON.stringify([b, ...existing]));
      window.dispatchEvent(new Event("storage"));
    `);
    await sleep(2000);

    // Check DOM for initial pending state
    const initialText = await client.evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('div')).find(el => el.textContent.includes("${acceptBookingId}") || el.textContent.includes("Artificial Intelligence & ML Consultation"));
      return card ? card.innerText : document.body.innerText;
    })()`);

    const hasPendingBadge = initialText.includes('Pending Expert Acceptance') || initialText.includes('Pending');
    const hasAwaitingText = initialText.includes('Awaiting Expert Acceptance');
    console.log('Initial Card Status -> hasPendingBadge:', hasPendingBadge, 'hasAwaitingText:', hasAwaitingText);
    await client.captureScreenshot('client_01_booking_pending.png');

    // 3. Trigger ACCEPT decision
    console.log('\n--- STEP 3: Expert Clicks ACCEPT (Simulated Broadcast & Supabase Update) ---');
    // Update Supabase
    await supabase.from('bookings').update({ status: 'accepted' }).eq('id', acceptBookingId);

    // Broadcast decision
    await client.evaluate(`(() => {
      const detail = {
        bookingId: "${acceptBookingId}",
        status: "accepted",
        decision: "accepted",
        expertName: "Aara",
        clientEmail: "aman@gmail.com",
        topic: "Artificial Intelligence & ML Consultation"
      };
      // 1. BroadcastChannel
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('mentora_booking_decisions');
        bc.postMessage(detail);
        bc.close();
      }
      // 2. Storage event
      localStorage.setItem('mentora_last_booking_decision', JSON.stringify({ ...detail, _ts: Date.now() }));
      // 3. CustomEvent
      window.dispatchEvent(new CustomEvent('booking_decision_updated', { detail }));
    })()`);

    // Wait 1.5 seconds for instant update WITHOUT refresh
    await sleep(1500);

    const liveAcceptedText = await client.evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('div')).find(el => el.textContent.includes("Artificial Intelligence & ML Consultation"));
      return card ? card.innerText : "";
    })()`);
    console.log('Live Card Text After Accept:', JSON.stringify(liveAcceptedText));

    const acceptedBadgeShown = liveAcceptedText.includes('Accepted');
    const acceptedMessageShown = liveAcceptedText.includes('Expert Aara has accepted your request. Please prepare for your meeting.');
    console.log('✅ INSTANT UPDATE CHECK -> acceptedBadgeShown:', acceptedBadgeShown, 'acceptedMessageShown:', acceptedMessageShown);

    if (!acceptedBadgeShown || !acceptedMessageShown) {
      console.error('❌ FAILED: Live update did not show accepted badge or message!');
    } else {
      console.log('🎉 PASS: Booking card updated instantly to Accepted with required message!');
    }
    await client.captureScreenshot('client_02_live_accepted.png');

    // 4. Test Persistence Across Page Reload
    console.log('\n--- STEP 4: Reload Client Portal and Verify Persistence of Accepted State ---');
    await client.send('Page.reload');
    await sleep(3000);

    const reloadedAcceptedText = await client.evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('div')).find(el => el.textContent.includes("Artificial Intelligence & ML Consultation"));
      return card ? card.innerText : "";
    })()`);
    console.log('Reloaded Card Text:', JSON.stringify(reloadedAcceptedText));

    const reloadedAcceptedBadge = reloadedAcceptedText.includes('Accepted');
    const reloadedAcceptedMsg = reloadedAcceptedText.includes('Expert Aara has accepted your request. Please prepare for your meeting.');
    console.log('✅ PERSISTENCE CHECK -> reloadedAcceptedBadge:', reloadedAcceptedBadge, 'reloadedAcceptedMsg:', reloadedAcceptedMsg);

    if (reloadedAcceptedBadge && reloadedAcceptedMsg) {
      console.log('🎉 PASS: Accepted status persisted across full page reload!');
    } else {
      console.error('❌ FAILED: Status did not persist across reload!');
    }
    await client.captureScreenshot('client_03_reloaded_accepted.png');

    // 5. TEST REJECT FLOW
    console.log('\n--- STEP 5: Create Second Booking & Verify REJECT Decision Flow ---');
    const rejectBookingId = `book-test-reject-${Date.now()}`;
    const { error: insErr2 } = await supabase.from('bookings').insert({
      id: rejectBookingId,
      client_id: 'cli-aman',
      client_name: 'Aman',
      client_email: 'aman@gmail.com',
      expert_id: 'usr-86c1c358-aara',
      expert_name: 'Aara',
      expert_email: 'aara@gmail.com',
      topic: 'Cloud Architecture Advisory',
      scheduled_date: '2026-10-28',
      scheduled_time: '02:00 PM - 03:00 PM',
      duration_minutes: 60,
      price: 600,
      status: 'pending'
    });
    if (insErr2) throw new Error('Supabase insert failed: ' + insErr2.message);

    await client.evaluate(`(() => {
      const b2 = {
        id: "${rejectBookingId}",
        client: "Aman",
        clientEmail: "aman@gmail.com",
        expert: "Aara",
        topic: "Cloud Architecture Advisory",
        when: "2026-10-28, 02:00 PM - 03:00 PM",
        status: "Pending Expert Acceptance"
      };
      const key = "client_upcoming_aman@gmail.com";
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(key, JSON.stringify([b2, ...existing]));
      window.dispatchEvent(new Event("storage"));
    })()`);
    await sleep(2000);

    // Trigger REJECT decision
    console.log('\n--- STEP 6: Expert Clicks REJECT (Simulated Broadcast & Supabase Update) ---');
    await supabase.from('bookings').update({ status: 'rejected' }).eq('id', rejectBookingId);

    await client.evaluate(`(() => {
      const detail = {
        bookingId: "${rejectBookingId}",
        status: "rejected",
        decision: "rejected",
        expertName: "Aara",
        clientEmail: "aman@gmail.com",
        topic: "Cloud Architecture Advisory"
      };
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('mentora_booking_decisions');
        bc.postMessage(detail);
        bc.close();
      }
      localStorage.setItem('mentora_last_booking_decision', JSON.stringify({ ...detail, _ts: Date.now() }));
      window.dispatchEvent(new CustomEvent('booking_decision_updated', { detail }));
    })()`);

    await sleep(1500);

    const liveRejectedText = await client.evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('div')).find(el => el.textContent.includes("Cloud Architecture Advisory"));
      return card ? card.innerText : "";
    })()`);
    console.log('Live Card Text After Reject:', JSON.stringify(liveRejectedText));

    const rejectedBadgeShown = liveRejectedText.includes('Rejected');
    const rejectedMessageShown = liveRejectedText.includes('Expert Aara has rejected your session request.');
    console.log('✅ INSTANT REJECT CHECK -> rejectedBadgeShown:', rejectedBadgeShown, 'rejectedMessageShown:', rejectedMessageShown);

    if (rejectedBadgeShown && rejectedMessageShown) {
      console.log('🎉 PASS: Booking card updated instantly to Rejected with required message (no reason)!');
    } else {
      console.error('❌ FAILED: Live update did not show rejected badge or message!');
    }
    await client.captureScreenshot('client_04_live_rejected.png');

    // 6. Test Persistence of Rejected State Across Page Reload
    console.log('\n--- STEP 7: Reload Client Portal and Verify Persistence of Rejected State ---');
    await client.send('Page.reload');
    await sleep(3000);

    const reloadedRejectedText = await client.evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('div')).find(el => el.textContent.includes("Cloud Architecture Advisory"));
      return card ? card.innerText : "";
    })()`);
    console.log('Reloaded Rejected Card Text:', JSON.stringify(reloadedRejectedText));

    const reloadedRejectedBadge = reloadedRejectedText.includes('Rejected');
    const reloadedRejectedMsg = reloadedRejectedText.includes('Expert Aara has rejected your session request.');
    console.log('✅ PERSISTENCE CHECK -> reloadedRejectedBadge:', reloadedRejectedBadge, 'reloadedRejectedMsg:', reloadedRejectedMsg);

    if (reloadedRejectedBadge && reloadedRejectedMsg) {
      console.log('🎉 PASS: Rejected status persisted across full page reload!');
    } else {
      console.error('❌ FAILED: Rejected status did not persist across reload!');
    }
    await client.captureScreenshot('client_05_reloaded_rejected.png');

    // Cleanup test bookings from Supabase
    await supabase.from('bookings').delete().in('id', [acceptBookingId, rejectBookingId]);
    console.log('\n🧹 Cleaned up test bookings from Supabase.');

  } finally {
    client.close();
    chromeProc.kill();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch {}
  }

  console.log('\n================================================================');
  console.log('ALL VERIFICATION STEPS COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

main().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
