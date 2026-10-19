# Error Log

## [Step 0] Baseline Verification
- Error: None
- Location: Workspace root
- Cause: N/A
- Fix: N/A
- Verification: Ran npm run build (tsc -b && vite build) - passed with 0 errors.
- Status: Resolved

## [Step 2] TypeScript Build Error: TS6133 Unused Variable in vite.config.ts
- Error: vite.config.ts(509,19): error TS6133: 'newDate' is declared but its value is never read.
- Location: vite.config.ts line 509
- Cause: `newDate` was declared for the updated date check but `payload.availabilityDate` was referenced instead in the condition.
- Fix: Referenced `newDate` in the past date validation check: `if (newDate < getTodayString())`.
- Verification: Re-ran `npm run build` (`tsc -b && vite build`), build succeeded with 0 errors.
- Status: Resolved

## [Step 5] TypeScript Build Error: TS2554 Expected 0 arguments, but got 1 in src/App.tsx
- Error: src/App.tsx(1992,62): error TS2554: Expected 0 arguments, but got 1.
- Location: src/App.tsx line 1992 and src/mongoDBService.ts line 3027
- Cause: `mongoDB.getLocalAvailabilities()` initially defined with 0 parameters while `BookingModal` passed `expert.id`.
- Fix: Added optional `expertId?: string` parameter to `getLocalAvailabilities(expertId?: string)` in `src/mongoDBService.ts` with filtering.
- Verification: Re-ran `npm run build`, build passed with 0 errors.
- Status: Resolved

## [Project Review - Step 1] Baseline Verification
- Error: None
- Location: Workspace root
- Cause: N/A
- Fix: N/A
- Verification: Ran `npm run build` (`tsc -b && vite build`) - passed with 0 errors.
- Status: Resolved

## [Project Review - Step 2] Backend Data Model & API Test
- Error: None
- Location: `vite.config.ts`, `server.js`, `src/types/index.ts`, `src/mongoDBService.ts`
- Cause: N/A
- Fix: N/A
- Verification: Ran `scratch/test_project_reviews_backend.mjs` - all 36 tests passed. Ran `npm run build` - 0 errors.
- Status: Resolved

## [Project Review - Step 5] TypeScript Build Error: Property 'user' does not exist on type 'ProjectReviewActivity'
- Error: `src/components/ProjectReviewWorkspace.tsx(1504,80): error TS2339: Property 'user' does not exist on type 'ProjectReviewActivity'.`
- Location: `src/components/ProjectReviewWorkspace.tsx` line 1504
- Cause: The interface defined `userId` and `userName`, but fallback accessed `act.user`.
- Fix: Changed to `act.userName || act.userId || 'System'`.
- Verification: Re-ran `npm run build`, build passed with 0 errors.
- Status: Resolved

## [Project Review - Step 3 & 4] TypeScript Build Errors in ClientPage & ExpertPage Integration
- Error: 
  * `TS2339: Property 'id' does not exist on type 'ProjectReviewRecord'` (authoritative field is `projectReviewId`).
  * `TS2367: Status comparisons with snake_case strings ('pending_expert_acceptance', etc.) rather than PascalCase 'ProjectReviewStatus' enums ('PendingExpertAcceptance', etc.)`.
  * `TS2322: Missing/incorrect props for ProjectReviewWorkspace and ProjectReviewRequestModal`.
  * `TS2304: Cannot find name 'customUpiId'` in ClientPage.
  * `TS2559: Type 'string' has no properties in common with type '{ id?: string; role?: string; reason?: string }'` in `respondProjectReview`.
- Location: `src/App.tsx` lines 4247, 4628, 4670, 4692, 5094, 5110, 5201, 5232, 6800, 6841, 6876, 7655.
- Cause: Initial view integration referenced prototype field names (`id`, snake_case enums, missing UPI state) instead of the authoritative `ProjectReviewRecord` types.
- Fix: 
  * Updated all references to use `projectReviewId`.
  * Used authoritative `ProjectReviewStatus` and `ProjectReviewPaymentStatus` enums (`PendingExpertAcceptance`, `Accepted`, `InReview`, `ReviewCompleted`, `PaymentSuccessful`, etc.).
  * Added `const [customUpiId, setCustomUpiId] = useState("");` in `ClientPage`.
  * Aligned `ProjectReviewRequestModal` and `ProjectReviewWorkspace` prop names (`onRequestSuccess`, `projectReviewId`, `userRole`, `onRefreshList`).
  * Corrected `respondProjectReview` payload signature to `{ id, role, reason }`.
- Verification: Ran `npm run build` (`tsc -b && vite build`) - 0 errors, build succeeded cleanly in 5.25s. Ran `node scratch/test_project_reviews_backend.mjs` (36/36 passed) and `node scratch/test_backend.mjs` (17/17 passed).
- Status: Resolved

## [PNG Document Audit & View Workflow] Investigation & Reproduction
- Error: Uploaded PNG documents (e.g. Work Experience, Offer Letter) appear in Expert Portal and can be viewed locally via HEAD check, but when Admin audits the expert and clicks "View Document", the document cannot be properly rendered or displayed, failing with invalid MIME type (`application/pdf`) and corrupted alias extension (`.pdf`).
- Location:
  * `vite.config.ts`: Lines 1481, 1489, 1525
  * `src/components/DocumentViewerModal.tsx`: Lines 15, 60, 87, 139, 192-225, 306
  * `src/utils/pdfGenerator.ts`: Line 204
  * `src/components/AdminGovernancePortal.tsx`: Lines 3965, 4024
  * `src/mongoDBService.ts`: Lines 271, 287
- Root Cause:
  1. Backend `GET /api/documents` hardcodes `Content-Type: application/pdf` (line 1481) and hardcodes `data:application/pdf;base64,...` (line 1489) regardless of the actual file extension (e.g., `.png`, `.jpg`).
  2. Backend `POST /api/documents` hardcodes `.pdf` alias extension: `${path.basename(payload.id)}.pdf` (line 1525) instead of preserving the original file's extension (`.png`), causing id-based lookups to serve PNG binary data under a `.pdf` name and `application/pdf` MIME type.
  3. `DocumentViewerModal.tsx` attempts to load all documents (including images) inside an `<iframe src={`${blobUrl}#toolbar=1&navpanes=0...`}>` intended exclusively for PDFs, with no `<img>` rendering path for image formats (`.png`, `.jpg`, `.jpeg`, `.webp`).
  4. When `createBlobUrlFromDataUrl` processes `data:application/pdf;base64,...` for a PNG, it creates a Blob with MIME type `application/pdf`. When Chromium/Edge's PDF viewer (PDFium) tries to parse the PNG file header, it fails to load the PDF document.
