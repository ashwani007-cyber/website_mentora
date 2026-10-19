# Expert Availability Variables

## Entity

ExpertAvailability

## Required Fields

- id: string (UUID / unique availability slot ID)
- expert_id: string (expert's unique ID, e.g. "exp-1")
- availability_date: string (date in ISO YYYY-MM-DD format)
- start_time: string (start time in 12h or 24h format, e.g. "10:00 AM" or "10:00")
- end_time: string (end time in 12h or 24h format, e.g. "11:00 AM" or "11:00")
- status: "AVAILABLE" | "BOOKED" | "DISABLED"
- booking_id: string | null (associated booking ID when status is BOOKED)
- client_id: string | null (ID or email of client who booked the slot)
- created_at: string (ISO timestamp)
- updated_at: string (ISO timestamp)

## Status Enums

- AVAILABLE: Slot is open for booking
- BOOKED: Slot has been successfully booked by a client
- DISABLED: Slot has been deactivated/unavailable by expert or admin

Display labels:
- AVAILABLE -> "Available"
- BOOKED -> "Booked"
- DISABLED -> "Unavailable/Disabled"

## API Request / Response Variables

- expertId: string
- availabilityDate: string (YYYY-MM-DD)
- startTime: string
- endTime: string
- status: "AVAILABLE" | "BOOKED" | "DISABLED"
- slots: Array<{ startTime: string; endTime: string; status?: string }> (for batch creation)
- bookingId: string
- clientId: string
- clientName: string

## Frontend State Variables

- selectedDate: string (YYYY-MM-DD)
- expertAvailabilities: ExpertAvailability[]
- newStartTime: string
- newEndTime: string
- editingSlotId: string | null
- filterDate: string
- filterStatus: string ("ALL" | "AVAILABLE" | "BOOKED" | "DISABLED")
- isSubmitting: boolean
- availabilityError: string | null

## Important Rules

- expert_id identifies the owner of the availability
- availability_date stores the applicable date (YYYY-MM-DD)
- start_time must strictly precede end_time (reject start >= end)
- Past dates cannot be created or selected
- Today's past times cannot be created
- Overlapping / duplicate time slots for the same expert and date are rejected
- BOOKED availability cannot be selected or booked by another client
- Concurrency control: Atomic transition from AVAILABLE to BOOKED via mutex locking
- Expert can modify only their own availability
- Admin can manage availability across all experts
- Client has read-only access to available slots and can book available slots

---

# Dedicated Project Review Workflow Variables & Schema

## Authoritative Identifier
- `projectReviewId`: string (unique authoritative ID, e.g. "pr-1727412345678-abcde")
  Single source of truth for Client, Expert, Admin, Chat, Meetings, Wallets, and Audit.

## Project Review Status Enums
- `PendingExpertAcceptance`: Client has submitted request; waiting for expert decision
- `Accepted`: Expert accepted review; workspace and chat activated
- `Declined`: Expert declined request; review inactive
- `ProjectSubmitted`: Client uploaded project documents, repository URL, or questions
- `InReview`: Expert is actively reviewing project material
- `MeetingRequested`: Client or expert requested a consultation meeting
- `MeetingScheduled`: Meeting time slot agreed upon and scheduled
- `ReviewCompleted`: Expert completed review and submitted final findings
- `Completed`: Review finalized, expert earning released, ready for archiving
- `Cancelled`: Review cancelled

## Meeting Status Enums
- `Scheduled`: Meeting agreed upon, awaiting Google Meet generation
- `Upcoming`: Google Meet link attached and sent to client
- `Started`: Meeting in progress
- `Completed`: Meeting concluded (increments completedMeetingCount)
- `Cancelled`: Meeting cancelled (does NOT consume meeting credit)

## Payment Status Enums
- `PaymentPending`: Initial state awaiting wallet deduction
- `PaymentSuccessful`: Client wallet successfully charged
- `PaymentFailed`: Client wallet balance insufficient or deduction failed
- `RefundPending`: Refund initiated
- `Refunded`: Funds returned to client wallet

## Expert Earning Status Enums
- `EarningPending`: Earnings held in escrow until Project Review completion
- `EarningReleased`: Earnings successfully credited to expert wallet
- `EarningCancelled`: Review declined/cancelled, no payout

## Core Project Review Entity Fields (`projectReviews` collection in DB)
- `projectReviewId`: string (UUID / unique ID)
- `clientId`: string
- `clientName`: string
- `clientEmail`: string
- `expertId`: string
- `expertName`: string
- `expertEmail`: string
- `packageId`: string ("project_review")
- `packageName`: string ("Dedicated Project Review")
- `price`: number (dynamic client price: expert.projectRate || expert.rate * 3)
- `expertEarning`: number (expert earning: Math.round(price * 0.85) or configured baseRate * 3)
- `platformFee`: number (platform cut: price - expertEarning)
- `status`: ProjectReviewStatus
- `paymentStatus`: PaymentStatus
- `expertEarningStatus`: ExpertEarningStatus
- `submission`: {
    files: Array<{ name: string; url: string; size?: string; uploadedAt: string }>;
    repositoryUrl?: string;
    demoUrl?: string;
    description: string;
    questions: string;
    submittedAt?: string;
  }
- `chat`: Array<{
    id: string;
    senderId: string;
    senderRole: 'client' | 'expert' | 'admin' | 'system';
    senderName: string;
    message: string;
    timestamp: string;
    read: boolean;
  }>
- `proposedTimes`: Array<{
    id: string;
    proposedBy: 'client' | 'expert';
    date: string;
    startTime: string;
    endTime: string;
    note?: string;
    status: 'pending' | 'accepted' | 'declined';
    createdAt: string;
  }>
- `meetings`: Array<{
    meetingId: string;
    meetingNumber: number; // 1 or 2
    date: string;
    startTime: string;
    endTime: string;
    googleMeetLink?: string;
    status: 'Scheduled' | 'Upcoming' | 'Started' | 'Completed' | 'Cancelled';
    createdAt: string;
    completedAt?: string;
    cancelledAt?: string;
  }>
- `completedMeetingCount`: number (0, 1, or 2; strictly capped at 2)
- `reviewFeedback`: {
    summary?: string;
    recommendations?: string[];
    strengths?: string;
    issues?: string;
    completedAt?: string;
  }
- `clientWalletTxId`?: string
- `expertWalletTxId`?: string
- `clientArchived`: boolean (soft delete from client history)
- `expertArchived`: boolean (soft delete from expert history)
- `activityTimeline`: Array<{
    id: string;
    eventType: string;
    user: string;
    role: string;
    timestamp: string;
    description: string;
    previousStatus?: string;
    newStatus?: string;
  }>
- `createdAt`: string (ISO 8601)
- `updatedAt`: string (ISO 8601)

---

# Expert Verification Document Upload & Audit Variables

## Document Slot Types
- `expCert`: Work Experience & Tenure Certificate
- `offerLetter`: Company Relieving / Promotion / Offer Letter
- `resume`: Executive Dossier & Bio Resume

## Document Item Schema (`ExpertDocumentItem`)
- `id`: string (e.g. `doc-${expertId}-1`, `doc-${expertId}-2`, `doc-${expertId}-3`)
- `type`: "expCert" | "offerLetter" | "resume"
- `title`: string
- `fileName`: string (original filename with extension, e.g. `Experience_Proof.png`, `Offer_Letter.pdf`)
- `fileSize`: string (human-readable, e.g. `245 KB`, `1.8 MB`)
- `fileData`?: string (base64 Data URL, e.g. `data:image/png;base64,...` or `data:application/pdf;base64,...`)
- `uploadedAt`: string (ISO timestamp or date string)
- `updatedAt`: string (ISO timestamp)
- `expertId`: string
- `expertName`: string
- `expertEmail`: string
- `status`: "Pending Audit" | "Verified" | "Rejected"

## Storage & Path Configuration
- Upload Directory: `public/uploaded_docs`
- Backup Server Directory: `server_docs`
- Relative Static URL: `/uploaded_docs/${encodeURIComponent(fileName)}`
- Document API Endpoint: `/api/documents`
  * `GET /api/documents?key=${key}`: Retrieves file metadata, Data URL, and static URL
  * `GET /api/documents?key=${key}&raw=true`: Streams raw binary file with correct Content-Type header
  * `POST /api/documents`: Accepts `{ id, fileName, fileData, expertId, expertName, expertEmail, type }`

## Supported Formats & MIME Mapping
- `.png` -> `image/png`
- `.jpg`, `.jpeg` -> `image/jpeg`
- `.webp` -> `image/webp`
- `.pdf` -> `application/pdf`
- `.doc` -> `application/msword`
- `.docx` -> `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

---

# Notification Management System Variables & Schema

## Entity
`AppNotification`

## Required & Optional Database Fields (`notifications` collection in db.json & Mongoose)
- `id`: string (UUID / authoritative unique ID, e.g. `notif-1727412345678-abcde`)
- `senderId`: string (e.g. "admin", "admin-desk", or user ID)
- `target`: "all" | "client" | "expert" | "landing" | "admin"
- `audienceType`: "all" | "client" | "expert" | "landing" | "custom"
- `recipientId`?: string (specific user ID or email; undefined / null for role-wide broadcast)
- `recipientName`?: string (human-readable recipient name)
- `recipientType`: "all" | "client" | "expert" | "landing" | "admin"
- `type`: "announcement" | "booking" | "session" | "review" | "verification" | "wallet" | "system" | "message" | "payment"
- `title`: string (notification subject / title)
- `message`: string (notification content / message body)
- `timestamp`: string (human-readable or relative timestamp, e.g. "Just now")
- `createdAt`: string (ISO 8601 UTC timestamp, e.g. `2026-09-29T11:45:00.000Z`)
- `read`: boolean (false initially, true once acknowledged)
- `readAt`?: string (ISO 8601 UTC timestamp when marked read)
- `status`: "queued" | "sent" | "delivered" | "read" | "failed"
- `actionLink`?: string ("landing" | "client" | "expert" | "owner")
- `channel`?: "in_app" | "email" | "push" | "sms"
- `channels`?: Array<"in_app" | "email" | "push" | "sms">
- `eventId`?: string (unique event trigger identifier)
- `eventName`?: NotificationEventName
- `metadata`?: Record<string, any>

## API Request / Response Variables

### 1. `GET /api/notifications`
- Query Parameters:
  * `role`?: "client" | "expert" | "admin" | "landing" | "all"
  * `recipientId`?: string (email, user ID, or expert ID)
  * `unreadOnly`?: boolean ("true" | "false")
- Response:
  * `success`: boolean (`true`)
  * `notifications`: AppNotification[]
  * `count`: number

### 2. `POST /api/notifications`
- Request Body:
  * `target`: "all" | "client" | "expert" | "landing" | "admin"
  * `recipientId`?: string
  * `recipientName`?: string
  * `type`?: NotificationType
  * `title`: string
  * `message`: string
  * `actionLink`?: string
  * `channels`?: NotificationChannel[]
  * `senderId`?: string
- Response:
  * `success`: boolean (`true`)
  * `notification`: AppNotification

### 3. `POST /api/notifications/mark-read`
- Request Body:
  * `id`: string (notification ID)
- Response:
  * `success`: boolean (`true`)
  * `id`: string
  * `read`: boolean (`true`)

### 4. `POST /api/notifications/mark-all-read`
- Request Body:
  * `role`?: string
  * `recipientId`?: string
- Response:
  * `success`: boolean (`true`)
  * `updatedCount`: number

### 5. `POST /api/notifications/clear`
- Request Body:
  * `role`?: string
  * `recipientId`?: string
- Response:
  * `success`: boolean (`true`)
  * `removedCount`: number

## Audience Targeting Rules
1. `target: "expert"`: Visible ONLY to verified experts in Expert Portal. Must NOT leak to Clients or Landing Page.
2. `target: "client"`: Visible ONLY to registered clients in Client Portal. Must NOT leak to Experts or Landing Page.
3. `target: "landing"`: Visible on public Landing Page / public notification area. Does NOT require any user login.
4. `target: "all"`: Platform-wide announcement. Visible across Expert Portal, Client Portal, and Landing Page.
5. Individual targeting (`recipientId` is set): Visible ONLY to the user matching `recipientId` (ID or email). Must NOT leak to other users sharing the same role.

## Notification Center Header & Stacking Context Specifications
1. Header container (`ClientPage` & `ExpertPage`):
   - Classes: `relative z-30 backdrop-blur-xl`
   - Must NOT use `overflow-hidden` at `<header>` level to prevent clipping absolutely positioned child popovers (`max-height: 540px`).
2. Canvas container (`GlobeGraphic` & `TrophyGraphic`):
   - Classes: `relative overflow-hidden`
   - Confines 3D webgl canvas strictly to its dedicated element box without clipping header dropdowns.
3. `NotificationCenter` root wrapper:
   - Classes: `relative inline-block z-40`
   - Provides stacking priority over adjacent navigation controls.
4. Popover Drawer container:
   - Classes: `absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl shadow-2xl z-50 overflow-hidden border backdrop-blur-xl`
   - Event handling: `onClick={(e) => e.stopPropagation()}` prevents click events inside the drawer from triggering dismissal.
   - Click-outside listeners: `mousedown` and `touchstart` on `document` safely close drawer only when target is external to `drawerRef.current`.

---

# Project Review Dynamic Price Synchronization & Platform Fee Variables

## Pricing Entity & Authoritative Price Fields
- `projectRate`: number (Authoritative single active Project Review price per expert, stored in `experts` collection in `db.json` and Mongoose schema)
  * Minimum Allowed Value: `0` (₹0)
  * Maximum Allowed Value: `2000` (₹2,000)
  * Allowed Price Range: `₹0 to ₹2,000` strictly enforced on backend and frontend
  * Values > ₹2,000 (e.g. ₹2,001, ₹5,000, ₹12,000) strictly rejected
  * Negative values (< ₹0) strictly rejected
  * Malformed / non-numeric values strictly rejected

## Platform Fee Configuration (`projectReviewConfig` in `db.json`)
- `feeType`: "percentage" | "fixed"
- `feeValue`: number (Percentage 0-100 if "percentage", or fixed amount >= 0 if "fixed")
- `updatedAt`: string (ISO 8601 UTC timestamp)
- `updatedBy`: string (Admin identifier, e.g. "admin-governance")
- Access Scope: Admin only. Expert and Client have zero read/write access to internal platform fee settings.

## Pricing Audit Trail Entity (`pricingAuditLogs` array in `db.json`)
- `id`: string (UUID / unique audit log identifier, e.g. `audit-1790701144766-byf8`)
- `changeType`: "expert_price" | "platform_fee"
- `targetExpertId`?: string (Expert ID whose price was updated, required for `changeType: "expert_price"`)
- `targetExpertName`?: string (Expert name)
- `previousValue`: number | object (Previous price or previous platform fee config)
- `newValue`: number | object (New price or new platform fee config)
- `changedByRole`: "expert" | "admin"
- `changedById`: string (User ID or role identifier of the modifier)
- `context`: string ("project_review")
- `timestamp`: string (ISO 8601 UTC timestamp)

## Price Snapshot Entity (On Each `ProjectReviewRecord` in `projectReviews`)
- `price`: number (Expert Project Review Price active at booking time; IMMUTABLE once created)
- `platformFee`: number (Platform fee computed at booking time; IMMUTABLE once created)
- `expertEarning`: number (Expert payout held in escrow; IMMUTABLE once created)
- `paidAmount`: number (Final client amount deducted from wallet at booking time)
- `projectReviewId`: string (Authoritative review ID)
- `expertId`: string
- `clientId`: string
- `createdAt`: string (Booking timestamp)

## API Endpoints & Request/Response Variables

### 1. `GET /api/project-reviews/pricing`
- Query Parameters:
  * `expertId`?: string
  * `all`?: boolean ("true" | "false")
  * `role`?: "expert" | "admin" | "client"
- Response:
  * `success`: boolean (`true`)
  * `expertId`: string
  * `projectRate`: number (Authoritative backend value)
  * `minPrice`: `0`
  * `maxPrice`: `2000`
  * `experts`?: Array<{ id: string; name: string; projectRate: number }> (If `all=true` or Admin)
  * `platformFeeConfig`?: object (If Admin)

### 2. `POST /api/project-reviews/pricing`
- Request Body:
  * `expertId`: string (Target expert ID)
  * `projectRate` (or `price`): number (Must be integer/number between 0 and 2000)
  * `role`: "expert" | "admin"
  * `userId`: string
- Response:
  * `success`: boolean (`true`)
  * `expertId`: string
  * `projectRate`: number (Newly active persisted price)
  * `message`: string
- Validation & Auth:
  * Expert: Can only update own `expertId`. Attempting to update another expert returns HTTP 403.
  * Admin: Can update any expert's price.
  * Client: Rejected with HTTP 403 Forbidden.
  * Values < 0 or > 2000 or non-numeric: Rejected with HTTP 400 Bad Request.

### 3. `GET /api/project-reviews/platform-fee` (Admin Only)
- Query Parameters: `role=admin`
- Response:
  * `success`: boolean (`true`)
  * `config`: { feeType: string, feeValue: number, updatedAt: string, updatedBy: string }

### 4. `POST /api/project-reviews/platform-fee` (Admin Only)
- Request Body:
  * `feeType`: "percentage" | "fixed"
  * `feeValue`: number
  * `role`: "admin"
  * `userId`: string
- Response:
  * `success`: boolean (`true`)
  * `config`: Updated configuration
- Validation & Auth:
  * Non-admin role: Rejected with HTTP 403 Forbidden.

## Step 2 & Step 3 Test States
- Expert JK Active Price Transition:
  * Initial State: ₹1,000
  * Step 2 Expert-Set Price: ₹1,500 (Verified synced across Expert, Admin, Client)
  * Step 3 Admin-Set Price: ₹1,200 (Planned target for Step 3 Admin Price Control)

## Step 4 Alternating Test Sequence
- Two-Way Alternating Synchronization Path for Expert JK:
  * 0. Baseline: ₹1,000 (Expert, Admin, Client)
  * 1. Expert updates: ₹1,000 → ₹1,500 (Admin, Client = ₹1,500)
  * 2. Admin updates: ₹1,500 → ₹1,200 (Expert, Client = ₹1,200)
  * 3. Expert updates: ₹1,200 → ₹1,800 (Admin, Client = ₹1,800)
  * 4. Admin updates: ₹1,800 → ₹900 (Expert, Client = ₹900)
  * Survives full DB reload, simulate tab switch, and new booking creation

## Step 4 Two-Way Synchronization Verification Status
- Verified Alternating Path on Expert JK:
  * Baseline: ₹1,000 (Expert, Admin, Client = ₹1,000) [PASS]
  * Expert Update 1: ₹1,000 -> ₹1,500 (Admin & Client = ₹1,500) [PASS]
  * Admin Update 1: ₹1,500 -> ₹1,200 (Expert & Client = ₹1,200) [PASS]
  * Expert Update 2: ₹1,200 -> ₹1,800 (Admin & Client = ₹1,800) [PASS]
  * Admin Update 2: ₹1,800 -> ₹900 (Expert & Client = ₹900) [PASS]
  * Survival checks (Disk DB, 5 simulated concurrent tabs, audit trail) [PASS]

## Step 5 Platform Fee Verification Status
- Verified Platform Fee Operations:
  * Admin View & Update: Percentage & Fixed [PASS]
  * Client Role Access Rejection: HTTP 403 [PASS]
  * Expert Role Access Rejection: HTTP 403 [PASS]
  * Input Boundary Enforcement: Negative, non-numeric, >100% rejected [PASS]
  * 1-Hour Call Rate Isolation: 100% untouched [PASS]
  * Audit Trail Persistence: `pricingAuditLogs` verified [PASS]

## Step 6 Payment Integration & Price Snapshot Verification Status
- Verified Payment & Snapshot Invariants:
  * Backend Authoritative Calculation: Client payload price ignored; backend computes price [PASS]
  * Wallet Escrow Deduction: Deducted authoritative price [PASS]
  * Historical Price Snapshot: Immutable across subsequent rate changes [PASS]
  * Historical Fee Snapshot: Immutable across subsequent fee config changes [PASS]
  * Historical Payout Snapshot: Escrow release pays out snapshot earning, not recalculated [PASS]
  * Multiple Review Coexistence: Review 1 (₹1,500) and Review 2 (₹900) coexisting [PASS]

## Step 7 Final Regression & Platform Status
- Final System Status: Fully Integrated & Verified
  * Total Test Suites: 7
  * Total Automated Tests: 205
  * Passed: 205 (100%)
  * Failed: 0
  * Production Build: Clean (0 errors)
  * Price Range: Strictly ₹0 - ₹2,000 enforced
  * Dynamic Portals: Expert Portal, Admin Portal, Client Portal 100% synchronized
  * Platform Fee: Admin-only (Percentage / Fixed), strictly isolated to Project Reviews
  * Snapshot Preservation: 100% immutable historical records & payouts

---

# Simple Additive Pricing Model Variables

## Pricing Formula
```text
Final Client Price = Expert Project Review Price (projectRate) + Platform Charge (platformFee)
```

## Entity Fields (`projectReviews` in DB)
- `expertCharge`: number (Expert's active price at booking time, ₹0 to ₹2,000)
- `platformFee`: number (Platform charge at booking time, set by Admin)
- `price`: number (`expertCharge + platformFee`, final amount payable by Client)
- `paidAmount`: number (`expertCharge + platformFee`, deducted from client wallet)
- `expertEarning`: number (`expertCharge`, full amount released to Expert wallet on completion)

## Platform Fee Config (`projectReviewConfig` in DB)
- `feeType`: "fixed" | "percentage" (default "fixed")
- `feeValue`: number (e.g., 100 for fixed ₹100 platform charge)
- `updatedAt`: string (ISO timestamp)
- `updatedBy`: string ("admin")

## Pricing API Fields
- `GET /api/project-reviews/pricing` returns:
  * `expertId`: string
  * `expertName`: string
  * `projectRate`: number (Expert charge, ₹0 to ₹2,000)
  * `platformFee`: number (Platform charge)
  * `clientPrice`: number (`projectRate + platformFee`)
  * `minPrice`: 0
  * `maxPrice`: 2000

## Step 2 Client Portal UI State (`ProjectReviewRequestModal.tsx`)
- `expertCharge`: number (active Expert Review Charge fetched from backend)
- `platformFee`: number (active Platform Charge fetched from backend)
- `totalAmount`: number (authoritative Client Total: `expertCharge + platformFee`)
- `hasSufficientBalance`: boolean (`walletBalance >= totalAmount`)
- Display Labels:
  * "Expert Review Charge: ₹X"
  * "Platform Charge: ₹Y"
  * "Total Amount: ₹(X + Y)"
- Immutable Client Escrow Requirement:
  * Client cannot edit or tamper with pricing numbers.
  * Backend independently calculates and deducts `totalAmount` on request creation.

## System Verification Summary
- Additive Pricing Model: Expert Price + Platform Charge = Final Client Price
- Total Test Suites: 3 active regression & integration suites
- `scratch/test_simple_pricing_sync.mjs`: 79/79 PASSED (100%)
- `scratch/test_backend.mjs`: 17/17 PASSED (100%)
- `scratch/test_project_reviews_backend.mjs`: 36/36 PASSED (100%)
- Total Tests: 132 automated tests passed (100%)
- Production Build: Clean (0 errors, 4.81s)
- Portals Synchronized: Expert Portal, Admin Portal, Client Portal
- Service Isolation: 1-Hour Call rates and availability 100% preserved





## Platform Fee Persistence & Synchronization Variables
- `mongo_project_review_config`: LocalStorage cache key storing `{ feeType: "fixed" | "percentage", feeValue: number, updatedAt: string, updatedBy: string }`.
- Default Platform Fee Setting: `{ feeType: "fixed", feeValue: 150 }`.
- Admin Action Button Label: `"Save Platform Charge"`.
- Admin Allowed Ranges: Fixed amount: ₹0 - ₹5,000. Percentage: 0% - 100%.
- Client Dynamic Synchronization Formula: `Client Total = Expert Project Review Price + Platform Charge`.

## Unified Platform Charge Configuration Variables & Schema
- `platformCharge`: Authoritative database object in `db.json`:
  * `feeType`: "fixed" | "percentage"
  * `feeValue`: number (non-negative)
  * `currency`: "INR"
  * `updatedAt`: ISO 8601 string
  * `updatedBy`: string
- API Endpoints:
  * `GET /api/platform-settings` & `GET /api/project-reviews/platform-fee` (reads authoritative config)
  * `PUT /api/platform-settings` & `POST/PUT /api/project-reviews/platform-fee` (admin mutation with audit)
- Audit Trail Log Fields (`pricingAuditLogs`):
  * `oldValue`: number
  * `newValue`: number
  * `changedBy`: string
  * `changedAt`: string
  * `context`: "project_review"
- Historical Snapshot Record Fields (`projectReviews`):
  * `expertCharge`: number (authoritative active expert price at creation)
  * `platformFee`: number (authoritative active platform fee at creation)
  * `platformCharge`: number (synonym for platformFee)
  * `platformChargeType`: "fixed" | "percentage"
  * `price`: number (total payable: `expertCharge + platformFee`)
  * `paidAmount`: number (amount deducted from wallet)
  * `expertEarning`: number (amount payable to expert on completion)

## Form Fee Real-Time Synchronization Variables
- `ProjectReviewRequestModal` Dynamic States:
  * `expertCharge`: number (active Expert Project Review price, dynamically synced)
  * `platformFee`: number (active Platform Charge, dynamically calculated based on fixed amount or percentage of expertCharge)
  * `totalAmount`: number (authoritative Client Total: `expertCharge + platformFee`)
  * `pollingInterval`: 1500ms (real-time live update for open modal across multi-tab / cross-browser sessions)
- `AdminProjectReviewDesk` Dynamic Table Variables:
  * `pCharge`: number (computed per row: `platformFeeConfig.feeType === 'fixed' ? platformFeeConfig.feeValue : Math.round(activePrice * (platformFeeConfig.feeValue / 100))`)
  * `clientFinalPrice`: number (`activePrice + pCharge`)
  * `pollingInterval`: 2000ms (keeps Admin directory aligned with live backend changes)
- `BookingModal` Package Pricing:
  * Project Review Package Price: `expert.projectRate || (expert.rate * 3) + activePlatformCharge`

## Platform Charge Input State & Protection Variables (`AdminProjectReviewDesk.tsx`)
- `isFeeDirtyRef`: `React.MutableRefObject<boolean>` (tracks whether user is actively typing/editing Fee Value or Fee Type)
- `feeValueInput`: `string` (allows fluid user text editing, preventing snap to 0 or truncation when clearing input)
- `feeTypeInput`: `'fixed' | 'percentage'` (controlled select state)
- `Save Action`: `handleAdminUpdateFee` validates, updates server via `PUT /api/platform-settings`, resets `isFeeDirtyRef.current = false`, updates active banner and directory table immediately.

## Mentora Blogs & Articles Variables (`src/data/blogArticles.ts` & `src/components/MentoraBlogsPage.tsx`)

### Entity: BlogArticle
- `id`: `string` (unique article identifier, e.g. `'blog-featured-1'`, `'blog-1'`)
- `slug`: `string` (URL-friendly slug, e.g. `'the-knowledge-you-build-over-a-career-is-more-valuable-than-you-think'`)
- `title`: `string` (Editorial article headline)
- `category`: `string` (one of `BLOG_CATEGORIES`)
- `readTime`: `string` (e.g. `'6 min read'`)
- `summary`: `string` (editorial summary/excerpt)
- `author`: `string` (e.g. `'Mentora Editorial Team'`, `'Krishnan Iyer'`, `'Sunita Rao'`)
- `authorRole`: `string` (professional title / council affiliation)
- `date`: `string` (publication date, e.g. `'October 2026'`)
- `image`: `string` (curated high-resolution editorial photograph)
- `featured`: `boolean` (flags hero featured article)
- `keywords`: `string[]` (indexed tags for real-time search)
- `keyTakeaways`: `string[]` (high-value executive takeaways)
- `sections`: `ArticleSection[]` (structured article body: headings, paragraphs, quotes, callouts, lists)

### Categories (`BLOG_CATEGORIES`)
- `'All'`
- `'Mentorship'`
- `'Career'`
- `'Leadership'`
- `'Entrepreneurship'`
- `'Technology & AI'`
- `'Industry Insights'`
- `'Projects'`
- `'Consulting'`
- `'Personal Growth'`

### Component State Variables (`MentoraBlogsPage.tsx`)
- `selectedSlug`: `string | null` (slug of currently viewed detailed article, null for main blog directory)
- `activeCategory`: `string` (currently selected category pill)
- `searchQuery`: `string` (active query filtering titles, summaries, keywords)
- `visibleCount`: `number` (pagination counter, initialized to 6)
- `hasLoadedMore`: `boolean` (guard preventing duplicate appends, shows *"All Articles Loaded"*)
- `cursorPos`: `{ x: number, y: number }` (desktop cursor tracking coordinates for spring physics)
- `isHoveringImage`: `boolean` (triggers floating circular "Read" badge over article cards)
- `mobileMenuOpen`: `boolean` (mobile drawer toggle)
- `copiedLink`: `boolean` (clipboard copy confirmation state)

### Theme Palette Tokens
- Light Mode:
  * `bg`: `'#FEF7EB'` (Warm ivory/cream)
  * `primary`: `'#601D22'` (Deep maroon/burgundy)
  * `primaryHover`: `'#72232B'`
  * `text`: `'#3E1117'`
  * `textMuted`: `'#6B4A4D'`
  * `border`: `'rgba(62, 17, 23, 0.10)'`
- Dark Mode:
  * `bg`: `'#120D0E'` (Editorial obsidian)
  * `surface`: `'#1C1415'`
  * `secondarySurface`: `'#251A1C'`
  * `primary`: `'#A94B55'` (Sophisticated rose-crimson)
  * `primaryHover`: `'#C15B66'`
  * `text`: `'#F8EEE2'`
  * `textMuted`: `'#D5C5C0'`
  * `border`: `'rgba(248, 238, 226, 0.12)'`

---

# Admin Blogs & Articles Management System Variables & Schema (`src/types/index.ts`, `src/components/AdminBlogsDesk.tsx`, `server.js`)

## Entity: BlogArticleRecord
- `id`: `string` (unique authoritative identifier, e.g. `'blog-1727412345678-abcd'`)
- `type`: `BlogContentType` (`'blog' | 'article'`)
- `title`: `string` (article title headline)
- `slug`: `string` (unique URL-friendly slug, e.g. `'mentorship-in-the-age-of-ai'`)
- `excerpt`: `string` (short summary / excerpt displayed on cards and search)
- `summary`: `string` (backward-compatibility alias for excerpt)
- `content`: `string` (full markdown or plain text article content)
- `sections`: `BlogArticleSection[]` (array of structured blocks: headings, paragraphs, quotes, callouts, lists, images)
- `category`: `string` (taxonomy category name)
- `author`: `object`
  * `name`: `string` (e.g. `'Dr. Jane Doe'`, `'Mentora Editorial Team'`)
  * `role`: `string` (e.g. `'Senior Governance Fellow'`, `'Knowledge Advisory Council'`)
  * `avatar`: `string | undefined` (author profile picture URL)
- `authorName`: `string` (denormalized convenience string)
- `authorRole`: `string` (denormalized convenience string)
- `coverImage`: `string` (featured visual URL)
- `image`: `string` (backward-compatibility alias for coverImage)
- `readTime`: `string` (e.g. `'5 min read'`)
- `status`: `BlogContentStatus` (`'draft' | 'published'`)
- `featured`: `boolean` (flags the primary featured article; strictly 1 at a time)
- `displayOrder`: `number` (numeric ordering rank for directory display)
- `publishedAt`: `string | undefined` (ISO timestamp of publication)
- `date`: `string` (human-readable publication date, e.g. `'October 2026'`)
- `createdAt`: `string` (ISO timestamp)
- `updatedAt`: `string` (ISO timestamp)
- `keywords`: `string[]` (indexed search tags)
- `keyTakeaways`: `string[]` (executive highlight takeaways)

## Entity: BlogCategoryRecord
- `id`: `string` (unique category identifier, e.g. `'cat-1'`)
- `name`: `string` (category display name, e.g. `'Technology & AI'`)
- `slug`: `string` (URL-safe slug, e.g. `'technology-ai'`)
- `description`: `string | undefined` (category summary)
- `articleCount`: `number | undefined` (real-time published article count)
- `createdAt`: `string` (ISO timestamp)
- `updatedAt`: `string` (ISO timestamp)

## Entity: BlogCMSStats
- `total`: `number` (total count of blogs & articles in database)
- `published`: `number` (count of published articles)
- `drafts`: `number` (count of unpublished draft articles)
- `featured`: `number` (count of featured articles)
- `categories`: `number` (count of categories)

## Admin Blogs CMS Desk State Variables (`AdminBlogsDesk.tsx`)
- `articles`: `BlogArticleRecord[]` (live articles list loaded from backend API)
- `categories`: `BlogCategoryRecord[]` (live categories list loaded from backend API)
- `stats`: `BlogCMSStats | null` (live database KPI aggregates)
- `viewMode`: `'list' | 'editor'` (toggles table view vs rich content editor view)
- `activeTab`: `'all' | 'published' | 'draft' | 'featured'`
- `categoryFilter`: `string` (`'all'` or specific category)
- `searchQuery`: `string`
- `editingArticle`: `BlogArticleRecord | null` (article currently open in editor)
- `isSaving`: `boolean` (mutation in-flight indicator)
- `previewArticle`: `BlogArticleRecord | null` (article open in public preview modal)
- `deleteConfirmArticle`: `BlogArticleRecord | null` (article pending deletion confirmation)
- `showCategoryModal`: `boolean` (toggles Category Management dialog)
- `newCategoryName`: `string` (input for new category creation)
- `newCategoryDescription`: `string` (input for category description)

## REST API Endpoints & Auth Requirements
- Public Endpoints:
  * `GET /api/blogs`: Query params: `category`, `search`, `type`, `limit` (returns published articles)
  * `GET /api/blogs/:slug`: Query params: `preview` (with preview=true, admin auth required for drafts)
  * `GET /api/blogs/categories`: Returns categories with real-time article counts
- Admin Endpoints (Requires `x-admin-role: admin` or payload `role: 'admin'`; non-admins receive 403 Forbidden):
  * `GET /api/admin/blogs`: Query params: `status`, `category`, `type`, `featured`, `search`
  * `GET /api/admin/blogs/stats`: Returns KPI totals
  * `POST /api/admin/blogs`: Create article
  * `PUT /api/admin/blogs/:id`: Update article
  * `DELETE /api/admin/blogs/:id`: Delete article
  * `POST /api/admin/blogs/:id/publish`: Publish draft
  * `POST /api/admin/blogs/:id/unpublish`: Unpublish article to draft
  * `POST /api/admin/blogs/:id/feature`: Toggle featured flag (enforces single primary featured article rule)
  * `POST /api/admin/blogs/reorder`: Persist custom display order array
  * `GET /api/admin/blogs/categories`: List categories
  * `POST /api/admin/blogs/categories`: Create new category
  * `DELETE /api/admin/blogs/categories/:id`: Delete category (checks article count protection)

## Synchronization Events
- Custom DOM Event: `blogs_updated` (dispatched across tabs and windows on any database mutation)
- Storage Key: `mongo_last_admin_action` (triggers cross-tab synchronization listeners)

---

# Landing Page Background Video Integration Variables & Configuration (`src/data/landingVideoConfig.ts`, `src/components/LandingBackgroundVideo.tsx`, `src/App.tsx`)

## Entity: LandingVideoConfig
- `videoUrl`: `string` (authoritative CloudFront MP4 URL)
  * Location: `src/data/landingVideoConfig.ts`
  * Value: `'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_045634_e1c98c76-1265-4f5c-882a-4276f2080894.mp4'`

## Video Component State Variables (`LandingBackgroundVideo.tsx`)
- `reducedMotion`: `boolean` (reflects `window.matchMedia('(prefers-reduced-motion: reduce)').matches`)
- `videoLoaded`: `boolean` (flags whether video `onLoadedData` / `onCanPlay` has fired)
- `videoError`: `boolean` (flags whether video failed to load or experienced decoding error)
- `autoplayBlocked`: `boolean` (flags whether browser autoplay policy or battery saver prevented playback)
- `isVideoActive`: `boolean` (computed flag: `!reducedMotion && !videoError && !autoplayBlocked`)
- `videoRef`: `React.RefObject<HTMLVideoElement | null>` (stable reference to DOM video element)

## Video Element Attributes & Rules
- `autoPlay`: `true`
- `muted`: `true` (strictly required for cross-browser background autoplay)
- `loop`: `true` (seamless continuous looping)
- `playsInline`: `true` (prevents fullscreen takeover on mobile devices)
- `preload`: `'auto'`
- `controls`: `false` (hidden browser controls)
- `aria-hidden`: `'true'` (decorative background element hidden from screen readers)
- `tabIndex`: `-1` (excluded from keyboard focus ring)
- `object-fit`: `'cover'` (responsive container fill preserving 16:9 aspect ratio without distortion)
- `pointer-events`: `'none'` (passes all mouse, touch, and scroll events through to interactive UI)

## Layering Architecture & Visual Hierarchy
- **Layer 1 — Video Background ONLY (Wallpaper Removed)**:
  * Fixed viewport container: `fixed inset-0 pointer-events-none overflow-hidden select-none z-0`
  * Video element: `absolute inset-0 w-full h-full object-cover z-1`
- **Layer 2 — Theme-Aware Overlay / Gradient**:
  * Radial gradient atmospheric depth overlay (`z-2`)
  * Vertical contrast & text readability linear gradient overlay (`z-2`)
- **Layer 2.5 — Executive Blooms & Grid Matrix**:
  * Geometric matrix mask and quantum gold/cyan ambient blooms (`z-0` in Landing container)
- **Layer 3 — Landing Page Content**:
  * Sticky Header (`z-30`)
  * Hero Section (`relative z-10`)
  * Floating 3D Cards, Buttons, and Nav Links

---

# Mentora Premium Landing Page Footer Variables & Design Tokens

## Footer Component Props (`src/components/Footer.tsx`)
- `theme`: `"dark" | "light"` (optional, defaults to `"dark"`)
- `setPage`: `(page: string) => void` (optional routing handler for `"landing" | "about" | "blogs" | "client" | "expert" | "owner"`)
- `onOpenAuth`: `(mode: "signup" | "login", role?: string) => void` (optional auth modal trigger for `"client" | "expert"`)
- `userRole`: `string | null` (optional current authenticated role: `"client" | "expert" | "admin" | null`)
- `setActiveTab`: `(tab: string) => void` (optional backward-compatible prop for client/senior/admin dashboards)
- `includeCta`: `boolean` (optional, controls rendering of pre-footer CTA section, defaults to `true`)

## Newsletter State Variables
- `email`: `string` (controlled input value)
- `status`: `"idle" | "loading" | "success" | "error"` (submission lifecycle state)
- `errorMessage`: `string` (validation or network message)

## Social Media Links & Exact URLs
- `LINKEDIN_URL`: `"https://www.linkedin.com/in/ashwani-kushwaha-11998a327"`
- `INSTAGRAM_URL`: `"https://www.instagram.com/ashwanikushwaha386"`
- Attributes: `target="_blank"`, `rel="noopener noreferrer"`, `aria-label`

## Color Tokens & Theme Architecture
- **Light Mode**:
  - Wave Background: `linear-gradient(180deg, transparent 0%, #FAF8F5 100%)`
  - Footer Surface: `#FAF8F5` / Warm Cream (`#F7F4EE` to `#FAF8F5`)
  - Primary Text: `#0F172A` (Deep Navy / Slate 900)
  - Secondary Text: `#475569` (Slate 600)
  - Muted Text: `#64748B` (Slate 500)
  - Brand Accent: `#D97706` / `#F59E0B` (Mentora Amber / Orange)
  - Borders: `rgba(15, 23, 42, 0.08)` / `#E2E8F0`
  - Input Background: `#FFFFFF` with `#E2E8F0` border
- **Dark Mode**:
  - Wave Background: `linear-gradient(180deg, transparent 0%, #060A10 100%)`
  - Footer Surface: `#060A10` / Deep Cyber Obsidian (`#060A10` to `#04070D`)
  - Primary Text: `#F8FAFC` (Pure Off-White)
  - Secondary Text: `#94A3B8` (Slate 400)
  - Muted Text: `#64748B` (Slate 500)
  - Brand Accent: `#FBBF24` / `#F59E0B` (Quantum Gold / Amber)
  - Borders: `rgba(255, 255, 255, 0.08)`
  - Input Background: `rgba(15, 23, 42, 0.7)` with `rgba(255, 255, 255, 0.12)` border

## Column Navigation Architecture
- **Column 1 — Brand, Newsletter & Social**:
  - Logo (`variant="horizontal"`, light/dark asset)
  - Mission statement & Brand tagline ("Empowering Future Leaders")
  - "Stay Connected" newsletter form
  - "CONNECT WITH US" social icons (LinkedIn & Instagram)
- **Column 2 — EXPLORE**:
  - How It Works (`#how`)
  - For Organizations (`#organizations`)
  - Stories (`#stories`)
  - About (`about`)
  - Blogs & Articles (`blogs`)
- **Column 3 — FOR CLIENTS & ORGANIZATIONS**:
  - Find an Expert (`onOpenAuth("signup", "client")` or `client` portal)
  - Browse Experts (`#featured-advisors`)
  - Book a Session (`onOpenAuth("signup", "client")` or `client` portal)
  - Project Review (`onOpenAuth("signup", "client")` or `client` portal)
  - Client Portal (`client` portal)
- **Column 4 — FOR EXPERTS**:
  - Become an Expert (`onOpenAuth("signup", "expert")`)
  - Expert Sign In (`onOpenAuth("login", "expert")`)
  - Expert Portal (`expert` portal)
  - How It Works (`#how`)
- **Column 5 — COMPANY & RESOURCES**:
  - About Mentora (`about`)
  - Blogs & Articles (`blogs`)
  - Stories (`#stories`)
  - Executive Governance Desk (`/?portal=admin`)
  - Contact (`mailto:support@mentora.com`)
  - Privacy Policy (Legal Modal)
  - Terms & Conditions (Legal Modal)

---

# Mentora Footer Animated Two-Layer Wave Tokens & Specifications

## Wave Animation Architecture
- Container: `relative w-full overflow-hidden leading-none select-none -mb-[1px] h-20 sm:h-24 md:h-32 lg:h-36 group cursor-pointer`
- Background Fill: `#F5F1EA` (Light) / `#05080E` (Dark) matching exact CTA boundary
- Viewport width: `100%`, horizontal overflow hidden
- Primary Wave (`Layer 1` - Foreground):
  * Class: `mentora-wave-layer-primary`
  * Animation: `mentoraWavePrimary 14s linear infinite`
  * Translation: `translate3d(0, 0, 0)` -> `translate3d(-50%, 0, 0)` with vertical oscillation (`-3px` at 50%)
  * Light Mode Fill: `#FFF3E0` to `#FFE8C8` to `#FAF8F5` (seamlessly merges into footer body)
  * Dark Mode Fill: `#1E2B45` to `#10192A` to `#060A10` (seamlessly merges into dark footer body)
  * Light Mode Crest Contour Stroke: 2.5px gradient `url(#mentoraWaveStrokeLight)` (`#EA580C` -> `#F59E0B` -> `#FBBF24` -> `#D97706`) with drop-shadow glow
  * Dark Mode Crest Contour Stroke: 2.5px gradient `url(#mentoraWaveStrokeDark)` (`#FCD34D` -> `#38BDF8` -> `#A855F7` -> `#F59E0B`) with neon glow filter
- Secondary Wave (`Layer 2` - Behind/Above):
  * Class: `mentora-wave-layer-secondary`
  * Animation: `mentoraWaveSecondary 19s linear infinite`
  * Translation: `translate3d(-50%, 0, 0)` -> `translate3d(0, 0, 0)` with vertical oscillation (`+4px` at 50%)
  * Light Mode Fill: Sunset Coral & Amber gradient (`#FF5722` 65% -> `#F59E0B` 80% -> `#FDE68A` 90% -> `#FAF8F5` 100%)
  * Dark Mode Fill: Cyber Aurora gradient (`#F59E0B` 85% -> `#6366F1` 60% -> `#0EA5E9` 55% -> `#0D1524` 90% -> `#060A10` 100%)
  * Crest Stroke: 2px contour stroke (Light: `#EA580C` to `#F59E0B`; Dark: `#38BDF8` to `#06B6D4`)
- Interactive Features:
  * On hover (`.group:hover`): Primary wave glow intensifies (`drop-shadow(0 0 14px rgba(245, 158, 11, 0.65))`), stroke width expands to 3.2px, and secondary wave opacity increases to 1.0 with amplified glow.
- Cycle Durations:
  * Primary Wave: ~14s (slow, calm, fluid)
  * Secondary Wave: ~19s (asynchronous speed/phase)
- Accessibility:
  * `@media (prefers-reduced-motion: reduce)`: `animation: none !important`

## Single Login Portal Integration Variables & Session Architecture

### Authoritative Identities & Database Collections
- `ADMIN_EMAILS`: `["kushwahaashwani12@gmail.com", "kushwaahaashwani12@gmail.com", "kushwaashwani12@gmail.com"]` (Supported admin identity email aliases; exclusive system administration authority).
- `isAdminEmail(email)`: Helper function verifying if an email address belongs to the designated admin identity list.
- `MONGO_URI`: `process.env.MONGO_URI || "mongodb://127.0.0.1:27017"`
- `DB_NAME`: `"silver_workforce"`
- `admin_credentials` Collection Schema:
  * `email`: string (e.g. `"kushwaahaashwani12@gmail.com"`)
  * `password`: string (bcrypt hash, `$2b$10$...` or `$2b$12$...`; empty string `""` when uninitialized)
  * `role`: `"admin"`
  * `initialized`: boolean (false until first password established)
  * `adminPasswordInitialized`: boolean
  * `isPasswordInitialized`: boolean
  * `currentToken`: string | null (cryptographic session token: `adm_<hex>`)
  * `lastLogin`: ISO 8601 string
  * `failedLoginAttempts`: number
  * `lockedUntil`: Date | null
  * `createdAt`: ISO 8601 string
  * `updatedAt`: ISO 8601 string
- `users` Collection Schema (admin record synchronization):
  * `id`: `"usr-admin-ashwani"`
  * `email`: `"kushwaahaashwani12@gmail.com"`
  * `password`: string (identical bcrypt hash; empty string `""` when uninitialized)
  * `role`: `"admin"`
  * `initialized`: boolean
  * `adminPasswordInitialized`: boolean
  * `isPasswordInitialized`: boolean
  * `updatedAt`: ISO 8601 string

### Frontend Session & Route Protection Variables
- `admin_token`: LocalStorage & SessionStorage key storing the verified backend session token (`adm_...`).
- `admin_user_role`: LocalStorage key (`"admin"`).
- `current_user_role`: LocalStorage key for public users (`"client"` | `"expert"`).
- Portal Routing States:
  * `isAdminPortal`: boolean (strictly true only when `userRole === 'admin'` and backend session verified)
  * `userRole`: `"admin"` | `"client"` | `"expert"` | null
  * `page`: `"landing"` | `"client"` | `"expert"` | `"owner"` | `"login"` | `"about"` | `"blogs"`
- Protected Admin URLs:
  * `/?portal=admin`
  * `/admin`
  * `/owner`
- Protection Policy:
  * Unauthenticated user visiting `/?portal=admin` -> Redirects to `http://localhost:5173/login`.
  * Authenticated Client visiting `/?portal=admin` -> Denied admin access; stays in Client Portal (`/client`).
  * Authenticated Expert visiting `/?portal=admin` -> Denied admin access; stays in Expert Portal (`/expert`).
  * Authenticated Admin visiting `http://localhost:5173/` -> Automatically routes to Admin Portal (`/?portal=admin`).


### Final Acceptance Criteria & Verification Matrix
- `Test 1: Admin Login`: `kushwahaashwani12@gmail.com` with configured password -> Authenticates via MongoDB Atlas, receives session token `adm_...`, automatically routes to `/?portal=admin`. (PASSED)
- `Test 2: Wrong Admin Password`: `kushwahaashwani12@gmail.com` with invalid password -> Backend returns HTTP 401 Unauthorized, zero session token created, Admin Portal remains blocked. (PASSED)
- `Test 3: Client Login`: `client.aarav@nextech.io` with valid credentials -> Authenticates via MongoDB, routes directly to Client Portal (`/client`). (PASSED)
- `Test 4: Expert Login`: `ramesh.sharma@silverworkforce.com` with valid credentials -> Authenticates via MongoDB, routes directly to Expert Portal (`/expert`). (PASSED)
- `Test 5: Manual Admin URL without Auth`: Direct navigation to `http://localhost:5173/?portal=admin` without admin session -> Denied admin access, redirects to `/login`. (PASSED)
- `Test 6: Client Attempts Admin URL`: Client user manually navigates to `/?portal=admin` -> Denied admin access, remains safely in Client Portal (`/client`). (PASSED)
- `Test 7: Expert Attempts Admin URL`: Expert user manually navigates to `/?portal=admin` -> Denied admin access, remains safely in Expert Portal (`/expert`). (PASSED)
- `Test 8: Admin Session Persistence`: Page refresh while logged in as Admin -> Session remains valid via backend `verify-admin`, stays in Admin Portal. (PASSED)
- `Test 9: Admin Logout`: Admin clicks logout -> Backend `admin-logout` invalidates session token in MongoDB, removes local credentials, redirects to login/landing. (PASSED)
- `Test 10: UI Single Entry Cleanliness`: Single entry point `http://localhost:5173/`, zero visible Admin buttons, zero separate Admin login pages. Role selector strictly limited to Client and Expert. (PASSED)
