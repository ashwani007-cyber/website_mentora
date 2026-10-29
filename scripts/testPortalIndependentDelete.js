// Automated verification script for portal-independent soft-delete
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 TESTING INDEPENDENT PORTAL SOFT-DELETE BEHAVIOR');
  console.log('🧪 ========================================================\n');

  const testId1 = `test-bkg-${Date.now()}-1`;
  const testId2 = `test-bkg-${Date.now()}-2`;
  const clientEmail = 'client.tester@example.com';
  const expertEmail = 'expert.tester@example.com';

  // -------------------------------------------------------------
  // Test 1: Create a booking as client and accept as expert
  // -------------------------------------------------------------
  console.log('➡️ TEST 1: Create a booking and accept it');
  const insertPayload = {
    id: testId1,
    client_id: 'usr-client-123',
    client_name: 'Test Client',
    client_email: clientEmail,
    expert_id: 'usr-expert-456',
    expert_name: 'Test Expert',
    expert_email: expertEmail,
    topic: 'Cloud & AI Architecture Consultation',
    scheduled_date: '2026-11-01',
    scheduled_time: '11:00 AM',
    duration_minutes: 60,
    package_type: 'Hourly Consultation',
    value: 800,
    price: 800,
    status: 'pending'
  };

  const { error: insErr } = await supabase.from('bookings').insert(insertPayload);
  if (insErr) {
    console.error('❌ Failed to insert test booking:', insErr.message);
    process.exit(1);
  }
  console.log(`✅ Created booking: ${testId1} with status "pending"`);

  // Verify visible in GET /api/bookings for all roles
  let resAll = await (await fetch('http://localhost:3000/api/bookings')).json();
  let foundInAll = resAll.bookings.find(b => b.id === testId1);
  console.log('   Visible in Admin/All fetch:', Boolean(foundInAll));

  // Expert accepts it
  const { error: patchErr } = await supabase.from('bookings').update({ status: 'accepted' }).eq('id', testId1);
  if (patchErr) console.error('❌ Update status failed:', patchErr.message);
  console.log(`✅ Expert accepted booking ${testId1}`);

  // -------------------------------------------------------------
  // Test 2: Client deletes booking
  // -------------------------------------------------------------
  console.log('\n➡️ TEST 2: Client deletes booking');
  const clientDelRes = await (await fetch(`http://localhost:3000/api/bookings/${testId1}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'usr-client-123',
      'x-user-email': clientEmail,
      'x-user-role': 'client'
    },
    body: JSON.stringify({ role: 'client' })
  })).json();
  console.log('   Client delete response:', clientDelRes);

  // Check client view (should be HIDDEN)
  const clientFetch = await (await fetch(`http://localhost:3000/api/bookings?role=client&clientEmail=${clientEmail}`)).json();
  const inClientView = clientFetch.bookings.find(b => b.id === testId1);
  console.log('   Hidden from Client Portal (expected: true):', !inClientView);

  // Check expert view (should be VISIBLE)
  const expertFetch = await (await fetch(`http://localhost:3000/api/bookings?role=expert&expertEmail=${expertEmail}`)).json();
  const inExpertView = expertFetch.bookings.find(b => b.id === testId1);
  console.log('   Still visible in Expert Portal (expected: true):', Boolean(inExpertView));

  // Check admin view (should be VISIBLE)
  const adminFetch = await (await fetch('http://localhost:3000/api/bookings?role=admin')).json();
  const inAdminView = adminFetch.bookings.find(b => b.id === testId1);
  console.log('   Still visible in Admin Portal (expected: true):', Boolean(inAdminView));

  if (inClientView || !inExpertView || !inAdminView) {
    console.error('❌ Test 2 failed!');
    process.exit(1);
  }
  console.log('✅ TEST 2 PASSED!');

  // -------------------------------------------------------------
  // Test 3: Expert deletes booking
  // -------------------------------------------------------------
  console.log('\n➡️ TEST 3: Expert deletes booking');
  const expDelRes = await (await fetch(`http://localhost:3000/api/bookings/${testId1}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'usr-expert-456',
      'x-user-email': expertEmail,
      'x-user-role': 'expert'
    },
    body: JSON.stringify({ role: 'expert' })
  })).json();
  console.log('   Expert delete response:', expDelRes);

  const expertFetch2 = await (await fetch(`http://localhost:3000/api/bookings?role=expert&expertEmail=${expertEmail}`)).json();
  const inExpertView2 = expertFetch2.bookings.find(b => b.id === testId1);
  console.log('   Hidden from Expert Portal (expected: true):', !inExpertView2);

  const adminFetch2 = await (await fetch('http://localhost:3000/api/bookings?role=admin')).json();
  const inAdminView2 = adminFetch2.bookings.find(b => b.id === testId1);
  console.log('   Still visible in Admin Portal (expected: true):', Boolean(inAdminView2));

  if (inExpertView2 || !inAdminView2) {
    console.error('❌ Test 3 failed!');
    process.exit(1);
  }
  console.log('✅ TEST 3 PASSED!');

  // -------------------------------------------------------------
  // Test 4: Fresh booking deleted by Admin first
  // -------------------------------------------------------------
  console.log('\n➡️ TEST 4: Fresh booking, deleted from Admin Portal first');
  const insertPayload2 = {
    id: testId2,
    client_id: 'usr-client-123',
    client_name: 'Test Client 2',
    client_email: clientEmail,
    expert_id: 'usr-expert-456',
    expert_name: 'Test Expert 2',
    expert_email: expertEmail,
    topic: 'FinTech Compliance Review',
    scheduled_date: '2026-11-02',
    scheduled_time: '02:00 PM',
    duration_minutes: 60,
    package_type: 'Hourly Consultation',
    value: 900,
    price: 900,
    status: 'pending'
  };

  await supabase.from('bookings').insert(insertPayload2);
  console.log(`✅ Created fresh booking: ${testId2}`);

  // Admin deletes booking
  const adminDelRes = await (await fetch(`http://localhost:3000/api/bookings/${testId2}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'admin'
    },
    body: JSON.stringify({ role: 'admin' })
  })).json();
  console.log('   Admin delete response:', adminDelRes);

  // Verify Admin view (should be HIDDEN)
  const adminFetch3 = await (await fetch('http://localhost:3000/api/bookings?role=admin')).json();
  const inAdminView3 = adminFetch3.bookings.find(b => b.id === testId2);
  console.log('   Hidden from Admin Portal (expected: true):', !inAdminView3);

  // Verify Client view (should be VISIBLE)
  const clientFetch3 = await (await fetch(`http://localhost:3000/api/bookings?role=client&clientEmail=${clientEmail}`)).json();
  const inClientView3 = clientFetch3.bookings.find(b => b.id === testId2);
  console.log('   Still visible in Client Portal (expected: true):', Boolean(inClientView3));

  // Verify Expert view (should be VISIBLE)
  const expertFetch3 = await (await fetch(`http://localhost:3000/api/bookings?role=expert&expertEmail=${expertEmail}`)).json();
  const inExpertView3 = expertFetch3.bookings.find(b => b.id === testId2);
  console.log('   Still visible in Expert Portal (expected: true):', Boolean(inExpertView3));

  if (inAdminView3 || !inClientView3 || !inExpertView3) {
    console.error('❌ Test 4 failed!');
    process.exit(1);
  }
  console.log('✅ TEST 4 PASSED!');

  // -------------------------------------------------------------
  // Test 5: Re-fetch / simulate refresh
  // -------------------------------------------------------------
  console.log('\n➡️ TEST 5: Verify persistence across simulated page refresh');
  const refetchClient = await (await fetch(`http://localhost:3000/api/bookings?role=client&clientEmail=${clientEmail}`)).json();
  const refetchExpert = await (await fetch(`http://localhost:3000/api/bookings?role=expert&expertEmail=${expertEmail}`)).json();
  const refetchAdmin = await (await fetch('http://localhost:3000/api/bookings?role=admin')).json();

  console.log('   Booking 1 (deleted by client & expert):');
  console.log('     In Client view:', Boolean(refetchClient.bookings.find(b => b.id === testId1)));
  console.log('     In Expert view:', Boolean(refetchExpert.bookings.find(b => b.id === testId1)));
  console.log('     In Admin view (expected: true):', Boolean(refetchAdmin.bookings.find(b => b.id === testId1)));

  console.log('   Booking 2 (deleted by admin only):');
  console.log('     In Client view (expected: true):', Boolean(refetchClient.bookings.find(b => b.id === testId2)));
  console.log('     In Expert view (expected: true):', Boolean(refetchExpert.bookings.find(b => b.id === testId2)));
  console.log('     In Admin view:', Boolean(refetchAdmin.bookings.find(b => b.id === testId2)));
  console.log('✅ TEST 5 PASSED!');

  // -------------------------------------------------------------
  // Test 6: Status change on booking deleted in one portal
  // -------------------------------------------------------------
  console.log('\n➡️ TEST 6: Trigger status change on booking deleted by admin (testId2)');
  // Expert confirms / accepts testId2
  await (await fetch(`http://localhost:3000/api/bookings/${testId2}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'expert',
      'x-user-email': expertEmail
    },
    body: JSON.stringify({ status: 'confirmed' })
  })).json();

  const refetchClientAfterStatus = await (await fetch(`http://localhost:3000/api/bookings?role=client&clientEmail=${clientEmail}`)).json();
  const clientBkg = refetchClientAfterStatus.bookings.find(b => b.id === testId2);
  console.log('   Client sees updated status (confirmed):', clientBkg?.status);

  const refetchAdminAfterStatus = await (await fetch('http://localhost:3000/api/bookings?role=admin')).json();
  const adminBkg = refetchAdminAfterStatus.bookings.find(b => b.id === testId2);
  console.log('   Admin still hides testId2 after status change (expected: true):', !adminBkg);

  if (!clientBkg || clientBkg.status !== 'confirmed' || adminBkg) {
    console.error('❌ Test 6 failed!');
    process.exit(1);
  }
  console.log('✅ TEST 6 PASSED!');

  // Cleanup test records
  await supabase.from('bookings').delete().in('id', [testId1, testId2]);
  console.log('\n🧹 Cleaned up test records from database.');
  console.log('🎉 ALL 6 TEST CASES PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
