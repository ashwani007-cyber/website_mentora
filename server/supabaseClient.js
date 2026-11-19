// Supabase Client for Backend (Node.js) — the ONE shared server-side client.
// ---------------------------------------------------------------------------
// Used by server.js (production / Vercel), the Vite dev API in vite.config.ts, the handlers in
// server/*.js and the scripts in scripts/*.js.
//
// SECURITY: the service_role key bypasses ALL Row Level Security. It must NEVER be written in
// source code (it used to be hard-coded here and is in your git history — rotate it in
// Supabase Dashboard → Project Settings → API). It is now read only from `.env`
// (SUPABASE_SERVICE_ROLE_KEY), which is git-ignored. On Vercel, add it under
// Project → Settings → Environment Variables.
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load the project-root .env even when this file is imported from vite.config.ts or a script.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
export const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    '[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to the .env file in the project root ' +
    '(and to Vercel → Settings → Environment Variables for production).'
  );
}

const IS_DEV = process.env.NODE_ENV !== 'production';
const BREAKER_COOLDOWN_MS = 2 * 60 * 1000;
let breakerOpenUntil = 0;

/** True while the project answered 402 (quota) / 540 (paused) recently — we stop calling it. */
export function isSupabaseUnavailable() {
  return Date.now() < breakerOpenUntil;
}

/**
 * Wraps fetch for every server-side Supabase request:
 *  - stops calling Supabase for 2 minutes after a 402/540 answer (no retry storms),
 *  - caps reads per endpoint per minute and shares identical in-flight reads (egress guard),
 *  - in development, logs each response size and time so heavy queries are easy to spot.
 * Server-side responses count toward egress exactly like browser ones.
 */
// ---- egress guard: per-minute cap per endpoint + in-flight de-duplication ----------------
// Counts calls per endpoint ("GET /rest/v1/experts") over a rolling minute for this server process.
//  - development: console warning once an endpoint passes WARN_PER_MINUTE (looks like a loop),
//  - everywhere: READS beyond HARD_CAP_PER_MINUTE get a 429 until the minute rolls over.
//    Writes are never blocked, so no save is ever lost.
const WARN_PER_MINUTE = 30;
const HARD_CAP_PER_MINUTE = 300;
const rateWindow = new Map();
const warned = new Set();
function allowByRateCap(method, url) {
  if (url.includes('/auth/v1/')) return true;
  const endpoint = `${method} ${new URL(url).pathname}`;
  const now = Date.now();
  const recent = (rateWindow.get(endpoint) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  rateWindow.set(endpoint, recent);
  if (IS_DEV && recent.length > WARN_PER_MINUTE && !warned.has(endpoint)) {
    warned.add(endpoint);
    console.warn(`[egress-guard:server] ${endpoint} called ${recent.length}× in the last minute — check for a loop.`);
    setTimeout(() => warned.delete(endpoint), 60_000);
  }
  const isRead = method === 'GET' || method === 'HEAD';
  return !(isRead && recent.length > HARD_CAP_PER_MINUTE);
}
const inFlight = new Map(); // identical GETs running at the same moment share one request

async function serverFetch(input, init) {
  const url = typeof input === 'string' ? input : input.url;
  const method = String(init?.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
  if (isSupabaseUnavailable() && !url.includes('/auth/v1/')) {
    return new Response(JSON.stringify({ message: 'Supabase temporarily unavailable (quota exceeded or project paused)', code: 'SERVICE_UNAVAILABLE' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  if (!allowByRateCap(method, url)) {
    return new Response(JSON.stringify({ message: 'Too many identical reads in the last minute (egress guard)', code: 'EGRESS_GUARD' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  const dedupeKey = method === 'GET' ? `${url} ${new Headers(init?.headers).get('range') || ''}` : null;
  if (dedupeKey && inFlight.has(dedupeKey)) {
    return (await inFlight.get(dedupeKey)).clone();
  }
  const started = Date.now();
  const pending = fetch(input, init);
  if (dedupeKey) {
    inFlight.set(dedupeKey, pending);
    pending.finally(() => inFlight.delete(dedupeKey)).catch(() => {});
  }
  const shared = await pending;
  const res = dedupeKey ? shared.clone() : shared;
  if (res.status === 402 || res.status === 540) {
    if (!isSupabaseUnavailable()) console.warn(`[supabase:server] HTTP ${res.status} — project restricted/paused. Pausing requests for 2 minutes.`);
    breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS;
  }
  if (IS_DEV) {
    try {
      const len = res.headers.get('content-length');
      const bytes = len ? Number(len) : (await res.clone().arrayBuffer()).byteLength;
      const u = new URL(url);
      const label = `${(init?.method || 'GET').toUpperCase()} ${u.pathname.replace(/^\/(rest|storage|auth)\/v1\//, '$1/')}`;
      const line = `[supabase:server] ${label} → ${res.status} · ${(bytes / 1024).toFixed(1)} KB · ${Date.now() - started} ms`;
      if (bytes > 50 * 1024) console.warn(line); // highlight heavy responses
    } catch {
      /* never let logging break a request */
    }
  }
  return res;
}

// Create Supabase client with service role key (full admin access) — created ONCE per process.
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    fetch: serverFetch
  }
});
