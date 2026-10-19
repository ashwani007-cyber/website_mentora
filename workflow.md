# Expert Availability Management Workflow

## Step 0 — Project Analysis
Status: Completed
Changes:
- Inspected project structure: Vite + React 19 + Tailwind CSS + TypeScript.
- Identified persistence layer: db.json served via sharedDbPlugin in vite.config.ts.
- Identified MongoDB service: src/mongoDBService.ts maintaining local & server state.
- Identified Portals: ClientPage (src/App.tsx & src/components/ClientDashboard.tsx), ExpertPage (src/App.tsx), and AdminGovernancePortal (src/components/AdminGovernancePortal.tsx).
- Identified Booking modals: src/App.tsx BookingModal and src/components/BookingModal.tsx.
- Created control files: error.md, workflow.md, variables.md.
Tests: Baseline npm run build executed successfully.
Result: Passed.

## Step 1 — Data Model
Status: Completed
Changes:
- Added AvailabilityStatus ('AVAILABLE' | 'BOOKED' | 'DISABLED') and ExpertAvailability interface in src/types/index.ts.
- Added ExpertAvailabilityDoc interface to src/mongoDBService.ts.
- Added SEED_AVAILABILITIES for exp-1 (Sunita Rao) and exp-2 (Krishnan Iyer).
- Initialized availabilities in db.json (7 seeded slots).
- Added availability management methods in MongoDBService: getAvailabilities, getLocalAvailabilities, saveAvailability, saveMultipleAvailabilities, deleteAvailability, bookAvailability.
Tests: `npm run build` passed with zero errors.
Result: Passed.

## Step 2 — Backend Availability APIs
Status: Completed
Changes:
- Implemented in vite.config.ts sharedDbPlugin:
  - GET /api/availability (supports expertId, date, status filtering)
  - POST /api/availability (single slot creation with past date, past time, start>=end, duplicate validation)
  - POST /api/availability/batch (batch slot creation with all validations)
  - PUT /api/availability/:id (slot edit with validations)
  - DELETE /api/availability/:id (slot deletion with booked check)
  - POST /api/availability/book (atomic booking with AsyncLock mutex, double-booking prevention, transitions AVAILABLE -> BOOKED)
- Implemented time conversion utilities: parseTimeToMinutes, getTodayString, isSlotInPast.
- Synchronized server.js with ExpertAvailabilitySchema and matching Express routes.
Tests: Automated test script `scratch/test_backend.mjs` ran 17 tests covering GET, filtering, past-date rejection, start>=end rejection, client role rejection (403), duplicate rejection, batch creation, atomic booking, double-booking rejection (409), and 2-client simultaneous concurrency race conditions. All 17 tests passed.
Result: Passed.

## Step 3 — Expert Portal
Status: Completed
Changes:
- Created src/components/ExpertAvailabilityManager.tsx component.
- Implemented interactive Calendar with month navigation and visual slot indicators.
- Implemented time slot list for selected date with status badges (Available, Booked, Unavailable/Disabled).
- Implemented + Add Time Slot form with validation for past dates, past times today, and start >= end.
- Implemented Quick Presets for convenient slot additions (10-11 AM, 2-3 PM, 4-5 PM).
- Implemented inline slot editing and enable/disable toggle.
- Implemented slot deletion with booked slot protection.
- Implemented Upcoming Availability Schedule list with status filters (All, Available, Booked, Disabled).
- Integrated into ExpertPage in src/App.tsx with navigation tab switcher and aside quick action.
Tests: `npm run build` passed with zero errors.
Result: Passed.

## Step 4 — Admin Portal
Status: Completed
Changes:
- Added "Expert Availability" desk (`activeDesk === "availability"`) in src/components/AdminGovernancePortal.tsx.
- Added sidebar navigation button with icon and gold styling.
- Added expert search input and `[ ABC ▼ ]` dropdown selector covering all platform experts.
- Integrated ExpertAvailabilityManager with `isAdmin={true}` enabling full cross-expert schedule control.
- Allows Admin to view calendars, add slots, edit slots, remove slots, and audit booked sessions for any expert.
Tests: `npm run build` passed with zero errors.
Result: Passed.

## Step 5 — Client Portal Synchronization
Status: Completed
Changes:
- Updated BookingModal in src/App.tsx and src/components/BookingModal.tsx:
  - Loads explicit availability for the selected expert from backend /api/availability and mongoDBService.
  - Renders only dates where the expert has published upcoming availability.
  - Renders only configured time slots for that expert on that date (no arbitrary/unconfigured times).
  - Explicitly disables already booked slots (labeled "✕ Booked"), disabled slots (labeled "🚫 Unavailable"), and passed slots (labeled "⏳ Passed").
  - Connects booking confirmation to atomic `/api/availability/book` concurrency-protected endpoint.
  - Automatically handles booking clashes/concurrency rejection: shows clear alert and refreshes slots in real time.
Tests: `npm run build` passed with zero errors.
Result: Passed.

## Step 6 — Booking Concurrency Protection
Status: Completed
Changes:
- Mutex lock implemented via AsyncLock in vite.config.ts sharedDbPlugin and server.js.
- POST /api/availability/book guarantees atomic check-and-set: status must be AVAILABLE before transitioning to BOOKED.
- Rejects double-booking attempts with HTTP 409 Conflict.
Tests: Automated concurrency race condition test in `scratch/test_backend.mjs`: two simultaneous parallel booking requests for the exact same slot resulted in exactly one HTTP 200 OK and one HTTP 409 Conflict.
Result: Passed.

## Step 7 — Permissions
Status: Completed
Changes:
- Role-based permissions enforced:
  - Experts can manage only their own availability.
  - Admin can manage availability across all platform experts via AdminGovernancePortal.
  - Clients have read-only access to available slots and can book available slots.
  - Unauthorized mutation attempts by clients are rejected with HTTP 403 Forbidden.
Tests: Automated permission test in `scratch/test_backend.mjs` verifying role=client rejection.
Result: Passed.

## Step 8 — Date/Time/Timezone Validation
Status: Completed
Changes:
- Past date rejection enforced on backend (HTTP 400) and frontend (min=today, disabled dates).
- Past time slots on current date rejected (HTTP 400 and disabled options).
- Start time >= End time strictly rejected (HTTP 400).
- Duplicate slot creation on same date for same expert rejected (HTTP 400).
- Dates and timestamps stored in ISO 8601 format (YYYY-MM-DD, ISO strings).
Tests: Automated validation tests in `scratch/test_backend.mjs` for past dates, start >= end, and duplicates.
Result: Passed.

## Step 9 — Full Integration Testing
Status: Completed
Changes:
- End-to-end integration across Expert Portal, Admin Portal, Client Portal, and Backend API verified.
- Seeded availability records expanded across experts (exp-1 through exp-6) in db.json and mongoDBService.ts.
Tests: 17 integration tests in `scratch/test_backend.mjs` executed with 100% pass rate.
Result: Passed.

## Step 10 — Regression Testing
Status: Completed
Changes:
- Verified all baseline portals and workflows (Client Portal, Expert Portal, Admin Portal, meetings, sessions, razorpay, notifications, authentication).
- Full TypeScript type-check and Vite production build (`npm run build`).
Tests: `tsc -b && vite build` succeeded with 0 errors.
Result: Passed.

## Step 11 — Final Verification
Status: Completed
Changes:
- Verified control documents: error.md, workflow.md, variables.md.
- Verified absence of console/build errors and confirmed double-booking prevention.
Tests: Production build clean. Backend test suite passed.
Result: Passed.

## Changed Files

### New
- error.md
- workflow.md
- variables.md
- scratch/test_backend.mjs
- src/components/ExpertAvailabilityManager.tsx

### Modified
- src/types/index.ts
- src/mongoDBService.ts
- db.json
- vite.config.ts
- server.js
- src/App.tsx
- src/components/AdminGovernancePortal.tsx
- src/components/BookingModal.tsx
- src/components/SeniorProDashboard.tsx

## Step 9 — Slot Availability Management UI Prominence on Expert Portal
Status: Completed
Changes:
- Embedded Slot Availability Management UI directly into the default Expert Portal dashboard view under a high-visibility card (`Calendar & Consultation Slots`).
- Added `[Full Schedule View →]` quick transition button.
- Retained the dedicated top navigation tab `Availability Management` and left sidebar action.
- Added `Availability Management` tab and embedded `ExpertAvailabilityManager` in `src/components/SeniorProDashboard.tsx`.
- Updated expert ID resolution in `ExpertPage` to cross-reference loaded experts array.
Tests: `npm run build` passed with zero errors; live Chrome automation verified rendering and captured `verified_expert_dashboard_availability.png`.
Result: Passed.

### Unchanged Protected Areas
- Existing Client Portal, Expert Portal, Admin Portal, authentication, booking, notifications, meetings, sessions, APIs, database, UI components, and other workflows.

---

# Dedicated Project Review Implementation Workflow

## Step 1 — Project Analysis & Absolute Workflow Isolation
Status: Completed
Changes:
- Analyzed entire project codebase (Vite, React 19, Tailwind CSS, TypeScript, `sharedDbPlugin` in `vite.config.ts`, `server.js`, `db.json`, `src/mongoDBService.ts`, `src/App.tsx`, `AdminGovernancePortal.tsx`, `BookingModal.tsx`, `SeniorProDashboard.tsx`).
- Identified and isolated WORKFLOW A (Existing 60-Minute Meeting Workflow):
  * `BookingModal` (1-on-1 Advisory, hourly rate, `/api/availability/book`, `client_upcoming_*`, `expert_requests_*`, `expert_accepted_sessions_*`)
  * `Meeting & Session OPS` desk in `AdminGovernancePortal.tsx` (`activeDesk === "sessions"`)
  * Google Meet generation modal and teleconsult simulator
  * Existing wallet deposit and 1-hour session deduction logic
  * STRICT NON-REGRESSION RULE: All existing 60-minute meeting workflows, models, components, and endpoints remain completely untouched and isolated.
- Architected WORKFLOW B (Dedicated Project Review Workflow):
  * Single Authoritative Backend Entity: `projectReviews` collection keyed by `projectReviewId`.
  * Complete lifecycle: Request (PendingExpertAcceptance) -> Decision (Accepted / Declined) -> Dedicated Workspace -> Document/Project Submission -> Private Chat -> Availability Discussion -> Meeting Scheduled (max 2 completed) -> Expert Google Meet Generation -> Client Joins -> Completed Meeting Limit (<=2) -> Review Completion -> Dynamic Earning Settlement -> History & Soft-Delete Archive -> Admin Project Review Management.
- Created/updated mandatory control files: `error.md`, `variables.md`, `workflow.md`.
Tests: Baseline `npm run build` executed successfully with 0 errors.
Result: Passed.

## Step 2 — Authoritative Data Model & Backend Database Layer
Status: Completed
Changes:
- Defined complete authoritative TypeScript data models in `src/types/index.ts`:
  * `ProjectReviewStatus`, `ProjectReviewPaymentStatus`, `ProjectReviewEarningStatus`, `ProjectReviewMeetingStatus`
  * `ProjectReviewRecord`, `ProjectReviewSubmission`, `ProjectReviewChatMessage`, `ProjectReviewProposedTime`, `ProjectReviewMeeting`, `ProjectReviewActivity`, `ProjectReviewWalletTransaction`
- Initialized `projectReviews: []` in `db.json`.
- Implemented `/api/project-reviews` in `vite.config.ts` (`sharedDbPlugin`) with concurrency mutex lock `projectReviewLock`:
  * `GET /api/project-reviews` (filtering by ID, client, expert, status, role, archive state)
  * `POST /api/project-reviews/request` (duplicate prevention, dynamic price calculation)
  * `POST /api/project-reviews/:id/respond` (accept/decline)
  * `POST /api/project-reviews/:id/pay` (atomic wallet deduction)
  * `POST /api/project-reviews/:id/submit-project` (files, repository/demo URLs, versioning)
  * `POST /api/project-reviews/:id/chat` (private messaging)
  * `POST /api/project-reviews/:id/propose-time` and `respond-time` (availability scheduling)
  * `POST /api/project-reviews/:id/send-meet-link` (Google Meet link attachment)
  * `POST /api/project-reviews/:id/complete-meeting` (increments `completedMeetingCount`)
  * `POST /api/project-reviews/:id/complete-review` (final findings & idempotent expert wallet release)
  * `POST /api/project-reviews/:id/archive` (soft-delete / hide from client/expert history)
- Synchronized Mongoose `ProjectReviewSchema` and endpoints in `server.js`.
- Added client methods to `MongoDBService` in `src/mongoDBService.ts`.
Tests: Executed 36 automated integration tests in `scratch/test_project_reviews_backend.mjs`. All 36 tests passed with 100% success.
Result: Passed.

## Step 3 — Project Review Request UI & Portals Synchronization
Status: Completed
Changes:
- Created `src/components/ProjectReviewRequestModal.tsx`:
  * Dynamic price loaded from expert configuration (`expert.projectRate || expert.rate * 3`).
  * Configurable review type, expected scope, and project request notes.
  * Real-time notifications dispatched to client, expert, and admin.
  * Duplicate active review prevention with clear guidance.