- Fix:
  1. In `vite.config.ts`, added `getDocumentMimeType` to detect MIME type from extension (`.png` -> `image/png`, `.jpg`/`.jpeg` -> `image/jpeg`, `.webp` -> `image/webp`, `.pdf` -> `application/pdf`).
  2. In `vite.config.ts`, updated `POST /api/documents` to preserve the original file extension for ID alias files (`${id}${ext}`).
  3. In `vite.config.ts`, updated `GET /api/documents` to return the correct MIME type on raw streaming and in the `fileData` data URL (`data:${mimeType};base64,...`).
  4. In `src/utils/pdfGenerator.ts`, updated `createBlobUrlFromDataUrl` to accept `fallbackFileName` and infer correct image MIME types.
  5. In `src/components/DocumentViewerModal.tsx`, added `isImage` detection and rendered responsive `<img>` for image formats, maintaining `<iframe>` for PDF documents.
  6. In `src/components/AdminGovernancePortal.tsx` and `src/App.tsx`, added direct static `/uploaded_docs/` checks matching Expert Portal behavior.
  7. In `src/mongoDBService.ts`, updated `getDocFile` to prioritize static URL and normalize mismatched MIME prefixes.
- Verification:
  * Ran `node scratch/test_e2e_document_workflow.mjs` (PNG & PDF workflow: 100% pass).
  * Ran `node scratch/test_backend.mjs` (17/17 pass).
  * Ran `node scratch/test_project_reviews_backend.mjs` (36/36 pass).
  * Ran `npm run build` (`tsc -b && vite build`): 0 errors, build succeeded.
- Status: Resolved

## [Notification Management System - Step 1] Investigation & Failure Identification
- Error: 
  1. Admin Portal -> Notification Management -> "Send Broadcast" shows a client-side success message, but notifications are not actually delivered to destination portals (Expert Portal, Client Portal, Landing Page) across separate sessions/devices or persisted in backend database.
  2. "Landing Page" is missing from the Audience selector in `NotificationManagementDesk.tsx` (`targetAudience` only offers `all`, `client`, `expert`, `custom`).
  3. No backend API endpoint exists for notifications (`/api/notifications` missing in `vite.config.ts` and `server.js`).
  4. `db.json` lacks a `notifications` collection.
  5. `notificationService.getForUser` leaks private individual notifications across users of the same role (e.g. notifications for `exp-1` visible to `exp-2`), and leaks private notifications to anonymous Landing Page visitors when `!role && !recipientId`.
- Location:
  * `src/components/NotificationManagementDesk.tsx`: Lines 61, 805-817, 176-185
  * `src/services/notificationService.ts`: Lines 49-162
  * `src/services/notificationEngine.ts`: Lines 209-220, 718-773
  * `src/types/index.ts`: Lines 145, 181-198, 223-239
  * `vite.config.ts`: `sharedDbPlugin` missing `/api/notifications` routes
  * `server.js`: Missing `NotificationSchema` and Express routes
  * `db.json`: Missing `notifications` collection
- Root Cause:
  1. The notification system was implemented purely as a frontend localStorage abstraction with no backend REST API or database persistence.
  2. The target audience selector omitted the "Landing Page" option.
  3. Audience resolution in `notificationEngine.ts` and filtering in `notificationService.ts` did not enforce recipient-specific isolation and lacked landing-specific query handling.
- Fix:
  1. Defined complete backend REST API in `vite.config.ts` (`sharedDbPlugin`) and `server.js` with endpoints:
     - `GET /api/notifications` (supports role, recipientId, unreadOnly, strict audience isolation)
     - `POST /api/notifications` (persists broadcast and individual dispatches)
     - `POST /api/notifications/mark-read`
     - `POST /api/notifications/mark-all-read`
     - `POST /api/notifications/clear`
  2. Initialized `notifications: []` collection in `db.json`.
  3. Added `landing` audience to `NotificationTarget`, `NotificationManagementDesk.tsx` dropdown, and `notificationEngine.ts`.
  4. Updated `notificationService.ts` to sync with `/api/notifications`, update database, cache in localStorage, handle cross-tab storage events, and sort newest first (`createdAt DESC`).
  5. Enforced strict isolation in `getForUser`:
     - Experts receive only Expert broadcasts, platform broadcasts, and their own individual alerts.
     - Clients receive only Client broadcasts, platform broadcasts, and their own individual alerts.
     - Landing page / Public visitors receive ONLY public announcements and landing broadcasts (zero private leakage).
     - Individual alerts for user A (e.g. `exp-1`) are never visible to user B (e.g. `exp-2`).
  6. Connected Landing Page to active public broadcast banner with live dismiss and mark-as-read capability.
- Verification:
  1. `scratch/test_notifications_backend.mjs`: 31/31 unit/integration tests PASSED (100%).
  2. `scratch/test_notifications_e2e_ui.mjs`: 23/23 live Chrome browser E2E tests PASSED (100%):
     - Admin Broadcast to Experts -> DB persistence verified -> Expert Portal delivery verified.
     - Admin Broadcast to Clients -> DB persistence verified -> Client Portal delivery verified -> Zero leak into Expert Portal verified.
     - Admin Broadcast to Landing Page -> DB persistence verified -> Landing Page banner & NotificationCenter verified -> Zero leak of client/expert private alerts verified.
     - Admin Individual alert to `exp-1` -> `exp-1` received -> `exp-2` strictly isolated (zero leak) verified.
     - Mark Read & Persistence across full browser page refresh verified.
  3. Regression Test Suites:
     - Availability (`scratch/test_backend.mjs`): 17/17 PASSED (100%).
     - Project Reviews (`scratch/test_project_reviews_backend.mjs`): 36/36 PASSED (100%).
     - Document Workflow (`scratch/test_e2e_document_workflow.mjs`): 100% PASSED.
  4. Production Build (`npm run build`): Passed cleanly with 0 errors in 4.86s.
- Status: Resolved

## [Notification Center UI Display Bug - Client & Expert Portals] Bell Icon Click Not Displaying Notification Drawer
- Error:
  * In both the Client Portal and Expert Portal, clicking the notification bell icon next to the theme toggle (`🌙 Dark` / `☀️ Light`) does not show the notification drawer/popover. The red badge appears, but the drawer remains hidden/invisible.
- Location:
  * `src/App.tsx`: Lines 4819 (ClientPage `<header>`) and 7352 (ExpertPage `<header>`)
  * `src/components/NotificationCenter.tsx`: Lines 110-125, 184-220
