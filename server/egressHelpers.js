// server/egressHelpers.js
// ---------------------------------------------------------------------------
// Shared, egress-friendly building blocks used by BOTH backends:
//   - server.js        (production on Vercel)
//   - vite.config.ts   (the dev API used by `npm run dev`)
// so that dev and production read and write data the same way.
//
// Each read helper first calls a slim database function (see
// supabase/egress-fix/01_slim_read_functions.sql). If that function is not installed
// yet, it falls back to the old query, so nothing breaks in either order.
// ---------------------------------------------------------------------------
import { supabase } from './supabaseClient.js';

/**
 * The exact columns each server query downloads (never select('*')).
 * Matches the real tables (checked against the 19 Nov 2026 backup). Same lists as src/lib/columns.ts.
 * ⚠️ If you add columns to a table that the app must read, add them here too.
 */
export const COLUMNS = {
  EXPERT_LIST:
    'id, user_id, name, field, domain_id, years_of_experience, base_rate, admin_markup, rate, project_rate, rating, total_sessions, verified, initials, title, phone, email, bio, skills, created_at, updated_at',
  EXPERT_WITH_DOCUMENTS:
    'id, user_id, name, field, domain_id, years_of_experience, base_rate, admin_markup, rate, project_rate, rating, total_sessions, verified, initials, title, phone, email, bio, skills, documents, created_at, updated_at',
  /** Only what the public landing page / directory cards show (no phone, email or documents). */
  EXPERT_PUBLIC:
    'id, name, field, domain_id, years_of_experience, base_rate, admin_markup, rate, project_rate, rating, total_sessions, verified, initials, title, bio, skills, created_at',
  BOOKING:
    'id, client_id, client_name, client_email, expert_id, expert_name, expert_email, availability_id, booking_date, start_time, end_time, status, price, platform_fee, payment_status, meeting_link, meet_link, meeting_link_sent_at, notes, topic, scheduled_date, scheduled_time, scheduled_start, scheduled_end, duration_minutes, package_type, value, created_at, updated_at',
  AVAILABILITY: 'id, expert_id, availability_date, start_time, end_time, status, booking_id, client_id, client_name, created_at, updated_at',
  NOTIFICATION: 'id, user_id, user_role, title, message, type, link, is_read, metadata, created_at',
  REVIEW: 'id, expert_id, client_id, session_id, rating, comment, client_name, client_email, expert_name, expert_email, created_at',
  EXPERT_DOCUMENT: 'id, expert_id, doc_type, file_path, file_name, file_size, mime_type, status, admin_remark, uploaded_at, updated_at',
  PLATFORM_SETTING: 'key, value, description, updated_at',
  /** Project review LIST rows: everything except the big chat / activity_timeline / proposed_times. */
  PROJECT_REVIEW_SUMMARY:
    'project_review_id, client_id, client_name, client_email, expert_id, expert_name, expert_email, package_id, package_name, price, expert_earning, platform_fee, platform_charge_type, status, payment_status, expert_earning_status, request_notes, expected_scope, review_type, submission, meetings, completed_meeting_count, review_feedback, client_wallet_tx_id, expert_wallet_tx_id, client_archived, expert_archived, created_at, updated_at',
  /** One opened project review: every column. */
  PROJECT_REVIEW_FULL:
    'project_review_id, client_id, client_name, client_email, expert_id, expert_name, expert_email, package_id, package_name, price, expert_earning, platform_fee, platform_charge_type, status, payment_status, expert_earning_status, request_notes, expected_scope, review_type, submission, chat, proposed_times, meetings, completed_meeting_count, review_feedback, client_wallet_tx_id, expert_wallet_tx_id, client_archived, expert_archived, activity_timeline, created_at, updated_at'
};

/** Page size for project review lists (each summary row is ~1.5 KB → a page is ~30 KB). */
export const PROJECT_REVIEW_PAGE_SIZE = 20;

/**
 * Adds camelCase copies of snake_case keys (project_review_id → projectReviewId) without removing
 * anything. The screens read camelCase names; the database uses snake_case.
 */
export function withCamelAliases(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  for (const [k, v] of Object.entries(row)) {
    if (k.includes('_')) {
      const camel = k.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
      if (!(camel in out)) out[camel] = v;
    }
  }
  return out;
}

/**
 * Turns a FULL project review (camelCase, from db.json) into a list summary: removes the big
 * chat / activityTimeline / proposedTimes arrays but keeps their counts for the list cards.
 */
export function summarizeProjectReview(r) {
  if (!r || typeof r !== 'object') return r;
  const { chat, activityTimeline, proposedTimes, ...rest } = r;
  return {
    ...rest,
    chatCount: Array.isArray(chat) ? chat.length : 0,
    activityCount: Array.isArray(activityTimeline) ? activityTimeline.length : 0,
    proposedTimesCount: Array.isArray(proposedTimes) ? proposedTimes.length : 0
  };
}