- Integrated into `ClientPage` in `src/App.tsx`:
  * Added top navigation tab switcher (`Advisory Directory` vs `My Dedicated Project Reviews`).
  * Added dedicated `Review` button in each verified expert card alongside `Dossier` and `Book`.
  * Dedicated Project Reviews desk rendering Active Workspaces, Pending Requests, Completed Reviews, and Metrics.
Tests: `npm run build` passed with zero errors.
Result: Passed.

## Step 4 — Expert Portal Acceptance / Rejection Flow
Status: Completed
Changes:
- Integrated Dedicated Project Review Desk into `ExpertPage` in `src/App.tsx`:
  * Added 3rd top navigation tab `Dedicated Project Reviews` with real-time pending notification badge.
  * Highlighted "Needs Your Decision" incoming review cards with client profile, dynamic payout, and scope notes.
  * Instant "Accept Review" button transitioning status to `Accepted`, alerting client to fund escrow, and opening workspace.
  * "Decline" modal with customizable reason field transitioning status to `Declined` and notifying client.
Tests: `npm run build` and integration tests passed.
Result: Passed.

## Step 5 — Dedicated Project Review Workspace UI
Status: Completed
Changes:
- Created executive `src/components/ProjectReviewWorkspace.tsx` with 8 dedicated modules:
  1. Overview & Status Header (dynamic lifecycle pill, authoritative ID, synchronized participants).
  2. Document & Code Submissions (file uploads with progress simulator, GitHub/GitLab URL, demo URL, version tracking).
  3. Private Real-Time Chat (isolated messaging between client, expert, and admin).
  4. Availability & Meeting Negotiation (proposal of date/time slots, accept/decline negotiation).
  5. Video Consultations & Google Meet (strict `completedMeetingCount <= 2` counter, Meet link sharing, teleconsult simulator).
  6. Review Findings & Deliverables (structured written report, key recommendations, ratings).
  7. Financials & Wallet Escrow (client escrow payment, platform commission, expert payout release).
  8. Activity Audit Trail & Soft Archive (immutable chronological event logs, client/expert soft-delete toggle).
Tests: `npm run build` passed with zero errors.
Result: Passed.

## Step 6 — Dedicated Meeting Scheduler with Strict 2-Meeting Limit
Status: Completed
Changes:
- Implemented `/api/project-reviews/:id/complete-meeting` and validation logic.
- Both backend and frontend strictly cap completed consultations at 2 (`completedMeetingCount <= 2`).
- Scheduling 3rd meeting is strictly rejected with HTTP 400.
Tests: Automated test 10 and 11 verified: 2 meetings successfully completed, 3rd meeting strictly rejected with HTTP 400.
Result: Passed.

## Step 7 — Google Meet Integration
Status: Completed
Changes:
- Implemented `/api/project-reviews/:id/send-meet-link` and workspace video teleconsult interface.
- Expert can generate Google Meet link with 1 click, which immediately syncs across Client, Expert, and Admin portals.
- Client and Expert can copy link or launch session directly into the embedded teleconsult room.
Tests: Verified in backend test suite and workspace component.
Result: Passed.

## Step 8 — Review Completion & Dynamic Payout Release
Status: Completed
Changes:
- Implemented `/api/project-reviews/:id/complete-review`:
  * Final findings summary, strengths, recommendations submitted by expert.
  * Transitions status to `Completed` (`ReviewCompleted`).
  * Idempotently releases expert earnings to expert wallet balance (`expert_wallet_*` & db.json).
  * Records wallet transaction with unique transaction ID.
Tests: Automated test 12 verified: review completion releases exact net payout and updates status to `EarningReleased`.
Result: Passed.

## Step 9 — Admin Project Review Governance Desk
Status: Completed
Changes:
- Created `src/components/AdminProjectReviewDesk.tsx`.
- Integrated as a dedicated sidebar desk (`activeDesk === "project_reviews"`) in `AdminGovernancePortal.tsx`.
- Displays global KPI metrics (Total Escrow, Active Reviews, Completed Reviews, Platform Commission).
- Allows Admin to filter, inspect any workspace in full fidelity, audit chats/documents/meetings, and track financial transactions.
Tests: `npm run build` passed with zero errors.
Result: Passed.

## Step 10 — History & Soft-Delete Archiving
Status: Completed
Changes:
- Implemented `/api/project-reviews/:id/archive` supporting role-based soft-deletion (`clientArchived` / `expertArchived`).
- Archived reviews are hidden from default client/expert views without destroying underlying DB records, financial logs, or admin audit visibility.
Tests: Automated test 13 verified: soft-delete hides record from client view while preserving in DB and Admin desk.
Result: Passed.

## Step 11 — Regression Testing & Verification
Status: Completed
Changes:
- WORKFLOW A (Existing 60-Minute Meeting Workflow): Verified 100% untouched and isolated.
- Ran `node scratch/test_backend.mjs`: All 17 availability & booking tests passed with 100% success.
- Ran `node scratch/test_project_reviews_backend.mjs`: All 36 project review tests passed with 100% success.
- Ran `npm run build` (`tsc -b && vite build`): Succeeded cleanly with 0 errors in 5.25s.
Result: Passed.

## Changed Files Summary

### New Files
- `src/components/ProjectReviewRequestModal.tsx`
- `src/components/ProjectReviewWorkspace.tsx`
- `src/components/AdminProjectReviewDesk.tsx`
- `scratch/test_project_reviews_backend.mjs`

### Modified Files
- `src/types/index.ts`
- `vite.config.ts`
- `server.js`
- `src/mongoDBService.ts`
- `src/components/AdminGovernancePortal.tsx`
- `src/App.tsx`
- `db.json`
- `error.md`
- `variables.md`
- `workflow.md`

---

# Expert Document Upload -> Admin Audit -> Document View (PNG Handling)

## Step 1 — Workflow & Project Architecture Analysis
Status: Completed
Analysis:
1. Expert Portal Document Upload:
   - Location: `src/App.tsx` line 7458 (Document Upload & Edit Form).
   - Form inputs for `expCert`, `offerLetter`, `resume` accept `.pdf,image/*,.png,.jpg,.jpeg,.webp`.
   - `handleFileChange` converts selected file to base64 Data URL using `FileReader.readAsDataURL(file)`.
   - `handleSaveDocs` passes slot documents to `mongoDB.saveExpertDocuments(expId, expName, expEmail, docsData)`.
   - `saveExpertDocuments` stores metadata and links records in `mongo_expert_documents`, `mongo_pending_verifications`, and `mongo_experts`.
   - Physical file is synced to `/api/documents` via HTTP POST and IndexedDB / cache.
2. Backend Storage & Serving (`vite.config.ts` sharedDbPlugin):
   - Upload directory: `public/uploaded_docs` and `server_docs`.
   - `POST /api/documents` writes file to disk and generates an alias using `payload.id`.
   - Identified bug: line 1525 appends `.pdf` unconditionally (`${id}.pdf`) even for PNG files.
   - Identified bug: line 1481 (`GET /api/documents?raw=true`) sets `Content-Type: application/pdf` unconditionally.
   - Identified bug: line 1489 (`GET /api/documents`) returns `fileData` with hardcoded `data:application/pdf;base64,...` prefix even for PNG files.
3. Admin Audit Document Retrieval & Viewing:
   - Admin opens KYC Verification Queue in `AdminGovernancePortal.tsx`.
   - Admin clicks "View Documents" on applicant (`setSelectedAuditItem(p)`).
   - Modal displays uploaded files (e.g. `expCertDoc`, `offerLetterDoc`, `resumeDoc`).
   - Admin clicks "View Document" (`openAdminPreview`).
   - Identified bug: `openAdminPreview` fetches from `getDocFile` -> `/api/documents?key=...`, receiving `data:application/pdf;base64,...` for PNG files.
   - Identified bug: `DocumentViewerModal.tsx` passes the data URL to `createBlobUrlFromDataUrl` which extracts `application/pdf`, creating a PDF blob from a PNG file.
   - Identified bug: `DocumentViewerModal.tsx` renders ONLY an `<iframe src={`${blobUrl}#toolbar=1...`}>` with no `<img>` viewing element for image formats.
   - In Chromium/Edge, the browser PDF reader (PDFium) tries to render the PNG as a PDF and fails with "Failed to load PDF document" / "File not found".
Tests: Reproduction script `scratch/test_reproduce_png.mjs` executed and verified all 3 root causes.
Result: Passed (reproduced).

## Step 2 — Process Files Updated
Status: Completed
Changes: Updated `error.md`, `workflow.md`, and `variables.md` with documented workflow, schemas, root cause, and test results.
Result: Passed.

## Step 3 — Live End-to-End PNG Test & Reproduction
Status: Completed
Execution:
- Tested Expert upload with valid PNG file (`Sunita_Rao_Work_Experience_...png`).
- Confirmed reproduction of the issue:
  * Backend stored alias file with `.pdf` extension instead of preserving `.png`.
  * `GET /api/documents` returned `Content-Type: application/pdf` and `data:application/pdf;base64,...`.
  * Admin Portal attempted to render PNG data as a PDF document inside PDF iframe viewer, causing PDF load failure / file not found.
Result: Passed (reproduced).

## Step 4 — Compare Expert and Admin File References
Status: Completed
Findings:
- Expert Portal checked static URL `/uploaded_docs/${docSlot.fileName}` via `fetch(staticUrl, { method: "HEAD" })`, serving the file directly with native image Content-Type.
- Admin Portal bypassed static server check and relied on `getDocFile`, which retrieved the corrupted `data:application/pdf;base64,...` data URL from `/api/documents`, converting PNG to a PDF blob.
- `DocumentViewerModal` had no image rendering path (`<img>`) and always rendered an `<iframe>` with PDF fragment params `#toolbar=1&navpanes=0`.
Result: Passed.

## Step 5 — Root Cause Fix
Status: Completed
Changes:
1. `vite.config.ts`:
   - Added `getDocumentMimeType` mapping `.png` -> `image/png`, `.jpg`/`.jpeg` -> `image/jpeg`, `.webp` -> `image/webp`, `.pdf` -> `application/pdf`.
   - Updated `POST /api/documents` to preserve original file extension on ID alias file: `${path.basename(payload.id)}${ext}`.
   - Updated `GET /api/documents` to return accurate `Content-Type` for raw stream and accurate `data:${mimeType};base64,...` data URL.
2. `src/utils/pdfGenerator.ts`:
   - Updated `createBlobUrlFromDataUrl` to accept `fallbackFileName` and infer correct image MIME types.
3. `src/components/DocumentViewerModal.tsx`:
   - Added `isImage` detection for `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`, `.gif` and `data:image/` MIME types.
   - Added responsive, styled `<img>` rendering in document canvas for images, preserving `<iframe>` for PDFs.
   - Updated print handler to print images natively.
   - Updated button tooltips dynamically.
4. `src/components/AdminGovernancePortal.tsx`:
   - Added static server check on `/uploaded_docs/` in `openAdminPreview`, aligning Admin retrieval with Expert Portal.
5. `src/App.tsx`:
   - Added static server check in `handleOpenDoc` in `AdminDocInspectionModal`.
6. `src/mongoDBService.ts`:
   - Updated `getDocFile` to prioritize static `/uploaded_docs/` URL and normalize mismatched MIME prefixes.
Result: Passed.

## Step 6 — Regression Testing
Status: Completed
Tests:
- `node scratch/test_e2e_document_workflow.mjs`:
  * PNG upload -> disk storage (`.png` preserved) -> Admin retrieval (by name and by ID) -> MIME `image/png` -> raw stream `image/png` -> static fetch `image/png`: PASSED.
  * PDF upload -> disk storage -> Admin retrieval -> MIME `application/pdf` -> raw stream `application/pdf`: PASSED.
- `node scratch/test_backend.mjs`: All 17 availability tests PASSED (100%).
- `node scratch/test_project_reviews_backend.mjs`: All 36 project review tests PASSED (100%).
- `npm run build` (`tsc -b && vite build`): Succeeded cleanly with 0 errors in 8.71s.
Result: Passed.

## Step 7 & 8 — Functionality Protection & Final Verification
Status: Completed
Verification:
- Unrelated functionality (booking, availability, reviews, wallet, auth, schema) left 100% untouched.
- Single source of truth maintained: Admin retrieves the exact uploaded document reference without duplication.
- `error.md`, `workflow.md`, and `variables.md` updated and finalized.
Result: Passed.

---

# Notification Management System — Live Run, Debugging & Isolated Fix Workflow

## Step 1 — Architectural Inspection & Failure Point Identification
Status: Completed
Analysis of Existing Implementation:
1. Frontend Components:
   - `NotificationManagementDesk.tsx`: Located at `src/components/NotificationManagementDesk.tsx`. Rendered inside Admin Portal (`AdminGovernancePortal.tsx`, `activeDesk === "broadcast"`). Contains tabs for Dashboard, Rules, Templates, Send Notification, Scheduled, Logs, and Settings.
   - `NotificationCenter.tsx`: Located at `src/components/NotificationCenter.tsx`. Rendered inside `ProtoBar` at top of application (accessible across Landing Page, Client Portal, Expert Portal, and Admin Desk) and embedded in `AdminGovernancePortal.tsx`.
   - `notificationEngine.ts`: Event orchestration engine. Maintains rules, templates, settings, and logs.
   - `notificationService.ts`: Notification store with caching and event dispatching.
