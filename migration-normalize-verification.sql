-- Migration Script: Normalize Expert Verification Status
-- Run this in Supabase SQL Editor
-- Safe to run multiple times

-- ============================================================
-- STEP 1: Ensure expert_profiles table exists for all expert users
-- ============================================================

-- Create expert_profiles for experts who don't have one
INSERT INTO expert_profiles (user_id, expertise_area, status, created_at, updated_at)
SELECT
  u.id,
  COALESCE(u.field, 'General') as expertise_area,
  'pending_verification' as status,
  u.created_at,
  NOW() as updated_at
FROM users u
LEFT JOIN expert_profiles ep ON u.id = ep.user_id
WHERE u.role = 'expert' AND ep.id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- STEP 2: Normalize status strings
-- ============================================================

-- Update any non-standard status values to standard ones
UPDATE expert_profiles
SET status = 'pending_verification'
WHERE status NOT IN ('pending_verification', 'pending_audit', 'submitted', 'under_review', 'approved', 'changes_requested', 'rejected');

-- Convert 'pending_audit' to 'pending_verification' for consistency
UPDATE expert_profiles
SET status = 'pending_verification'
WHERE status = 'pending_audit';

-- ============================================================
-- STEP 3: Set status for experts with documents but no status
-- ============================================================

UPDATE expert_profiles
SET status = 'submitted',
    updated_at = NOW()
WHERE id IN (
  SELECT DISTINCT expert_id
  FROM kyc_documents
)
AND status = 'pending_verification';

-- ============================================================
-- STEP 4: Normalize role casing
-- ============================================================

UPDATE users
SET role = LOWER(role)
WHERE role != LOWER(role);

-- ============================================================
-- STEP 5: Add missing indexes if they don't exist
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_expert_profiles_status ON expert_profiles(status);
CREATE INDEX IF NOT EXISTS idx_expert_profiles_user_id ON expert_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================
-- STEP 6: Verification query (run to check results)
-- ============================================================

-- Check all expert profiles
SELECT
  ep.id,
  u.email,
  u.full_name,
  u.role,
  ep.status,
  ep.expertise_area,
  ep.created_at,
  COUNT(kd.id) as document_count
FROM expert_profiles ep
JOIN users u ON ep.user_id = u.id
LEFT JOIN kyc_documents kd ON ep.id = kd.expert_id
GROUP BY ep.id, u.email, u.full_name, u.role, ep.status, ep.expertise_area, ep.created_at
ORDER BY ep.created_at DESC;

-- Check pending verifications
SELECT
  ep.id,
  u.email,
  u.full_name,
  ep.status,
  COUNT(kd.id) as document_count
FROM expert_profiles ep
JOIN users u ON ep.user_id = u.id
LEFT JOIN kyc_documents kd ON ep.id = kd.expert_id
WHERE ep.status IN ('pending_verification', 'submitted', 'under_review', 'changes_requested')
GROUP BY ep.id, u.email, u.full_name, ep.status
ORDER BY ep.created_at DESC;

-- ============================================================
-- STEP 7: Status history for existing records (optional)
-- ============================================================

-- Insert status history for records that don't have it
INSERT INTO status_history (expert_id, old_status, new_status, changed_by, comment, changed_at)
SELECT
  ep.id,
  NULL as old_status,
  ep.status as new_status,
  NULL as changed_by,
  'Migration: Initial status' as comment,
  ep.created_at as changed_at
FROM expert_profiles ep
LEFT JOIN status_history sh ON ep.id = sh.expert_id
WHERE sh.id IS NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- SUMMARY
-- ============================================================

-- This migration:
-- 1. Creates expert_profiles for all expert users
-- 2. Normalizes status strings to standard values
-- 3. Sets 'submitted' status for experts with documents
-- 4. Normalizes role casing
-- 5. Adds missing indexes
-- 6. Creates status history for existing records
-- 7. Is safe to run multiple times (uses ON CONFLICT)
