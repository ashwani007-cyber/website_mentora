import { createServer } from 'vite';
import fs from 'fs';

async function runTests() {
  console.log("Starting Vite dev server for Notification API testing...");
  const server = await createServer({
    configFile: './vite.config.ts',
    server: { port: 5176, strictPort: true }
  });
  await server.listen();
  const baseUrl = "http://localhost:5176";
  console.log(`Server listening at ${baseUrl}`);

  let passed = 0;
  let failed = 0;

  function assert(cond, desc) {
    if (cond) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✕ FAIL: ${desc}`);
      failed++;
    }
  }

  try {
    // Test 1: GET /api/notifications (Admin sees all, unauthenticated sees public)
    console.log("\n--- Test 1: GET /api/notifications ---");
    const resAdmin = await fetch(`${baseUrl}/api/notifications?role=admin`);
    const dataAdmin = await resAdmin.json();
    assert(resAdmin.status === 200, "GET /api/notifications?role=admin returns 200");
    assert(dataAdmin.success === true, "dataAdmin.success === true");
    assert(Array.isArray(dataAdmin.notifications), "Returns notifications array");
    assert(dataAdmin.notifications.length >= 4, "Admin sees all seeded notifications (>= 4)");

    const resPublic = await fetch(`${baseUrl}/api/notifications`);
    const dataPublic = await resPublic.json();
    assert(resPublic.status === 200, "GET /api/notifications (public) returns 200");
    assert(dataPublic.notifications.every(n => n.target === 'landing' || n.target === 'all'), "Public sees only landing & all");

    // Test 2: Validation - missing title/message rejected with 400
    console.log("\n--- Test 2: Reject Missing Title or Message ---");
    const resInvalid = await fetch(`${baseUrl}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'expert', title: '', message: '' })
    });
    assert(resInvalid.status === 400, "Missing title/message rejected with 400 Bad Request");

    // Test 3: Broadcast to Experts
    console.log("\n--- Test 3: POST /api/notifications (Broadcast -> Experts) ---");
    const resExpert = await fetch(`${baseUrl}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: 'expert',
        title: 'Senior Advisory Protocol Update',
        message: 'All verified experts must review revised GST advisory rate policies.'
      })
    });
    const dataExpert = await resExpert.json();
    assert(resExpert.status === 200, "Expert broadcast created with 200 OK");
    assert(dataExpert.success === true, "Response has success: true");
    assert(dataExpert.notification.target === 'expert', "target is expert");
    assert(dataExpert.notification.read === false, "read is false initially");
    assert(dataExpert.notification.status === 'delivered', "status is delivered");

    // Test 4: Broadcast to Clients
    console.log("\n--- Test 4: POST /api/notifications (Broadcast -> Clients) ---");
    const resClient = await fetch(`${baseUrl}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: 'client',
        title: 'New IAS Retainer Packages Available',
        message: 'Explore exclusive enterprise advisory retainers with former Chief Secretaries.'
      })
    });
    const dataClient = await resClient.json();
    assert(resClient.status === 200, "Client broadcast created with 200 OK");
    assert(dataClient.notification.target === 'client', "target is client");

    // Test 5: Broadcast to Landing Page
    console.log("\n--- Test 5: POST /api/notifications (Broadcast -> Landing Page) ---");
    const resLanding = await fetch(`${baseUrl}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: 'landing',
        title: 'Welcome to India\'s Premier CXO Advisory Network',
        message: 'Over 3,000+ retired senior directors and civil servants available for strategic guidance.'
      })
    });
    const dataLanding = await resLanding.json();
    assert(resLanding.status === 200, "Landing broadcast created with 200 OK");
    assert(dataLanding.notification.target === 'landing', "target is landing");

    // Test 6: Individual Notification targeting specific expert
    console.log("\n--- Test 6: POST /api/notifications (Individual -> Expert exp-1) ---");
    const resIndivExp = await fetch(`${baseUrl}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: 'expert',
        recipientId: 'exp-1',
        recipientName: 'Sunita Rao',
        title: 'Direct Message for Sunita Rao',
        message: 'Your tenure document has been verified by Admin.'
      })
    });
    const dataIndivExp = await resIndivExp.json();
    assert(resIndivExp.status === 200, "Individual notification created with 200 OK");
    assert(dataIndivExp.notification.recipientId === 'exp-1', "recipientId is exp-1");

    // Test 7: Recipient Filtering - Landing Page
    console.log("\n--- Test 7: Query role=landing ---");
    const resQueryLanding = await fetch(`${baseUrl}/api/notifications?role=landing`);
    const dataQueryLanding = await resQueryLanding.json();
    assert(resQueryLanding.status === 200, "Query role=landing returns 200");
    assert(dataQueryLanding.notifications.every(n => n.target === 'landing' || n.target === 'all'), "Landing page ONLY sees landing and all broadcasts");
    assert(!dataQueryLanding.notifications.some(n => n.target === 'expert' || n.target === 'client'), "Landing page DOES NOT see expert or client notifications");

    // Test 8: Recipient Filtering - Expert Portal
    console.log("\n--- Test 8: Query role=expert for exp-1 vs exp-2 ---");
    const resQueryExp1 = await fetch(`${baseUrl}/api/notifications?role=expert&recipientId=exp-1`);
    const dataQueryExp1 = await resQueryExp1.json();
    assert(dataQueryExp1.notifications.some(n => n.title === 'Senior Advisory Protocol Update'), "exp-1 sees expert broadcast");
    assert(dataQueryExp1.notifications.some(n => n.title === 'Direct Message for Sunita Rao'), "exp-1 sees their own individual notification");
    assert(!dataQueryExp1.notifications.some(n => n.target === 'client'), "exp-1 does NOT see client notifications");

    const resQueryExp2 = await fetch(`${baseUrl}/api/notifications?role=expert&recipientId=exp-2`);
    const dataQueryExp2 = await resQueryExp2.json();
    assert(dataQueryExp2.notifications.some(n => n.title === 'Senior Advisory Protocol Update'), "exp-2 sees expert broadcast");
    assert(!dataQueryExp2.notifications.some(n => n.title === 'Direct Message for Sunita Rao'), "exp-2 DOES NOT see exp-1's individual notification (No leakage)");

    // Test 9: Recipient Filtering - Client Portal
    console.log("\n--- Test 9: Query role=client ---");
    const resQueryClient = await fetch(`${baseUrl}/api/notifications?role=client`);
    const dataQueryClient = await resQueryClient.json();
    assert(dataQueryClient.notifications.some(n => n.title === 'New IAS Retainer Packages Available'), "Client sees client broadcast");
    assert(!dataQueryClient.notifications.some(n => n.target === 'expert'), "Client does NOT see expert broadcast");

    // Test 10: Mark as Read
    console.log("\n--- Test 10: POST /api/notifications/mark-read ---");
    const notifToRead = dataExpert.notification.id;
    const resRead = await fetch(`${baseUrl}/api/notifications/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: notifToRead })
    });
    const dataRead = await resRead.json();
    assert(resRead.status === 200, "Mark read returns 200");
    assert(dataRead.read === true, "read is true");

    // Verify in db.json
    const dbRaw = JSON.parse(fs.readFileSync('db.json', 'utf8'));
    const inDb = dbRaw.notifications.find(n => n.id === notifToRead);
    assert(inDb && inDb.read === true, "db.json persists read=true");

    console.log("\nAll backend notification API tests completed successfully!");
  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  } finally {
    await server.close();
    console.log("Server stopped.");
    console.log(`\n========================================\nTOTAL PASSED: ${passed}\nTOTAL FAILED: ${failed}\n========================================`);
  }
}

runTests();