- Root Cause:
  1. Both the ClientPage and ExpertPage `<header>` containers were styled with `overflow-hidden` without an explicit z-index (`overflow-hidden backdrop-blur-xl`).
  2. Because `<header>` had `overflow: hidden`, any absolutely positioned child elements extending below the 70px header boundary (such as the notification popover drawer, which has `maxHeight: 540px` and drops down `mt-3`) were clipped by the browser rendering engine at the header's bottom border, making the drawer completely invisible to the user.
  3. The trigger `<button>` in `NotificationCenter.tsx` did not invoke `e.stopPropagation()`, allowing clicks to bubble up.
  4. The root container of `NotificationCenter.tsx` had `z-index: auto` rather than an explicit high stacking layer (`z-40`), and the popover lacked an `e.stopPropagation()` guard.
- Fix:
  1. In `src/App.tsx`, removed `overflow-hidden` from the `<header>` element in both `ClientPage` (line 4819) and `ExpertPage` (line 7352), replacing it with `relative z-30 backdrop-blur-xl`.
  2. Isolated `overflow-hidden` strictly to the canvas containers for `GlobeGraphic` and `TrophyGraphic` so 3D canvases remain contained without clipping header dropdowns.
  3. In `src/components/NotificationCenter.tsx`, added `e.stopPropagation()` to the bell button click handler and popover drawer container.
  4. Elevated `NotificationCenter` root wrapper to `relative inline-block z-40`.
  5. Added `touchstart` event support to `handleClickOutside` for touch devices.
- Verification:
  1. Live Chrome CDP automated test (`scratch/test_portal_bell_interactions.mjs`):
     - Client Portal: Drawer opens visibly upon clicking bell icon (verified bounding rect and visible styles) [PASS].
     - Client Portal: Toggles closed upon clicking bell again [PASS].
     - Client Portal: Closes upon clicking outside [PASS].
     - Expert Portal: Drawer opens visibly upon clicking bell icon [PASS].
     - Expert Portal: Toggles closed upon clicking bell again [PASS].
     - Expert Portal: Drawer opens visibly in Light Theme [PASS].
     - All 8 interaction tests passed (100%).
  2. Captured visual verification screenshots:
     - `client_portal_bell_drawer_open.png` (220586 bytes): Drawer fully visible and interactive in Client Portal.
     - `expert_portal_bell_drawer_open.png` (234083 bytes): Drawer fully visible and interactive in Expert Portal.
     - `expert_portal_light_drawer_open.png` (220429 bytes): Drawer fully visible and responsive in Light theme.
  3. Full E2E & Backend Test Suites:
     - `scratch/test_notifications_e2e_ui.mjs`: 23/23 PASSED (100%).
     - `scratch/test_notifications_backend.mjs`: 31/31 PASSED (100%).
     - `scratch/test_backend.mjs` (Availability): 17/17 PASSED (100%).
     - `scratch/test_project_reviews_backend.mjs`: 36/36 PASSED (100%).
  4. Production Build (`npm run build`): `tsc -b && vite build` completed cleanly with 0 errors in 4.32s.
- Status: Resolved

## [Project Review Pricing - Step 1] Existing System Analysis & Baseline Verification
- Error: None
- Location: Workspace root, vite.config.ts, server.js, db.json, src/components/
- Cause: N/A
- Fix: N/A
- Verification: Ran baseline tests:
  * scratch/test_project_reviews_backend.mjs (36/36 passed)
  * scratch/test_backend.mjs (17/17 passed)
  * npm run build (tsc -b && vite build passed with 0 errors)
- Status: Resolved

## [Project Review Pricing - Step 2] TypeScript Build Errors in AdminGovernancePortal.tsx
- Error:
  * `AdminGovernancePortal.tsx(2154,42): error TS2339: Property 'projectRate' does not exist on type '{ base: number; markup: number; }'`
  * `AdminGovernancePortal.tsx(2157,60): error TS2345: Argument of type '"projectRate"' is not assignable to parameter of type '"base" | "markup"'`
- Location: `src/components/AdminGovernancePortal.tsx` lines 1219, 1238, 2154.
- Cause: `markupState` type was strictly typed as `Record<string, { base: number; markup: number }>` and `handleMarkupChange` parameter restricted to `"base" | "markup"`.
- Fix: Updated `markupState` type definition to include optional `projectRate?: number` and extended `handleMarkupChange` fieldName parameter to `"base" | "markup" | "projectRate"`.
- Verification: Re-ran `npm run build` (`tsc -b && vite build`) — completed cleanly with 0 errors in 4.77s. Ran `node scratch/test_step2_expert_pricing.mjs` — 28/28 tests passed (100%).
- Status: Resolved

## [Project Review Pricing - Step 3] Admin Price Control & Authorization Verification
- Error: None
- Location: `vite.config.ts`, `server.js`, `src/components/AdminProjectReviewDesk.tsx`, `src/components/AdminGovernancePortal.tsx`
- Cause: N/A
- Fix: N/A
- Verification: Ran `scratch/test_step3_admin_pricing.mjs` — 22/22 tests passed (100%). Admin-set price ₹1,500 → ₹1,200 immediately synchronized across Admin, Expert, and Client portals with disk persistence and audit log creation.
- Status: Resolved

## [Project Review Pricing - Step 4] Two-Way Alternating Dynamic Synchronization Verification
- Error: None
- Location: `vite.config.ts`, `server.js`, `db.json`, `src/mongoDBService.ts`
- Cause: N/A
- Fix: N/A
- Verification: Ran `scratch/test_step4_two_way_sync.mjs` — 31/31 tests passed (100%).
  * Baseline ₹1,000 verified across Expert, Admin, and Client portals.
  * Expert update (₹1,000 -> ₹1,500) synchronized immediately to Admin and Client portals.
  * Admin update (₹1,500 -> ₹1,200) synchronized immediately to Expert and Client portals.
  * Expert update (₹1,200 -> ₹1,800) synchronized immediately to Admin and Client portals.
  * Admin update (₹1,800 -> ₹900) synchronized immediately to Expert and Client portals.
  * Disk persistence in db.json confirmed (rate = ₹900).
  * 5 simulated concurrent tab queries all returned ₹900.
  * Full audit trail recorded in pricingAuditLogs.
- Status: Resolved

