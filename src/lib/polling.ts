/**
 * polling.ts — helpers that replace the old "fetch every 1.5 seconds" loops.
 *
 * startVisibleInterval(fn, ms)
 *   Like setInterval, but it SKIPS ticks while the browser tab is hidden (another tab is active,
 *   window minimised, phone screen off). When the user comes back to the tab, it runs once
 *   right away so the screen is fresh. Returns a cleanup function for useEffect.
 *
 * debounce(fn, ms)
 *   Collapses a burst of calls (e.g. 5 events fired at once, or typing in a search box)
 *   into ONE call made `ms` after the last event.
 */

export function startVisibleInterval(fn: () => void, ms: number): () => void {
  const isVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

  const id = setInterval(() => {
    if (isVisible()) fn();
  }, ms);

  // Refresh once when the user returns to the tab (only if it was hidden for a while).
  let hiddenAt = 0;
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
    } else if (hiddenAt && Date.now() - hiddenAt > ms) {
      hiddenAt = 0;
      fn();
    }
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

  return () => {
    clearInterval(id);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
  };
}

export function debounce<A extends any[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null;
  const wrapped = (...args: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...args);
    }, ms);
  };
  wrapped.cancel = () => {
    if (t) clearTimeout(t);
    t = null;
  };
  return wrapped;
}
