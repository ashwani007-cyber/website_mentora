# Supabase Egress Fix — what changed and what to do next

**Branch:** `fix/supabase-egress` · **Your code before these changes:** git ref `refs/backup/pre-egress-fix`
(see only my changes with `git diff refs/backup/pre-egress-fix`).

---

## 1. What went wrong (plain language)

"Egress" is every byte Supabase sends back to you. The Free Plan allows 5 GB/month.

- The root `App` component re-loaded **all experts every 1.5 seconds on every page**, and
  the server API loaded them again for the "pending verifications" list. Each load was about
  **336 KB** (measured on your live project today).
- Why so big: some expert rows held whole **PDFs and photos as base64 text** inside
  `experts.documents` / `experts.img` (one row was 282 KB).
- Result: about **1.6 GB per hour for each open browser tab**. A few hours of testing with the
  admin, expert and client portals open used up the month's 16.94 GB.

## 2. What I changed

| Area | File(s) | Change |
|---|---|---|
| Main culprit | `src/App.tsx` (root effect) | 1.5 s poll → load once, then every **60 s only while the tab is visible**; events debounced; admin KYC queue only fetched on admin pages |
| Other polls | `App.tsx`, `NotificationCenter`, `ProjectReview*`, `AdminProjectReviewDesk`, `expertiseService.ts` | 1.5–10 s polls → 15 s–5 min, visible-tab only (`src/lib/polling.ts`) |
| Slim reads | `supabaseExpertiseService.ts`, `mongoDBService.ts`, `server/egressHelpers.js` | Experts are read through SQL functions that **strip base64 blobs**; falls back to the old query until you run the SQL |
| Caching | `src/lib/requestCache.ts` | 15–60 s cache + request de-duplication; **cache is cleared automatically after any save**, so saved data shows immediately |
| One client | `src/supabaseClient.ts`, `src/kyc/supabaseClient.ts`, `server/supabaseClient.js`, `vite.config.ts` | One browser client, one server client (the dev API used to create a new client per request) |
| Safety net | `src/lib/supabaseFetch.ts`, `ServiceStatusBanner.tsx` | Dedupes identical requests; on **402/paused** stops calling Supabase for 2 min and shows a friendly banner (no retry storms); dev logger |
| Photos | `src/lib/imageUpload.ts`, `/api/uploads/avatar` | Photos are compressed to WebP (≤512 px, ~50 KB), stored in the public `avatars` bucket with a 1-year cache; only the URL goes in the table |
| Wallet (money) | `walletService.ts`, `server.js`, `vite.config.ts`, SQL | Balance computed in the DB (one number); writes are **atomic + idempotent** (same booking can't be charged twice); failed saves now show an error instead of fake success |
| Admin saves | `App.tsx` | Fixed handlers that put `{success, expert}` into the experts list (the fast poll used to hide this bug) |
| Login | `App.tsx` | Stopped downloading `users.*` (incl. `password_hash`) to the browser |
| Lists | `server.js` | Notifications capped at 50, project-review lists at 100, stable ordering |
| Secrets | `server/supabaseClient.js`, `vite.config.ts`, `.env.example` | **service_role key removed from source** — now only in `.env` |

## 3. Do these steps IN THIS ORDER

> ⚠️ Your project is answering requests again (the billing cycle reset on 19 Nov). Until step 3c is done,
> keep the app closed. With only the code changes it already uses about 85× less egress, but each expert-list
> load is still about 330 KB.

**a) Backup first.** Supabase Dashboard → Database → Backups (or "Download backups" on the paused page).
Free-plan projects have no point-in-time restore, so also run:
`node scripts/migrateBase64ToStorage.js` (dry run, changes nothing) and keep its output.