## [Project Review Pricing - Step 5] Platform Fee Management & Service Isolation
- Error: None
- Location: `vite.config.ts`, `server.js`, `src/components/AdminProjectReviewDesk.tsx`, `src/mongoDBService.ts`
- Cause: N/A
- Fix: Synchronized `server.js` request endpoint to compute `price`, `platformFee`, and `expertEarning` authoritatively from database expert records and `projectReviewConfig`.
- Verification: Ran `scratch/test_step5_platform_fee.mjs` — 30/30 tests passed (100%).
  * Role authorization strictly blocks Client & Expert access to platform fee config (HTTP 403).
  * Admin fee updates for percentage (20%), fixed (₹150), and boundary values (0%, 100%) succeeded (HTTP 200).
  * Boundary validation blocks negative values, non-numeric values, invalid types, and > 100% percentages (HTTP 400).
  * 1-Hour Call rates across all platform experts verified 100% isolated and unchanged.
  * Audit log integrity confirmed.
- Status: Resolved

## [Project Review Pricing - Step 6] Payment Integration & Historical Price Snapshot Preservation
- Error: None
- Location: `vite.config.ts`, `server.js`, `db.json`
- Cause: N/A
- Fix: N/A
- Verification: Ran `scratch/test_step6_payment_integration.mjs` — 41/41 tests passed (100%).
  * Backend calculated authoritative price ₹1,500 and ignored client payload tampering.
  * Client wallet deducted by ₹1,500.
  * Subsequent rate reduction to ₹900 and fee change to ₹150 did not alter historical Review 1 snapshot (retained ₹1,500 price, ₹225 fee, ₹1,275 earning).
  * Review 1 lifecycle completed and released exact snapshot payout (₹1,275) to Expert wallet.
  * Review 2 booked at new active rate (₹900, fee ₹150, earning ₹750).
  * Both reviews coexisted with zero leakage or recalculation.
- Status: Resolved

## [Project Review Pricing - Step 7] Final Regression & Full Platform Security Verification
- Error: None
- Location: Entire workspace ('src/', 'vite.config.ts', 'server.js', 'db.json')
- Cause: N/A
- Fix: N/A
- Verification:
  * npm run build completed with 0 errors in 5.10s.
  * 205 automated tests executed across 7 comprehensive test suites with 100% pass rate.
  * Verified strict price boundary of ₹0 to ₹2,000 across all portals and backend endpoints.
  * Verified single authoritative source of truth in backend database with zero desynchronization.
  * Verified historical snapshot immutability for all past transactions.
  * Verified total service isolation: 1-Hour Call rates, availability schedules, and wallets remain completely unaffected.
- Status: Resolved

## [Simple Additive Pricing Model - Step 1] Baseline & Requirements Alignment
- Error: None
- Location: Workspace root, vite.config.ts, server.js, src/components/
- Cause: N/A
- Fix: N/A
- Verification: Baseline npm run build passed with 0 errors. Additive model specified: Client Price = Expert Price + Platform Charge.
- Status: Resolved

## [Simple Additive Pricing Model - Step 2] Client Portal Breakdown & Modal Integration
- Error: None
- Location: `src/components/ProjectReviewRequestModal.tsx`, `src/components/ProjectReviewWorkspace.tsx`, `vite.config.ts`, `server.js`
- Cause: N/A
- Fix:
  1. Updated `src/components/ProjectReviewRequestModal.tsx` to query `/api/project-reviews/pricing` and display transparent pricing breakdown:
     - Expert Review Charge: ₹X
     - Platform Charge: ₹Y
     - Total Amount: ₹(X + Y)
  2. Bound Client Wallet Escrow Indicator, booking submit button, and multi-party notifications to authoritative Total Amount.
  3. Cleaned up obsolete percentage labels in `src/components/ProjectReviewWorkspace.tsx` to `Expert Earning` and `Platform Charge`.
  4. Hardened role-based endpoint authorization in `vite.config.ts` and `server.js` (immediate 403 when expert role attempts to modify mismatching expertId).
- Verification:
  * `scratch/test_simple_pricing_sync.mjs`: 79/79 PASSED (100%).
  * `scratch/test_backend.mjs`: 17/17 PASSED (100%).
  * `scratch/test_project_reviews_backend.mjs`: 36/36 PASSED (100%).
  * `npm run build`: 0 errors, build completed in 4.81s.
- Status: Resolved





## [Project Review Platform Fee Persistence Bug] Platform Fee Resetting to ₹150 on Save/Refresh/Reload
- Error:
  * Admin Platform Fee displays ₹150. When Admin edits the fee (e.g. to ₹200) and clicks "Save Platform Charge", the value resets back to ₹150 after save, page refresh, or logout/login.
- Location:
  * `src/components/AdminProjectReviewDesk.tsx`
  * `src/mongoDBService.ts`
  * `vite.config.ts`
  * `server.js`
- Root Cause:
  1. `AdminProjectReviewDesk.tsx` initialized `platformFeeConfig` to `{ feeType: 'percentage', feeValue: 15 }`. For a ₹1,000 expert, 15% evaluated to ₹150.
  2. Input remained in `feeTypeInput === 'percentage'` mode by default, so entering a rupee amount like 200 was blocked by the percentage <= 100 validation check.
  3. Action button was labeled `Update Platform Fee` instead of `Save Platform Charge`.
  4. Backend fallbacks in `vite.config.ts` and `server.js` hardcoded `{ feeType: 'percentage', feeValue: 15 }` (calculating ₹150 for ₹1,000 rate).
  5. `mongoDBService.ts` did not cache `db.projectReviewConfig` in localStorage during `pullServerDb()`.
- Fix Plan & Implementation:
  1. Defaulted Platform Fee configuration across frontend (`AdminProjectReviewDesk.tsx`, `ProjectReviewRequestModal.tsx`) and backend (`vite.config.ts`, `server.js`) to `{ feeType: 'fixed', feeValue: 150 }`.
  2. Cached `projectReviewConfig` in localStorage key `mongo_project_review_config` during `pullServerDb()`, `getProjectReviewPlatformFee()`, and `updateProjectReviewPlatformFee()`.
  3. Added direct call to `mongoDB.getProjectReviewPlatformFee()` in `AdminProjectReviewDesk.tsx` on mount, refresh, and save.
  4. Updated action button label to `Save Platform Charge` (`Saving...` during mutations).
  5. Updated Client transparent breakdown in `ProjectReviewRequestModal.tsx` to read dynamic platform fee from cache and `/api/project-reviews/pricing`.
- Verification:
  * Ran `scratch/test_platform_fee_persistence.mjs`: 42/42 tests PASSED (100%).
    - Edit ₹150 -> ₹200 and Save Platform Charge: Verified.
    - Permanent persistence in `db.json`: Verified (`feeValue: 200`).
    - Page refresh simulation: Verified (remains ₹200).
    - Logout/login simulation: Verified (remains ₹200).
    - Client transparent breakdown & payment deduction: Verified (Expert ₹1,000 + Platform Fee ₹200 = Client Total ₹1,200).
    - Changed ₹200 -> ₹250 and full cycle repeated: Verified.
    - Full server restart: Verified (persisted ₹250 survived restart, zero reset to ₹150).
  * Regression Suites:
    - `scratch/test_simple_pricing_sync.mjs`: 79/79 PASSED (100%).
    - `scratch/test_backend.mjs`: 17/17 PASSED (100%).
    - `scratch/test_project_reviews_backend.mjs`: 36/36 PASSED (100%).
  * Production Build: `npm run build` completed cleanly with 0 errors in 3.90s.
