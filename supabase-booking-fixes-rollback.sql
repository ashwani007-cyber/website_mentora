-- ==============================================================================
-- ROLLBACK SCRIPT FOR BOOKINGS FIXES
-- Run this script in the Supabase SQL Editor to restore previous configuration:
-- https://supabase.com/dashboard/project/oitxwcspkelduxbuczux/sql/new
-- ==============================================================================

-- 1. Drop partial unique index
DROP INDEX IF EXISTS idx_bookings_no_double_booking;

-- 2. Drop NOT NULL constraints if needed
ALTER TABLE public.bookings ALTER COLUMN topic DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN scheduled_date DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN scheduled_time DROP NOT NULL;

-- 3. Restore open RLS policies
DROP POLICY IF EXISTS "bookings_insert_all" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_all" ON public.bookings;
DROP POLICY IF EXISTS "bookings_delete_all" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_all" ON public.bookings;
DROP POLICY IF EXISTS "bookings_service_role" ON public.bookings;
DROP POLICY IF EXISTS "bookings_auth_client_insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings_auth_expert_update" ON public.bookings;

CREATE POLICY "bookings_service_role" ON public.bookings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "bookings_insert_all" ON public.bookings FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "bookings_select_all" ON public.bookings FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "bookings_update_all" ON public.bookings FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "bookings_delete_all" ON public.bookings FOR DELETE TO authenticated, anon USING (true);

-- Verify restored policies
SELECT policyname, cmd, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'bookings';
