/**
 * supabaseFetch.ts — a small "safety net" that sits between the Supabase client and the network.
 *
 * WHY THIS EXISTS (simple version):
 *   Every byte Supabase sends back counts toward the 5 GB/month Free Plan egress limit.
 *   This wrapper gives us three protections without changing any query code:
 *
 *   1. DEDUPLICATION – if two parts of the app ask for the exact same data at the same moment,
 *      only ONE network request is made and both get the same answer.
 *   2. CIRCUIT BREAKER – if Supabase answers 402 (quota exceeded) or says the project is paused,
 *      we stop sending requests for a while instead of retrying in a loop (a "retry storm"),
 *      and we tell the UI so it can show a friendly message.
 *   3. DEV LOGGER – in development only, every Supabase response is logged with its size and
 *      duration, so you can see which calls are heavy. Type `__supabaseStats()` in the browser
 *      console to see a summary table.
 */

import { invalidate } from './requestCache';

// Event name the UI listens for (see src/components/ServiceStatusBanner.tsx)
export const SUPABASE_UNAVAILABLE_EVENT = 'supabase-unavailable';
export const SUPABASE_AVAILABLE_EVENT = 'supabase-available';

const IS_DEV = Boolean(import.meta.env?.DEV);

// How long we stay "closed" after a 402 / paused response before trying again.
const BREAKER_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

let breakerOpenUntil = 0;
let breakerReason = '';

/** Returns true while we are deliberately not calling Supabase (quota/paused). */
export function isSupabaseUnavailable(): boolean {
  return Date.now() < breakerOpenUntil;
}

export function getSupabaseUnavailableReason(): string {
  return breakerReason;
}

function openBreaker(status: number, reason: string) {
  const wasOpen = isSupabaseUnavailable();
  breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS;
  breakerReason = reason;
  if (!wasOpen && typeof window !== 'undefined') {
    console.warn(`[supabase] Service unavailable (HTTP ${status}: ${reason}). Pausing requests for 2 minutes.`);
    window.dispatchEvent(new CustomEvent(SUPABASE_UNAVAILABLE_EVENT, { detail: { status, reason } }));
  }
}

function closeBreaker() {
  if (breakerOpenUntil !== 0) {
    breakerOpenUntil = 0;
    breakerReason = '';
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(SUPABASE_AVAILABLE_EVENT));
    }
  }
}

/**
 * Decide whether a response means "the project cannot serve requests right now".
 * 402 = Fair Use / quota exceeded. 540 = project paused (Supabase specific).
 * 503 with a "paused"/"restricted" body is treated the same way.
 */
function classifyUnavailable(status: number): string | null {
  if (status === 402) return 'quota exceeded (Free Plan limit reached)';
  if (status === 540) return 'project paused';
  return null;
}

// ---- dev stats -------------------------------------------------------------
type StatRow = { calls: number; bytes: number; ms: number };
const stats: Record<string, StatRow> = {};

function statKey(method: string, url: URL): string {
  // e.g. "GET rest/experts" or "POST rpc/get_experts_list"
  const path = url.pathname.replace(/^\/(rest|storage|auth|functions)\/v1\//, '$1/');
  return `${method} ${path}`;
}

function recordStat(key: string, bytes: number, ms: number) {
  const row = stats[key] || (stats[key] = { calls: 0, bytes: 0, ms: 0 });
  row.calls += 1;
  row.bytes += bytes;
  row.ms += ms;
}

if (IS_DEV && typeof window !== 'undefined') {
  // Open DevTools console and run: __supabaseStats()
  (window as any).__supabaseStats = () => {
    const table = Object.entries(stats)
      .map(([k, v]) => ({ request: k, calls: v.calls, totalKB: +(v.bytes / 1024).toFixed(1), avgKB: +(v.bytes / 1024 / v.calls).toFixed(1), avgMs: Math.round(v.ms / v.calls) }))
      .sort((a, b) => b.totalKB - a.totalKB);
    console.table(table);
    return table;
  };
}

// ---- in-flight de-duplication ----------------------------------------------
const inFlight = new Map<string, Promise<Response>>();

function dedupeKey(method: string, url: string, headers: Headers): string | null {
  // Only safe, read-only requests are shared.
  if (method !== 'GET' && method !== 'HEAD') return null;
  // Include the auth header so two different users never share a response.
  return `${method} ${url} ${headers.get('authorization') || ''} ${headers.get('range') || ''}`;
}

/**
 * Drop-in replacement for window.fetch, passed to createClient({ global: { fetch } }).
 */
export const supabaseFetch: typeof fetch = async (input, init) => {
  const request = new Request(input as any, init);
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  // 1) Circuit breaker: don't hit the network while the project is restricted/paused.
  //    Auth token refresh is allowed through so the session is not lost.
  if (isSupabaseUnavailable() && !url.pathname.startsWith('/auth/')) {
    return new Response(
      JSON.stringify({ message: `Supabase temporarily unavailable: ${breakerReason}`, code: 'SERVICE_UNAVAILABLE' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2) De-duplicate identical concurrent GETs.
  const key = dedupeKey(method, request.url, request.headers);
  if (key && inFlight.has(key)) {
    const shared = await inFlight.get(key)!;
    return shared.clone();
  }

  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const promise = fetch(input as any, init).then(async (res) => {
    const reason = classifyUnavailable(res.status);
    if (reason) openBreaker(res.status, reason);
    else if (res.ok) closeBreaker();

    // A successful direct write to a table means cached reads may be out of date → clear them.
    // (Read-only RPCs are sent as GET, so they never trigger this.)
    if (res.ok && method !== 'GET' && method !== 'HEAD' && url.pathname.startsWith('/rest/v1/')) {
      invalidate();
    }

    // 3) Dev-only size + duration logger.
    if (IS_DEV) {
      try {
        const lenHeader = res.headers.get('content-length');
        const bytes = lenHeader ? Number(lenHeader) : (await res.clone().arrayBuffer()).byteLength;
        const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - started);
        const k = statKey(method, url);
        recordStat(k, bytes, ms);
        const kb = (bytes / 1024).toFixed(1);
        const log = bytes > 50 * 1024 ? console.warn : console.debug; // highlight heavy (>50 KB) responses
        log(`[supabase] ${k}${url.search ? url.search.slice(0, 80) : ''} → ${res.status} · ${kb} KB · ${ms} ms`);
      } catch {
        /* logging must never break a request */
      }
    }
    return res;
  });

  if (key) {
    inFlight.set(key, promise);
    promise.finally(() => inFlight.delete(key));
    const res = await promise;
    return res.clone();
  }
  return promise;
};
