# Expert Verification Workflow Fix - Complete Summary

## 1. ROOT CAUSE

**File**: `src/mongoDBService.ts` (lines 111-113)

The application has TWO completely disconnected verification systems:
1. **Legacy system**: localStorage-based via `mongoDBService.getPendingVerifications()` - reads from localStorage key `'pending_verifications'`
2. **New KYC system**: Supabase-based via `kycService` - writes to `expert_profiles` and `kyc_documents` tables

When an expert registers and uploads documents via the new KYC system (RegisterPage, ExpertPortal), the data is saved to Supabase but **never** updates the localStorage that the AdminGovernancePortal reads. This causes newly registered experts to never appear in the Admin Desk → Document Audit & KYC section.

## 2. LIST OF MISMATCHES FOUND

### Registration API (server/authHandler.js)
- **Writes to**: `users` table (Supabase)
- **Fields**: email, password_hash, full_name, role, phone
- **Does NOT create**: `expert_profiles` record ❌
- **Does NOT set**: verification status ❌

### Profile Save & PDF Upload (kycService.ts)
- **ExpertPortal**: Uses `kycDocumentService.uploadDocument()` → saves to `kyc_documents` table
- **Status update**: Uses `expertProfileService.submitForReview()` → sets status to 'submitted'
- **ID type**: UUID (Supabase)
- **Linking**: Documents link to `expert_id` (UUID in expert_profiles table)
- **Connection**: NO connection to localStorage system ❌

### Expert Portal (ExpertPortal.tsx)
- **Shows badge**: Based on `expertProfile.status` from Supabase
- **Status values**: 'pending_verification', 'submitted', 'under_review', 'approved', 'changes_requested', 'rejected'

### Admin Document Audit & KYC (AdminGovernancePortal.tsx)
- **Reads from**: `pendingVerifications` prop (localStorage via mongoDBService)
- **Query**: `mongoDB.getPendingVerifications()` → reads localStorage
- **NO Supabase integration**: Does not query expert_profiles table ❌
- **No Realtime**: No polling or Supabase Realtime ❌
- **No Refresh**: No manual refresh button ❌

### Additional Mismatches
- Status strings: New uses 'pending_verification', old uses 'Pending Audit'
- Field names: Supabase uses snake_case (expert_id), old uses camelCase (expertId)
- ID types: Supabase uses UUID, old uses string/ObjectId
- Table names: New uses expert_profiles, old uses experts (mongoDB collection)
- Document storage: New uses Supabase Storage with signed URLs, old uses local storage/URLs
- No unified status constants across systems ❌

## 3. FIXED CODE

### File 1: src/constants/verificationStatus.ts (NEW)
**Purpose**: Single source of truth for verification status constants

```typescript
export const VERIFICATION_STATUS = {
  PENDING_VERIFICATION: 'pending_verification',
  PENDING_AUDIT: 'pending_audit',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
  REJECTED: 'rejected'
} as const;

export type VerificationStatus = typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS];
```

### File 2: server/authHandler.js (MODIFIED)
**Change**: Create expert_profiles record on expert registration

**Before** (lines 164-174):
```javascript
const { data: user, error } = await supabase.from('users').insert({
  email,
  password_hash: passwordHash,
  full_name: fullName,
  role,
  phone: payload.phone || null
}).select().single();

if (error) throw error;
upsertLocalUser({ ...localRecord, id: user.id });
return { status: 200, body: { success: true, message: 'Account registered successfully.', user: publicUser(user, localRecord), token: publicUser(user, localRecord).token || null } };
```

**After** (lines 164-194):
```javascript
const { data: user, error } = await supabase.from('users').insert({
  email,
  password_hash: passwordHash,
  full_name: fullName,
  role,
  phone: payload.phone || null
}).select().single();

if (error) throw error;

// Create expert_profiles record if role is expert
if (role === 'expert') {
  const { error: expertError } = await supabase
    .from('expert_profiles')
    .insert({
      user_id: user.id,
      expertise_area: payload.expertiseArea || payload.field || 'General',
      status: 'pending_verification'
    })
    .select()
    .single();

  if (expertError) {
    console.error('Error creating expert profile:', expertError);
    // Log but don't fail registration - can be created later
  }
}

upsertLocalUser({ ...localRecord, id: user.id });
return { status: 200, body: { success: true, message: 'Account registered successfully.', user: publicUser(user, localRecord), token: publicUser(user, localRecord).token || null } };
```

### File 3: server.js (MODIFIED)
**Change**: Added admin API endpoints for pending verifications and admin actions

**Added endpoints** (lines 135-280):
- `GET /api/admin/pending-verifications` - Fetch pending experts with optional status filter
- `POST /api/admin/approve-expert` - Approve expert
- `POST /api/admin/request-changes` - Request changes
- `POST /api/admin/reject-expert` - Reject expert
- `POST /api/admin/start-review` - Start review

Each endpoint transforms Supabase data to match frontend format.

### File 4: src/mongoDBService.ts (MODIFIED)
**Change**: Updated `getPendingVerifications()` to call Supabase API

**Before** (lines 111-113):
```typescript
async getPendingVerifications(): Promise<any[]> {
  return readStored<any[]>('pending_verifications', []);
},
```

