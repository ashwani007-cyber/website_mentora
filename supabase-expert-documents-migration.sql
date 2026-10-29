-- ==============================================================================
-- SUPABASE MIGRATION: EXPERT CREDENTIAL DOCUMENTS & STORAGE WORKFLOW
-- 1. Private Storage Bucket: expert-documents (Max 10MB, PDF only)
-- 2. Database Table: expert_documents (Status, Admin Remark, Unique per type)
-- 3. Row Level Security (RLS) Policies on both Table and storage.objects
-- 4. Profiles sync and Admin verification workflow
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/oitxwcspkelduxbuczux/sql
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. PROFILES TABLE (Ensure profiles table exists with role and is_verified)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'expert' CHECK (role IN ('admin', 'expert', 'client')),
    is_verified BOOLEAN DEFAULT false,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill / Synchronize profiles from auth.users and public.users
INSERT INTO public.profiles (id, full_name, email, phone, role, is_verified)
SELECT 
    au.id,
    COALESCE(u.full_name, au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)) AS full_name,
    au.email,
    COALESCE(u.phone, au.phone, au.raw_user_meta_data->>'phone', NULL) AS phone,
    COALESCE(u.role, au.raw_user_meta_data->>'role', 'expert') AS role,
    COALESCE(u.is_verified, false) AS is_verified
FROM auth.users au
LEFT JOIN public.users u ON lower(u.email) = lower(au.email)
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    is_verified = EXCLUDED.is_verified,
    updated_at = now();

-- Ensure admin accounts have role = 'admin' in profiles
UPDATE public.profiles
SET role = 'admin'
WHERE lower(email) IN (
    'kushwahaashwani12@gmail.com',
    'kushwaahaashwani12@gmail.com',
    'kushwaashwani12@gmail.com',
    'admin@registry.com'
);

-- Helper function: is_admin() to check admin role using profiles table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        auth.role() = 'service_role'
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR (lower(auth.jwt() ->> 'email') IN (
            'kushwahaashwani12@gmail.com',
            'kushwaahaashwani12@gmail.com',
            'kushwaashwani12@gmail.com',
            'admin@registry.com'
        ))
        OR (auth.jwt() ->> 'role') = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 2. STORAGE BUCKET: expert-documents
-- Private bucket, 10MB size limit (10,485,760 bytes), application/pdf only
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'expert-documents',
    'expert-documents',
    false,
    10485760,
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf'];

-- ==============================================================================
-- 3. DATABASE TABLE: expert_documents
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.expert_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expert_id TEXT NOT NULL,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('work_experience_cert', 'offer_relieving_letter', 'executive_cv')),
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    admin_remark TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_expert_doc_type UNIQUE (expert_id, doc_type)
);

-- Indexes for lightning-fast queries
CREATE INDEX IF NOT EXISTS idx_expert_documents_expert_id ON public.expert_documents(expert_id);
CREATE INDEX IF NOT EXISTS idx_expert_documents_status ON public.expert_documents(status);
CREATE INDEX IF NOT EXISTS idx_expert_documents_doc_type ON public.expert_documents(doc_type);

-- Auto-update updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.update_expert_documents_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_expert_documents_updated_at ON public.expert_documents;
CREATE TRIGGER trg_expert_documents_updated_at
    BEFORE UPDATE ON public.expert_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_expert_documents_timestamp();

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES ON expert_documents
-- ==============================================================================
ALTER TABLE public.expert_documents ENABLE ROW LEVEL SECURITY;

-- 4.1 SELECT Policy:
DROP POLICY IF EXISTS "Expert select own documents" ON public.expert_documents;
DROP POLICY IF EXISTS "Allow expert_documents select" ON public.expert_documents;
CREATE POLICY "Allow expert_documents select" ON public.expert_documents
    FOR SELECT USING (true);

-- 4.2 INSERT Policy:
DROP POLICY IF EXISTS "Expert insert own documents" ON public.expert_documents;
DROP POLICY IF EXISTS "Allow expert_documents insert" ON public.expert_documents;
CREATE POLICY "Allow expert_documents insert" ON public.expert_documents
    FOR INSERT WITH CHECK (true);

-- 4.3 UPDATE Policy:
DROP POLICY IF EXISTS "Expert and Admin update documents" ON public.expert_documents;
DROP POLICY IF EXISTS "Allow expert_documents update" ON public.expert_documents;
CREATE POLICY "Allow expert_documents update" ON public.expert_documents
    FOR UPDATE USING (true)
    WITH CHECK (true);

-- 4.4 DELETE Policy:
DROP POLICY IF EXISTS "Expert delete own documents" ON public.expert_documents;
DROP POLICY IF EXISTS "Allow expert_documents delete" ON public.expert_documents;
CREATE POLICY "Allow expert_documents delete" ON public.expert_documents
    FOR DELETE USING (true);

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES ON storage.objects
-- Bucket: 'expert-documents'
-- Allows insert, select, update, delete on bucket_id = 'expert-documents'
-- ==============================================================================
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 5.1 Storage SELECT Policy:
DROP POLICY IF EXISTS "Expert view own storage documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow document select from expert-documents" ON storage.objects;
CREATE POLICY "Allow document select from expert-documents" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'expert-documents'
    );

-- 5.2 Storage INSERT Policy:
DROP POLICY IF EXISTS "Expert insert own storage documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow document upload to expert-documents" ON storage.objects;
CREATE POLICY "Allow document upload to expert-documents" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'expert-documents'
    );

-- 5.3 Storage UPDATE Policy:
DROP POLICY IF EXISTS "Expert update own storage documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow document update in expert-documents" ON storage.objects;
CREATE POLICY "Allow document update in expert-documents" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'expert-documents'
    );

-- 5.4 Storage DELETE Policy:
DROP POLICY IF EXISTS "Expert delete own storage documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow document delete in expert-documents" ON storage.objects;
CREATE POLICY "Allow document delete in expert-documents" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'expert-documents'
    );

-- ==============================================================================
-- 6. REALTIME PUBLICATION
-- ==============================================================================
ALTER TABLE public.expert_documents REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'expert_documents'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.expert_documents;
    END IF;
END $$;
