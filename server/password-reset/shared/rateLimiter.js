// In-memory rate limiter for password reset requests
const requestCounts = new Map();

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '5', 10); // 5 requests per window

/**
 * Check if the given key (e.g., IP or email) is rate-limited.
 * Returns { allowed: boolean, retryAfterMs?: number }
 */
export function checkRateLimit(key) {
  const now = Date.now();
  const entry = requestCounts.get(key);
  
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    // Reset window
    requestCounts.set(key, { windowStart: now, count: 1 });
    return { allowed: true };
  }
  
  if (entry.count >= MAX_REQUESTS) {
    const retryAfterMs = WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }
  
  entry.count++;
  return { allowed: true };
}

// Cleanup stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestCounts.entries()) {
    if (now - entry.windowStart > WINDOW_MS * 2) {
      requestCounts.delete(key);
    }
  }
}, 60000); // Every minute