**After** (lines 111-130):
```typescript
async getPendingVerifications(status?: string): Promise<any[]> {
  // Try to get from Supabase API (new KYC system)
  try {
    const url = status ? `/api/admin/pending-verifications?status=${status}` : '/api/admin/pending-verifications';
    const response = await fetch(url);
    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      console.log('[AUDIT] Fetched pending verifications from Supabase:', data.length);
      return data;
    }
  } catch (err) {
    console.error('Error fetching pending verifications from API:', err);
  }

  // Fallback to localStorage (old system)
  const fallback = readStored<any[]>('pending_verifications', []);
  console.log('[AUDIT] Fallback to localStorage:', fallback.length);
  return fallback;
},
```

**Also updated** `approvePendingVerification()` (lines 189-214) to call Supabase API.

### File 5: src/components/AdminGovernancePortal.tsx (MODIFIED)
**Changes**:
1. Added auto-refresh state (line 151)
2. Added auto-refresh every 30 seconds (lines 169-179)
3. Added manual refresh button (lines 181-187)
4. Added status filter dropdown (lines 1963-1977)
5. Added refresh button in UI (lines 1979-1985)

## 4. MIGRATION SCRIPT

**File**: `migration-normalize-verification.sql`

**How to run**:
1. Go to Supabase Dashboard → SQL Editor
2. Copy the entire content of `migration-normalize-verification.sql`
3. Paste and click "Run"
4. Safe to run multiple times (uses ON CONFLICT)

**What it does**:
1. Creates expert_profiles for all expert users who don't have one
2. Normalizes status strings to standard values
3. Sets 'submitted' status for experts with documents
4. Normalizes role casing
5. Adds missing indexes
6. Creates status history for existing records

## 5. TEST CHECKLIST

### Test 1: Expert Registration
- [ ] Register a new expert via RegisterPage
- [ ] Verify expert_profiles record is created in Supabase with status='pending_verification'
- [ ] Check browser console for "[AUDIT] Fetched pending verifications from Supabase" log

### Test 2: Profile Completion & Document Upload
- [ ] Expert logs in and completes profile
- [ ] Expert uploads KYC documents (ID proof, address proof, etc.)
- [ ] Expert clicks "Submit for Review"
- [ ] Verify status changes to 'submitted' in Supabase
- [ ] Verify documents are saved to kyc_documents table

### Test 3: Admin Dashboard
- [ ] Admin logs in and navigates to Admin Desk → Document Audit & KYC
- [ ] Expert should appear in the list within 30 seconds (auto-refresh)
- [ ] Or click "🔄 Refresh" button for immediate update
- [ ] Verify pending count badge updates
- [ ] Verify expert details and documents are displayed

### Test 4: Status Filter
- [ ] Test each status filter option (All, Pending Verification, Submitted, etc.)
- [ ] Verify list updates correctly

### Test 5: Admin Actions
- [ ] Click "Start Review" → status changes to 'under_review'
- [ ] Click "Approve" → status changes to 'approved'
- [ ] Verify expert disappears from pending list
- [ ] Verify expert can now appear in public expert listing
- [ ] Test "Request Changes" with comments
- [ ] Test "Reject" with reason

### Test 6: Notifications
- [ ] Verify expert receives notification in portal
- [ ] Verify notification contains status change and comments

### Test 7: Migration Script
- [ ] Run migration script in Supabase SQL Editor
- [ ] Verify all expert users have expert_profiles records
- [ ] Verify status strings are normalized
- [ ] Verify existing experts with documents have status='submitted'

## 6. EXPECTED RESULTS

### Before Fix
- Expert registers → uploads documents → shows "Verification Pending" in portal
- Admin Dashboard → Document Audit & KYC → **Expert does NOT appear** ❌
- No connection between new KYC system and admin dashboard

### After Fix
- Expert registers → expert_profiles record created automatically
- Expert uploads documents → status changes to 'submitted'
- Admin Dashboard → Document Audit & KYC → **Expert appears within 30 seconds** ✅
- Admin can view expert details and documents
- Admin can approve/reject/request changes
- Expert receives notifications
- Approved experts appear in public listings

## 7. LOGGING

Temporary logging added (remove after verification):
- `[AUDIT] Fetched pending verifications from Supabase: X` - Shows when API fetch succeeds
- `[AUDIT] Fallback to localStorage: X` - Shows when fallback is used
- `[ADMIN] Auto-refreshing pending verifications` - Shows auto-refresh trigger
- `[ADMIN] Manual refresh triggered` - Shows manual refresh
- Console errors for failed API calls

**To remove**: Search for `console.log('[AUDIT]` and `console.log('[ADMIN]` and remove or comment out.

## 8. FILES CHANGED

1. ✅ `src/constants/verificationStatus.ts` - NEW
2. ✅ `server/authHandler.js` - MODIFIED (added expert_profiles creation)
3. ✅ `server.js` - MODIFIED (added admin API endpoints)
4. ✅ `src/mongoDBService.ts` - MODIFIED (updated getPendingVerifications and approvePendingVerification)
5. ✅ `src/components/AdminGovernancePortal.tsx` - MODIFIED (added auto-refresh, status filter, refresh button)
6. ✅ `migration-normalize-verification.sql` - NEW

## 9. DEPLOYMENT STEPS

1. Run migration script in Supabase SQL Editor
2. Restart backend server: `npm run server`
3. Restart frontend: `npm run dev`
4. Test registration flow
5. Test admin dashboard
6. Remove temporary logging
7. Deploy to production

## 10. ROLLBACK PLAN

If issues occur:
1. Restore previous versions of modified files from git
2. Revert migration script (no rollback needed - it's idempotent)
3. Restart servers
4. System will fall back to localStorage-based pending verifications
