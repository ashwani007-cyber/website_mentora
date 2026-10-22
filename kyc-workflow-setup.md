# Expert Onboarding & KYC Verification - Setup Guide

## 📋 Prerequisites

1. Supabase account and project
2. Node.js 18+ installed
3. React + Vite project set up

## 🚀 Setup Instructions

### Step 1: Run Database Migration

1. Go to your Supabase project: https://supabase.com/dashboard/project/your-project-id
2. Click **SQL Editor** in the left sidebar
3. Click **"New Query"**
4. Copy the entire content of `kyc-workflow-schema.sql`
5. Paste and click **"Run"**
6. Wait for success message

### Step 2: Create Storage Buckets

1. Go to **Storage** in Supabase dashboard
2. Create bucket: `kyc-documents`
   - Public: No (Private)
   - File size limit: 5 MB
   - Allowed MIME types: `image/jpeg`, `image/png`, `application/pdf`
3. Create bucket: `profile-photos`
   - Public: Yes
   - File size limit: 2 MB
   - Allowed MIME types: `image/jpeg`, `image/png`

### Step 3: Configure Storage Policies

**For kyc-documents bucket:**
- Create policy: `Experts can upload to their own folder`
  - Operation: INSERT
  - Target: `auth.uid() = bucket_id` (folder structure: user_id/doc_type/filename)
- Create policy: `Experts can read their own documents`
  - Operation: SELECT
  - Target: `auth.uid() = bucket_id`
- Create policy: `Admins can read all documents`
  - Operation: SELECT
  - Target: `(SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'`

**For profile-photos bucket:**
- Create policy: `Public read access`
  - Operation: SELECT
  - Target: `true`
- Create policy: `Users can upload to their own folder`
  - Operation: INSERT
  - Target: `auth.uid() = bucket_id`

### Step 4: Set Environment Variables

Add to your `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 5: Enable Realtime

1. Go to **Database** → **Replication** in Supabase dashboard
2. Enable Realtime for `notifications` table
3. Add to `supabase_realtime` publication

### Step 6: Deploy Edge Function (Email Notifications)

1. Install Supabase CLI: `npm install -g supabase`
2. Initialize Supabase in your project: `supabase init`
3. Create Edge Function: `supabase functions new send-status-email`
4. Copy the Edge Function code to `supabase/functions/send-status-email/index.ts`
5. Deploy: `supabase functions deploy send-status-email`

### Step 7: Add React Router

Install dependencies:
```bash
npm install react-router-dom
```

Update your main.tsx to include routing:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import RegisterPage from './kyc/pages/RegisterPage';
import ExpertPortal from './kyc/pages/ExpertPortal';
import AdminDashboard from './kyc/pages/AdminDashboard';

// Add routes
```

### Step 8: Test Data (Optional)

Run the test data queries from `kyc-workflow-schema.sql` to create:
- 1 admin user
- 3 test experts in different statuses

## 📊 Workflow Status Transitions

```
pending_verification
    ↓ (Expert submits profile)
submitted
    ↓ (Admin starts review)
under_review
    ↓ (Admin decision)
    ├─→ approved (Expert appears publicly)
    ├─→ changes_requested (Expert can resubmit)
    └─→ rejected (Expert cannot resubmit without new registration)
```

## 🔐 Security Notes

- Never expose service_role key in frontend
- Use only anon key in client
- All sensitive operations use RLS policies
- Documents stored in private bucket with signed URLs
- Admin role verified from database, not client input

## 📧 Email Notification Setup

The Edge Function sends emails on status changes. Configure:
- SMTP credentials in Edge Function environment variables
- Email templates for each status change

## 🧪 Testing

1. Register as expert: `/register`
2. Complete profile: `/expert-portal`
3. Upload KYC documents
4. Submit for review
5. Login as admin: `/admin-dashboard`
6. Review and approve/reject
7. Check notifications in expert portal

## 📝 File Structure

```
src/kyc/
├── supabaseClient.ts          # Supabase client setup
├── kycService.ts              # All service functions
├── pages/
│   ├── RegisterPage.tsx       # Registration
│   ├── ExpertPortal.tsx       # Expert dashboard
│   └── AdminDashboard.tsx     # Admin review
└── types.ts                  # TypeScript types (optional)
```

## 🚀 Deployment

### Vercel
1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

### Environment Variables (Vercel)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 📞 Support

For issues:
1. Check Supabase logs
2. Verify RLS policies
3. Check browser console
4. Review this guide