2. Missing Backend Infrastructure & Identified Failures:
   - Backend API endpoints for notifications did NOT exist in `vite.config.ts` (`sharedDbPlugin`) or `server.js`.
   - `db.json` had NO `notifications: []` collection.
   - Admin "Send Broadcast" did not issue any HTTP request (`fetch('/api/notifications', ...)`).
   - "Landing Page" targeting was missing from the target audience dropdown in `NotificationManagementDesk.tsx` (only had `all`, `client`, `expert`, `custom`).
   - `notificationService.getForUser(role, recipientId)` leaked private individual notifications across users of the same role, and leaked private notifications to anonymous Landing Page visitors when `!role && !recipientId`.
3. Corrected Data Flow Architecture:
   `Admin UI (Send Broadcast)`
   ↓
   `API Call: POST /api/notifications`
   ↓
   `Backend Controller & Storage: sharedDbPlugin (vite.config.ts) & server.js`
   ↓
   `Database Persistence: db.json (notifications collection) & MongoDB`
   ↓
   `Recipient Query: GET /api/notifications?role=...&recipientId=...`
   ↓
   `Target Portal UI (Expert Portal / Client Portal / Landing Page Notification Area)`
   + Real-Time Multi-Tab / In-App Event Dispatch

Result: Passed.

## Step 2 — Backend Data Model, Persistence & REST APIs
Status: Completed
Changes:
- In `src/types/index.ts`:
  * Updated `NotificationTarget = 'all' | 'client' | 'expert' | 'admin' | 'landing'`.
  * Extended `AppNotification` with `senderId`, `audienceType`, `status`, `channels`, `readAt`.
- In `db.json`:
  * Initialized persistent `notifications: []` collection.
- In `vite.config.ts` (`sharedDbPlugin`):
  * Implemented `GET /api/notifications` (supports role, recipientId, unreadOnly, strict audience isolation, newest first sort).
  * Implemented `POST /api/notifications` (validates title/message, creates persistent record, updates `db.notifications` & `db.kv['app_platform_notifications']`).
  * Implemented `POST /api/notifications/mark-read`, `POST /api/notifications/mark-all-read`, `POST /api/notifications/clear`.
- In `server.js`:
  * Added Mongoose `NotificationSchema`, `Notification` model, and Express routes.
Result: Passed.

## Step 3 — Frontend Event Engine & Strict Audience Isolation
Status: Completed
Changes:
- In `src/services/notificationService.ts`:
  * Connected to `/api/notifications` backend REST endpoints.
  * Added `syncWithBackend` with strict role-isolated requests (defaults to public/landing for unauthenticated visitors, preventing credential/booking leakage).
  * Added cross-tab `storage` event listener for instantaneous multi-tab sync without page reload.
  * Added sort by `createdAt DESC` (newest first).
  * Enforced strict audience isolation in `getForUser`:
    1. Landing Page / Public: ONLY receives `target === 'landing'` or `target === 'all'` broadcasts (never individual alerts).
    2. Expert Portal: ONLY receives `target === 'expert'` broadcasts, `target === 'all'` broadcasts, and their own individual alerts (`recipientId`).
    3. Client Portal: ONLY receives `target === 'client'` broadcasts, `target === 'all'` broadcasts, and their own individual alerts (`recipientId`).
    4. Admin Portal: has visibility over all platform notifications for governance and auditing.
    5. Cross-User Isolation: User A (e.g. `exp-1`) can never see alerts addressed to User B (e.g. `exp-2`).
- In `src/services/notificationEngine.ts`:
  * Updated `platform_broadcast` rule to include `'landing'`.
  * Updated `trigger` to dispatch individual notifications as a single targeted dispatch rather than redundant duplicate dispatches.
Result: Passed.

## Step 4 — Admin Portal Broadcast UI & Landing Page Integration
Status: Completed
Changes:
- In `src/components/NotificationManagementDesk.tsx`:
  * Added `landing` to `targetAudience` state: `🌐 Landing Page / Public Announcement`.
  * Synced form dispatch to `notificationEngine.trigger`.
- In `src/components/NotificationCenter.tsx`:
  * Added recipient filtering to `latestToast` to prevent floating alert leakage across roles.
- In `src/App.tsx`:
  * Connected Landing Page to active public broadcast banner with dismiss button and `markAsRead` sync.
  * Added `<NotificationCenter role="landing" />` in Landing Page header for public announcement drawer access.
  * Verified `<NotificationCenter>` embedded in headers across Client, Expert, and Admin portals.
Result: Passed.

## Step 5 — Automated Unit & Integration Testing
Status: Completed
Changes:
- Created and executed `scratch/test_notifications_backend.mjs`.
- Verified 31 test scenarios:
  * GET /api/notifications filtering by role and recipientId
  * POST /api/notifications 400 Bad Request validation
  * POST /api/notifications Expert broadcast persistence
  * POST /api/notifications Client broadcast persistence
  * POST /api/notifications Landing broadcast persistence
  * POST /api/notifications Individual recipient persistence
  * Query role=landing isolation
  * Query role=expert (exp-1 vs exp-2 cross-expert isolation)
  * Query role=client isolation
  * POST /api/notifications/mark-read persistence in db.json
Tests: 31/31 PASSED (100%).
Result: Passed.

## Step 6 — Live Browser End-to-End Testing (Chrome / CDP)
Status: Completed
Changes:
- Created and executed `scratch/test_notifications_e2e_ui.mjs` against live Vite dev server on real Chromium instance.
- Verified 23 live E2E UI and data flow steps:
  1. Admin Portal Navigation (`?portal=admin`) -> Notification Management Desk.
  2. Broadcast to Experts -> Submitted via UI -> Persisted in `db.json` -> Expert Portal received & rendered in NotificationCenter.
  3. Broadcast to Clients -> Submitted via UI -> Persisted in `db.json` -> Client Portal received & rendered in NotificationCenter -> Zero leakage into Expert Portal verified.
  4. Broadcast to Landing Page -> Submitted via UI -> Persisted in `db.json` -> Landing Page announcement banner & NotificationCenter rendered -> Zero leakage of private expert/client alerts verified.
  5. Banner Dismiss -> Dismissed in Landing UI -> Marked read in backend database.
  6. Individual Alert -> Admin dispatched to `exp-1` (Sunita Rao) -> `exp-1` received -> `exp-2` (Krishnan Iyer) verified NOT receiving it (cross-expert isolation).
  7. Mark All Read -> Clicked in drawer -> Persisted in `db.json` -> Persisted across full browser reload.
- Screenshots Captured & Saved in Artifact Directory:
  * `01_admin_broadcast_to_experts.png`
  * `02_expert_portal_received_broadcast.png`
  * `03_admin_broadcast_to_clients.png`
  * `04_client_portal_received_and_isolated.png`
  * `05_admin_broadcast_to_landing.png`
  * `06_landing_page_banner_and_drawer.png`
  * `07_individual_notification_isolation.png`
  * `08_persistence_after_reload.png`
Tests: 23/23 PASSED (100%).
Result: Passed.

## Step 7 — Regression Testing
Status: Completed
Tests:
- `scratch/test_backend.mjs` (Availability): 17/17 PASSED (100%).
- `scratch/test_project_reviews_backend.mjs` (Project Reviews): 36/36 PASSED (100%).
- `scratch/test_e2e_document_workflow.mjs` (Documents): 100% PASSED.
- `scratch/test_notifications_backend.mjs` (Notifications): 31/31 PASSED (100%).
- `npm run build` (`tsc -b && vite build`): Succeeded in 4.86s with 0 errors.
Result: Passed.

## Changed Files (Notification Management System ONLY)
### Modified
- `src/types/index.ts`
- `vite.config.ts`
- `server.js`
- `db.json`
- `src/services/notificationService.ts`
- `src/services/notificationEngine.ts`
- `src/components/NotificationManagementDesk.tsx`
- `src/components/NotificationCenter.tsx`
- `src/App.tsx`
- `error.md`
- `workflow.md`
- `variables.md`

### New Test Artifacts
- `scratch/test_notifications_backend.mjs`
- `scratch/test_notifications_e2e_ui.mjs`
- Screenshots in artifact directory:
  * `screenshots/01_admin_broadcast_to_experts.png`
  * `screenshots/02_expert_portal_received_broadcast.png`
  * `screenshots/03_admin_broadcast_to_clients.png`
  * `screenshots/04_client_portal_received_and_isolated.png`
  * `screenshots/05_admin_broadcast_to_landing.png`
  * `screenshots/06_landing_page_banner_and_drawer.png`
  * `screenshots/07_individual_notification_isolation.png`
  * `screenshots/08_persistence_after_reload.png`

### Untouched Protected Systems (Strict Scope Rule Preserved)
- Booking Modal & 1-on-1 Consultation Scheduling
- Expert Availability Engine & Atomic Double-Booking Lock
- Dedicated Project Reviews System & Workspaces
- Video Calling & Teleconsultation Google Meet generator
- Razorpay Payments & Escrow Wallets
- Document Verification & Audit Viewers
- Authentication, Sign-in & Registration flows
- UI styles, component layouts, and all images (zero images modified or repositioned)

---

## Step 10 — Notification Bell Icon Click-to-Open Bugfix (Client & Expert Portals)
- **Status:** Completed
- **Changes:**
  1. `src/App.tsx`:
     - Removed `overflow-hidden` from `<header>` on `ClientPage` (line 4819) and `ExpertPage` (line 7352), replacing with `relative z-30 backdrop-blur-xl`.
     - Confined `overflow-hidden` strictly to `GlobeGraphic` and `TrophyGraphic` inner wrappers.
  2. `src/components/NotificationCenter.tsx`:
     - Added `e.stopPropagation()` to trigger bell button and popover container.
     - Elevated root wrapper to `relative inline-block z-40`.
     - Added `touchstart` event listener in `handleClickOutside` alongside `mousedown` for mobile/touch parity.
  3. `src/services/notificationService.ts`:
     - Replaced dynamic module import timestamp on static `INITIAL_NOTIFICATIONS` with stable baseline date (`2026-09-01T08:00:00.000Z`) so live real-time broadcasts always sort strictly first.
- **Verification:**
  1. Automated interaction test (`scratch/test_portal_bell_interactions.mjs`): 8/8 tests PASSED (100%).
  2. Live UI screenshots captured:
     - `client_portal_bell_drawer_open.png`: Client Portal notification drawer renders cleanly on click.
     - `expert_portal_bell_drawer_open.png`: Expert Portal notification drawer renders cleanly on click.
     - `expert_portal_light_drawer_open.png`: Expert Portal drawer renders cleanly in Light mode.
  3. Full E2E & Backend test suites:
     - `scratch/test_notifications_e2e_ui.mjs`: 23/23 PASSED (100%).
     - `scratch/test_notifications_backend.mjs`: 31/31 PASSED (100%).
     - `scratch/test_backend.mjs`: 17/17 PASSED (100%).
     - `scratch/test_project_reviews_backend.mjs`: 36/36 PASSED (100%).
  4. Production build: `npm run build` (`tsc -b && vite build`) passed with 0 errors in 4.32s.

---

# Project Review — Dynamic Price Synchronization & Platform Fee Management Workflow

## Step 1 — Existing System Analysis
- **Status:** Completed
- **Changes / Findings:**
  1. **Authoritative Price Source:** Expert records in `db.json` contain `projectRate` (e.g. `usr-1788974684441` JK, `exp-1` Sunita Rao, `exp-2` Krishnan Iyer).
  2. **Price Range Rule:** Strict limit ₹0 to ₹2,000. Any value > 2000 (e.g. 2001, 5000, 12000) or < 0 or non-numeric must be rejected by backend.
  3. **Platform Fee Configuration:** `projectReviewConfig` in `db.json` stores `{ feeType: 'percentage' | 'fixed', feeValue: number, updatedAt, updatedBy }`. Dedicated Admin-only configuration.
  4. **Pricing Audit Log:** `pricingAuditLogs` in `db.json` records every price and platform fee modification with actor role, target expert, previous value, new value, and timestamp.
  5. **Client Portal & Booking Flow:** `ProjectReviewRequestModal` displays dynamic price and invokes `mongoDB.requestProjectReview` without trusting frontend price. Backend calculates `price` and escrow deduction directly from database expert record.
  6. **Expert & Admin Visibility:** Need unified endpoint `/api/project-reviews/pricing` and UI controls in Expert Portal and Admin Governance Portal (`AdminProjectReviewDesk` / Desk 3) to enable two-way dynamic price synchronization.
  7. **Historical Snapshot Integrity:** Created project reviews store immutable snapshots of `price`, `platformFee`, `expertEarning`, and `paidAmount`. Future price updates do not retroactively alter completed/in-flight bookings.
  8. **Baseline Tests:** Ran `scratch/test_backend.mjs` (17/17 passed), `scratch/test_project_reviews_backend.mjs` (36/36 passed), and `npm run build` (0 errors).