- Status: Resolved

## [Global Dynamic Platform Charge Synchronization] Single Dynamic Authoritative Source of Truth
- Error:
  * Platform Charge configuration is not yet exposed via a unified standard schema (`platformCharge` with currency, feeType, feeValue, updatedAt) in `db.json`.
  * `/api/platform-settings` endpoint is missing, and routes only listen on `/api/project-reviews/platform-fee`.
  * Success message in Admin UI did not strictly match user specification (`✓ Platform charge updated successfully`).
  * Modal labels in Client Portal (`ProjectReviewRequestModal.tsx`) used `Expert Review Charge:` instead of `Project Price:`, and did not react dynamically to live Admin updates without page refresh.
- Location:
  * `db.json`
  * `vite.config.ts`
  * `server.js`
  * `src/mongoDBService.ts`
  * `src/components/AdminProjectReviewDesk.tsx`
  * `src/components/ProjectReviewRequestModal.tsx`
- Root Cause:
  * Multiple historical naming conventions (`platformFeeConfig`, `projectReviewConfig`, `platformCharge`) existed across backend controllers without a single unified schema and unified aliases.
  * Real-time multi-tab and in-app event dispatching was missing for instant client synchronization.
- Fix Plan:
  1. Initialize `db.platformCharge` alongside `db.projectReviewConfig` in `db.json` and backend readers with `{ feeType, feeValue, currency: "INR", updatedAt, updatedBy }`.
  2. Implement unified API routes in `vite.config.ts` and `server.js`: `GET/PUT/POST /api/platform-settings` and `GET/POST/PUT /api/project-reviews/platform-fee`.
  3. Push comprehensive audit logs with `{ oldValue, newValue, changedBy, changedAt, changeType: "platform_charge" }` in `pricingAuditLogs`.
  4. Align Admin UI title to `Platform Charge`, dropdown options to `Fixed Amount` and `Percentage`, button to `Save Platform Charge`, and feedback to `✓ Platform charge updated successfully`.
  5. Align Client UI breakdown labels to `Project Price:`, `Platform Charge:`, `Total:`, and add reactive event listeners (`platform_fee_updated` and `storage`).
  6. Ensure historical bookings preserve immutable snapshot fields (`expertCharge`, `platformFee`, `platformCharge`, `price`, `paidAmount`).
  7. Protect 1-Hour Call rates and availability from any regression.
- Verification:
  * Ran `scratch/test_dynamic_platform_charge.mjs`: 64/64 PASSED (100%).
    - Test 1 (Initial DB = 200 -> Client = 200, Total = 1200): Verified.
    - Test 2 (Admin changes 200 -> 300 -> DB = 300, Admin UI = 300, Client UI = 300, Total = 1300): Verified.
    - Test 3 (Reload / fresh queries verify 300 persists): Verified.
    - Test 4 (Simulated restart verifies persistent disk survival): Verified.
    - Test 5 (Admin changes 300 -> 500 -> all update to 500, Total = 1500): Verified.
    - Test 6 (Validation of negative, non-numeric, >100% percentage, and unauthorized access rejected): Verified.
    - Test 7 (Historical transaction snapshot immutability across subsequent rate/fee changes): Verified.
    - Test 8 (Audit history verification with oldValue, newValue, changedBy, changedAt): Verified.
    - Test 9 (1-Hour Call rate isolation): Verified.
  * Ran regression suites:
    - `scratch/test_platform_fee_persistence.mjs`: 42/42 PASSED (100%).
    - `scratch/test_simple_pricing_sync.mjs`: 79/79 PASSED (100%).
    - `scratch/test_backend.mjs`: 17/17 PASSED (100%).
    - `scratch/test_project_reviews_backend.mjs`: 36/36 PASSED (100%).
  * Production build: `npm run build` succeeded with 0 errors in 4.06s.
- Status: Resolved



## [Project Review Form Fee Synchronization] Cross-Form Real-Time Dynamic Propagation
- Error:
  * In the Project Review Request modal form (`ProjectReviewRequestModal.tsx`), when Admin changes the Platform Charge in the Admin Portal, the pricing in the form does not update dynamically in real time without manually closing and reopening the modal or page refresh.
  * In `ProjectReviewRequestModal.tsx`, the initial state does not properly evaluate percentage fees, treating percentage numbers as flat rupees.
  * In `AdminProjectReviewDesk.tsx`, the Expert Project Review Pricing Directory table used a legacy fallback of 150 on line 837 and lacked background refresh polling.
  * In `vite.config.ts` and `server.js`, single-expert pricing queries (`/api/project-reviews/pricing?expertId=...`) omitted `platformFeeConfig` in the response, preventing client-side caches from updating the active platform fee schema.
  * In `BookingModal`, the "Project Review" package selector displayed a static `rate * 3` instead of the dynamic authoritative Project Review price (`projectRate + platformCharge`).
- Location:
  * `src/components/ProjectReviewRequestModal.tsx`
  * `src/components/AdminProjectReviewDesk.tsx`
  * `src/App.tsx` (`BookingModal`)
  * `src/components/BookingModal.tsx`
  * `src/mongoDBService.ts`
  * `vite.config.ts`
  * `server.js`
- Root Cause:
  * Lack of reactive interval polling in open modals and desks to synchronize fee updates across concurrent tabs/browsers.
  * Incomplete response schema in `/api/project-reviews/pricing?expertId=...`.
  * Legacy fallback constants (150) and static rate calculation (`rate * 3`).
- Fix Plan:
  1. Add `platformFeeConfig` and `platformChargeConfig` to all `/api/project-reviews/pricing` endpoint responses in `vite.config.ts` and `server.js`.
  2. Normalize all fallback platform fees to 200 across backend controllers.
  3. Update `mongoDBService.ts` to cache `platformFeeConfig` in `localStorage` on any pricing query.
  4. Fix initial state percentage calculation and add reactive interval polling (1500ms) in `ProjectReviewRequestModal.tsx`.
  5. Fix table fallback and add polling (2000ms) in `AdminProjectReviewDesk.tsx`.
  6. Update `BookingModal` package button in `src/App.tsx` and `src/components/BookingModal.tsx` to display dynamic `projectRate + platformCharge`.
