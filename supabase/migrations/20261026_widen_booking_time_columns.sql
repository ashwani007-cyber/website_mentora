-- ==============================================================================
-- Migration: Widen start_time and end_time columns in public.bookings
-- Fixes: "Booking Error: value too long for type character varying(10)"
--
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/oitxwcspkelduxbuczux/sql/new
-- ==============================================================================

-- 1. Widen start_time and end_time in public.bookings to accommodate full time slot strings (e.g. "10:00 AM - 11:00 AM")
ALTER TABLE public.bookings ALTER COLUMN start_time TYPE VARCHAR(100);
ALTER TABLE public.bookings ALTER COLUMN end_time TYPE VARCHAR(100);

-- 2. Optional safety: Widen expert_availability time columns to avoid any future length constraint
ALTER TABLE IF EXISTS public.expert_availability ALTER COLUMN start_time TYPE VARCHAR(100);
ALTER TABLE IF EXISTS public.expert_availability ALTER COLUMN end_time TYPE VARCHAR(100);