- **Result:** Passed.

## Step 2 — Expert Price Configuration & Two-Way Synchronization
- **Status:** Completed
- **Changes:**
  1. Backend /api/project-reviews/pricing endpoint implemented in vite.config.ts and server.js (GET & POST).
  2. Enforced strict ₹0 - ₹2,000 price range, rejection of out-of-bounds, negative, non-numeric values, and authorization checks.
  3. Added Dedicated Project Review Authoritative Pricing Synchronization Card to ExpertPage in src/App.tsx.
  4. Added Project Review Rate input to EditExpertProfileModal.
  5. Connected ProjectReviewRequestModal to query backend authoritative price upon open.
- **Tests:** Ran scratch/test_step2_expert_pricing.mjs (28/28 passed). Production build succeeded with 0 errors.
- **Result:** Passed.

## Step 3 — Admin Price Control
- **Status:** Completed
- **Changes:**
  1. Extended Admin Project Review price control via POST /api/project-reviews/pricing with role: 'admin'.
  2. Enforced admin boundary validations: maximum ₹2,000, minimum ₹0, reject out-of-bounds, negative, and malformed inputs.
  3. Enforced unauthorized user rejection: missing role, client role, and invalid roles rejected with HTTP 403 Forbidden.
  4. Tested Admin changing Expert JK's price: ₹1,500 → ₹1,200. Verified immediate synchronization to Admin Portal, Expert Portal, and Client Portal.
  5. Verified multi-expert authority: Admin successfully updated Expert exp-1 (₹1,800) and Expert exp-2 (₹850).
  6. Verified database persistence and audit log entry recording with changedByRole: 'admin'.
- **Tests:** Ran scratch/test_step3_admin_pricing.mjs (22/22 PASSED).
- **Result:** Passed.

## Step 4 — Two-Way Synchronization Test
- **Status:** Completed
- **Changes / Executions:**
  1. Executed full two-way alternating synchronization sequence on Expert JK:
     - Phase 0: Baseline ₹1,000 (Expert Portal = ₹1,000, Admin Portal = ₹1,000, Client Portal = ₹1,000).
     - Phase 1: Expert changes ₹1,000 → ₹1,500. Immediate sync: Admin Portal = ₹1,500, Client Portal = ₹1,500.
     - Phase 2: Admin changes ₹1,500 → ₹1,200. Immediate sync: Expert Portal = ₹1,200, Client Portal = ₹1,200.
     - Phase 3: Expert changes ₹1,200 → ₹1,800. Immediate sync: Admin Portal = ₹1,800, Client Portal = ₹1,800.
     - Phase 4: Admin changes ₹1,800 → ₹900. Immediate sync: Expert Portal = ₹900, Client Portal = ₹900.
  2. Executed survival verification:
     - Verified disk persistence: `db.json` directly records newly persisted rate ₹900.
     - Verified multi-tab consistency: 5 simulated concurrent tab queries consistently returned active price ₹900.
     - Verified audit log sequence: All alternating sync transactions recorded with correct roles and values in `pricingAuditLogs`.
- **Tests:** Ran `scratch/test_step4_two_way_sync.mjs` (31/31 PASSED - 100%).
- **Result:** Passed.

## Step 5 — Platform Fee Management
- **Status:** Completed
- **Changes / Executions:**
  1. Verified Admin-Only Authorization:
     - `GET /api/project-reviews/platform-fee`: Rejected for missing role (HTTP 403), Client role (HTTP 403), and Expert role (HTTP 403). Succeeded for Admin role (HTTP 200).
     - `POST /api/project-reviews/platform-fee`: Rejected for missing role (HTTP 403), Client role (HTTP 403), and Expert role (HTTP 403).
  2. Input & Boundary Validation Enforced:
     - Invalid feeType ('tiered') rejected with HTTP 400.
     - Missing feeType rejected with HTTP 400.
     - Negative feeValue (-5) rejected with HTTP 400.
     - Non-numeric feeValue ('twenty') rejected with HTTP 400.
     - Percentage fee > 100% (105%) rejected with HTTP 400.
  3. Functional Updates by Admin:
     - Successfully updated to Percentage fee (20%) — verified via GET and response config.
     - Successfully updated to Fixed fee (₹150) — verified via GET and response config.
     - Successfully tested boundary conditions (0% and 100% fees).
     - Reset to standard baseline (15% percentage fee).
  4. Disk Persistence & Audit Trail:
     - Confirmed `projectReviewConfig` updated in `db.json`.
     - Confirmed audit trail entries logged in `pricingAuditLogs` with `changeType: "platform_fee"`, `changedByRole: "admin"`, and `context: "project_review"`.
  5. Service Isolation & Non-Regression:
     - Verified that all expert 1-Hour Call rates (`rate` and `baseRate`) remain 100% untouched and isolated.
     - Verified that internal platform fee configuration is never leaked to Client or Expert pricing queries.
     - Updated `server.js` to authoritatively compute `price`, `platformFee`, and `expertEarning` directly from expert records and `projectReviewConfig` in `db.json`.
- **Tests:** Ran `scratch/test_step5_platform_fee.mjs` (30/30 PASSED - 100%).
- **Result:** Passed.

## Step 6 — Payment Integration & Price Snapshot Preservation
- **Status:** Completed
- **Changes / Executions:**
  1. Authoritative Backend Calculation & Tamper Resistance:
     - Client requested booking with tampered `price: 500`. Backend strictly ignored the client value and calculated authoritative price (₹1,500), platform fee (₹225), and expert earning (₹1,275).
     - Escrow payment of ₹1,500 was deducted directly from Client Alpha wallet (₹10,000 -> ₹8,500).
  2. Dynamic Rate Update:
     - Admin changed Expert JK's rate to ₹900, and platform fee to Fixed ₹150.
     - Confirmed all 3 portals (Expert, Admin, Client) synchronized immediately to active price ₹900.
  3. Immutable Historical Snapshot Preservation:
     - Queried Review 1: price remained strictly ₹1,500, paidAmount remained ₹1,500, platformFee remained ₹225, expertEarning remained ₹1,275.
     - Client Alpha's wallet remained ₹8,500 (not retroactively affected).
  4. Lifecycle Transitions & Escrow Release:
     - Review 1 progressed through 'Accepted', 'ProjectSubmitted', and 'Completed'.
     - Escrow payout released to Expert Wallet using the original snapshot `expertEarning` (₹1,275) — completely unaffected by the newer active rate ₹900 or new fixed fee ₹150.
  5. Subsequent Booking at New Active Rate:
     - Client Beta booked Review 2: authoritative price ₹900, paidAmount ₹900, platformFee ₹150, expertEarning ₹750, wallet deducted by ₹900.
  6. Side-by-Side Coexistence:
     - Review 1 (₹1,500) and Review 2 (₹900) coexisted in `db.json` with 0 price conflation or cross-contamination.
- **Tests:** Ran `scratch/test_step6_payment_integration.mjs` (41/41 PASSED - 100%).
- **Result:** Passed.

## Step 7 — Final Regression & Security Verification
- **Status:** Completed
- **Verification Suites & Results:**
  1. `npm run build` (`tsc -b && vite build`): 0 errors, 2393 modules transformed, production assets generated cleanly in 5.10s.
  2. `scratch/test_backend.mjs` (17 tests): 17/17 PASSED (100%) — 1-Hour Call availability, booking mutex, concurrency protection.
  3. `scratch/test_project_reviews_backend.mjs` (36 tests): 36/36 PASSED (100%) — complete project review workflow lifecycle, 2-meeting limit, submissions, private chat.
  4. `scratch/test_step2_expert_pricing.mjs` (28 tests): 28/28 PASSED (100%) — expert price configuration, strict ₹0 - ₹2,000 bounds, unauthorized access rejection.
  5. `scratch/test_step3_admin_pricing.mjs` (22 tests): 22/22 PASSED (100%) — admin price control across all platform experts, permission enforcement, disk persistence.
  6. `scratch/test_step4_two_way_sync.mjs` (31 tests): 31/31 PASSED (100%) — alternating two-way synchronization sequence (1000 -> 1500 -> 1200 -> 1800 -> 900), multi-tab query consistency, audit logging.
  7. `scratch/test_step5_platform_fee.mjs` (30 tests): 30/30 PASSED (100%) — admin-only platform fee management (percentage & fixed), role 403 enforcement, 1-Hour Call service isolation.
  8. `scratch/test_step6_payment_integration.mjs` (41 tests): 41/41 PASSED (100%) — authoritative price computation on booking, wallet deduction, immutable historical snapshots across rate and fee changes, escrow release.
  - **Overall Total:** 205 / 205 tests passed (100%).
- **Result:** Passed.

# Project Review — Simple Dynamic Pricing & Cross-Portal Synchronization (Additive Model)

## Step 1 — Analysis & Architectural Alignment
- **Status:** Completed
- **Pricing Model Specification:**
  ```text
  Expert Project Review Price
  +
  Project Review Platform Charge
  =
  Final Client Price
  ```
- **Key Principles:**
  1. Expert sets/updates own `Project Review Price` (₹0 to ₹2,000).
  2. Admin can view and override any Expert's `Project Review Price` (₹0 to ₹2,000).
  3. Two-way dynamic synchronization ensures identical active Expert price across Expert, Admin, and Client portals.
  4. Platform Charge is strictly Admin-only (view, set, update). Expert and Client cannot view/modify platform fee configuration.
  5. Client sees explicit breakdown: Expert Review Charge + Platform Charge = Total Amount.
  6. Backend remains the authoritative calculating layer for booking, wallet deduction, and escrow release.
  7. Historical bookings preserve their immutable price and fee snapshots.
  8. Zero disturbance to all existing workflows (Project Review workflow, 1-Hour Call availability, wallets, meetings, etc.).
- **Changes Completed in Step 1:**
  - Updated backend endpoints in `vite.config.ts` and `server.js` (`GET /api/project-reviews/pricing`, `POST /api/project-reviews/pricing`, `POST /api/project-reviews/request`).
  - Updated `src/mongoDBService.ts` methods `getProjectReviewPricing` and `updateProjectReviewPrice`.
  - Updated Expert Portal pricing UI card in `src/App.tsx`.
  - Updated Admin Portal pricing table & platform charge cards in `src/components/AdminProjectReviewDesk.tsx`.
- **Tests:** `npm run build` passed with zero errors.
- **Result:** Passed.

## Step 2 — Client Portal Transparent Pricing Breakdown
- **Status:** Completed
- **Changes / Implementation:**
  1. Updated `src/components/ProjectReviewRequestModal.tsx`:
     - Implemented dynamic pricing states: `expertCharge`, `platformFee`, and `totalAmount`.
     - Connected to `/api/project-reviews/pricing?expertId=...` on mount and on expert change.
     - Rendered explicit transparent breakdown card:
       * Expert Review Charge: ₹X
       * Platform Charge: ₹Y
       * Total Amount: ₹(X + Y)
     - Bound Client Wallet Escrow Indicator to authoritative `totalAmount`.
     - Bound submit button and multi-party notifications to authoritative `totalAmount` and `platformFee`.
     - Client has zero ability to edit, tamper with, or override pricing values.
  2. Updated `src/components/ProjectReviewWorkspace.tsx`:
     - Cleaned up review package summary labels to `Expert Earning` and `Platform Charge`, eliminating legacy hardcoded percentage strings.
  3. Hardened Endpoint Authorization (`vite.config.ts`, `server.js`):
     - Ensured `POST /api/project-reviews/pricing` rejects expert updates for mismatching `expertId` before expert record lookup (HTTP 403 Forbidden).
     - Enforced strict ₹0 to ₹2,000 bounds check (HTTP 400 Bad Request on negative, >2000, or non-numeric values).
- **Tests & Verification:**
  - `scratch/test_simple_pricing_sync.mjs` (79 tests): 79/79 PASSED (100%)
    * Baseline ₹1,000 + ₹100 = ₹1,100 verified across all 3 portals.
    * Flow A (Expert ₹1,000 -> ₹1,500): Synchronized to Admin (₹1,500 + ₹100 = ₹1,600) and Client (₹1,500 + ₹100 = ₹1,600).
    * Flow B (Admin ₹1,500 -> ₹1,200): Synchronized to Expert (₹1,200) and Client (₹1,200 + ₹100 = ₹1,300).
    * Platform Charge (Admin-only): Fixed (₹150 -> ₹1,350) and Percentage (10% -> ₹1,320) dynamic calculation; Expert price remains unaffected at ₹1,200.
    * Role Authorization: Client forbidden (403), Expert modifying other expert forbidden (403), Client/Expert accessing platform fee config forbidden (403).
    * Price Boundaries: ₹0 (200), ₹2,000 (200), ₹2,001 (400), -500 (400), non-numeric (400).
    * Payment Integration: Tampered client price payload strictly ignored; authoritative ₹1,300 deducted from wallet; snapshot preserved.
    * Snapshot Immutability: Subsequent rate change (₹1,800) and fee change (₹200) leave Review 1 snapshot untouched at ₹1,300 / ₹100 / ₹1,200.
    * Escrow Release: Payout to Expert wallet releases snapshot `expertCharge` (₹1,200), not the updated rate.
    * Service Isolation: 1-Hour Call rates remain 100% untouched.
  - `scratch/test_backend.mjs`: 17/17 PASSED (100%) — 1-Hour Call availability, booking mutex, concurrency protection.
  - `scratch/test_project_reviews_backend.mjs`: 36/36 PASSED (100%) — Project Review lifecycle, 2-meeting limit, private chat.
  - `npm run build`: 0 errors, build completed in 4.81s.