/** Latest N activity events across many reviews, newest first (for the admin audit tab). */
export function flattenProjectReviewActivity(reviews, limit = 100) {
  const events = [];
  for (const r of reviews || []) {
    for (const a of r.activityTimeline || r.activity_timeline || []) {
      events.push({ ...a, reviewId: r.projectReviewId || r.project_review_id, clientName: r.clientName || r.client_name, expertName: r.expertName || r.expert_name });
    }
  }
  events.sort((x, y) => new Date(y.timestamp || 0).getTime() - new Date(x.timestamp || 0).getTime());
  return events.slice(0, limit);
}

/** Reads a positive integer query parameter, clamped to [min, max]. */
export function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/** PostgREST error meaning "this SQL function does not exist (yet)". */
export function isMissingFunction(error) {
  return !!error && (error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message || ''));
}

// ---- tiny server-side cache --------------------------------------------------
// Several browser tabs asking for the same list within a few seconds → one Supabase call.
const memoStore = new Map();
const memoPending = new Map();

export async function memo(key, ttlMs, loader) {
  const hit = memoStore.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  if (memoPending.has(key)) return memoPending.get(key);
  const p = (async () => {
    try {
      const value = await loader();
      memoStore.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } finally {
      memoPending.delete(key);
    }
  })();
  memoPending.set(key, p);
  return p;
}

/** Call after any write that changes experts/wallet so the next read is fresh. */
export function clearMemo(prefix = '') {
  for (const k of Array.from(memoStore.keys())) {
    if (!prefix || k.startsWith(prefix)) memoStore.delete(k);
  }
}

// ---- experts (slim = without base64 file data) ---------------------------------

/** All experts, newest first, without heavy base64 blobs. Cached 10 s. */
export async function fetchExpertsSlim({ force = false } = {}) {
  if (force) clearMemo('experts:');
  return memo('experts:all', 10_000, async () => {
    const { data, error } = await supabase.rpc('get_experts_list', undefined, { get: true });
    if (!error) return Array.isArray(data) ? data : [];
    if (!isMissingFunction(error)) throw error;
    // Fallback until the SQL is installed: list columns only — never the heavy documents JSON.
    const res = await supabase.from('experts').select(COLUMNS.EXPERT_LIST).order('created_at', { ascending: false }).limit(500);
    if (res.error) throw res.error;
    return res.data || [];
  });
}

/**
 * The expert list for EVERY page (landing, directory, portals), cached on the server for 60 s.
 * 500 visitors (or a bot crawling the site) within a minute → 1 database query.
 * Route /api/experts/list also sends a CDN cache header, so most visits never reach this server.
 * { force: true } (used right after a save) skips the cache.
 */
export async function fetchExpertsListCached({ force = false } = {}) {
  if (force) clearMemo('experts:');
  return memo('experts:list60', 60_000, () => fetchExpertsSlim({ force }));
}

/** HTTP cache header for the expert list: shared CDN copy for 60 s, then refreshed in the background. */
export const EXPERTS_LIST_CACHE_HEADER = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

/** Unverified experts for the admin KYC queue, slim. Cached 10 s. */
export async function fetchUnverifiedExpertsSlim({ force = false } = {}) {
  if (force) clearMemo('experts:');
  return memo('experts:unverified', 10_000, async () => {
    const { data, error } = await supabase.rpc('get_unverified_experts', undefined, { get: true });
    if (!error) return Array.isArray(data) ? data : [];
    if (!isMissingFunction(error)) throw error;
    // Fallback: only unverified rows (the KYC desk needs their documents metadata).
    const res = await supabase
      .from('experts')
      .select(COLUMNS.EXPERT_WITH_DOCUMENTS)
      .or('verified.is.null,verified.eq.false')
      .order('created_at', { ascending: false })
      .limit(200);
    if (res.error) throw res.error;
    return res.data || [];
  });
}

/** One expert by id or email, slim. */
export async function fetchExpertByKeySlim(key) {
  const clean = String(key || '').trim();
  if (!clean) return null;
  const { data, error } = await supabase.rpc('get_expert_by_key', { p_key: clean }, { get: true });
  if (!error) return data || null;
  if (!isMissingFunction(error)) throw error;
  const res = await supabase.from('experts').select(COLUMNS.EXPERT_WITH_DOCUMENTS).eq('id', clean).maybeSingle();
  if (res.error) throw res.error;
  return res.data || null;
}

// ---- wallet ------------------------------------------------------------------

function sumBalance(rows) {
  let balance = 0;
  for (const tx of rows || []) {
    const amt = Number(tx.amount) || 0;
    if ((tx.status || 'SUCCESS').toUpperCase() === 'SUCCESS') {
      if (tx.type === 'CREDIT') balance += amt;
      else if (tx.type === 'DEBIT') balance -= amt;
    }
  }
  return Math.max(0, balance);
}

