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
    const res = await supabase.from('experts').select('*').order('created_at', { ascending: false });
    if (res.error) throw res.error;
    return res.data || [];
  });
}

/** Unverified experts for the admin KYC queue, slim. Cached 10 s. */
export async function fetchUnverifiedExpertsSlim({ force = false } = {}) {
  if (force) clearMemo('experts:');
  return memo('experts:unverified', 10_000, async () => {
    const { data, error } = await supabase.rpc('get_unverified_experts', undefined, { get: true });
    if (!error) return Array.isArray(data) ? data : [];
    if (!isMissingFunction(error)) throw error;
    const res = await supabase.from('experts').select('*');
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
  const res = await supabase.from('experts').select('*').eq('id', clean).maybeSingle();
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