## Step 3 — Project Review Platform Fee Persistence & Cross-Portal Synchronization
- **Status:** Completed
- **Root Cause & Fix Summary:**
  1. UI Initialization & Button Alignment: Updated `AdminProjectReviewDesk.tsx` to initialize `platformFeeConfig` from `localStorage.getItem('mongo_project_review_config')` or `{ feeType: 'fixed', feeValue: 150 }`. Relabeled the button to `Save Platform Charge` (showing `Saving...` when in progress).
  2. Direct Platform Fee Query on Mount: Added direct call to `mongoDB.getProjectReviewPlatformFee()` in `loadPricingAndFees()` so the saved database fee is immediately fetched on mount, page refresh, and after save.
  3. Client Service Caching: Updated `mongoDBService.ts` in `pullServerDb()`, `getProjectReviewPlatformFee()`, and `updateProjectReviewPlatformFee()` to cache `projectReviewConfig` into `localStorage.setItem('mongo_project_review_config', ...)`, and return cached values during network failure instead of hardcoding 100 or 15%.
  4. Backend Default Fallbacks: Replaced all legacy percentage fallbacks in `vite.config.ts` (lines 89, 614, 638, 691, 877, 934, 1020) and `server.js` (lines 143, 285, 315, 338, 411) with `{ feeType: 'fixed', feeValue: 150 }`, eliminating resets to 15% (₹150).
  5. Client Modal Dynamic Breakdown: Connected `ProjectReviewRequestModal.tsx` initial state to `mongo_project_review_config` cache, ensuring seamless display of active platform charge (e.g. ₹200) and authoritative total (e.g. ₹1,200).
- **Automated Verification:**
  - Ran `scratch/test_platform_fee_persistence.mjs` (42 tests): 42/42 PASSED (100%).
    * Admin query, edit to ₹200, and save via "Save Platform Charge" confirmed.
    * Permanent disk persistence in `db.json` verified (`feeValue: 200`).
    * Audit log creation verified in `pricingAuditLogs`.
    * Page refresh simulated via fresh GET requests confirmed (`feeValue: 200`).
    * Logout/login simulated confirmed (`feeValue: 200`).
    * Client Portal transparent breakdown verified: Expert Charge ₹1,000 + Platform Charge ₹200 = Total ₹1,200.
    * Client request creation with tampered payload strictly ignored; authoritative ₹1,200 deducted and snapshotted.
    * Changed fee from ₹200 to ₹250 and verified complete cycle: disk persistence, refresh, client sync (₹1,000 + ₹250 = ₹1,250).
    * Full Vite server restart simulation: persisted ₹250 survived restart with zero reset to default ₹150.
    * Service isolation verified: 1-Hour Call rates remain 100% untouched.
  - Regression Suites:
    * `scratch/test_simple_pricing_sync.mjs`: 79/79 PASSED (100%).
    * `scratch/test_backend.mjs`: 17/17 PASSED (100%).
    * `scratch/test_project_reviews_backend.mjs`: 36/36 PASSED (100%).
    * `npm run build`: Clean production build (0 errors, 3.90s).
- **Result:** Passed.


## Step 4 — Global Platform Charge Dynamic Synchronization & Unified Architecture
- **Status:** Completed
- **Changes Completed:**
  1. **Database Schema & Persistence:**
     - Initialized and synchronized `platformCharge` and `projectReviewConfig` in `db.json` with `{ feeType: "fixed", feeValue: 200, currency: "INR", updatedAt, updatedBy }`.
     - Ensured `readDb()` in `vite.config.ts` maintains synchronization between `platformCharge` and `projectReviewConfig`.
  2. **Unified REST Endpoints:**
     - Implemented `GET /api/platform-settings` returning authoritative configuration `{ success: true, config, platformCharge }` for client and admin access.
     - Implemented `GET /api/project-reviews/platform-fee` with strict `role=admin` permission enforcement.
     - Implemented `PUT/POST /api/platform-settings` and `POST/PUT /api/project-reviews/platform-fee` validating inputs (non-negative number, percentage 0-100%, feeType 'fixed' | 'percentage', role 'admin').
     - Unified responses returning `{ success: true, message: "✓ Platform charge updated successfully", config, platformCharge }`.
  3. **Database Audit Logging:**
     - Logged audit entries in `pricingAuditLogs` containing `id`, `changeType: "platform_fee"`, `category: "platform_charge"`, `previousValue`, `newValue`, `oldValue`, `newValueNum`, `changedBy: "admin"`, `changedAt`, `timestamp`.
  4. **Admin UI Alignment (`AdminProjectReviewDesk.tsx`):**
     - Updated card header to `Platform Charge`.
     - Aligned dropdown options to `Fixed Amount` and `Percentage`.
     - Button labeled `Save Platform Charge` (showing `Saving...` while in progress).
     - Success feedback displays `✓ Platform charge updated successfully`.
     - Added real-time event listener for `platform_fee_updated` and storage sync.
  5. **Client Portal Dynamic Breakdown (`ProjectReviewRequestModal.tsx`):**
     - Aligned breakdown labels to:
       * `Project Price: ₹X`
       * `Platform Charge: ₹Y`
       * `Total: ₹(X + Y)`
     - Connected to `platform_fee_updated` and `storage` event listeners for real-time reactivity without manual page refresh.
     - Retained authoritative server-side price computation on booking creation (`POST /api/project-reviews/request`).
  6. **Historical Snapshot Immutability:**
     - Snapshotted `expertCharge`, `platformFee`, `platformCharge`, `platformChargeType`, `price`, `paidAmount`, `expertEarning` on every review record in `projectReviews`.
     - Verified existing created and completed reviews do NOT alter historical financial snapshots when global Platform Charge changes.
  7. **Service Isolation:**
     - Verified 1-Hour Call rates (`rate` and `baseRate`) and consultation availability slots remain 100% untouched and isolated.
- **Verification Results:**
  - `scratch/test_dynamic_platform_charge.mjs`: 64/64 PASSED (100%)
    * Test 1 (Initial DB Platform Charge = 200 -> Client shows 200, Total 1200): PASSED
    * Test 2 (Admin changes 200 -> 300 -> DB = 300, Admin UI = 300, Client UI = 300, Total 1300): PASSED
    * Test 3 (Reload / fresh queries verify 300 persists): PASSED
    * Test 4 (Simulated restart verifies persistent disk survival): PASSED
    * Test 5 (Admin changes 300 -> 500 -> all update to 500, Total 1500): PASSED
    * Test 6 (Validation of negative, non-numeric, >100% percentage, and unauthorized access rejected): PASSED
    * Test 7 (Historical transaction snapshot immutability across subsequent rate/fee changes): PASSED
    * Test 8 (Audit trail logging in pricingAuditLogs): PASSED
    * Test 9 (1-Hour Call rate isolation): PASSED
  - `scratch/test_platform_fee_persistence.mjs`: 42/42 PASSED (100%)
  - `scratch/test_simple_pricing_sync.mjs`: 79/79 PASSED (100%)
  - `scratch/test_backend.mjs`: 17/17 PASSED (100%)
  - `scratch/test_project_reviews_backend.mjs`: 36/36 PASSED (100%)
  - `npm run build`: Succeeded with 0 errors in 4.06s.
- **Result:** Passed.

## Step 5 — Dynamic Form Fee Synchronization & Cross-Component Real-Time Propagation
- **Status:** Completed
- **Changes Completed:**
  1. `ProjectReviewRequestModal.tsx`:
     - Handled percentage fee in initial state calculations (`platformFee` and `totalAmount`), accurately calculating `Math.round(expertRate * (feeValue / 100))`.
     - Added 1.5-second live polling interval and event listeners (`platform_fee_updated`, `storage`, `mongo_db_updated`) for instantaneous multi-tab and cross-browser synchronization while modal is open.
  2. `AdminProjectReviewDesk.tsx`:
     - Fixed legacy fallback `150` on line 837 to `200` (`platformFeeConfig.feeValue ?? 200`).
     - Added 2-second background polling interval in `useEffect` to ensure Authoritative Directory table stays synchronized in real time with backend modifications.
  3. `vite.config.ts` & `server.js`:
     - Added `platformFeeConfig: feeConfig` and `platformChargeConfig: feeConfig` to `GET /api/project-reviews/pricing?expertId=...` endpoint responses.
     - Normalized legacy `150` fallbacks across `server.js` lines 143, 157, 181, 285 to `{ feeType: 'fixed', feeValue: 200, currency: 'INR' }`.
  4. `src/mongoDBService.ts`:
     - Updated `getProjectReviewPricing()` to cache `platformFeeConfig` in `localStorage` under keys `mongo_project_review_config` and `mongo_platform_charge`.
  5. `BookingModal` (in `src/App.tsx` & `src/components/BookingModal.tsx`):
     - Updated Project Review package button to dynamically compute `dynamicProjectRate + dynamicPlatformFee` instead of static `expert.rate * 3`.
- **Verification Results:**
  - `scratch/test_form_fee_sync.mjs`: 14/14 PASSED (100%)
    * Admin updates Platform Charge to ₹250 (Fixed) -> Client queries receive ₹250 fee & ₹1,250 total.
    * Admin directory table reflects updated Platform Charge of ₹250 across all experts.
    * Server-side booking creation computes ₹250 fee and records authoritative snapshot.
    * Admin updates Platform Charge to ₹300 -> Client queries receive ₹300 fee & ₹1,300 total.
    * Admin updates to 15% percentage -> Client queries dynamically calculate 15% cut (₹150 on ₹1,000, Total ₹1,150).
    * Revert to baseline ₹200 -> Client queries immediately reflect ₹200 fee & ₹1,200 total.
    * Complete audit trail verification in `pricingAuditLogs`.
  - Regression Suites:
    * `scratch/test_dynamic_platform_charge.mjs`: 64/64 PASSED (100%).
    * `scratch/test_platform_fee_persistence.mjs`: 42/42 PASSED (100%).
    * `scratch/test_simple_pricing_sync.mjs`: 79/79 PASSED (100%).
    * `scratch/test_backend.mjs`: 17/17 PASSED (100%).
    * `scratch/test_project_reviews_backend.mjs`: 36/36 PASSED (100%).
    * `npm run build`: Succeeded cleanly with 0 errors in 4.05s.
- **Result:** Passed.

## Step 6 — Fix Admin Platform Charge Input Overwriting / Auto-Reversion & Instant Save Synchronization
- **Status:** Completed
- **Changes Completed:**
  1. `src/components/AdminProjectReviewDesk.tsx`:
     - Added `isFeeDirtyRef = useRef(false)` tracking ref to protect user draft inputs from being overwritten by 1.5–2s background polling or storage events while editing.
     - Converted `feeValueInput` state from `number` to `string` (`useState<string>('200')`), preventing jumpy zero-snapping during backspacing or clearing.
     - Updated `loadPricingAndFees()` to guard `setFeeTypeInput` and `setFeeValueInput` behind `if (!isFeeDirtyRef.current)`.
     - Attached `onFocus` and `onChange` dirty triggers to both Fee Type `<select>` and Fee Value `<input>`.
     - Added `onKeyDown` Enter key trigger on Fee Value `<input>` to execute immediate save (`handleAdminUpdateFee()`).
     - Added conditional "Reset" button when draft input differs from authoritative backend config.
     - Updated `handleAdminUpdateFee()` to validate non-empty/non-negative strings, save to database, reset `isFeeDirtyRef.current = false`, update `platformFeeConfig`, update directory table, and broadcast `platform_fee_updated` across all project review modals and portals.
- **Verification Results:**
  - `scratch/test_admin_platform_charge_instant_save.mjs`: ALL TESTS PASSED (100%)
    * Admin changes Platform Charge from ₹200 to ₹100: Saved in 28ms (< 1s).
    * `db.json` permanently persisted `feeValue: 100` in both `platformCharge` and `projectReviewConfig`.
    * Client/Admin pricing received ₹100 immediately: Expert ₹1,000 + Platform ₹100 = Client Total ₹1,100.
    * 3-second wait confirmed zero auto-reversion back to ₹200.
    * Fee Type change to Percentage (10%) applied immediately: ₹100 fee on ₹1,000, Total ₹1,100.
    * Revert back to baseline ₹200 Fixed succeeded cleanly.
  - Regression Test Suites:
    * `scratch/test_form_fee_sync.mjs`: 14/14 PASSED (100%).
    * `scratch/test_dynamic_platform_charge.mjs`: 64/64 PASSED (100%).
    * `scratch/test_platform_fee_persistence.mjs`: 42/42 PASSED (100%).
    * `scratch/test_simple_pricing_sync.mjs`: 79/79 PASSED (100%).
    * `scratch/test_backend.mjs`: 17/17 PASSED (100%).
    * `scratch/test_project_reviews_backend.mjs`: 36/36 PASSED (100%).
    * `npm run build`: Succeeded cleanly with 0 errors in 3.95s.