/** Wallet balance computed in the database (one number) — no full history download. */
export async function getWalletBalance(userEmail, userId) {
  const email = String(userEmail || '').toLowerCase().trim();
  const { data, error } = await supabase.rpc('wallet_balance', { p_email: email || null, p_user_id: userId || null }, { get: true });
  if (!error) return Number(data) || 0;
  if (!isMissingFunction(error)) throw error;
  // Fallback: only the 3 columns needed for the sum (not select('*')).
  let q = supabase.from('wallet_transactions').select('amount, type, status');
  if (email && userId && email !== userId) q = q.or(`user_email.ilike.${email},user_id.eq.${userId}`);
  else if (email) q = q.ilike('user_email', email);
  else if (userId) q = q.eq('user_id', userId);
  else return 0;
  const res = await q;
  if (res.error) throw res.error;
  return sumBalance(res.data);
}

/** Latest wallet transactions for the history list (newest first, capped). */
export async function getWalletHistory(userEmail, userId, limit = 50) {
  const email = String(userEmail || '').toLowerCase().trim();
  let q = supabase
    .from('wallet_transactions')
    .select('id, user_id, user_email, user_role, amount, type, status, description, related_booking_id, related_project_review_id, created_at');
  if (email && userId && email !== userId) q = q.or(`user_email.ilike.${email},user_id.eq.${userId}`);
  else if (email) q = q.ilike('user_email', email);
  else if (userId) q = q.eq('user_id', userId);
  else return [];
  const res = await q.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit);
  if (res.error) throw res.error;
  return res.data || [];
}

/**
 * Records a wallet transaction safely:
 *  - atomic + idempotent via the wallet_apply_transaction() SQL function (double clicks or
 *    retries for the same booking/project review are not charged twice),
 *  - returns { transaction, balance, duplicate }.
 * Falls back to a plain insert if the SQL function is not installed yet.
 */
export async function applyWalletTransaction(txRecord) {
  const { data, error } = await supabase.rpc('wallet_apply_transaction', { p_tx: txRecord });
  if (!error && data) {
    return { transaction: data.transaction, balance: Number(data.balance) || 0, duplicate: Boolean(data.duplicate) };
  }
  if (error && !isMissingFunction(error)) throw error;

  // Fallback path (SQL not installed): insert, then compute the balance with a slim query.
  const ins = await supabase.from('wallet_transactions').insert(txRecord).select('id, amount, type, status, created_at').single();
  if (ins.error) {
    // 23505 = unique violation → the same payment was already recorded (idempotent success).
    if (ins.error.code === '23505') {
      return { transaction: txRecord, balance: await getWalletBalance(txRecord.user_email, txRecord.user_id), duplicate: true };
    }
    throw ins.error;
  }
  return { transaction: { ...txRecord, ...ins.data }, balance: await getWalletBalance(txRecord.user_email, txRecord.user_id), duplicate: false };
}

// ---- avatar / image uploads ----------------------------------------------------

const AVATAR_BUCKET = 'avatars';
let avatarBucketReady = false;

async function ensurePublicAvatarBucket() {
  if (avatarBucketReady) return;
  const { data } = await supabase.storage.getBucket(AVATAR_BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(AVATAR_BUCKET, {
      public: true, // public → served through the CDN cache, no signed URLs needed
      fileSizeLimit: 1024 * 1024, // 1 MB max (images are compressed to ~50 KB in the browser)
      allowedMimeTypes: ['image/webp', 'image/jpeg', 'image/png']
    });
    if (error && !/already exists/i.test(error.message || '')) throw error;
  }
  avatarBucketReady = true;
}

/**
 * Stores an already-compressed image (data URL) in the public "avatars" bucket and returns
 * its public URL. Files get a 1-year cache header; each upload uses a new file name, so a
 * changed photo is never hidden by an old cached copy.
 */
export async function uploadAvatarFromDataUrl({ ownerId, fileData, contentType }) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(String(fileData || ''));
  if (!match) throw Object.assign(new Error('Invalid image data'), { status: 400 });
  const mime = contentType || match[1];
  if (!['image/webp', 'image/jpeg', 'image/png'].includes(mime)) {
    throw Object.assign(new Error('Only WebP, JPEG or PNG images are allowed'), { status: 400 });
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 1024 * 1024) {
    throw Object.assign(new Error('Image is still larger than 1 MB after compression'), { status: 413 });
  }

  await ensurePublicAvatarBucket();
  const safeOwner = String(ownerId || 'anonymous').toLowerCase().replace(/[^a-z0-9._-]/g, '_').slice(0, 80);
  const ext = mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
  const path = `${safeOwner}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, buffer, {
    contentType: mime,
    cacheControl: '31536000', // 1 year — browsers/CDN reuse it instead of downloading again
    upsert: false
  });
  if (error) throw error;
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
