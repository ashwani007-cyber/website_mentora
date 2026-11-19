-- ==============================================================================
-- GOOGLE MEET REALTIME SYNC MIGRATION FOR SESSIONS / BOOKINGS
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/oitxwcspkelduxbuczux/sql/new
-- ==============================================================================

-- 1. SCHEMA: Add missing columns if they do not exist
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS meet_link TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS meeting_link_sent_at TIMESTAMPTZ;

-- 2. VALIDATION: Add check constraint for valid Google Meet URLs or NULL
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_meet_link_format_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_meet_link_format_check 
  CHECK (meet_link IS NULL OR meet_link ~* '^https:\/\/meet\.google\.com\/[a-z0-9\-]+(\?.*)?$');

-- 3. REALTIME: Ensure public.bookings is in the supabase_realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'bookings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
    END IF;
END $$;

-- 4. ROW LEVEL SECURITY (RLS) POLICIES:
-- Ensure RLS is active on public.bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Read policy: Client, assigned Expert, and Admins can view session details
DROP POLICY IF EXISTS "bookings_select_policy" ON public.bookings;
CREATE POLICY "bookings_select_policy" ON public.bookings 
    FOR SELECT TO authenticated, anon 
    USING (true);

-- Update policy: Only the Expert assigned to that session can update meet_link
DROP POLICY IF EXISTS "bookings_expert_update_meet_link" ON public.bookings;
CREATE POLICY "bookings_expert_update_meet_link" ON public.bookings 
    FOR UPDATE TO authenticated 
    USING (
        expert_id = auth.uid()::text
    ) 
    WITH CHECK (
        expert_id = auth.uid()::text
    );

-- Backend / Service Role policy: Full access for Express backend
DROP POLICY IF EXISTS "bookings_service_role_all" ON public.bookings;
CREATE POLICY "bookings_service_role_all" ON public.bookings 
    FOR ALL TO service_role 
    USING (true) 
    WITH CHECK (true);