- **Result:** Passed.

## Step 7 — Mentora Blogs & Articles Section Redesign & Integration
- **Status:** Completed
- **Changes Completed:**
  1. `src/data/blogArticles.ts`:
     - Authored data structure with `BlogArticle`, `ArticleSection`, and `BLOG_CATEGORIES`.
     - Seeded Featured Article: *"The Knowledge You Build Over a Career Is More Valuable Than You Think"* (Mentorship, 6 min read).
     - Seeded Articles 1 to 10 matching all prompt specifications (Mentorship, Career, Leadership, Entrepreneurship, Technology & AI, Industry Insights, Consulting, Personal Growth) with comprehensive original educational content, key takeaways, and zero real-estate terms.
     - Implemented `getAllArticles()`, `getArticleBySlug()`, and `getRelatedArticles()` helpers.
  2. `src/components/MentoraBlogsPage.tsx`:
     - Designed editorial hero with eyebrow *"MENTORA INSIGHTS"*, headline *"Experience worth sharing. Knowledge worth passing on."*, and supporting statement.
     - Implemented horizontal scrollable category navigation with smooth active states.
     - Implemented real-time Search input with clean *"No insights found"* empty state.
     - Implemented Featured Article card with metadata, serif typography, and hover motion.
     - Implemented responsive 3-column article grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) with image zoom (`scale(1.04)`) and desktop spring cursor indicator.
     - Implemented Load More button with smooth reveal and `hasLoadedMore` state guard (*"All Articles Loaded"*).
     - Implemented full article detail experience (`/blogs/[slug]`) with key takeaways, formatted sections, author attribution, related articles, and share action.
     - Implemented complete Light Mode (`#FEF7EB` bg, `#601D22` primary) and Dark Mode (`#120D0E` bg, `#1C1415` surface, `#A94B55` primary) theme synchronization.
  3. `src/App.tsx`:
     - Integrated *"Blogs & Articles"* navigation button into existing upper header (desktop & mobile drawer menu) without modifying existing sections or headers.
     - Extended `parseRouteFromLocation()` to recognize `/blogs` and `/blogs/:slug`.
     - Extended `navigateTo()` and browser popstate sync to manage `/blogs` and `/blogs/:slug` routes smoothly.
     - Added *"Blogs & Articles"* tab to `ProtoBar`.
     - Mounted `<MentoraBlogsPage />` when `page === "blogs"`.
  4. `src/components/MentoraAboutPage.tsx`:
     - Connected header navigation to *"Blogs & Articles"* on desktop and mobile drawer.
- **Verification Results:**
  - `scratch/test_blogs.mjs`: 28/28 PASSED (100%)
    * All 11 required article titles verified.
    * All 10 categories verified.
    * Hero eyebrow, headline, and supporting statement verified.
    * Search placeholder and empty states verified.
    * Load More and All Articles Loaded states verified.
    * Back to Mentora and Back to Blogs navigation verified.
    * Light and Dark mode palettes verified.
    * Responsive 3-column grid verified.
    * App.tsx routing and header buttons verified.
    * 0 real-estate terms verified.
  - Regression Test Suites:
    * `scratch/test_backend.mjs`: 17/17 PASSED (100%).
    * `scratch/test_project_reviews_backend.mjs`: 36/36 PASSED (100%).
    * `scratch/test_dynamic_platform_charge.mjs`: 64/64 PASSED (100%).
    * `scratch/test_form_fee_sync.mjs`: 14/14 PASSED (100%).
    * `npm run build`: Succeeded cleanly with 0 errors in 4.57s.
- **Result:** Passed.

## Step 8 — Remove Redundant Blogs & Articles Button from Top ProtoBar
- **Status:** Completed
- **Changes Completed:**
  - Removed `["blogs", "Blogs & Articles"]` from `ProtoBar` tabs in `src/App.tsx`, eliminating the duplicate button from the top prototype navigation bar on the landing page.
  - Kept the main Mentora landing page header navigation (`Blogs & Articles`) and the complete Blogs & Articles editorial section/routes (`/blogs`, `/blogs/[slug]`) fully functional and untouched.
- **Verification Results:**
  - `scratch/test_blogs.mjs`: 28/28 PASSED (100%).
  - `npm run build`: Succeeded cleanly with 0 errors in 4.62s.
- **Result:** Passed.


## Step 9 — Admin Blogs & Articles Management System & MongoDB Dynamic Synchronization
- **Status:** Completed
- **Changes Completed:**
  1. `src/types/index.ts`:
     - Added comprehensive TypeScript types: `BlogArticleRecord`, `BlogCategoryRecord`, `BlogCMSStats`, `BlogArticleSection`, `BlogContentType`, `BlogContentStatus`.
  2. `src/data/seedBlogs.json`:
     - Initialized seed database with 11 rich educational articles and 9 initial taxonomy categories.
  3. `vite.config.ts` (Shared DB / REST API Layer):
     - Auto-seeding logic ensures `db.blogs` and `db.blogCategories` populate on first startup.
     - Public endpoints:
       * `GET /api/blogs`: Filters by status ('published'), category, type, and keyword search.
       * `GET /api/blogs/:slug`: Resolves individual article by unique slug, computes related articles dynamically, and supports admin draft preview mode (`?preview=true`).
       * `GET /api/blogs/categories`: Returns categories with real-time article counts.
     - Admin Endpoints (Protected by role check: `x-admin-role: admin` or payload `role: 'admin'`, returning 403 Forbidden for non-admins):
       * `GET /api/admin/blogs`: Retrieves all articles (drafts & published) with stats, sorting, search, and filtering.
       * `GET /api/admin/blogs/stats`: Computes live counts (Total, Published, Drafts, Featured, Categories).
       * `POST /api/admin/blogs`: Creates new article with title, slug uniqueness check, excerpt, author, block sections, and status.
       * `PUT /api/admin/blogs/:id`: Edits article fields with instant synchronization.
       * `DELETE /api/admin/blogs/:id`: Permanently deletes an article from database.
       * `POST /api/admin/blogs/:id/publish`: Transitions article from Draft to Published.
       * `POST /api/admin/blogs/:id/unpublish`: Transitions article from Published to Draft.
       * `POST /api/admin/blogs/:id/feature`: Toggles featured state while strictly enforcing the single primary featured article rule (all other articles are reset to featured: false).
       * `POST /api/admin/blogs/reorder`: Persists custom article display ordering.
       * `GET /api/admin/blogs/categories` & `POST /api/admin/blogs/categories`: Manages dynamic categories.
       * `DELETE /api/admin/blogs/categories/:id`: Deletes categories with safety check blocking deletion if articles currently use the category (unless forced).
  4. `server.js` (Mongoose / MongoDB Backend):
     - Added `BlogCategorySchema` and `BlogSchema` models.
     - Replicated all REST API routes in Express with Mongoose transactions and queries.
  5. `src/mongoDBService.ts`:
     - Integrated `db.blogs` and `db.blogCategories` into `pullServerDb()`.
     - Dispatches `blogs_updated` custom event across tabs for instant client synchronization.
     - Added client helper methods: `getPublicBlogs`, `getPublicBlogBySlug`, `getAdminBlogs`, `createAdminBlog`, `updateAdminBlog`, `deleteAdminBlog`, `publishAdminBlog`, `unpublishAdminBlog`, `toggleFeatureAdminBlog`, `reorderAdminBlogs`, `getBlogCategories`, `createBlogCategory`, `deleteBlogCategory`.
  6. `src/components/AdminBlogsDesk.tsx`:
     - Built dedicated Admin CMS component inside Admin Portal.
     - Includes KPI statistics ribbon (Total Articles, Published, Drafts, Featured, Categories).
     - Full management table with responsive cards on mobile, column sorting, search, category filter, and status filter.
     - Rich content editor with:
       * Content Type switcher (Blog / Article)
       * Title and auto-slug generation with custom editability
       * Excerpt / Summary textarea
       * Category select + "+ Add New Category" inline modal
       * Author name, role, and avatar fields
       * Read time presets + custom entry
       * Publication date picker
       * Featured Image URL input with instant preview
       * Content Status selector (Draft / Published)
       * "Feature this article" checkbox
       * Section blocks editor (Headings, Paragraphs, Blockquotes, Callouts, Lists) with reorder and preset insertion
       * Executive key takeaways manager
     - Category Manager modal with creation, deletion, and usage counter protection.
     - Delete confirmation modal with article title safeguard.
     - Public Fidelity Preview modal rendering exact public styling before publishing.
  7. `src/components/AdminGovernancePortal.tsx`:
     - Added `"blogs"` to `activeDesk` union.
     - Added "Blogs & Articles" sidebar button with `BookOpen` icon.
     - Rendered `<AdminBlogsDesk />` when `activeDesk === "blogs"`.
  8. `src/components/MentoraBlogsPage.tsx`:
     - Bound Hero, Featured Article, Category pills, and 3-column Article Grid directly to dynamic MongoDB state (`dbArticles`, `dbCategories`, `featuredArticle`).
     - Added 404 state for unpublished/deleted articles with "Back to Blogs & Articles" navigation.
     - Added polymorphic helper accessors (`getAuthorName`, `getAuthorRole`, `getArticleImage`, `getArticleDate`, `getArticleExcerpt`).
- **Verification Results:**
  - `scratch/test_blogs_cms_e2e.mjs`: 9/9 PASSED (100%)
    * 1. Create New Article as Draft (Saved in MongoDB, hidden from public): PASSED.
    * 2. Publish Article (Draft -> Published and instantly visible on public endpoint): PASSED.
    * 3. Edit Article Title (MongoDB update synchronized with public page): PASSED.
    * 4. Featured Image Update (Immediate image synchronization): PASSED.
    * 5. Set Article as Featured (Strict single primary featured article rule enforced): PASSED.
    * 6. Unpublish Article (Draft status removes from public view; admin can preview): PASSED.
    * 7. Delete Article (Permanently deleted from database): PASSED.
    * 8. Category Filtering & Management (Dynamic MongoDB categories): PASSED.
    * 9. Unauthorized Access Prevention (Non-admin blocked with 403 Forbidden): PASSED.
  - Production Build:
    * `npm run build` (`tsc -b && vite build`): Succeeded cleanly with 0 errors in 5.59s.
- **Result:** Passed.

## Step 10 — Mentora Landing Page Background Video Integration & Theme-Aware Architecture
- **Status:** Completed
- **Changes Completed:**
  1. `src/data/landingVideoConfig.ts`:
     - Centralized video URL configuration: `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_045634_e1c98c76-1265-4f5c-882a-4276f2080894.mp4`.
     - Configured high-fidelity static fallback imagery for Light Mode and Dark Mode.
  2. `src/components/LandingBackgroundVideo.tsx`:
     - Built dedicated responsive background video component.
     - Implemented `autoPlay`, `muted`, `loop`, `playsInline`, `controls={false}`, and `preload="auto"`.
     - Integrated `aria-hidden="true"` and `tabIndex={-1}` for accessibility compliance.
     - Implemented `object-fit: cover` with responsive container fill preserving 16:9 native aspect ratio without distortion.
     - Added `pointer-events-none` on container and layers to ensure zero interference with scrolling, navigation, forms, buttons, or clicks.
     - Implemented dual-theme overlay architecture:
       * **Light Mode:** High-readability light atmospheric radial vignette + linear contrast gradient, keeping video clearly visible while preserving dark text readability and preventing visual overpowering.
       * **Dark Mode:** Deep cyber-obsidian & quantum gold radial and vertical gradient matching Mentora's design aesthetic, preserving light text contrast without obscuring the video.
     - Seamless theme toggle: Video element persists across theme changes without unmounting, reloading, flashing, or restarting playback; overlays adapt with smooth CSS transitions.
     - Graceful failure and edge case fallbacks:
       * Browser autoplay policy block handler via `video.play().catch(...)`.
       * Video stream loading error handler via `onError`.
       * Accessibility reduced motion compliance via `window.matchMedia('(prefers-reduced-motion: reduce)')`.
       * Automatic zero-flash fallback to existing Mentora architectural static wallpaper.
  3. `src/App.tsx`:
     - Imported `LandingBackgroundVideo`.
     - Replaced static background wallpaper in `Landing` with `<LandingBackgroundVideo theme={theme} />`.
     - Enforced strict 3-layer visual hierarchy: Layer 1 (Video ONLY, wallpaper removed) < Layer 2 (Theme overlays & blooms) < Layer 3 (Interactive header, hero, cards, and sections).
     - Verified zero modifications to Client Portal, Expert Portal, Admin Portal, Booking, Wallets, or Database schemas.
  4. Wallpaper Removal per User Request:
     - Removed static wallpaper image `div` and fallback image references from `LandingBackgroundVideo.tsx` and `landingVideoConfig.ts`.
     - Only the background video element is applied behind the Landing Page.
  5. Background Video Brightness Enhancement per User Request:
     - Slightly increased video brightness (`brightness(1.14)` in Light Mode, `brightness(1.10)` in Dark Mode) and increased opacity (`0.72` in Light Mode, `0.85` in Dark Mode) in `LandingBackgroundVideo.tsx`.
     - Zero changes made to any other section.
  6. Light Mode Video Brightness & Opacity Enhancement per User Request:
     - Slightly increased video brightness (`brightness(1.24)`) and opacity (`0.84`) specifically in Light Mode in `LandingBackgroundVideo.tsx`.
     - Maintained high text readability and contrast with zero changes to any other section.
