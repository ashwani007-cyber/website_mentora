/**
 * requestCache.ts — a tiny in-memory cache with request de-duplication.
 *
 * HOW TO USE:
 *   const experts = await cached('experts:list', 30_000, () => loadExpertsFromSupabase());
 *
 *   - If the same key was loaded less than `ttlMs` ago, the saved answer is returned instantly
 *     (no network, no egress).
 *   - If a load for that key is already running, the caller waits for that SAME request instead
 *     of starting a second one.
 *   - Errors are NOT cached, so the next call will try again.
 *
 * After you SAVE something, call `invalidate('experts')` so the next read fetches fresh data.
 * This is how the app stays correct (no stale data) while still being cheap.
 */

type Entry = { value: unknown; expiresAt: number };

const store = new Map<string, Entry>();
let lastWriteAt = 0;

/**
 * Remember that THIS browser just saved something. For the next 2 minutes, reads that are normally
 * served from a shared CDN copy (e.g. the public expert list) ask the server for a fresh answer,
 * so the user always sees their own change immediately.
 */
export function markWrite() {
  lastWriteAt = Date.now();
  invalidate();
}

/** True if this browser saved something in the last 2 minutes. */
export function wroteRecently(): boolean {
  return Date.now() - lastWriteAt < 2 * 60_000;
}
const pending = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const running = pending.get(key);
  if (running) return running as Promise<T>;

  const p = (async () => {
    try {
      const value = await loader();
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, p);
  return p;
}

/**
 * Makes sure cached reads are never stale after a SAVE.
 * The app saves data in many places (fetch('/api/...') calls spread across components).
 * Instead of remembering to clear the cache in each one, we watch window.fetch: whenever a
 * successful write (POST/PUT/PATCH/DELETE) goes to our own /api/ server, the whole cache is
 * cleared, so the next read loads fresh data. Reads (GET) are not affected.
 * Direct writes to Supabase are handled the same way inside src/lib/supabaseFetch.ts.
 */
export function installWriteInvalidation() {
  if (typeof window === 'undefined' || (window as any).__writeInvalidationInstalled) return;
  (window as any).__writeInvalidationInstalled = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await originalFetch(input as any, init);
    try {
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (method !== 'GET' && method !== 'HEAD' && res.ok) {
        const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const url = new URL(raw, window.location.origin);
        // /api/kv is a local session key/value sync that never changes cached Supabase data,
        // and it is written often — so it is ignored here.
        if (url.origin === window.location.origin && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/kv')) {
          markWrite();
        }
      }
    } catch {
      /* never break a request because of cache bookkeeping */
    }
    return res;
  };
}

/** Forget cached answers whose key starts with `prefix` (or everything if no prefix). */
export function invalidate(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
