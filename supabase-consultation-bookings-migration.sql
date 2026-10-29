-- ==============================================================================
-- RUN THIS ENTIRE SCRIPT IN SUPABASE SQL EDITOR:
-- https://supabase.com/dashboard/project/oitxwcspkelduxbuczux/sql/new
-- ==============================================================================

-- 1. Add the missing columns to public.bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT 'Consultation';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS scheduled_date VARCHAR(100);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS scheduled_time VARCHAR(100);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS package_type VARCHAR(100) DEFAULT 'Hourly Consultation';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS value NUMERIC(10, 2) DEFAULT 600.00;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS meet_link TEXT;

-- 2. Drop the restrictive status check constraint and allow canonical statuses
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ALTER COLUMN status SET DEFAULT 'pending';

-- 3. Relax legacy constraints that reject modern booking inserts
ALTER TABLE public.bookings ALTER COLUMN booking_date DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN end_time DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN start_time TYPE VARCHAR(100);
ALTER TABLE public.bookings ALTER COLUMN end_time TYPE VARCHAR(100);
ALTER TABLE public.bookings ALTER COLUMN price DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN price SET DEFAULT 600.00;

-- 4. Enable Supabase Realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'bookings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
    END IF;
END $$;

-- 5. Insert / Backfill the Aman -> Aara booking
INSERT INTO public.bookings (
    id,
    client_id,
    client_name,
    client_email,
    expert_id,
    expert_name,
    expert_email,
    topic,
    scheduled_date,
    scheduled_time,
    duration_minutes,
    package_type,
    value,
    price,
    status,
    booking_date,
    start_time,
    end_time,
    notes,
    created_at,
    updated_at
) VALUES (
    'bkg-aman-aara-20261026-1000',
    '059fc01e-4a01-47a1-95d8-e881d1b5a262',
    'Aman',
    'aman@gmail.com',
    'usr-86c1c358-aara',
    'Aara',
    'aara@gmail.com',
    'Artificial Intelligence & ML Consultation',
    '2026-10-26',
    '10:00 AM',
    60,
    'Hourly Consultation',
    600.00,
    600.00,
    'pending',
    '2026-10-26',
    '10:00 AM',
    '11:00 AM',
    'Artificial Intelligence & ML Consultation',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    client_id = EXCLUDED.client_id,
    client_name = EXCLUDED.client_name,
    client_email = EXCLUDED.client_email,
    expert_id = EXCLUDED.expert_id,
    expert_name = EXCLUDED.expert_name,
    expert_email = EXCLUDED.expert_email,
    topic = EXCLUDED.topic,
    scheduled_date = EXCLUDED.scheduled_date,
    scheduled_time = EXCLUDED.scheduled_time,
    duration_minutes = EXCLUDED.duration_minutes,
    package_type = EXCLUDED.package_type,
    value = EXCLUDED.value,
    price = EXCLUDED.price,
    status = 'pending',
    updated_at = NOW();

-- 6. Verify row exists
SELECT id, client_name, expert_name, topic, scheduled_date, scheduled_time, status 
FROM public.bookings;