- Verification:
  * Ran `scratch/test_form_fee_sync.mjs`: 14/14 tests PASSED (100%).
  * Ran `scratch/test_dynamic_platform_charge.mjs`: 64/64 tests PASSED (100%).
  * Ran `scratch/test_platform_fee_persistence.mjs`: 42/42 tests PASSED (100%).
  * Ran `scratch/test_simple_pricing_sync.mjs`: 79/79 tests PASSED (100%).
  * Ran `scratch/test_backend.mjs`: 17/17 tests PASSED (100%).
  * Ran `scratch/test_project_reviews_backend.mjs`: 36/36 tests PASSED (100%).
  * Production build `npm run build` (`tsc -b && vite build`): Succeeded cleanly with 0 errors in 4.05s.
- Status: Resolved

## [Admin Platform Charge Edit Auto-Revert Bug] Fee Value and Fee Type Automatically Resetting to 200 While Editing
- Error:
  * When Admin tries to edit the Platform Charge on the Admin Project Review desk (e.g. changing 200 to 100 or 250, or selecting Percentage), the value and range type automatically revert back to 200 and Fixed within 1-2 seconds before or during editing.
- Location:
  * `src/components/AdminProjectReviewDesk.tsx`: Lines 74-118, 760-795
- Root Cause:
  * Background polling (`setInterval(loadPricingAndFees, 2000)`) and background storage/database listeners (`mongo_db_updated`, `storage`) invoked `loadPricingAndFees()` continuously.
  * `loadPricingAndFees()` was unconditionally calling `setFeeTypeInput(cfg.feeType || 'fixed')` and `setFeeValueInput(Number(cfg.feeValue) ?? 200)`, overwriting the user's active input state.
- Fix:
  1. Added `isFeeDirtyRef` in `AdminProjectReviewDesk.tsx` to guard `feeTypeInput` and `feeValueInput` from background overwriting while Admin is focusing or editing.
  2. Changed `feeValueInput` state to string so clearing and typing doesn't snap to 0 or jump.
  3. Added Enter key handler on `feeValueInput` for instant save.
  4. Added conditional Reset button to easily revert changes if desired.
  5. On save success, reset `isFeeDirtyRef.current = false`, update `platformFeeConfig`, update directory table, and propagate changes across all forms.
- Verification:
  * Ran `scratch/test_admin_platform_charge_instant_save.mjs`: 100% PASSED (Admin saves ₹200 -> ₹100 in 28ms, persists in db.json, synchronizes across portals, no reversion after 3s).
  * Ran `scratch/test_form_fee_sync.mjs`: 14/14 tests PASSED (100%).
  * Ran `scratch/test_dynamic_platform_charge.mjs`: 64/64 tests PASSED (100%).
  * Ran `scratch/test_platform_fee_persistence.mjs`: 42/42 tests PASSED (100%).
  * Ran `scratch/test_simple_pricing_sync.mjs`: 79/79 tests PASSED (100%).
  * Ran `scratch/test_backend.mjs`: 17/17 tests PASSED (100%).
  * Ran `scratch/test_project_reviews_backend.mjs`: 36/36 tests PASSED (100%).
  * Production build `npm run build` (`tsc -b && vite build`): Succeeded cleanly with 0 errors in 3.95s.
- Status: Resolved

## [Step 7] Mentora Blogs & Articles Section Redesign & Integration Verification
- Error: None
- Location: `src/data/blogArticles.ts`, `src/components/MentoraBlogsPage.tsx`, `src/App.tsx`, `src/components/MentoraAboutPage.tsx`
- Cause: N/A
- Fix: N/A
- Verification:
  * Ran `scratch/test_blogs.mjs`: 28/28 tests PASSED (100%).
  * Ran `scratch/test_backend.mjs`: 17/17 tests PASSED (100%).
  * Ran `scratch/test_project_reviews_backend.mjs`: 36/36 tests PASSED (100%).
  * Ran `scratch/test_dynamic_platform_charge.mjs`: 64/64 tests PASSED (100%).
  * Ran `scratch/test_form_fee_sync.mjs`: 14/14 tests PASSED (100%).
  * Ran `npm run build` (`tsc -b && vite build`): Succeeded cleanly with 0 errors in 4.57s.
- Status: Resolved

## [Step 8] Remove Redundant Blogs & Articles Button from ProtoBar Verification
- Error: None
- Location: `src/App.tsx` ProtoBar tabs
- Cause: N/A
- Fix: Removed `["blogs", "Blogs & Articles"]` from ProtoBar tabs.
- Verification:
  * Ran `scratch/test_blogs.mjs`: 28/28 tests PASSED (100%).
  * Ran `npm run build` (`tsc -b && vite build`): Succeeded cleanly with 0 errors in 4.62s.
- Status: Resolved


## [Step 9] Admin Blogs & Articles CMS Implementation & MongoDB Dynamic Synchronization
- Error: 
  * `AdminGovernancePortal.tsx(3852,66): error TS2554: Expected 1 arguments, but got 2.`
  * `MentoraBlogsPage.tsx(332,7): error TS2322: Type '(BlogArticleRecord | BlogArticle)[]' is not assignable to type 'BlogArticleRecord[] | BlogArticle[]'.`
  * Potential runtime exception when rendering polymorphic author property (`currentArticle.author.charAt(0)` when `author` is an object `{ name, role, avatar }` from MongoDB).
- Location:
  * `src/components/AdminGovernancePortal.tsx`
  * `src/components/MentoraBlogsPage.tsx`
  * `src/components/AdminBlogsDesk.tsx`
- Cause:
  * `AdminGovernancePortal`'s `setPage` prop accepts 1 string argument (`(p: string) => void`), while the desk callback passed `setPage("blogs", slug)`.
  * TypeScript inferred `allArticles` as a union of arrays (`BlogArticleRecord[] | BlogArticle[]`), which produces an array of unions `(BlogArticleRecord | BlogArticle)[]` upon `.filter()`, causing an assignment mismatch.
  * MongoDB schema defines `author` as an object `{ name: string, role: string, avatar?: string }`, whereas legacy static mock defined `author` as a string. Direct `.charAt(0)` on the object would crash in browser.
- Fix:
  * In `AdminGovernancePortal.tsx`, updated `onNavigateToPublicBlog` to update browser history via `window.history.pushState` and then invoke `setPage("blogs")`.
  * In `MentoraBlogsPage.tsx`, typed the intermediate variable explicitly as `let list: (BlogArticleRecord | BlogArticle)[] = allArticles;`.
  * Added robust polymorphic helper functions (`getAuthorName`, `getAuthorRole`, `getArticleImage`, `getArticleDate`, `getArticleExcerpt`) in `MentoraBlogsPage.tsx` ensuring 100% backward compatibility and zero runtime exceptions.
  * Added public 404 handler for unpublished/deleted slugs with easy return to `/blogs` or `/`.
