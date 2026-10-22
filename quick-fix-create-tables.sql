-- Quick Fix: Create expert_profiles table if it doesn't exist
-- Run this in Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create expert_profiles table
CREATE TABLE IF NOT EXISTS expert_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  bio TEXT,
  skills TEXT[],
  experience_years INTEGER,
  photo_url TEXT,
  expertise_area VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending_verification',
  rejection_reason TEXT,
  admin_comments TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_expert_profile UNIQUE (user_id)
);

-- Create profiles table if it doesn't exist (for user details)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL DEFAULT 'expert',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create kyc_documents table if it doesn't exist
CREATE TABLE IF NOT EXISTS kyc_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expert_id UUID NOT NULL,
  doc_type VARCHAR(50) NOT NULL,
  file_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_expert_profiles_status ON expert_profiles(status);
CREATE INDEX IF NOT EXISTS idx_expert_profiles_user_id ON expert_profiles(user_id);

-- ============================================================
-- MIGRATE EXISTING EXPERTS FROM users TABLE TO expert_profiles
-- ============================================================

-- Copy experts from users table to expert_profiles
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

-- Copy user details to profiles table
INSERT INTO profiles (id, full_name, email, phone, role, created_at, updated_at)
SELECT
  u.id,
  u.full_name,
  u.email,
  u.phone,
  u.role,
  u.created_at,
  NOW() as updated_at
FROM users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  updated_at = NOW();

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check expert_profiles
SELECT
  ep.id,
  u.email,
  u.full_name,
  u.role,
  ep.status,
  ep.expertise_area,
  ep.created_at
FROM expert_profiles ep
JOIN users u ON ep.user_id = u.id
ORDER BY ep.created_at DESC;

-- Check pending verifications
SELECT
  ep.id,
  u.email,
  u.full_name,
  ep.status
FROM expert_profiles ep
JOIN users u ON ep.user_id = u.id
WHERE ep.status IN ('pending_verification', 'submitted', 'under_review', 'changes_requested')
ORDER BY ep.created_at DESC;
