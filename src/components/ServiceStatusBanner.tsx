/**
 * ServiceStatusBanner — a small, friendly notice shown when Supabase answers
 * "402 quota exceeded" or "project paused".
 *
 * The detection happens in src/lib/supabaseFetch.ts, which also stops sending requests for
 * 2 minutes so the app does not hammer a restricted project in a retry loop.
 * The banner hides itself automatically as soon as a request succeeds again.
 */
import { useEffect, useState } from 'react';
import { SUPABASE_AVAILABLE_EVENT, SUPABASE_UNAVAILABLE_EVENT } from '../lib/supabaseFetch';

export default function ServiceStatusBanner() {
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    const onDown = (e: Event) => setReason((e as CustomEvent).detail?.reason || 'service unavailable');
    const onUp = () => setReason(null);
    window.addEventListener(SUPABASE_UNAVAILABLE_EVENT, onDown);
    window.addEventListener(SUPABASE_AVAILABLE_EVENT, onUp);
    return () => {
      window.removeEventListener(SUPABASE_UNAVAILABLE_EVENT, onDown);
      window.removeEventListener(SUPABASE_AVAILABLE_EVENT, onUp);
    };
  }, []);

  if (!reason) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 99999,
        maxWidth: 560,
        margin: '0 auto',
        padding: '12px 16px',
        borderRadius: 12,
        background: '#1E293B',
        color: '#F8FAFC',
        border: '1px solid #F59E0B',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 14,
        lineHeight: 1.45
      }}
    >
      <strong style={{ color: '#FBBF24' }}>We're having trouble reaching our servers.</strong>{' '}
      Some information may be out of date and saving is temporarily unavailable. Please try again in a few minutes.
      {import.meta.env.DEV && <div style={{ marginTop: 6, fontSize: 12, color: '#94A3B8' }}>Dev info: Supabase {reason}.</div>}
      <button
        onClick={() => setReason(null)}
        style={{ marginLeft: 8, background: 'transparent', color: '#94A3B8', border: 'none', cursor: 'pointer', fontSize: 13 }}
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  );
}
