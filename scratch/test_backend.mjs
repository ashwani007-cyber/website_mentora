import { createServer } from 'vite';

async function runTests() {
  console.log("Starting Vite dev server for API testing...");
  const server = await createServer({
    configFile: './vite.config.ts',
    server: { port: 5174, strictPort: true }
  });
  await server.listen();
  const baseUrl = "http://localhost:5174";
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
    // Test 1: GET /api/availability
    console.log("\n--- Test 1: GET /api/availability ---");
    const res1 = await fetch(`${baseUrl}/api/availability`);
    const data1 = await res1.json();
    assert(res1.status === 200, "GET /api/availability returns 200");
    assert(data1.success === true, "data1.success === true");
    assert(Array.isArray(data1.availabilities), "Returns availabilities array");
    assert(data1.availabilities.length >= 7, "Contains seeded availabilities");

    // Test 2: Filter by expertId
    console.log("\n--- Test 2: Filter by expertId=exp-1 ---");
    const res2 = await fetch(`${baseUrl}/api/availability?expertId=exp-1`);
    const data2 = await res2.json();
    assert(data2.availabilities.every(a => a.expertId === 'exp-1'), "All results belong to exp-1");

    // Test 3: Reject past dates
    console.log("\n--- Test 3: Reject Past Dates ---");
    const resPast = await fetch(`${baseUrl}/api/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: 'exp-1',
        availabilityDate: '2020-01-01',
        startTime: '10:00 AM',
        endTime: '11:00 AM'
      })
    });
    assert(resPast.status === 400, "Past date rejected with status 400");

    // Test 4: Reject invalid time range (start >= end)
    console.log("\n--- Test 4: Reject Invalid Time Range (start >= end) ---");
    const resInvalidTime = await fetch(`${baseUrl}/api/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: 'exp-1',
        availabilityDate: '2026-11-20',
        startTime: '04:00 PM',
        endTime: '03:00 PM'
      })
    });
    assert(resInvalidTime.status === 400, "Start >= End rejected with status 400");

    // Test 5: Reject Client creating availability (Permission check)
    console.log("\n--- Test 5: Reject Client Permission ---");
    const resClientPerm = await fetch(`${baseUrl}/api/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: 'exp-1',
        availabilityDate: '2026-11-20',
        startTime: '10:00 AM',
        endTime: '11:00 AM',
        requesterRole: 'client'
      })
    });
    assert(resClientPerm.status === 403, "Client role rejected with 403 Forbidden");

    // Test 6: Create valid availability
    console.log("\n--- Test 6: Create Valid Availability ---");
    const resCreate = await fetch(`${baseUrl}/api/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: 'exp-1',
        availabilityDate: '2026-11-20',
        startTime: '10:00 AM',
        endTime: '11:00 AM',
        status: 'AVAILABLE'
      })
    });
    const dataCreate = await resCreate.json();
    assert(resCreate.status === 200, "Create slot returns 200");
    assert(dataCreate.success === true && dataCreate.availability.status === 'AVAILABLE', "Slot created with status AVAILABLE");
    const createdId = dataCreate.availability.id;

    // Test 7: Reject duplicate time slot
    console.log("\n--- Test 7: Reject Duplicate Slot ---");
    const resDup = await fetch(`${baseUrl}/api/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: 'exp-1',
        availabilityDate: '2026-11-20',
        startTime: '10:00 AM',
        endTime: '11:00 AM'
      })
    });
    assert(resDup.status === 400, "Duplicate slot rejected with 400");

    // Test 8: Batch create slots
    console.log("\n--- Test 8: Batch Create Slots ---");
    const resBatch = await fetch(`${baseUrl}/api/availability/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: 'exp-1',
        availabilityDate: '2026-11-21',
        slots: [
          { startTime: '09:00 AM', endTime: '10:00 AM' },
          { startTime: '01:00 PM', endTime: '02:00 PM' },
          { startTime: '05:00 PM', endTime: '06:00 PM' }
        ]
      })
    });
    const dataBatch = await resBatch.json();
    assert(resBatch.status === 200, "Batch create returns 200");
    assert(dataBatch.availabilities.length === 3, "Batch created 3 slots");

    // Test 9: Atomic Booking
    console.log("\n--- Test 9: Atomic Booking ---");
    const resBook = await fetch(`${baseUrl}/api/availability/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId: createdId,
        bookingId: 'test-booking-1',
        clientId: 'client-123',
        clientName: 'Test Client',
        expertId: 'exp-1'
      })
    });
    const dataBook = await resBook.json();
    assert(resBook.status === 200, "Booking returns 200");
    assert(dataBook.availability.status === 'BOOKED', "Status successfully transitioned to BOOKED");

    // Test 10: Double Booking Rejection (Second attempt on already booked slot)
    console.log("\n--- Test 10: Double Booking Rejection ---");
    const resBookAgain = await fetch(`${baseUrl}/api/availability/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId: createdId,
        bookingId: 'test-booking-2',
        clientId: 'client-456',
        clientName: 'Second Client'
      })
    });
    assert(resBookAgain.status === 409, "Second booking rejected with 409 Conflict");

    // Test 11: Concurrency Double-Booking Race Condition Test
    console.log("\n--- Test 11: Concurrency Race Condition Test (2 Simultaneous Bookings) ---");
    // Create a new slot for testing concurrency
    const resSlotRace = await fetch(`${baseUrl}/api/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId: 'exp-2',
        availabilityDate: '2026-10-20',
        startTime: '10:00 AM',
        endTime: '11:00 AM'
      })
    });
    const dataSlotRace = await resSlotRace.json();
    const raceSlotId = dataSlotRace.availability.id;

    // Send 2 simultaneous booking requests for the exact same slot
    const [raceRes1, raceRes2] = await Promise.all([
      fetch(`${baseUrl}/api/availability/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: raceSlotId,
          bookingId: 'race-book-1',
          clientId: 'client-A'
        })
      }),
      fetch(`${baseUrl}/api/availability/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: raceSlotId,
          bookingId: 'race-book-2',
          clientId: 'client-B'
        })
      })
    ]);

    const statuses = [raceRes1.status, raceRes2.status].sort();
    assert(
      statuses[0] === 200 && statuses[1] === 409,
      `Simultaneous booking test: Exactly one 200 OK and one 409 Conflict (Got ${raceRes1.status} and ${raceRes2.status})`
    );

    // Clean up created test slots
    await fetch(`${baseUrl}/api/availability/${raceSlotId}`, {
      method: 'DELETE',
      headers: { 'x-admin-override': 'true' }
    });
    await fetch(`${baseUrl}/api/availability/${createdId}`, {
      method: 'DELETE',
      headers: { 'x-admin-override': 'true' }
    });
    for (const s of dataBatch.availabilities) {
      await fetch(`${baseUrl}/api/availability/${s.id}`, { method: 'DELETE' });
    }

  } finally {
    await server.close();
    console.log("\nServer stopped.");
  }

  console.log(`\n========================================`);
  console.log(`TOTAL PASSED: ${passed}`);
  console.log(`TOTAL FAILED: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error("Test runner error:", err);
  process.exit(1);
});
