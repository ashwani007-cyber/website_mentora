-- ==============================================================================
-- RUN THIS IN SUPABASE SQL EDITOR:
-- https://supabase.com/dashboard/project/oitxwcspkelduxbuczux/sql/new
-- ==============================================================================

-- 1. Add per-role soft-delete columns to public.bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS deleted_by_client BOOLEAN DEFAULT FALSE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS deleted_by_expert BOOLEAN DEFAULT FALSE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS deleted_by_admin BOOLEAN DEFAULT FALSE;

-- 2. Backfill safe defaults for existing rows (treat missing/null as false)
UPDATE public.bookings SET deleted_by_client = FALSE WHERE deleted_by_client IS NULL;
UPDATE public.bookings SET deleted_by_expert = FALSE WHERE deleted_by_expert IS NULL;
UPDATE public.bookings SET deleted_by_admin = FALSE WHERE deleted_by_admin IS NULL;

-- 3. Verify columns were added successfully
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
  AND column_name IN ('deleted_by_client', 'deleted_by_expert', 'deleted_by_admin');
