# Quick Fix: Expert Profile Not Showing in Admin Portal

## Problem
Shivam's expert profile is not showing in the Admin Portal's "Document Audit & KYC" section, even though it shows "Verification Pending Admin Audit" in the Expert Portal.

## Root Cause
The `expert_profiles` table (and related tables like `profiles` and `kyc_documents`) likely don't exist in your Supabase database yet. The new KYC system expects these tables, but they haven't been created.

## Solution

### Step 1: Run the Quick Fix SQL Script

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/oitxwcspkelduxbuczux
2. Click **SQL Editor** in the left sidebar
3. Click **"New Query"**
4. Copy the entire content of `quick-fix-create-tables.sql`
5. Paste it into the SQL Editor
6. Click **"Run"** (or press Ctrl+Enter)
7. Wait for success message

This script will:
- Create the `expert_profiles` table
- Create the `profiles` table
- Create the `kyc_documents` table
- Migrate existing experts from the `users` table to `expert_profiles`
- Add necessary indexes

### Step 2: Restart the Backend Server

```bash
# Stop the current server (Ctrl+C)
# Then restart it
npm run server
```

### Step 3: Refresh the Admin Portal

1. Open the Admin Portal in your browser
2. Click the **"🔄 Refresh"** button
3. Shivam's profile should now appear in the "Senior Professional KYC Verification Queue"

### Step 4: Verify

Check the browser console for:
- `[ADMIN API] Fetched experts from expert_profiles: X` - Shows experts were fetched
- `[AUDIT] Fetched pending verifications from Supabase: X` - Shows data was received

## What If It Still Doesn't Work?

### Check the Database Manually

Run this query in Supabase SQL Editor:

```sql
SELECT
  ep.id,
  u.email,
  u.full_name,
  u.role,
  ep.status,
  ep.expertise_area
FROM expert_profiles ep
JOIN users u ON ep.user_id = u.id
WHERE u.email = 'shivam@example.com'  -- Replace with Shivam's actual email
ORDER BY ep.created_at DESC;
```

If no results:
- The expert might not have an `expert_profiles` record
- Run the migration script again

### Check the API Response

Open browser DevTools (F12) → Network tab, then refresh the admin page. Look for:
- Request: `/api/admin/pending-verifications`
- Response: Should show Shivam's profile

### Check Server Logs

The server console should show:
- `[ADMIN API] Fetching pending verifications, status filter: all`
- `[ADMIN API] Fetched experts from expert_profiles: X`

## Expected Result

After running the SQL script and refreshing:
- The admin portal should show "Senior Professional KYC Verification Queue (1)" or more
- Shivam's profile should appear in the list
- Status should show "Pending Audit"
- Admin can now approve/reject/request changes

## Notes

- The SQL script is **safe to run multiple times** (uses ON CONFLICT)
- It will not delete any existing data
- It only creates missing tables and migrates missing records
- If you already ran the migration script from the previous fix, you don't need to run this one