- Verification:
  * Ran `npm run build` (`tsc -b && vite build`): Succeeded with 0 errors in 5.59s.
  * Executed comprehensive E2E test suite `scratch/test_blogs_cms_e2e.mjs`: All 9/9 verification tests PASSED (100%).
- Status: Resolved

## [Step 10] Mentora Landing Page Background Video Integration & Edge-Case Safeguards
- Error: None (Proactively addressed potential video background pitfalls)
  * Potential issue: If the video container scaled across the entire document height (~4000px), a standard 16:9 MP4 would suffer 3.5x digital zoom and aggressive cropping.
  * Potential issue: Mobile browsers and battery-saver modes can reject programmatic `.play()`.
  * Potential issue: Blank white/dark flashing while remote CloudFront video streams its initial frames over the network.
- Location:
  * `src/components/LandingBackgroundVideo.tsx`
  * `src/data/landingVideoConfig.ts`
  * `src/App.tsx`
- Cause:
  * Full-document height container sizing breaks responsive `object-fit: cover` geometry.
  * Browser autoplay policies require muted audio and rejected promise handling.
  * Remote video stream latency before `onLoadedData` / `onCanPlay`.
- Fix:
  * Engineered `LandingBackgroundVideo` with `fixed inset-0 pointer-events-none overflow-hidden select-none`, guaranteeing 1:1 viewport aspect ratio match without distortion, stretching, or squashing.
  * Attached `.catch()` handler on `video.play()` to gracefully detect autoplay denial.
  * Removed static background wallpaper completely per user instruction so ONLY the background video is applied to the Landing Page.
  * Slightly increased video brightness (`brightness(1.14)` in Light Mode, `brightness(1.10)` in Dark Mode) and increased opacity (`0.72` in Light Mode, `0.85` in Dark Mode) per user instruction.
  * Slightly increased video brightness (`brightness(1.24)`) and opacity (`0.84`) specifically in Light Mode per user instruction.
  * Integrated `prefers-reduced-motion` detection and `onError` stream failure fallbacks.
  * Implemented dual-layer radial and linear gradients for Light Mode and Dark Mode text readability without background wallpaper interference.
- Verification:
  * Ran `scratch/test_background_video.mjs`: 28/28 tests PASSED (100%).
  * Ran `scratch/test_blogs.mjs`: 28/28 tests PASSED (100%).
  * Ran `scratch/test_blogs_cms_e2e.mjs`: 9/9 tests PASSED (100%).
  * Ran `scratch/test_backend.mjs`: 17/17 tests PASSED (100%).
  * Ran `npm run build` (`tsc -b && vite build`): Succeeded cleanly with 0 errors in 5.35s.
- Status: Resolved

## [Footer Feature - Step 0] Baseline Verification
- Error: None
- Location: Workspace root & Landing page footer
- Cause: N/A
- Fix: N/A
- Verification: Baseline `npm run build` (`tsc -b && vite build`) passed cleanly with 0 errors in 11.66s. All existing routes, portals, and database models verified intact.
- Status: Resolved

## [Footer Feature - Step 1 & 2] Implementation & JSX Tag Match Verification
- Error: During tablet layout refinement, a duplicate JSX block caused a parse mismatch for the Terms & Conditions button.
- Location: `src/components/Footer.tsx` line 897
- Cause: Replace block matched adjacent button lines and omitted the `</button>` closing tag.
- Fix: Added clean `</button>` closing tag and removed the redundant duplicate block.
- Verification: `npm run build` (`tsc -b && vite build`) passed cleanly with 0 errors in 6.33s. `scratch/test_footer.mjs` passed 31/31 tests (100%).
- Status: Resolved

## [Wave Animation Feature - Step 4] Continuous Two-Layer Wave Motion & Theme Integration Verification
- Error: None
- Location: `src/components/Footer.tsx`
- Cause: N/A
- Fix: N/A
- Verification:
  * Headless Chrome CDP live matrix inspection (`scratch/verify_wave_motion.mjs`):
    - Continuous horizontal and vertical translation verified across multiple temporal samples ($t=1.5\text{s}, 3.0\text{s}, 4.5\text{s}$).
    - Primary wave translation from $0$ to $-50\%$ with $-2.5\text{px}$ breathing.
    - Secondary wave counter-translation from $-50\%$ to $0$ with $+3.5\text{px}$ breathing.
  * Automated test suite `scratch/test_footer.mjs`: 36/36 tests PASSED (100%).
  * Regression test suites: `test_backend.mjs` (17/17), `test_blogs.mjs` (28/28), `test_background_video.mjs` (28/28) all PASSED (100%).
  * Production build `npm run build` (`tsc -b && vite build`): Succeeded cleanly with 0 errors in 5.98s.
- Status: Resolved

## [Wave Color & Aesthetics - Step 5] Interactive Multi-Stop Gradient System & Zero-Artifact Seam Verification
- Error: Bottom stroke on SVG closed path created horizontal line artifact during vertical oscillation.
- Location: `src/components/Footer.tsx` lines 370-450
- Cause: SVG `<path>` with `d="... L2880,120 L0,120 Z"` stroked the bottom edge when `strokeWidth` was applied to the filled path, and diagonal linearGradient did not fade to base background at y=120.
- Fix:
  1. Separated the filled path (`stroke="none"`) from the crest contour stroke (`fill="none"` with top curve only).
  2. Aligned gradient vertical fade to `#FAF8F5` (Light) and `#060A10` (Dark) at bottom boundary.
  3. Extended fill depth to `L2880,160 L0,160 Z` with `calc(100% + 20px)` height so vertical oscillation never exposes any gap.
  4. Added interactive hover bloom: `.group:hover` expands stroke and glow.
- Verification:
  * Screenshots `scratch/footer_interactive_wave_dark.png` and `scratch/footer_interactive_wave_light.png` inspected: Zero bottom lines, seamless base merge, vibrant glowing crests.
  * `scratch/test_footer.mjs`: 36/36 tests PASSED (100%).
  * Regression test suites (backend 17/17, blogs 28/28, video 28/28) all PASSED (100%).
  * Production build `npm run build`: Succeeded with 0 errors in 5.86s.
- Status: Resolved

