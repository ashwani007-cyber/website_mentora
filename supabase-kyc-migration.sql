-- ============================================================
-- Supabase Migration: Expert Registration, Onboarding & KYC Realtime Workflow
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/oitxwcspkelduxbuczux/sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Legacy/Auth sync)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL DEFAULT 'expert',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. USERS TABLE (Backward compatibility with legacy routes)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'expert',
  phone VARCHAR(50),
  avatar_url TEXT,
  bio TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. EXPERT PROFILES TABLE (Core table for KYC workflow)
CREATE TABLE IF NOT EXISTS public.expert_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  field VARCHAR(255) DEFAULT 'Strategic Leadership',
  company VARCHAR(255) DEFAULT 'Enterprise Advisory',
  years INTEGER DEFAULT 0,
  base_rate NUMERIC(10, 2) DEFAULT 799,
  admin_markup NUMERIC(10, 2) DEFAULT 0,
  project_rate NUMERIC(10, 2) DEFAULT 1000,
  bio TEXT,
  status VARCHAR(50) DEFAULT 'pending_verification', -- 'pending_verification', 'under_review', 'approved', 'rejected', 'changes_requested', 'removed'
  rejection_reason TEXT,
  admin_comments TEXT,
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  is_removed BOOLEAN DEFAULT false,
  removed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_expert_user UNIQUE (user_id),
  CONSTRAINT unique_expert_email UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_expert_profiles_status ON public.expert_profiles(status);
CREATE INDEX IF NOT EXISTS idx_expert_profiles_email ON public.expert_profiles(email);
CREATE INDEX IF NOT EXISTS idx_expert_profiles_phone ON public.expert_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_expert_profiles_is_removed ON public.expert_profiles(is_removed);

-- 4. DOCUMENTS TABLE (Exactly 3 documents per expert)
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expert_id UUID NOT NULL REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL, -- 'expCert', 'offerLetter', 'resume'
  file_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  rejection_reason TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_expert_doc_type UNIQUE (expert_id, document_type)
);

CREATE INDEX IF NOT EXISTS idx_documents_expert_id ON public.documents(expert_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);

-- 5. EXPERT PROFILE CHANGES (Realtime audit trail)
CREATE TABLE IF NOT EXISTS public.expert_profile_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expert_id UUID NOT NULL REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_profile_changes_expert_id ON public.expert_profile_changes(expert_id);

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_profile_changes ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-running
DROP POLICY IF EXISTS "Allow service_role full access" ON public.expert_profiles;
DROP POLICY IF EXISTS "Experts read own profile" ON public.expert_profiles;
DROP POLICY IF EXISTS "Experts update own profile" ON public.expert_profiles;
DROP POLICY IF EXISTS "Admins full access to expert_profiles" ON public.expert_profiles;
DROP POLICY IF EXISTS "Public / Anon read expert_profiles" ON public.expert_profiles;

DROP POLICY IF EXISTS "Allow service_role full access docs" ON public.documents;
DROP POLICY IF EXISTS "Experts manage own documents" ON public.documents;
DROP POLICY IF EXISTS "Admins manage all documents" ON public.documents;
DROP POLICY IF EXISTS "Public / Anon read documents" ON public.documents;

DROP POLICY IF EXISTS "Allow service_role full access changes" ON public.expert_profile_changes;
DROP POLICY IF EXISTS "Allow read on profile changes" ON public.expert_profile_changes;
DROP POLICY IF EXISTS "Allow insert on profile changes" ON public.expert_profile_changes;

-- EXPERT PROFILES POLICIES
CREATE POLICY "Admins and service_role full access" ON public.expert_profiles
  FOR ALL USING (
    auth.role() = 'service_role'
    OR (auth.jwt() ->> 'email') IN ('kushwahaashwani12@gmail.com', 'kushwaahaashwani12@gmail.com')
    OR (auth.jwt() ->> 'role') = 'admin'
  );

CREATE POLICY "Experts read own profile" ON public.expert_profiles
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Experts update own profile" ON public.expert_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- DOCUMENTS POLICIES
CREATE POLICY "Admins and service_role full access docs" ON public.documents
  FOR ALL USING (
    auth.role() = 'service_role'
    OR (auth.jwt() ->> 'email') IN ('kushwahaashwani12@gmail.com', 'kushwaahaashwani12@gmail.com')
    OR (auth.jwt() ->> 'role') = 'admin'
  );

CREATE POLICY "Experts manage own documents" ON public.documents
  FOR ALL USING (
    expert_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid())
    OR auth.role() = 'anon'
  );

-- PROFILE CHANGES POLICIES
CREATE POLICY "Allow read on profile changes" ON public.expert_profile_changes
  FOR SELECT USING (true);

CREATE POLICY "Allow insert on profile changes" ON public.expert_profile_changes
  FOR INSERT WITH CHECK (true);

-- 7. REPLICA IDENTITY & REALTIME PUBLICATION
ALTER TABLE public.expert_profiles REPLICA IDENTITY FULL;
ALTER TABLE public.documents REPLICA IDENTITY FULL;
ALTER TABLE public.expert_profile_changes REPLICA IDENTITY FULL;

-- Add tables to realtime publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'expert_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expert_profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'expert_profile_changes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expert_profile_changes;
  END IF;
END $$;
