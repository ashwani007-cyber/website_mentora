const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfillAmanAaraBooking() {
  console.log('🚀 Running backfill for Aman -> Aara booking (2026-10-26, 10:00 AM)...');

  const bookingPayload = {
    id: 'bkg-aman-aara-20261026-1000',
    client_id: '059fc01e-4a01-47a1-95d8-e881d1b5a262',
    client_name: 'Aman',
    client_email: 'aman@gmail.com',
    expert_id: 'usr-86c1c358-aara',
    expert_name: 'Aara',
    expert_email: 'aara@gmail.com',
    topic: 'Artificial Intelligence & ML Consultation',
    scheduled_date: '2026-10-26',
    scheduled_time: '10:00 AM',
    duration_minutes: 60,
    package_type: 'Hourly Consultation',
    value: 600.00,
    price: 600.00,
    status: 'pending',
    booking_date: '2026-10-26',
    start_time: '10:00 AM',
    end_time: '11:00 AM',
    notes: 'Artificial Intelligence & ML Consultation',
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('bookings')
    .upsert(bookingPayload)
    .select();

  if (error) {
    console.error('❌ Backfill failed:', error.message);
    console.log('👉 Please run `supabase-consultation-bookings-migration.sql` in the Supabase SQL Editor first, then rerun this script.');
  } else {
    console.log('✅ Backfill succeeded! Booking row in Supabase:');
    console.log(JSON.stringify(data[0], null, 2));
  }
}

backfillAmanAaraBooking();
