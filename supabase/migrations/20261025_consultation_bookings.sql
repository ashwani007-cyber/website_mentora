-- Migration: 20261025_consultation_bookings.sql
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/oitxwcspkelduxbuczux/sql/new

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.bookings (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    client_id VARCHAR(255) NOT NULL,
    client_name VARCHAR(255),
    client_email VARCHAR(255) NOT NULL,
    expert_id VARCHAR(255) NOT NULL,
    expert_name VARCHAR(255),
    expert_email VARCHAR(255) NOT NULL,
    topic TEXT NOT NULL DEFAULT 'Consultation',
    scheduled_date VARCHAR(100),
    scheduled_time VARCHAR(100),
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 60,
    package_type VARCHAR(100) DEFAULT 'Hourly Consultation',
    value NUMERIC(10, 2) DEFAULT 600.00,
    price NUMERIC(10, 2) DEFAULT 600.00,
    status VARCHAR(50) DEFAULT 'pending',
    meet_link TEXT,
    meeting_link TEXT,
    booking_date VARCHAR(100),
    start_time VARCHAR(100),
    end_time VARCHAR(100),
    notes TEXT,
    payment_status VARCHAR(50) DEFAULT 'PAID',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'topic') THEN
        ALTER TABLE public.bookings ADD COLUMN topic TEXT DEFAULT 'Consultation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'scheduled_date') THEN
        ALTER TABLE public.bookings ADD COLUMN scheduled_date VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'scheduled_time') THEN
        ALTER TABLE public.bookings ADD COLUMN scheduled_time VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'scheduled_start') THEN
        ALTER TABLE public.bookings ADD COLUMN scheduled_start TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'scheduled_end') THEN
        ALTER TABLE public.bookings ADD COLUMN scheduled_end TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'duration_minutes') THEN
        ALTER TABLE public.bookings ADD COLUMN duration_minutes INTEGER DEFAULT 60;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'package_type') THEN
        ALTER TABLE public.bookings ADD COLUMN package_type VARCHAR(100) DEFAULT 'Hourly Consultation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'value') THEN
        ALTER TABLE public.bookings ADD COLUMN value NUMERIC(10, 2) DEFAULT 600.00;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'meet_link') THEN
        ALTER TABLE public.bookings ADD COLUMN meet_link TEXT;
    END IF;
END $$;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check 
    CHECK (status IN (
        'pending', 'accepted', 'rejected', 'completed', 'cancelled',
        'Pending Expert Acceptance', 'Accepted — Awaiting Google Meet Link',
        'Confirmed — Meet Link Sent', 'Confirmed — Meet Link Ready',
        'Confirmed', 'Live', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'
    ));

ALTER TABLE public.bookings ALTER COLUMN booking_date DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN end_time DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN start_time TYPE VARCHAR(100);
ALTER TABLE public.bookings ALTER COLUMN end_time TYPE VARCHAR(100);
ALTER TABLE public.bookings ALTER COLUMN price DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN price SET DEFAULT 600.00;

UPDATE public.bookings
SET 
    scheduled_date = COALESCE(scheduled_date, booking_date::text),
    scheduled_time = COALESCE(scheduled_time, start_time),
    meet_link = COALESCE(meet_link, meeting_link),
    topic = COALESCE(topic, notes, 'Consultation'),
    value = COALESCE(value, price, 600.00)
WHERE scheduled_date IS NULL OR scheduled_time IS NULL OR topic IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON public.bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client_email ON public.bookings(client_email);
CREATE INDEX IF NOT EXISTS idx_bookings_expert_id ON public.bookings(expert_id);
CREATE INDEX IF NOT EXISTS idx_bookings_expert_email ON public.bookings(expert_email);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access bookings" ON public.bookings;
DROP POLICY IF EXISTS "Clients can insert own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Clients can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Experts can view assigned bookings" ON public.bookings;
DROP POLICY IF EXISTS "Experts can update assigned bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin can manage all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public access to bookings" ON public.bookings;
DROP POLICY IF EXISTS "bookings_service_role" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_all" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_all" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_all" ON public.bookings;
DROP POLICY IF EXISTS "bookings_delete_all" ON public.bookings;

CREATE POLICY "bookings_service_role" ON public.bookings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "bookings_insert_all" ON public.bookings FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "bookings_select_all" ON public.bookings FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "bookings_update_all" ON public.bookings FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "bookings_delete_all" ON public.bookings FOR DELETE TO authenticated, anon USING (true);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bookings') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
    END IF;
END $$;

INSERT INTO public.bookings (
    id, client_id, client_name, client_email,
    expert_id, expert_name, expert_email,
    topic, scheduled_date, scheduled_time, duration_minutes,
    package_type, value, price, status,
    booking_date, start_time, end_time, notes, created_at, updated_at
) VALUES (
    'bkg-aman-aara-20261026-1000',
    '059fc01e-4a01-47a1-95d8-e881d1b5a262', 'Aman', 'aman@gmail.com',
    'usr-86c1c358-aara', 'Aara', 'aara@gmail.com',
    'Artificial Intelligence & ML Consultation', '2026-10-26', '10:00 AM', 60,
    'Hourly Consultation', 600.00, 600.00, 'pending',
    '2026-10-26', '10:00 AM', '11:00 AM', 'Artificial Intelligence & ML Consultation',
    NOW(), NOW()
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
