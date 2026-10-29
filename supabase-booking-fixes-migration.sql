-- ==============================================================================
-- FIXES MIGRATION FOR CONSULTATION BOOKINGS WORKFLOW
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/oitxwcspkelduxbuczux/sql/new
-- ==============================================================================

-- 1. DELETE LEFTOVER TEST ROW (if still present)
DELETE FROM public.bookings WHERE id = 'test-a2-1792914871670';

-- 2. FIX 4: BACKFILL scheduled_start & scheduled_end ON EXISTING ROWS
-- Convert Aman -> Aara booking (2026-10-26 10:00 AM IST) to UTC (2026-10-26T04:30:00Z)
UPDATE public.bookings
SET 
    scheduled_start = '2026-10-26T04:30:00.000Z'::timestamptz,
    scheduled_end = '2026-10-26T05:30:00.000Z'::timestamptz
WHERE id = 'bkg-aman-aara-20261026-1000';

-- Backfill any other rows where scheduled_start is NULL
UPDATE public.bookings
SET 
    scheduled_start = (scheduled_date || ' ' || REPLACE(REPLACE(scheduled_time, ' AM', ':00+05:30'), ' PM', ':00+05:30'))::timestamptz,
    scheduled_end = (scheduled_date || ' ' || REPLACE(REPLACE(scheduled_time, ' AM', ':00+05:30'), ' PM', ':00+05:30'))::timestamptz + (COALESCE(duration_minutes, 60) || ' minutes')::interval
WHERE scheduled_start IS NULL AND scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL;

-- 3. FIX 3: NOT NULL CONSTRAINTS
-- Backfill any legacy NULLs in critical columns before applying NOT NULL
UPDATE public.bookings
SET 
    topic = COALESCE(topic, notes, 'Consultation'),
    scheduled_date = COALESCE(scheduled_date, booking_date::text, CURRENT_DATE::text),
    scheduled_time = COALESCE(scheduled_time, start_time, '10:00 AM'),
    status = COALESCE(status, 'pending')
WHERE topic IS NULL OR scheduled_date IS NULL OR scheduled_time IS NULL OR status IS NULL;

ALTER TABLE public.bookings ALTER COLUMN topic SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN scheduled_date SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN scheduled_time SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN expert_id SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN status SET NOT NULL;

-- 4. FIX 6: DOUBLE BOOKING PROTECTION (PARTIAL UNIQUE INDEX)
DROP INDEX IF EXISTS idx_bookings_no_double_booking;
CREATE UNIQUE INDEX idx_bookings_no_double_booking 
ON public.bookings (expert_id, scheduled_date, scheduled_time) 
WHERE status IN ('pending', 'accepted');

-- 5. FIX 1: RLS HARDENING
-- Drop open anon write policies
DROP POLICY IF EXISTS "bookings_insert_all" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_all" ON public.bookings;
DROP POLICY IF EXISTS "bookings_delete_all" ON public.bookings;

-- Ensure service_role has full access for backend Express endpoints
DROP POLICY IF EXISTS "bookings_service_role" ON public.bookings;
CREATE POLICY "bookings_service_role" ON public.bookings 
    FOR ALL TO service_role 
    USING (true) 
    WITH CHECK (true);

-- Scoped authenticated user policies (for Supabase Auth users if logged in)
DROP POLICY IF EXISTS "bookings_auth_client_insert" ON public.bookings;
CREATE POLICY "bookings_auth_client_insert" ON public.bookings 
    FOR INSERT TO authenticated 
    WITH CHECK (client_id = auth.uid()::text AND status = 'pending');

DROP POLICY IF EXISTS "bookings_auth_expert_update" ON public.bookings;
CREATE POLICY "bookings_auth_expert_update" ON public.bookings 
    FOR UPDATE TO authenticated 
    USING (expert_id = auth.uid()::text) 
    WITH CHECK (expert_id = auth.uid()::text);

-- Read policy: Keep SELECT for authenticated and anon so Realtime subscriptions and initial page loads continue working
DROP POLICY IF EXISTS "bookings_select_all" ON public.bookings;
CREATE POLICY "bookings_select_all" ON public.bookings 
    FOR SELECT TO authenticated, anon 
    USING (true);

-- Verify policies
SELECT policyname, cmd, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'bookings';