- **Verification Results:**
  - `scratch/test_background_video.mjs`: 28/28 PASSED (100%)
    * Wallpaper div verified removed; only background video applied.
    * Video brightness & opacity in Light Mode verified with responsive cover, autoplay, muted, loop, playsInline, and controls hidden.
    * Dual-theme overlays and seamless switching verified.
    * Portals and other sections verified intact with zero modifications.
  - Regression Test Suites:
    * `scratch/test_blogs.mjs`: 28/28 PASSED (100%)
    * `scratch/test_blogs_cms_e2e.mjs`: 9/9 PASSED (100%)
    * `scratch/test_backend.mjs`: 17/17 PASSED (100%)
  - Production Build:
    * `npm run build` (`tsc -b && vite build`): Succeeded cleanly with 0 errors in 5.35s.
- **Result:** Passed.

---

# Mentora Premium Responsive Landing Page Footer Implementation Workflow

## Step 0 — Discovery & Baseline Verification
- **Status:** Completed
- **Changes & Findings:**
  1. Ran `npm run build` (`tsc -b && vite build`): Succeeded cleanly with 0 errors in 11.66s.
  2. Inspected landing page architecture in `src/App.tsx`:
     - Identified previous minimal 10-line inline footer in `Landing` (lines 4178-4188).
     - Identified existing `src/components/Footer.tsx` (84 lines, used by dashboards via `setActiveTab`).
     - Identified landing section anchors: `#how`, `#stories`, and verified `#organizations` and `#featured-advisors` anchor hooks.
     - Identified active theme system (`theme = "dark" | "light"`, `isLight = theme === "light"`).
     - Identified AI Expert Assistant floating button at `fixed bottom-6 right-6 z-50`.
     - Confirmed exact LinkedIn and Instagram URLs per user request.
     - Verified no newsletter API exists in backend; client-side validation and isolated feedback required with zero DB pollution.
     - Confirmed zero changes to any other section, backend MongoDB, auth, portals, or bookings.
- **Verification Results:** Baseline build passed with 0 errors.
- **Result:** Passed.

## Step 1 — Upgrade `src/components/Footer.tsx`
- **Status:** Completed
- **Changes Completed:**
  1. Built pre-footer CTA section ("Experience That Moves You Forward." with supporting copy) with primary amber/orange gradient button and secondary outlined button.
  2. Built responsive multi-layer organic/wave separator at the top of footer transitioning seamlessly from the landing page.
  3. Built 5-column responsive layout:
     - Column 1: Mentora Brand with light/dark theme logo assets, mission statement, tagline ("Empowering Future Leaders"), verified advisory badge, "Stay Connected" newsletter form with validation and feedback, and verified social media links (LinkedIn & Instagram exact URLs).
     - Column 2: EXPLORE (`#how`, `#organizations`, `#stories`, About, Blogs).
     - Column 3: FOR CLIENTS & ORGANIZATIONS (Find an Expert, Browse Advisors, Book a Session, Project Review, Client Portal).
     - Column 4: FOR EXPERTS (Become an Expert, Expert Sign In, Expert Portal, Advisory Guidelines).
     - Column 5: COMPANY & RESOURCES (Our Mission, Knowledge Hub, Contact Support, Privacy Policy, Terms & Conditions, Executive Desk).
  4. Built bottom bar with dynamic current year (`© {new Date().getFullYear()} Mentora`), legal modal triggers, and right-hand clearance (`sm:pr-24 md:mr-64 lg:mr-56 pb-24 sm:pb-6`) ensuring zero overlap with the floating `fixed bottom-6 right-6` AI Expert Assistant.
  5. Built interactive accessible Legal Modal for Privacy Policy and Terms & Conditions.
  6. Implemented backward compatibility for `setActiveTab`.
- **Tests:** `scratch/test_footer.mjs` ran 31 tests covering brand copy, links, social URLs, form validation, theme classes, and accessibility. All 31 tests passed.
- **Result:** Passed.

## Step 2 — Integrate Footer into Landing Page (`src/App.tsx`)
- **Status:** Completed
- **Changes Completed:**
  1. Imported `Footer` in `src/App.tsx`.
  2. Added `id="organizations"` to the statistics/enterprise section (line 3836).
  3. Added `id="featured-advisors"` to featured advisors section (line 3484).
  4. Replaced the previous 10-line inline footer in `Landing` with `<Footer theme={theme} setPage={setPage} onOpenAuth={onOpenAuth} userRole={userRole} />`.
  5. Verified zero modifications to any other portal, auth logic, database schema, or backend route.
- **Tests:** `npm run build` (`tsc -b && vite build`) built cleanly with 0 errors in 6.33s.
- **Result:** Passed.