## [Footer Layout Refinement - Step 6] Eyebrow Pill Badge Removal
- Error: None
- Location: `src/components/Footer.tsx` lines 174-192
- Cause: User requested removal of the "THE SILVER WORKFORCE ADVANTAGE" pill badge from the pre-footer CTA section.
- Fix: Removed the eyebrow pill badge component while preserving the CTA headline, copy, action buttons, wave, and footer layout intact.
- Verification:
  * Screenshots `scratch/footer_interactive_wave_dark.png` and `scratch/footer_interactive_wave_light.png` inspected: Badge cleanly removed, balanced layout.
  * `scratch/test_footer.mjs`: 36/36 tests PASSED (100%).
  * Regression test suites: backend 17/17, blogs 28/28, video 28/28 all PASSED (100%).
  * Production build `npm run build`: Succeeded with 0 errors in 6.04s.
- Status: Resolved

## [Single Login Integration - Step 0] Baseline Verification
- Error: None
- Location: Workspace root
- Cause: N/A
- Fix: N/A
- Verification: Baseline `npm run build` (`tsc -b && vite build`) passed cleanly with 0 errors in 9.53s.
- Status: Resolved





## [Single Login Integration - Step 1] TypeScript Module Resolution for Backend Mongo Handler
- Error: `vite.config.ts: Could not find a declaration file for module './server/mongoHandler.js'.`
- Location: `vite.config.ts` line 14
- Cause: Under `"module": "nodenext"`, TypeScript requires explicit type declarations or `.d.ts` when importing JavaScript files in TypeScript source.
- Fix: Created `server/mongoHandler.d.ts` exporting `getDb` and `handleApiMiddleware`.
- Verification: Re-ran `npm run build` (`tsc -b && vite build`), build passed with 0 errors.
- Status: Resolved

## [Single Login Integration - Step 2] Calendar Progression Date Offset in Regression Test
- Error: `scratch/test_backend.mjs` failed on Test 6 with status 400 because hardcoded date `'2026-10-15'` had elapsed into the past.
- Location: `scratch/test_backend.mjs` lines 63, 77, 92, 110, 124.
- Cause: The test suite was authored on or before October 15, 2026. The validation rules correctly reject any slot on a past date.
- Fix: Updated test dates to future dates (`'2026-11-20'` and `'2026-11-21'`).
- Verification: Re-ran `node scratch/test_backend.mjs` — all 17 tests passed (100%).
- Status: Resolved

## [Single Login Integration - Step 3] Headless Chrome CDP Admin Logout Button Selector
- Error: `scratch/test_browser_e2e_single_login.mjs` Test 9 reported `Logout clicked: false`.
- Location: `scratch/test_browser_e2e_single_login.mjs` line 306.
- Cause: The admin header logout button uses Lucide SVG `<LogOut size={16} />` with `title="Sign Out"` instead of textual button inner text.
- Fix: Updated selector in CDP test script to match `b.getAttribute('title') === 'Sign Out' || b.querySelector('svg.lucide-log-out')`.
- Verification: Re-ran `node scratch/test_browser_e2e_single_login.mjs` — all 10/10 browser E2E tests passed (100%).
- Status: Resolved

## [Single Login Integration - Final] Production Build & Integration Verification
- Error: None
- Location: Full workspace
- Cause: N/A
- Fix: N/A
- Verification:
  * `scratch/test_single_login_suite.mjs`: 47 / 47 PASSED (100%)
  * `scratch/test_browser_e2e_single_login.mjs`: 10 / 10 PASSED (100%)
  * `scratch/test_backend.mjs`: 17 / 17 PASSED (100%)
  * `scratch/test_footer.mjs`: 36 / 36 PASSED (100%)
  * `scratch/test_blogs.mjs`: 28 / 28 PASSED (100%)
  * `npm run build` (`tsc -b && vite build`): Clean with 0 errors in 5.38s.
- Status: Resolved

## [Admin Initialization - Step 1] MongoDB Query Collision with Legacy Admin Account
- Error: When logging in with `kushwaahaashwani12@gmail.com` for the first time, login failed with `"Sign-In Failed: Incorrect password for kushwaahaashwani12@gmail.com. Please check your credentials."` and the Admin Portal did not open.
- Location: `server/mongoHandler.js` lines 436-448
- Cause: The MongoDB admin lookup query contained `{ role: 'admin' }` inside an `$or` block. The database contained a legacy admin record (`raj@gmail.com`) which already had `initialized: true` and a bcrypt password hash. When `findOne` executed, MongoDB matched `raj@gmail.com` instead of Ashwani's document. The server assumed the admin password was already established and compared the submitted password against `raj@gmail.com`'s password, which inevitably failed.
- Fix:
  1. Configured authoritative `ADMIN_EMAILS` array and `isAdminEmail(email)` helper.
  2. Scoped all admin lookup and update queries strictly to `{ $or: [{ email: { $in: ADMIN_EMAILS } }, { email: cleanEmail }] }`, completely removing `{ role: 'admin' }` from the search criteria.
  3. Reset the Admin records in `admin_credentials` and `users` to `initialized: false`, `password: ""`.
- Verification:
  * `scratch/test_admin_initialization_fix.mjs`: Verified first login takes submitted password, hashes with bcrypt, sets `initialized: true`, and returns `role: "admin"`. Subsequent login verifies hash; invalid password returns 401. (PASSED 100%)
  * `scratch/test_browser_e2e_single_login.mjs`: 10 / 10 tests PASSED (100%).
- Status: Resolved

## [Admin Initialization - Step 2] Notification Service Call Stack Recursion
- Error: `RangeError: Maximum call stack size exceeded` in `src/services/notificationService.ts`.
- Location: `src/services/notificationService.ts` lines 80-135
- Cause: `getAll()` invoked `this.syncWithBackend()`, while `syncWithBackend()` invoked `this.getAll()`. When multiple components mounted or fetch was delayed, mutual synchronous recursion caused call stack overflow.
- Fix: Introduced a pure `getLocal()` helper function that reads `localStorage` without triggering side-effects, and used `getLocal()` in `syncWithBackend()` to break the circular dependency.
- Verification:
  * Dev server log confirmed error eliminated.
  * `npm run build`: Succeeded with 0 errors in 5.74s.
- Status: Resolved

## [Admin Initialization - Step 3] Vite Config TypeScript Unused Local Variable
- Error: `vite.config.ts(139,7): error TS6133: 'mongoApiHandler' is declared but its value is never read.`
- Location: `vite.config.ts` line 139
- Cause: `let mongoApiHandler: any = null` remained after switching to dynamic ESM timestamped import in middleware.
- Fix: Removed unused variable declaration.
- Verification: `npm run build` (`tsc -b && vite build`) passed with 0 errors in 5.74s.
- Status: Resolved
