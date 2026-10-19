import { createServer } from 'vite';

async function runTests() {
  console.log("Starting Vite dev server for Project Review API testing...");
  const server = await createServer({
    configFile: './vite.config.ts',
    server: { port: 5175, strictPort: true }
  });
  await server.listen();
  const baseUrl = "http://localhost:5175";
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
    // Test 1: GET /api/project-reviews
    console.log("\n--- Test 1: GET /api/project-reviews ---");
    const res1 = await fetch(`${baseUrl}/api/project-reviews`);
    const data1 = await res1.json();
    assert(res1.status === 200, "GET /api/project-reviews returns 200");
    assert(data1.success === true, "data1.success is true");
    assert(Array.isArray(data1.projectReviews), "projectReviews is an array");

    // Test 2: POST /api/project-reviews/request (Initiate Request)
    console.log("\n--- Test 2: POST /api/project-reviews/request ---");
    const testClientId = `client-test-${Date.now()}`;
    const testClientEmail = `client_${Date.now()}@example.com`;
    const testExpertId = "exp-1";
    const testExpertEmail = "sunita.rao@example.com";

    const reqPayload = {
      clientId: testClientId,
      clientName: "Acme Corp Client",
      clientEmail: testClientEmail,
      expertId: testExpertId,
      expertName: "Dr. Sunita Rao",
      expertEmail: testExpertEmail,
      expectedScope: "Architecture review of cloud banking system",
      reviewType: "Cloud Architecture Audit",
      requestNotes: "Need senior review before Q4 compliance audit"
    };

    const res2 = await fetch(`${baseUrl}/api/project-reviews/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqPayload)
    });
    const data2 = await res2.json();
    assert(res2.status === 200, "Request created with HTTP 200");
    assert(data2.success === true, "data2.success is true");
    assert(data2.projectReview && data2.projectReview.projectReviewId.startsWith("pr-"), "Assigned projectReviewId");
    assert(data2.projectReview.status === "PendingExpertAcceptance", "Initial status is PendingExpertAcceptance");
    assert(data2.projectReview.price > 0, `Dynamic price calculated: ₹${data2.projectReview.price}`);
    assert(data2.projectReview.completedMeetingCount === 0, "completedMeetingCount initialized to 0");

    const reviewId = data2.projectReview.projectReviewId;

    // Test 3: Duplicate Request Prevention
    console.log("\n--- Test 3: Duplicate Request Prevention ---");
    const resDup = await fetch(`${baseUrl}/api/project-reviews/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqPayload)
    });
    assert(resDup.status === 409, "Duplicate request rejected with HTTP 409 Conflict");

    // Test 4: Expert Acceptance
    console.log("\n--- Test 4: Expert Acceptance ---");
    const resAccept = await fetch(`${baseUrl}/api/project-reviews/${reviewId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: "accept", responderId: testExpertId, responderRole: "expert" })
    });
    const dataAccept = await resAccept.json();
    assert(resAccept.status === 200, "Expert accept returns HTTP 200");
    assert(dataAccept.projectReview.status === "Accepted", "Status transitioned to Accepted");

    // Test 5: Client Submits Project Materials
    console.log("\n--- Test 5: Client Submits Project Materials ---");
    const subPayload = {
      description: "Core payment gateway microservices repository and architectural spec",
      questions: "How to scale throughput from 500 TPS to 5000 TPS?",
      repositoryUrl: "https://github.com/acme/payment-core",
      demoUrl: "https://staging.acme-payments.internal",
      files: [
        { name: "architecture_diagram.pdf", url: "/uploaded_docs/arch.pdf", size: "2.4 MB", uploadedAt: new Date().toISOString() }
      ]
    };
    const resSub = await fetch(`${baseUrl}/api/project-reviews/${reviewId}/submit-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subPayload)
    });
    const dataSub = await resSub.json();
    assert(resSub.status === 200, "Submit project returns HTTP 200");
    assert(dataSub.projectReview.status === "ProjectSubmitted", "Status transitioned to ProjectSubmitted");
    assert(dataSub.projectReview.submission.repositoryUrl === subPayload.repositoryUrl, "Submission preserved");

    // Test 6: Private Client ↔ Expert Chat
    console.log("\n--- Test 6: Private Chat ---");
    const chatMsg = {
      senderId: testClientId,
      senderRole: "client",
      senderName: "Acme Client",
      content: "Hello Dr. Sunita, I uploaded our architecture docs and repository link."
    };
    const resChat = await fetch(`${baseUrl}/api/project-reviews/${reviewId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatMsg)
    });
    const dataChat = await resChat.json();
    assert(resChat.status === 200, "Chat message sent with HTTP 200");
    assert(dataChat.projectReview.chat.some(m => m.content === chatMsg.content), "Message stored in review chat");

    // Test 7: Meeting Scheduling Discussion
    console.log("\n--- Test 7: Propose and Confirm Meeting 1 ---");
    const propRes = await fetch(`${baseUrl}/api/project-reviews/${reviewId}/propose-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposedBy: "client",
        date: "2026-10-15",
        startTime: "15:00",
        endTime: "16:00",
        reason: "Initial architecture walkthrough"
      })
    });
    const dataProp = await propRes.json();
    assert(propRes.status === 200, "Time proposed with HTTP 200");
    const proposedId = dataProp.projectReview.proposedTimes[0].id;

    // Expert accepts proposed time -> creates meeting 1
    const resConfirmTime = await fetch(`${baseUrl}/api/project-reviews/${reviewId}/respond-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposedTimeId: proposedId, action: "accept", responderRole: "expert" })
    });
    const dataConfirmTime = await resConfirmTime.json();
    assert(resConfirmTime.status === 200, "Time accepted with HTTP 200");
    assert(dataConfirmTime.projectReview.meetings.length === 1, "Meeting 1 created");
    assert(dataConfirmTime.projectReview.status === "MeetingScheduled", "Status is MeetingScheduled");
    const meeting1Id = dataConfirmTime.projectReview.meetings[0].meetingId;

    // Test 8: Expert Generates & Sends Google Meet Link
    console.log("\n--- Test 8: Expert Sends Google Meet Link ---");
    const meetLink = "https://meet.google.com/xyz-abcd-qwe";
    const resMeet = await fetch(`${baseUrl}/api/project-reviews/${reviewId}/send-meet-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId: meeting1Id, googleMeetLink: meetLink })
    });
    const dataMeet = await resMeet.json();
    assert(resMeet.status === 200, "Meet link sent with HTTP 200");
    assert(dataMeet.projectReview.meetings[0].googleMeetLink === meetLink, "Stored same Google Meet link");
    assert(dataMeet.projectReview.meetings[0].meetingStatus === "Upcoming", "Meeting status is Upcoming");

    // Test 9: Complete Meeting 1
    console.log("\n--- Test 9: Complete Meeting 1 ---");
    const resComp1 = await fetch(`${baseUrl}/api/project-reviews/${reviewId}/complete-meeting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId: meeting1Id })
    });
    const dataComp1 = await resComp1.json();
    assert(resComp1.status === 200, "Meeting 1 completed with HTTP 200");
    assert(dataComp1.projectReview.completedMeetingCount === 1, "completedMeetingCount is now 1 / 2");

    // Test 10: Schedule and Complete Meeting 2
    console.log("\n--- Test 10: Schedule and Complete Meeting 2 ---");
    const propRes2 = await fetch(`${baseUrl}/api/project-reviews/${reviewId}/propose-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposedBy: "expert",
        date: "2026-10-20",
        startTime: "16:00",
        endTime: "17:00",
        reason: "Final recommendations debrief"
      })
    });
    const dataProp2 = await propRes2.json();
    const prop2 = dataProp2.projectReview.proposedTimes.find(p => p.status === 'pending');
    const resConfirm2 = await fetch(`${baseUrl}/api/project-reviews/${reviewId}/respond-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposedTimeId: prop2.id, action: "accept", responderRole: "client" })
    });
    const dataConfirm2 = await resConfirm2.json();
    const meeting2Id = dataConfirm2.projectReview.meetings[1].meetingId;

    await fetch(`${baseUrl}/api/project-reviews/${reviewId}/send-meet-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId: meeting2Id, googleMeetLink: "https://meet.google.com/abc-efgh-ijk" })
    });

    const resComp2 = await fetch(`${baseUrl}/api/project-reviews/${reviewId}/complete-meeting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId: meeting2Id })
    });
    const dataComp2 = await resComp2.json();
    assert(dataComp2.projectReview.completedMeetingCount === 2, "completedMeetingCount is now 2 / 2");

    // Test 11: Strict 2-Meeting Limit Enforcement
    console.log("\n--- Test 11: Strict 2-Meeting Limit Enforcement ---");
    const propRes3 = await fetch(`${baseUrl}/api/project-reviews/${reviewId}/propose-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposedBy: "client",
        date: "2026-10-25",
        startTime: "10:00",
        endTime: "11:00",
        reason: "Extra third meeting"
      })
    });
    const dataProp3 = await propRes3.json();
    const prop3 = dataProp3.projectReview.proposedTimes.find(p => p.date === "2026-10-25");
    const resConfirm3 = await fetch(`${baseUrl}/api/project-reviews/${reviewId}/respond-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposedTimeId: prop3.id, action: "accept" })
    });
    assert(resConfirm3.status === 400, "3rd meeting scheduling strictly rejected with HTTP 400");

    // Test 12: Expert Completes Review & Releases Payout
    console.log("\n--- Test 12: Expert Completes Review & Releases Payout ---");
    const resFinal = await fetch(`${baseUrl}/api/project-reviews/${reviewId}/complete-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: "Architecture successfully reviewed. Identified database bottlenecks and recommended Redis caching layer.",
        recommendations: [
          "Deploy Redis cache cluster in front of Postgres",
          "Decouple payment webhook workers via Kafka queue",
          "Enforce circuit breakers on external banking gateway calls"
        ],
        strengths: "Well structured microservices, strong idempotency patterns",
        issues: "Synchronous blocking DB calls under high load"
      })
    });
    const dataFinal = await resFinal.json();
    assert(resFinal.status === 200, "Complete review returns HTTP 200");
    assert(dataFinal.projectReview.status === "Completed", "Review status transitioned to Completed");
    assert(dataFinal.projectReview.expertEarningStatus === "EarningReleased", "Expert earning status is EarningReleased");
    assert(dataFinal.projectReview.expertWalletTxId !== null, "Expert wallet transaction ID recorded");

    // Test 13: Soft Delete / History Archiving
    console.log("\n--- Test 13: History Archiving ---");
    const resArchive = await fetch(`${baseUrl}/api/project-reviews/${reviewId}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: "client" })
    });
    const dataArchive = await resArchive.json();
    assert(resArchive.status === 200, "Archive returns HTTP 200");
    assert(dataArchive.projectReview.clientArchived === true, "clientArchived is true");

    // Verifying it is excluded when querying role=client without includeArchived
    const resFiltered = await fetch(`${baseUrl}/api/project-reviews?clientEmail=${testClientEmail}&role=client`);
    const dataFiltered = await resFiltered.json();
    assert(!dataFiltered.projectReviews.some(r => r.projectReviewId === reviewId), "Archived review hidden from client list");

    // Verifying it is still in database and visible to admin
    const resAdmin = await fetch(`${baseUrl}/api/project-reviews?id=${reviewId}`);
    const dataAdmin = await resAdmin.json();
    assert(dataAdmin.projectReview.projectReviewId === reviewId, "Authoritative record preserved in database for Admin and audit");

  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  } finally {
    await server.close();
    console.log(`\n================================`);
    console.log(`TOTAL TESTS: ${passed + failed}`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);
    console.log(`================================`);
    if (failed > 0) process.exit(1);
  }
}

runTests();
