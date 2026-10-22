-- Expert Onboarding & KYC Verification Workflow - Supabase Migration Script
-- Run this in Supabase SQL Editor

-- ============================================================
-- ENABLE EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CREATE ENUMS
-- ============================================================
CREATE TYPE expert_status AS ENUM (
  'pending_verification',
  'submitted',
  'under_review',
  'approved',
  'changes_requested',
  'rejected'
);

CREATE TYPE user_role AS ENUM ('expert', 'admin');

CREATE TYPE doc_type AS ENUM (
  'id_proof',
  'address_proof',
  'qualification_certificate',
  'experience_certificate',
  'other'
);

-- ============================================================
-- PROFILES TABLE (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  role user_role NOT NULL DEFAULT 'expert',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- EXPERT PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS expert_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bio TEXT,
  skills TEXT[],
  experience_years INTEGER,
  photo_url TEXT,
  expertise_area VARCHAR(255),
  status expert_status DEFAULT 'pending_verification',
  rejection_reason TEXT,
  admin_comments TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_expert_profile UNIQUE (user_id)
);

-- ============================================================
-- KYC DOCUMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS kyc_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expert_id UUID NOT NULL REFERENCES expert_profiles(id) ON DELETE CASCADE,
  doc_type doc_type NOT NULL,
  file_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- STATUS HISTORY TABLE (Audit Log)
-- ============================================================
CREATE TABLE IF NOT EXISTS status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expert_id UUID NOT NULL REFERENCES expert_profiles(id) ON DELETE CASCADE,
  old_status expert_status,
  new_status expert_status NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  comment TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- CREATE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_expert_profiles_user_id ON expert_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_expert_profiles_status ON expert_profiles(status);