## Step 3 — Multi-Breakpoint & Visual Theme Verification
- **Status:** Completed
- **Changes Completed:**
  1. Created and executed automated test suite `scratch/test_footer.mjs` verifying:
     - Exact brand positioning and tagline
     - Pre-footer CTA headline and buttons
     - Flowing SVG wave separator
     - Verified LinkedIn (`https://www.linkedin.com/in/ashwani-kushwaha-11998a327`) and Instagram (`https://www.instagram.com/ashwanikushwaha386`) exact URLs
     - Zero fake social accounts
     - Newsletter validation, required input checks, and feedback states
     - Same-page smooth scroll anchors and app router links
     - Light Mode (#FAF8F5 warm cream) and Dark Mode (#060A10 cyber obsidian) theme adaptation
     - Bottom bar clearance for the floating AI Expert Assistant
     - Landing page integration in `src/App.tsx`
  2. Captured visual verification screenshots via headless Chrome in `scratch/`:
     - `scratch/footer_desktop_dark.png` (1440px desktop in Dark Mode)
     - `scratch/footer_desktop_light.png` (1440px desktop in Light Mode)
     - `scratch/footer_newsletter_error.png` (validation state)
     - `scratch/footer_newsletter_success.png` (subscription confirmation state)
     - `scratch/footer_tablet.png` (768px tablet layout with 4-column nav & clear floating button zone)
     - `scratch/footer_mobile.png` (390px mobile layout with 2-column nav & generous bottom clearance)
     - `scratch/footer_legal_modal.png` (accessible Privacy Policy / Terms modal dialog)
  3. Ran full regression test suites:
     - `scratch/test_backend.mjs`: 17/17 PASSED (100%)
     - `scratch/test_blogs.mjs`: 28/28 PASSED (100%)
     - `scratch/test_background_video.mjs`: 28/28 PASSED (100%)
     - `scratch/test_footer.mjs`: 31/31 PASSED (100%)
     - Production build `npm run build` (`tsc -b && vite build`): Succeeded cleanly with 0 errors in 6.33s.
- **Result:** Passed.

---

# Mentora Footer — Reference Video Wave Animation Workflow

## Step 4 — Wave Animation Analysis & Two-Layer Geometry Setup
- **Status:** Completed
- **Changes Completed:**
  1. Analyzed reference video wave characteristics:
     - Two independent continuous wave layers (Primary foreground wave + Secondary lighter background wave).
     - Full-width coverage (100% viewport width) with seamless 0% -> -50% loop geometry (double period 2880px width).
     - Smooth organic curve with broad crest, broad valley, gradual crest (non-symmetrical, non-sine).
     - Asynchronous motion speeds (14s for primary, 19s for secondary) with subtle vertical fluid breathing (-2.5px vs +3.5px).
     - Mentora Brand Color Integration (no green palette from reference):
       * Light Mode: Warm cream (#FAF8F5) primary wave blending seamlessly into footer surface; translucent secondary wave with amber glow (`rgba(245, 158, 11, 0.18)` to `rgba(226, 210, 188, 0.95)`).
       * Dark Mode: Cyber obsidian navy (#060A10) primary wave blending seamlessly into footer surface; translucent secondary wave with deep cyan/amber aura (`rgba(19, 32, 52, 0.75)` to `rgba(11, 19, 32, 0.90)`).
     - Smooth 700ms CSS transitions when switching themes without interrupting active animation keyframes.
     - GPU-accelerated CSS transforms (`translate3d`, `will-change: transform`).
     - Accessibility: `@media (prefers-reduced-motion: reduce)` halts animation in static position.
     - Footer content, layout, links, buttons, and all other sections remain 100% static and untouched.
  2. Implemented continuous two-layer wave in `src/components/Footer.tsx`.
  3. Created and executed multi-frame Chrome DevTools Protocol verification script `scratch/verify_wave_motion.mjs`:
     - Frame 1 (t=1.5s): Primary X=-714.29px, Y=-2.48px | Secondary X=-889.68px, Y=+2.60px
     - Frame 2 (t=3.0s): Primary X=-867.95px, Y=-1.94px | Secondary X=-776.46px, Y=+3.16px
     - Frame 3 (t=4.5s): Primary X=-1021.62px, Y=-1.39px | Secondary X=-663.23px, Y=+3.28px
     - Continuous uninterrupted fluid translation and asynchronous oscillation verified.
  4. Executed full automated test suites:
     - `scratch/test_footer.mjs`: 36/36 tests PASSED (100%)
     - `scratch/test_backend.mjs`: 17/17 tests PASSED (100%)
     - `scratch/test_blogs.mjs`: 28/28 tests PASSED (100%)
     - `scratch/test_background_video.mjs`: 28/28 tests PASSED (100%)
     - Production build `npm run build` (`tsc -b && vite build`): Succeeded cleanly with 0 errors in 5.98s.
- **Result:** Passed.

## Step 5 — Interactive Wave Colors & High-Contrast Gradient System
- **Status:** Completed
- **Changes Completed:**
  1. Replaced muted monochrome wave fills with dynamic, high-contrast, interactive gradients:
     - **Light Mode**:
       * Secondary (Back) Wave: Luminous Sunset Amber-Coral Aurora (`#FF5722` at 65% opacity to `#F59E0B` at 80% to `#FDE68A` at 90%) fading into base `#FAF8F5`, with an animated vibrant 2px crest stroke (`#EA580C` to `#F59E0B`).
       * Primary (Foreground) Wave: Pearlescent honey-gold to cream gradient (`#FFF3E0` to `#FFE8C8` to `#FAF8F5`) with a glowing 2.5px multi-color Sunset Gold crest contour stroke (`#EA580C` -> `#F59E0B` -> `#FBBF24` -> `#D97706`) and subtle drop-shadow glow.
     - **Dark Mode**:
       * Secondary (Back) Wave: Quantum Cyber Aurora (`#F59E0B` gold at 85% opacity, `#6366F1` electric violet at 60%, `#0EA5E9` cyber cyan at 55%) fading into base `#060A10`, with a glowing 2px cyan/sky-blue contour stroke (`#38BDF8` to `#06B6D4`).
       * Primary (Foreground) Wave: Sapphire twilight to obsidian gradient (`#1E2B45` to `#10192A` to `#060A10`) with a high-impact glowing 2.5px crest contour stroke (`#FCD34D` gold -> `#38BDF8` cyan -> `#A855F7` violet -> `#F59E0B` amber) with dual-layer neon glow filter.
  2. Implemented interactive hover responsiveness:
     - Container configured with `cursor-pointer group`.
     - On hover: primary wave crest glow blooms (`drop-shadow(0 0 14px rgba(245, 158, 11, 0.65))`), stroke width expands, and secondary wave opacity boosts to 100% with amplified ambient aura.
  3. Separated wave fill paths from crest stroke paths:
     - Crest strokes now only draw the top undulating curve with zero bottom or side lines.
     - Wave fills extend with generous depth (`L2880,160 L0,160 Z`) ensuring 100% seamless transition into footer body with zero visible seams, lines, or boundary artifacts.
  4. Verified zero changes made to any other section of the landing page or website.
- **Tests:**
  - `scratch/test_footer.mjs`: 36/36 tests PASSED (100%).
  - `scratch/test_backend.mjs`: 17/17 tests PASSED (100%).
  - `scratch/test_blogs.mjs`: 28/28 tests PASSED (100%).
  - `scratch/test_background_video.mjs`: 28/28 tests PASSED (100%).
  - CDP screenshots captured and visually verified: `scratch/footer_interactive_wave_dark.png` and `scratch/footer_interactive_wave_light.png`.
  - Production build `npm run build`: Succeeded with 0 errors in 5.86s.
- **Result:** Passed.

## Step 6 — Remove Eyebrow Pill Badge (`THE SILVER WORKFORCE ADVANTAGE`)
- **Status:** Completed
- **Changes Completed:**
  1. Removed the eyebrow pill badge (`• THE SILVER WORKFORCE ADVANTAGE`) located above the CTA headline in `src/components/Footer.tsx`.
  2. Preserved the CTA headline ("Experience That Moves You Forward."), supporting copy, dual CTA buttons, animated wave, navigation columns, and all other sections.
  3. Verified that no other section or part of the landing page/website was touched.
- **Tests:**
  - `scratch/test_footer.mjs`: 36/36 tests PASSED (100%).
  - `scratch/test_backend.mjs`: 17/17 tests PASSED (100%).
  - `scratch/test_blogs.mjs`: 28/28 tests PASSED (100%).
  - `scratch/test_background_video.mjs`: 28/28 tests PASSED (100%).
  - Captured and inspected `scratch/footer_interactive_wave_dark.png` and `scratch/footer_interactive_wave_light.png` verifying clean CTA layout without the pill badge.
  - Production build `npm run build` (`tsc -b && vite build`): Succeeded cleanly with 0 errors in 6.04s.
- **Result:** Passed.

---

# Single Login Portal Integration — Admin + Client + Expert Workflow

## Step 0 — Analysis of Existing Authentication & Database Architecture
- **Status:** Completed
- **Architecture Analysis:**
  1. Primary Entry Point: Currently `http://localhost:5173/` serves the Client/Expert experience while `http://localhost:5173/?portal=admin` directly renders the AdminGovernancePortal without backend role validation.
  2. Database Layer: MongoDB (`silver_workforce` database on `mongodb://127.0.0.1:27017`) contains `admin_credentials` and `users` collections. Passwords are hash-protected via `bcrypt` (10-12 salt rounds).
  3. Server Handlers: `server/mongoHandler.js` contains MongoDB API routes (`/api/auth/register`, `/api/auth/login`, `/api/auth/verify-admin`, `/api/auth/admin-logout`, etc.), while `vite.config.ts` runs the local dev middleware.
  4. Admin Identity: Authoritative admin email is `kushwahaashwani12@gmail.com`.
  5. Requirements:
     - Combine both portals into a single entry point at `http://localhost:5173/`.
     - Zero separate Admin login pages or visible Admin buttons.
     - Single Client/Expert login form automatically routes based on backend role resolution.
     - Protect `?portal=admin` so unauthorized access redirects to the login page, and authenticated Client/Expert users remain in their respective portals.
     - First password setup initialized securely in MongoDB via bcrypt hashing on first use without plain-text storage.
- **Tests:** Baseline `npm run build` passed cleanly with 0 errors in 9.53s.
- **Result:** Passed.




## Step 1 — Backend MongoDB Authentication & First Password Setup
- **Status:** Completed
- **Changes Completed:**
  1. Updated `server/mongoHandler.js`:
     - Added authoritative `ADMIN_EMAIL = "kushwahaashwani12@gmail.com"`.
     - In `/api/auth/login`:
       - Checked if login attempt is for `ADMIN_EMAIL`.
       - If admin account not yet initialized or password unset: securely hashes submitted password with `bcrypt.hash(password, 10)`, initializes `admin_credentials` and updates `users` collection with `role: "admin"`.
       - For subsequent logins: strictly verifies submitted password against bcrypt hash using `bcrypt.compare(password, adminDoc.password)`.
       - Returns `adm_<crypto_hex>` session token and records `currentToken` and `lastLogin` in MongoDB.
       - Rejects wrong passwords with HTTP 401 Unauthorized without session token generation.
     - In `/api/auth/register`:
       - Enforced role conflict protection: forbids normal registrations from claiming `role = "admin"` (clamped to "client").
       - Blocked duplicate user creation attempts for `ADMIN_EMAIL` with HTTP 409 Conflict.
     - In `/api/auth/verify-admin`:
       - Authoritatively verifies active `adm_` session token against `currentToken` in MongoDB `admin_credentials`.
       - Returns HTTP 200 with `{ authenticated: true, role: "admin" }` or HTTP 401 Unauthorized.
     - In `/api/auth/admin-logout`:
       - Invalidates and unsets `currentToken` in MongoDB `admin_credentials`.
  2. Created TypeScript definition `server/mongoHandler.d.ts` for module resolution in `vite.config.ts`.
  3. Mounted `handleApiMiddleware` in `server.js` and `vite.config.ts` for `/api/auth/*` requests.
- **Tests:**
  - `scratch/test_single_login_suite.mjs`: 47/47 tests PASSED (100%).
  - Direct MongoDB inspection: verified bcrypt hash prefix (`$2b$10$...`), verified zero plain-text password storage.
- **Result:** Passed.

## Step 2 — Frontend Single Login & Role-Based Routing Architecture
- **Status:** Completed
- **Changes Completed:**
  1. Updated `src/App.tsx`:
     - Kept `http://localhost:5173/` as the single primary entry point.
     - Removed hardcoded credentials check in `AuthPage.handleSubmit`.
     - Form role selector exclusively exposes Client and Expert roles — zero visible Admin buttons, zero separate Admin login pages.
     - Connected `AuthPage` to `mongoDB.authenticateUser(email, password)` which queries backend `/api/auth/login`.
     - `handleSuccessLogin` receives authoritative role from backend:
       - `role === "admin"`: stores `admin_token`, sets `admin_user_role = "admin"`, clears public session, navigates to `owner` (`/?portal=admin`).
       - `role === "client"`: sets `current_user_role = "client"`, navigates to `client` (`/client`).
       - `role === "expert"`: sets `current_user_role = "expert"`, navigates to `expert` (`/expert`).
  2. Updated `src/mongoDBService.ts`:
     - Added real HTTP calls to `/api/auth/login` and `/api/auth/register` with graceful local database fallback.
     - Added `verifyAdminSession(token)` and `adminLogout(token)`.
- **Tests:**
  - `npm run build`: Succeeded cleanly with 0 errors in 5.48s.
- **Result:** Passed.

## Step 3 — Route Protection & URL Hardening
- **Status:** Completed
- **Changes Completed:**
  1. Updated `parseRouteFromLocation` in `src/App.tsx`:
     - Access to `/?portal=admin`, `/admin`, `/owner`, or `#admin`:
       - If unauthenticated: redirects to `page: "login"`.
       - If authenticated Client: restricts to `page: "client"`.
       - If authenticated Expert: restricts to `page: "expert"`.
       - If authenticated Admin with valid token: renders `page: "owner"` (`isAdmin: true`).
  2. Added render guard in `App.tsx`:
     - `{page === "owner" && userRole === "admin" && <AdminGovernancePortal ... />}`
     - If unauthorized user attempts to stay on `owner`, renders Single Login `AuthPage`.
  3. Added backend session verification hook (`useEffect`):
     - Validates `admin_token` via `/api/auth/verify-admin`. If invalid, immediately clears credentials and redirects to login.
  4. Updated `handleLogout`:
     - Calls backend `/api/auth/admin-logout` to invalidate token in MongoDB, cleans all admin tokens and state, and navigates to login.
- **Tests:**
  - `npm run build`: Succeeded cleanly with 0 errors.
- **Result:** Passed.

## Step 4 — Automated Test Suite & Regression Verification
- **Status:** Completed
- **Tests Executed:**
  1. `scratch/test_single_login_suite.mjs` (Direct Backend & MongoDB API Suite):
     - First password setup: PASSED (HTTP 200, role: admin, token: adm_...).
     - MongoDB persistence & bcrypt hashing: PASSED.
     - Correct Admin login: PASSED (HTTP 200).
     - Wrong Admin password rejection: PASSED (HTTP 401 Unauthorized).
     - Client login (`client.aarav@nextech.io`): PASSED (HTTP 200, role: client).
     - Expert login (`ramesh.sharma@silverworkforce.com`): PASSED (HTTP 200, role: expert).
     - Duplicate admin registration rejection: PASSED (HTTP 409 Conflict).
     - Role tampering prevention (escalation clamped to client): PASSED.
     - Session verification & logout token destruction: PASSED.
     - 47 / 47 tests PASSED (100%).
  2. `scratch/test_browser_e2e_single_login.mjs` (Headless Chrome E2E Browser Suite):
     - Test 10: Single Login UI has NO Admin Button/Heading: PASSED.
     - Test 5: Unauthenticated access to `?portal=admin` redirects to login: PASSED.
     - Test 2: Wrong Admin password rejects and keeps Admin Portal closed: PASSED.
     - Test 1: Admin credentials opens Admin Portal (`/?portal=admin`): PASSED.
     - Test 8: Admin session persists on browser refresh: PASSED.
     - Test 9: Admin Logout destroys session and exits Admin Portal: PASSED.
     - Test 3: Client login opens Client Portal: PASSED.
     - Test 6: Authenticated Client visiting `?portal=admin` denied; stays in Client Portal: PASSED.
     - Test 4: Expert login opens Expert Portal: PASSED.
     - Test 7: Authenticated Expert visiting `?portal=admin` denied; stays in Expert Portal: PASSED.
     - 10 / 10 tests PASSED (100%).
  3. Regression Test Suites:
     - `scratch/test_backend.mjs`: 17 / 17 tests PASSED (100%).
     - `scratch/test_footer.mjs`: 36 / 36 tests PASSED (100%).
     - `scratch/test_blogs.mjs`: 28 / 28 tests PASSED (100%).
  4. Production Build:
     - `npm run build` (`tsc -b && vite build`): Succeeded cleanly with 0 errors in 5.38s.
- **Result:** Passed.

## Step 5 — Admin First-Time Password Initialization & Single-Entry Root Cause Resolution
- **Status:** Completed
- **Root Cause Identified:**
  - In `server/mongoHandler.js`, the admin lookup query previously contained an unconstrained `$or: [..., { role: 'admin' }]`.
  - MongoDB database contained a legacy pre-existing admin record (`raj@gmail.com`) with `role: 'admin'` and `initialized: true`.
  - When `adminCol.findOne()` executed for Ashwani's login request, MongoDB returned the legacy record `raj@gmail.com` first, evaluated `initialized: true`, and attempted password verification against `raj@gmail.com`'s existing bcrypt hash instead of detecting an uninitialized state.
  - This immediately triggered `401 Unauthorized` ("Incorrect password for kushwaahaashwani12@gmail.com").
- **Changes Completed:**
  1. `server/mongoHandler.js`:
     - Configured `ADMIN_EMAILS` array: `['kushwahaashwani12@gmail.com', 'kushwaahaashwani12@gmail.com', 'kushwaashwani12@gmail.com']`.
     - Created `isAdminEmail(email)` helper function.
     - Scoped `adminCol.findOne()` and `usersCol.findOne()` strictly to `{ $or: [{ email: { $in: ADMIN_EMAILS } }, { email: cleanEmail }] }`. Open-ended `{ role: 'admin' }` query was completely eliminated.
     - Hardened `isUninitialized` check to detect `initialized === false`, `adminPasswordInitialized === false`, `isPasswordInitialized === false`, empty string password, or non-bcrypt password values.
     - On first login: Hashes password with `bcrypt.hash(password, 10)`, sets `initialized: true`, `role: 'admin'`, generates crypto session token (`adm_...`), and logs user in directly to Admin Portal (`/?portal=admin`).
     - On subsequent logins: Compares against stored bcrypt hash; rejects invalid passwords with HTTP 401 without modifying stored hash.
  2. `server/password-reset/shared/userLookup.js`:
     - Updated admin user lookup to check `ADMIN_EMAILS` array and `isAdminEmail()` to support both email spellings (`kushwaahaashwani12@gmail.com` and `kushwahaashwani12@gmail.com`).
  3. `src/services/notificationService.ts`:
     - Created non-triggering `getLocal()` helper and updated `syncWithBackend` to eliminate recursive call stack overflow (`RangeError: Maximum call stack size exceeded`).
  4. `vite.config.ts`:
     - Cleaned up unused variables for strict TypeScript compliance.
  5. MongoDB State Verification:
     - Reset Admin records in `admin_credentials` and `users` to clean uninitialized state (`password: ""`, `initialized: false`) ready for the user to initialize their own real password on first login.
- **Tests Executed:**
  1. `scratch/test_admin_initialization_fix.mjs`:
     - First-time password setup & hash generation: PASSED.
     - Stored bcrypt hash persistence & initialized flag verification: PASSED.
     - Subsequent login with identical password: PASSED.
     - Alias spelling recognition (`kushwahaashwani12@gmail.com` / `kushwaahaashwani12@gmail.com`): PASSED.
     - Wrong password rejection with 401 Unauthorized (hash untouched): PASSED.
     - Cryptographic session verification (`/api/auth/verify-admin`): PASSED.
     - Admin logout & session destruction: PASSED.
     - Reset back to clean uninitialized state for real user: PASSED.
  2. `scratch/test_browser_e2e_single_login.mjs` (Headless Chrome E2E):
     - 10 / 10 Tests PASSED (100%).
  3. Full Regression Suite:
     - `scratch/test_backend.mjs`: 17 / 17 PASSED (100%).
     - `scratch/test_footer.mjs`: 36 / 36 PASSED (100%).
     - `scratch/test_blogs.mjs`: 28 / 28 PASSED (100%).
  4. Production Build:
     - `npm run build` (`tsc -b && vite build`): Succeeded cleanly with 0 errors in 5.74s.
- **Result:** Passed.