**b) Rotate the leaked keys.** Your `service_role` key was in `server/supabaseClient.js`,
`vite.config.ts` and `.env.example`, all in git history (and on GitHub if you pushed).
Dashboard → Project Settings → API → generate new keys (or JWT secret) → put the new values in
`.env` (`SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_ANON_KEY`) **and** in Vercel → Settings →
Environment Variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`). The server now refuses to start without them.

**c) Run the SQL** (Supabase → SQL Editor → New query → paste the whole file → Run), in order:

| # | File | What it does |
|---|---|---|
| 1 | `supabase/egress-fix/01_slim_read_functions.sql` | Functions that return experts **without** base64 blobs; wallet balance + atomic wallet write |
| 2 | `supabase/egress-fix/02_indexes.sql` | Indexes for every filter/sort the app uses (skips missing columns) |
| 3 | `supabase/egress-fix/03_integrity_constraints.sql` | Positive amounts, no double charge per booking, unique expert email, auto `updated_at` (only adds rules that your current data passes) |
| 4 | `supabase/egress-fix/04_rls_fast_policies.sql` | Rewrites `auth.uid()` → `(select auth.uid())` in existing policies (same meaning, faster) |
| undo | `supabase/egress-fix/99_rollback.sql` | Removes everything above (no data is touched) |

All four were tested on a local Postgres: they run cleanly, can be re-run safely, and the rollback works.
Read the green "NOTICE" lines: they tell you if a unique rule was **not** added because duplicates exist.

**d) Move the base64 files to Storage:**
```bash
node scripts/migrateBase64ToStorage.js
```
```bash
node scripts/migrateBase64ToStorage.js --apply
```
The first command is a dry run. The second writes a backup to `backups/` first (git-ignored), uploads each file, and then updates the row.
To undo: `node scripts/migrateBase64ToStorage.js --restore backups/<file>.json`.

**e) Test locally** (section 5), then **deploy** to Vercel.

## 4. Before / after (per open tab)

| | Before | Code only (no SQL) | After SQL + migration |
|---|---|---|---|
| Expert list request | ~336 KB, 2–3× every 1.5 s | ~336 KB, at most 1×/min | ~25 KB (≈1 KB/expert), at most 1×/min |
| Per hour, one visible tab | **≈1.6 GB** | ≈20 MB | **≈1.5 MB** |
| Hidden/background tab | same as visible | 0 | 0 |
| Expected month (13 users + your testing) | 16.94 GB | ~1–2 GB | **well under 0.3 GB** |

Measured today in the dev server: in the first 58 s the page made 4 Supabase calls (341 KB, all at
page load, using the fallback because the SQL isn't installed). The old code would have used about 25 MB.

## 5. Verify it works

**DevTools → Network:** filter `supabase.co`, reload, wait 2 minutes. You should see a few calls at
load and at most about one per minute after that, each a few KB. Nothing should repeat every second.

**Console (dev only):** run `__supabaseStats()` for a table of every Supabase call (count, KB, ms).
Responses over 50 KB are printed as yellow warnings. The terminal shows `[supabase:server]` for heavy
server-side calls.

**Supabase dashboard:** Organization → Usage → Egress (updates hourly) should stay flat. Use
Reports → API to see which endpoints are hit most, and Logs → API Gateway to inspect single requests.

**Data checklist** (do each one, then reload the page and check it's still there):
- [ ] Register a client and an expert. Each appears once (try double-clicking the button).
- [ ] Expert: edit profile and upload a photo. The photo URL starts with `https://…/storage/v1/object/public/avatars/`.
- [ ] Expert: upload the 3 KYC documents. Admin sees them and can open each one (signed URL).
- [ ] Admin: approve, reject, feature on landing, change price. The list updates immediately and survives a reload.
- [ ] Client: top up the wallet. The balance is correct after reload. In Supabase → Table editor → `wallet_transactions` there is exactly one row.
- [ ] Client: book a session. Exactly one DEBIT with `related_booking_id`. Clicking twice doesn't create a second DEBIT.
- [ ] Cancel or delete a booking. It's gone after reload for that role only.
- [ ] Project review request, chat message, completion. Visible to both sides after reload.
- [ ] Notifications: mark read and clear. They stay read after reload.

## 6. Monthly maintenance (5 minutes)
- [ ] Usage page: egress < 1 GB, DB < 0.3 GB, storage < 0.7 GB, and no red bars.
- [ ] Reports → API: no single endpoint with thousands of calls per day.
- [ ] Look for new large rows: `select id, pg_column_size(e.*) from experts e order by 2 desc limit 5;` (should be under 5 KB).
- [ ] Free projects pause after 7 days without activity. Open the site once a week, or upgrade if real users depend on it.

## 7. Habits so this never comes back
1. Never `select('*')`. List only the columns the screen shows.
2. Never store files or base64 in a table. Put them in Storage and save the path.
3. No `setInterval` faster than 30 s. Prefer realtime or events, and use `startVisibleInterval`.
4. Every list gets `.limit()` or `.range()` and a stable `.order()`.
5. Always check `error` after a save and show it to the user. Never "optimistic success".
6. Use one Supabase client. Never put the service_role key in code.
7. After adding a feature, run `__supabaseStats()` for 2 minutes and look for repeats or big responses.

## 8. Not done (needs your decision) — please read
- **Security model:** the app logs users in with its own `users` table, not Supabase Auth, so
  database rules (RLS) can't tell users apart. Today the anon key can read **and change** bookings,
  expert documents and the `expert-documents` storage bucket, and "admin" is any token longer than
  5 characters. The fix is to move to Supabase Auth, or route all private reads and writes through
  the server. That is a separate, larger task.
- `public/uploaded_docs/` (KYC PDFs and two `.exe` files, ~450 MB) is published with every Vercel deploy.
  Move real documents to Storage and delete the rest.
- Pagination in the UI (infinite scroll / "load more") and TanStack Query were **not** added. Retrofitting
  them into the 12,000-line `App.tsx` risked breaking features. The server caps and the cache above cover
  the egress side for now.
- Bookings realtime still listens to the whole table (privacy issue; small egress).
- Many `catch {}` blocks remain in `App.tsx`. I fixed the money, expert-save and photo paths.