CREATE INDEX IF NOT EXISTS idx_expert_profiles_expertise_area ON expert_profiles(expertise_area);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_expert_id ON kyc_documents(expert_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_doc_type ON kyc_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_status_history_expert_id ON status_history(expert_id);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON status_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES FOR PROFILES
-- ============================================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

-- Admins can read all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert only via trigger (on signup)
CREATE POLICY "Profiles insert only via trigger"
  ON profiles FOR INSERT
  WITH CHECK (false);

-- ============================================================
-- RLS POLICIES FOR EXPERT PROFILES
-- ============================================================

-- Experts can read their own profile
CREATE POLICY "Experts can view own profile"
  ON expert_profiles FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Experts can update their own profile (but not status to approved/rejected/under_review)
CREATE POLICY "Experts can update own profile"
  ON expert_profiles FOR UPDATE
  USING (
    user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid() AND
    status NOT IN ('approved', 'rejected', 'under_review')
  );

-- Admins can read all expert profiles
CREATE POLICY "Admins can view all expert profiles"
  ON expert_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update all expert profiles
CREATE POLICY "Admins can update all expert profiles"
  ON expert_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Public can read only approved experts
CREATE POLICY "Public can view approved experts"
  ON expert_profiles FOR SELECT
  USING (status = 'approved');

-- Insert only via trigger or admin
CREATE POLICY "Expert profiles insert via trigger or admin"
  ON expert_profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- RLS POLICIES FOR KYC DOCUMENTS
-- ============================================================

-- Experts can read their own documents
CREATE POLICY "Experts can view own documents"
  ON kyc_documents FOR SELECT
  USING (
    expert_id IN (
      SELECT id FROM expert_profiles WHERE user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Experts can insert their own documents
CREATE POLICY "Experts can insert own documents"
  ON kyc_documents FOR INSERT
  WITH CHECK (
    expert_id IN (
      SELECT id FROM expert_profiles WHERE user_id = auth.uid()
    )
  );

-- Experts can delete their own documents
CREATE POLICY "Experts can delete own documents"
  ON kyc_documents FOR DELETE
  USING (
    expert_id IN (
      SELECT id FROM expert_profiles WHERE user_id = auth.uid()
    )
  );

-- Admins can read all documents
CREATE POLICY "Admins can view all documents"
  ON kyc_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can delete all documents
CREATE POLICY "Admins can delete all documents"
  ON kyc_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- RLS POLICIES FOR STATUS HISTORY
-- ============================================================

-- Experts can read their own status history
CREATE POLICY "Experts can view own status history"
  ON status_history FOR SELECT
  USING (
    expert_id IN (
      SELECT id FROM expert_profiles WHERE user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can read all status history
CREATE POLICY "Admins can view all status history"
  ON status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert only via trigger
CREATE POLICY "Status history insert only via trigger"
  ON status_history FOR INSERT
  WITH CHECK (false);

-- ============================================================
-- RLS POLICIES FOR NOTIFICATIONS
-- ============================================================

-- Users can read their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own notifications
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Insert only via trigger
CREATE POLICY "Notifications insert only via trigger"
  ON notifications FOR INSERT
  WITH CHECK (false);

-- ============================================================
-- DATABASE TRIGGERS
-- ============================================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'expert')::user_role
  );

  -- Create expert profile if role is expert
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'expert')::user_role = 'expert' THEN
    INSERT INTO expert_profiles (user_id, expertise_area)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'expertise_area'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expert_profiles_updated_at BEFORE UPDATE ON expert_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to log status changes and create notifications
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Log status change
  INSERT INTO status_history (expert_id, old_status, new_status, changed_by, comment)
  VALUES (
    NEW.id,
    OLD.status,
    NEW.status,
    NEW.reviewed_by,
    NEW.admin_comments
  );

  -- Get expert email
  SELECT email INTO user_email
  FROM profiles
  WHERE id = (SELECT user_id FROM expert_profiles WHERE id = NEW.id);

  -- Create notification for expert
  INSERT INTO notifications (user_id, title, message, metadata)
  VALUES (
    (SELECT user_id FROM expert_profiles WHERE id = NEW.id),
    'Profile Status Updated',
    'Your expert profile status has been changed to ' || NEW.status,
    jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'comment', NEW.admin_comments
    )
  );

  -- Trigger Edge Function for email (will be implemented separately)
  -- This is a placeholder - actual email sending via Edge Function
  -- SELECT net.http_post(
  --   url := 'https://your-project.supabase.co/functions/v1/send-status-email',
  --   body := jsonb_build_object(
  --     'email', user_email,
  --     'status', NEW.status,
  --     'comment', NEW.admin_comments
  --   )
  -- );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on expert_profiles status change
CREATE TRIGGER on_expert_status_changed
  AFTER UPDATE OF status ON expert_profiles
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_status_change();

-- ============================================================
-- STORAGE BUCKETS (Run these in Supabase Dashboard > Storage)
-- ============================================================

-- Note: Storage buckets must be created manually in Supabase Dashboard
-- or via Supabase CLI. SQL below is for reference.

-- Bucket: kyc-documents (PRIVATE)
-- Policy: Experts can upload/read only their own folder
-- Policy: Admins can read all
-- Max file size: 5 MB
-- Allowed types: PDF, JPG, PNG

-- Bucket: profile-photos (PUBLIC read, owner write)
-- Policy: Users can upload/read only their own folder
-- Policy: Public can read all
-- Max file size: 2 MB
-- Allowed types: JPG, PNG

-- ============================================================
-- SAMPLE TEST DATA
-- ============================================================

-- Insert admin user (run after creating user in auth.users)
-- Replace 'admin_uuid' with actual UUID from auth.users
-- INSERT INTO profiles (id, full_name, email, phone, role)
-- VALUES ('admin_uuid', 'Admin User', 'admin@example.com', '+1234567890', 'admin');

-- Insert test experts (run after creating users in auth.users)
-- INSERT INTO profiles (id, full_name, email, phone, role)
-- VALUES
--   ('expert1_uuid', 'John Expert', 'john@example.com', '+1234567891', 'expert'),
--   ('expert2_uuid', 'Jane Expert', 'jane@example.com', '+1234567892', 'expert'),
--   ('expert3_uuid', 'Bob Expert', 'bob@example.com', '+1234567893', 'expert');

-- Update expert profiles with different statuses
-- UPDATE expert_profiles SET status = 'approved' WHERE user_id = 'expert1_uuid';
-- UPDATE expert_profiles SET status = 'under_review' WHERE user_id = 'expert2_uuid';
-- UPDATE expert_profiles SET status = 'changes_requested' WHERE user_id = 'expert3_uuid';

-- ============================================================
-- REALTIME SUBSCRIPTION (for notifications)
-- ============================================================

-- Enable Realtime for notifications table
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================================
-- FUNCTION TO GENERATE SIGNED URLS (for document access)
-- ============================================================

-- This will be implemented in the Edge Function for security
-- The database trigger itself will not generate signed URLs
