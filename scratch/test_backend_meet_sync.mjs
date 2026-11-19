import fs from 'fs';

async function runTests() {
  console.log('🧪 =========================================================');
  console.log('🧪 TESTING GOOGLE MEET LINK BACKEND SYNC & VALIDATION');
  console.log('🧪 =========================================================\n');

  const testSessionId = 'book-1793372078834';
  const assignedExpertId = 'usr-86c1c358-aara';
  const assignedExpertEmail = 'aara@gmail.com';
  const wrongExpertId = 'usr-999-intruder';
  const wrongExpertEmail = 'intruder@gmail.com';

  // TEST 1: Send invalid link format (e.g. zoom link or bad url)
  console.log('Test 1: Invalid link rejection...');
  const res1 = await fetch(`http://localhost:5173/api/bookings/${testSessionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': assignedExpertId,
      'x-user-email': assignedExpertEmail,
      'x-user-role': 'expert'
    },
    body: JSON.stringify({
      meet_link: 'https://zoom.us/j/123456789'
    })
  });
  const json1 = await res1.json();
  console.log('   Response status:', res1.status);
  console.log('   Response body:', json1);
  if (res1.status === 400 && json1.success === false) {
    console.log('   ✅ PASS: Invalid Google Meet link was rejected with 400 Bad Request');
  } else {
    console.error('   ❌ FAIL: Expected 400 Bad Request');
    process.exit(1);
  }

  // TEST 2: Unauthorized expert cannot update another expert\'s booking
  console.log('\nTest 2: Unauthorized update rejection (security)...');
  const res2 = await fetch(`http://localhost:5173/api/bookings/${testSessionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': wrongExpertId,
      'x-user-email': wrongExpertEmail,
      'x-user-role': 'expert'
    },
    body: JSON.stringify({
      meet_link: 'https://meet.google.com/abc-defg-hij'
    })
  });
  const json2 = await res2.json();
  console.log('   Response status:', res2.status);
  console.log('   Response body:', json2);
  if (res2.status === 403 && json2.success === false) {
    console.log('   ✅ PASS: Unauthorized expert was rejected with 403 Forbidden');
  } else {
    console.error('   ❌ FAIL: Expected 403 Forbidden');
    process.exit(1);
  }

  // TEST 3: Authorized expert sends valid Google Meet link
  console.log('\nTest 3: Authorized expert sends valid Google Meet link...');
  const validMeetLink = 'https://meet.google.com/xyz-uvwx-rst';
  const res3 = await fetch(`http://localhost:5173/api/bookings/${testSessionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': assignedExpertId,
      'x-user-email': assignedExpertEmail,
      'x-user-role': 'expert'
    },
    body: JSON.stringify({
      meet_link: validMeetLink,
      status: 'accepted'
    })
  });
  const json3 = await res3.json();
  console.log('   Response status:', res3.status);
  console.log('   Booking meet_link:', json3.booking?.meet_link);
  console.log('   Booking meeting_link_sent_at:', json3.booking?.meeting_link_sent_at);
  if (res3.status === 200 && json3.success === true && json3.booking?.meet_link === validMeetLink && json3.booking?.meeting_link_sent_at) {
    console.log('   ✅ PASS: Valid link saved with meet_link and meeting_link_sent_at');
  } else {
    console.error('   ❌ FAIL: meet_link or meeting_link_sent_at not populated');
    process.exit(1);
  }

  // TEST 4: Client query verifies same link appears for Client
  console.log('\nTest 4: Client query verifies link visibility...');
  const res4 = await fetch(`http://localhost:5173/api/bookings?clientEmail=aman@gmail.com&role=client`, {
    headers: {
      'x-user-email': 'aman@gmail.com',
      'x-user-role': 'client'
    }
  });
  const json4 = await res4.json();
  const clientBooking = (json4.bookings || []).find(b => b.id === testSessionId);
  console.log('   Client sees booking meet_link:', clientBooking?.meet_link);
  console.log('   Client sees booking meetUrl:', clientBooking?.meetUrl);
  if (clientBooking?.meet_link === validMeetLink) {
    console.log('   ✅ PASS: Client query returned exact identical meet_link');
  } else {
    console.error('   ❌ FAIL: Client query did not return expected meet_link');
    process.exit(1);
  }

  // TEST 5: Admin query verifies same link appears for Admin
  console.log('\nTest 5: Admin query verifies link visibility...');
  const res5 = await fetch(`http://localhost:5173/api/bookings?role=admin`, {
    headers: {
      'x-user-role': 'admin'
    }
  });
  const json5 = await res5.json();
  const adminBooking = (json5.bookings || []).find(b => b.id === testSessionId);
  console.log('   Admin sees booking meet_link:', adminBooking?.meet_link);
  console.log('   Admin sees booking meetUrl:', adminBooking?.meetUrl);
  if (adminBooking?.meet_link === validMeetLink) {
    console.log('   ✅ PASS: Admin query returned exact identical meet_link');
  } else {
    console.error('   ❌ FAIL: Admin query did not return expected meet_link');
    process.exit(1);
  }

  // TEST 6: Re-send / edit link by Expert
  console.log('\nTest 6: Expert edits / re-sends updated Google Meet link...');
  const updatedMeetLink = 'https://meet.google.com/new-link-999';
  const res6 = await fetch(`http://localhost:5173/api/bookings/${testSessionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': assignedExpertId,
      'x-user-email': assignedExpertEmail,
      'x-user-role': 'expert'
    },
    body: JSON.stringify({
      meet_link: updatedMeetLink
    })
  });
  const json6 = await res6.json();
  console.log('   Booking updated meet_link:', json6.booking?.meet_link);
  if (json6.booking?.meet_link === updatedMeetLink) {
    console.log('   ✅ PASS: Edited Google Meet link was successfully updated and saved');
  } else {
    console.error('   ❌ FAIL: Edited link was not updated');
    process.exit(1);
  }

  console.log('\n🎉 ALL BACKEND SYNC & VALIDATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
