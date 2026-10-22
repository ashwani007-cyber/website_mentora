-- Test Data for KYC Workflow
-- Run this after creating users in Supabase Auth

-- IMPORTANT: Replace the UUIDs below with actual UUIDs from your auth.users table
-- Get UUIDs from: SELECT id, email FROM auth.users;

-- ============================================================
-- INSERT ADMIN USER
-- ============================================================
-- Replace 'admin_uuid_here' with actual UUID from auth.users
INSERT INTO profiles (id, full_name, email, phone, role)
VALUES (
  'admin_uuid_here',
  'Admin User',
  'admin@example.com',
  '+1234567890',
  'admin'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- INSERT TEST EXPERTS
-- ============================================================
-- Replace these UUIDs with actual UUIDs from auth.users

-- Expert 1: Approved status
INSERT INTO profiles (id, full_name, email, phone, role)
VALUES (
  'expert1_uuid_here',
  'John Expert',
  'john@example.com',
  '+1234567891',
  'expert'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO expert_profiles (user_id, bio, skills, experience_years, expertise_area, status)
VALUES (
  'expert1_uuid_here',
  'Senior software engineer with 10+ years of experience in full-stack development. Specialized in React, Node.js, and cloud architecture.',
  ARRAY['React', 'Node.js', 'TypeScript', 'AWS', 'PostgreSQL'],
  10,
  'Technology',
  'approved'
) ON CONFLICT (user_id) DO NOTHING;

-- Expert 2: Under review status
INSERT INTO profiles (id, full_name, email, phone, role)
VALUES (
  'expert2_uuid_here',
  'Jane Expert',
  'jane@example.com',
  '+1234567892',
  'expert'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO expert_profiles (user_id, bio, skills, experience_years, expertise_area, status)
VALUES (
  'expert2_uuid_here',
  'Financial consultant with expertise in corporate finance, mergers and acquisitions, and strategic planning.',
  ARRAY['Finance', 'M&A', 'Strategic Planning', 'Risk Management'],
  8,
  'Finance',
  'under_review'
) ON CONFLICT (user_id) DO NOTHING;

-- Expert 3: Changes requested status
INSERT INTO profiles (id, full_name, email, phone, role)
VALUES (
  'expert3_uuid_here',
  'Bob Expert',
  'bob@example.com',
  '+1234567893',
  'expert'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO expert_profiles (user_id, bio, skills, experience_years, expertise_area, status, admin_comments)
VALUES (
  'expert3_uuid_here',
  'Healthcare consultant specializing in hospital management and healthcare IT systems.',
  ARRAY['Healthcare', 'Hospital Management', 'IT Systems', 'Compliance'],
  5,
  'Healthcare',
  'changes_requested',
  'Please upload additional qualification certificates to verify your credentials.'
) ON CONFLICT (user_id) DO NOTHING;

-- Expert 4: Rejected status
INSERT INTO profiles (id, full_name, email, phone, role)
VALUES (
  'expert4_uuid_here',
  'Alice Expert',
  'alice@example.com',
  '+1234567894',
  'expert'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO expert_profiles (user_id, bio, skills, experience_years, expertise_area, status, rejection_reason)
VALUES (
  'expert4_uuid_here',
  'Marketing consultant with experience in digital marketing and brand strategy.',
  ARRAY['Marketing', 'Digital Marketing', 'Brand Strategy', 'SEO'],
  3,
  'Marketing',
  'rejected',
  'Insufficient experience in the claimed expertise area. Minimum 5 years required.'
) ON CONFLICT (user_id) DO NOTHING;

-- Expert 5: Pending verification
INSERT INTO profiles (id, full_name, email, phone, role)
VALUES (
  'expert5_uuid_here',
  'Charlie Expert',
  'charlie@example.com',
  '+1234567895',
  'expert'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO expert_profiles (user_id, expertise_area, status)
VALUES (
  'expert5_uuid_here',
  'Legal',
  'pending_verification'
) ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- INSERT STATUS HISTORY FOR TEST EXPERTS
-- ============================================================

-- Expert 1 (Approved)
INSERT INTO status_history (expert_id, old_status, new_status, changed_by, comment, changed_at)
VALUES
  (
    (SELECT id FROM expert_profiles WHERE user_id = 'expert1_uuid_here'),
    'pending_verification',
    'submitted',
    'admin_uuid_here',
    'Profile submitted for review',
    NOW() - INTERVAL '2 days'
  ),
  (
    (SELECT id FROM expert_profiles WHERE user_id = 'expert1_uuid_here'),
    'submitted',
    'under_review',
    'admin_uuid_here',
    'Started review process',
    NOW() - INTERVAL '1 day'
  ),
  (
    (SELECT id FROM expert_profiles WHERE user_id = 'expert1_uuid_here'),
    'under_review',
    'approved',
    'admin_uuid_here',
    'All documents verified. Profile approved.',
    NOW() - INTERVAL '12 hours'
  );

-- Expert 2 (Under Review)
INSERT INTO status_history (expert_id, old_status, new_status, changed_by, comment, changed_at)
VALUES
  (
    (SELECT id FROM expert_profiles WHERE user_id = 'expert2_uuid_here'),
    'pending_verification',
    'submitted',
    'admin_uuid_here',
    'Profile submitted for review',
    NOW() - INTERVAL '3 hours'
  ),
  (
    (SELECT id FROM expert_profiles WHERE user_id = 'expert2_uuid_here'),
    'submitted',
    'under_review',
    'admin_uuid_here',
    'Started review process',
    NOW() - INTERVAL '1 hour'
  );

-- Expert 3 (Changes Requested)
INSERT INTO status_history (expert_id, old_status, new_status, changed_by, comment, changed_at)
VALUES
  (
    (SELECT id FROM expert_profiles WHERE user_id = 'expert3_uuid_here'),
    'pending_verification',
    'submitted',
    'admin_uuid_here',
    'Profile submitted for review',
    NOW() - INTERVAL '1 day'
  ),
  (
    (SELECT id FROM expert_profiles WHERE user_id = 'expert3_uuid_here'),
    'submitted',
    'under_review',
    'admin_uuid_here',
    'Started review process',
    NOW() - INTERVAL '20 hours'
  ),
  (
    (SELECT id FROM expert_profiles WHERE user_id = 'expert3_uuid_here'),
    'under_review',
    'changes_requested',
    'admin_uuid_here',
    'Additional documents required',
    NOW() - INTERVAL '18 hours'
  );

-- Expert 4 (Rejected)
INSERT INTO status_history (expert_id, old_status, new_status, changed_by, comment, changed_at)
VALUES
  (
    (SELECT id FROM expert_profiles WHERE user_id = 'expert4_uuid_here'),
    'pending_verification',
    'submitted',
    'admin_uuid_here',
    'Profile submitted for review',
    NOW() - INTERVAL '5 days'
  ),
  (
    (SELECT id FROM expert_profiles WHERE user_id = 'expert4_uuid_here'),
    'submitted',
    'under_review',
    'admin_uuid_here',
    'Started review process',
    NOW() - INTERVAL '4 days'
  ),
  (
    (SELECT id FROM expert_profiles WHERE user_id = 'expert4_uuid_here'),
    'under_review',
    'rejected',
    'admin_uuid_here',
    'Insufficient experience',
    NOW() - INTERVAL '3 days'
  );

-- ============================================================
-- INSERT TEST NOTIFICATIONS
-- ============================================================

INSERT INTO notifications (user_id, title, message, is_read, created_at)
VALUES
  (
    'expert1_uuid_here',
    'Profile Approved',
    'Your expert profile has been approved. You can now appear in public listings.',
    false,
    NOW() - INTERVAL '12 hours'
  ),
  (
    'expert2_uuid_here',
    'Profile Under Review',
    'Your profile is currently under review by our admin team.',
    false,
    NOW() - INTERVAL '1 hour'
  ),
  (
    'expert3_uuid_here',
    'Changes Requested',
    'Please upload additional qualification certificates to verify your credentials.',
    false,
    NOW() - INTERVAL '18 hours'
  ),
  (
    'expert4_uuid_here',
    'Profile Rejected',
    'Your profile has been rejected due to insufficient experience. Minimum 5 years required.',
    false,
    NOW() - INTERVAL '3 days'
  );

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check all profiles
SELECT p.full_name, p.email, p.role, ep.status
FROM profiles p
LEFT JOIN expert_profiles ep ON p.id = ep.user_id
ORDER BY p.created_at;

-- Check expert profiles with status
SELECT
  ep.id,
  p.full_name,
  p.email,
  ep.expertise_area,
  ep.status,
  ep.created_at
FROM expert_profiles ep
JOIN profiles p ON ep.user_id = p.id
ORDER BY ep.created_at;

-- Check documents for each expert
SELECT
  p.full_name,
  kd.doc_type,
  kd.file_name,
  kd.uploaded_at
FROM kyc_documents kd
JOIN expert_profiles ep ON kd.expert_id = ep.id
JOIN profiles p ON ep.user_id = p.id
ORDER BY kd.uploaded_at;

-- Check status history
SELECT
  p.full_name,
  sh.old_status,
  sh.new_status,
  sh.comment,
  sh.changed_at
FROM status_history sh
JOIN expert_profiles ep ON sh.expert_id = ep.id
JOIN profiles p ON ep.user_id = p.id
ORDER BY sh.changed_at;

-- Check notifications
SELECT
  p.full_name,
  n.title,
  n.message,
  n.is_read,
  n.created_at
FROM notifications n
JOIN profiles p ON n.user_id = p.id
ORDER BY n.created_at DESC;
