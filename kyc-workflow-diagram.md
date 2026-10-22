# Expert Onboarding & KYC Verification - Workflow Diagram

## Status Transition Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXPERT ONBOARDING WORKFLOW                     │
└─────────────────────────────────────────────────────────────────┘

STEP 1: REGISTRATION
┌──────────────┐
│ Expert Signs  │
│    Up        │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Verify Email │
│   (OTP)      │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Profile Created  │
│ status = pending │
└──────────────────┘

STEP 2: EXPERT PORTAL
┌──────────────────┐
│ Complete Profile │
│ - Bio            │
│ - Skills         │
│ - Experience    │
│ - Photo         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Upload KYC Docs  │
│ - ID Proof       │
│ - Address Proof  │
│ - Certificates   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Submit for Review│
│ status = submitted│
└──────────────────┘

STEP 3: ADMIN REVIEW
┌──────────────────┐
│ Admin Starts     │
│ status = under   │
│    review        │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│     ADMIN DECISION           │
└──────────┬───────────────────┘
           │
    ┌──────┴──────┬────────────┐
    │             │            │
    ▼             ▼            ▼
┌────────┐   ┌──────────┐  ┌────────┐
│Approve │   │Request   │  │ Reject │
└───┬────┘   │ Changes  │  └───┬────┘
    │        └────┬─────┘      │
    │             │            │
    ▼             ▼            ▼
┌────────┐   ┌──────────┐  ┌────────┐
│status= │   │status=   │  │status= │
│approved│   │changes_  │  │rejected│
└───┬────┘   │requested │  └────────┘
    │        └────┬─────┘
    │             │
    │             ▼
    │    ┌────────────────┐
    │    │ Expert Resubmits│
    │    │ status = submitted│
    │    └────────┬─────────┘
    │             │
    │             └───────────┐
    │                         │
    ▼                         ▼
┌────────────────┐    ┌────────────────┐
│ Expert Appears  │    │ Expert Cannot   │
│   Publicly     │    │ Resubmit       │
└────────────────┘    └────────────────┘
```

## Component Interactions

```
┌─────────────┐
│  Frontend   │
│  (React)    │
└──────┬──────┘
       │
       ├─────────────┬──────────────┬─────────────┐
       │             │              │             │
       ▼             ▼              ▼             ▼
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│ Auth    │  │ Profiles│  │ Expert  │  │KYC Docs │
│ Service │  │ Service │  │Profiles│  │ Service │
└────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘
     │            │            │            │
     └────────────┴────────────┴────────────┘
                  │
                  ▼
         ┌────────────────┐
         │   Supabase     │
         │   Database     │
         └────────┬───────┘
                  │
     ┌────────────┴────────────┐
     │                         │
     ▼                         ▼
┌──────────┐           ┌──────────┐
│   Auth   │           │ Storage  │
│ (Users)  │           │  Buckets │
└──────────┘           └──────────┘
```

## Data Flow for KYC Review

```
Expert Uploads Document
        │
        ▼
┌─────────────────────┐
│ Validate File Type  │
│ Validate File Size  │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Upload to Storage   │
│ (kyc-documents)     │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Save to Database   │
│ (kyc_documents)    │
└─────────────────────┘

Admin Reviews
        │
        ▼
┌─────────────────────┐
│ Generate Signed URL│
│ (60 second expiry) │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ View Document      │
│ in New Tab         │
└─────────────────────┘
```

## Notification Flow

```
Status Change
        │
        ▼
┌─────────────────────┐
│ Database Trigger     │
│ log_status_change()  │
└────────┬────────────┘
         │
         ├──────────────┬──────────────┐
         │              │              │
         ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│Insert to │  │ Insert to│  │ Trigger  │
│status_   │  │notifi-   │  │ Edge     │
│history  │  │cations  │  │ Function │
└──────────┘  └──────────┘  └────┬─────┘
                                 │
                                 ▼
                          ┌──────────┐
                          │ Send     │
                          │ Email    │
                          └──────────┘
```

## Security Flow

```
User Action
        │
        ▼
┌─────────────────────┐
│ Client-Side Valid.  │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Supabase Client     │
│ (anon key)          │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ RLS Policy Check    │
│ (Database)          │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Operation Allowed? │
└───────┬─────────────┘
        │
   ┌────┴────┐
   │         │
   ▼         ▼
Yes        No
   │         │
   ▼         ▼
Execute   Return
           Error
```

## Real-time Notification Flow

```
Status Change (DB)
        │
        ▼
┌─────────────────────┐
│ Trigger inserts     │
│ notification row    │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ PostgreSQL Realtime │
│ Publication         │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Client Subscription │
│ (useEffect)         │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Update UI in Real-  │
│    Time             │
└─────────────────────┘
```

## Status Timeline

```
Timeline: Expert "John Doe"

T0: Registration
    Status: pending_verification
    Action: Email verification sent

T1: Email Verified
    Status: pending_verification
    Action: User can access portal

T2: Profile Completed
    Status: pending_verification
    Action: Expert fills bio, skills, uploads docs

T3: Submitted for Review
    Status: submitted
    Action: Notification sent to admin

T4: Admin Starts Review
    Status: under_review
    Action: Admin opens expert profile

T5: Admin Approves
    Status: approved
    Action: Email sent, expert appears publicly

Total time: ~24-48 hours (typical)
```

## Edge Cases Handling

```
Case 1: Expert submits incomplete profile
    → Validation blocks submission
    → Error message shown

Case 2: Admin rejects without reason
    → Validation blocks rejection
    → Comment required

Case 3: Expert tries to change own status
    → RLS policy blocks
    → "Unauthorized" error

Case 4: Non-admin tries to access admin dashboard
    → Role check on backend
    → Redirect to login/error

Case 5: Document upload exceeds size limit
    → Client validation + Storage policy
    → Error message shown

Case 6: Expert with 'rejected' status tries to resubmit
    → Not allowed by workflow
    → Must register new account
```

## API Call Sequence for Expert Approval

```
1. Admin clicks "Approve"
   ↓
2. Frontend calls adminService.approveExpert()
   ↓
3. Service calls Supabase RPC/UPDATE
   ↓
4. Database RLS checks admin role
   ↓
5. UPDATE expert_profiles SET status = 'approved'
   ↓
6. Trigger fires: log_status_change()
   ↓
7. Trigger inserts into status_history
   ↓
8. Trigger inserts into notifications
   ↓
9. Trigger calls Edge Function (async)
   ↓
10. Edge Function sends email
   ↓
11. Frontend updates UI
   ↓
12. Realtime pushes notification to expert
```

## Performance Considerations

```
Optimizations:
- File uploads: Direct to Supabase Storage (bypasses server)
- Signed URLs: 60-second expiry, no full file fetch
- RLS: Database-level filtering (no server-side checks)
- Realtime: WebSockets (no polling)
- Pagination: For expert lists in admin dashboard

Scalability:
- Storage buckets separate from database
- CDN for public profile photos
- Edge Functions for email (global distribution)
- Database indexes on frequently queried fields
```

## Audit Trail

```
Every status change creates:
- timestamp
- old_status
- new_status
- changed_by (admin ID)
- comment

Stored in: status_history table
Accessible by: Expert and Admin
Retention: Permanent
```
