// Dynamic Review & Rating Calculation Service
import { supabase } from '../supabaseClient';

export interface ExpertReview {
  id: string;
  expertId?: string;
  expert_id?: string;
  expertName?: string;
  expert_name?: string;
  expertEmail?: string;
  expert_email?: string;
  clientId?: string;
  client_id?: string;
  clientName?: string;
  client_name?: string;
  clientEmail?: string;
  client_email?: string;
  sessionId?: string;
  session_id?: string;
  rating: number;
  comment?: string;
  date?: string;
  created_at?: string;
  status?: string;
  visibleToExpert?: boolean;
  featuredOnLanding?: boolean;
}

export interface ExpertDynamicStats {
  avgRating: number;
  reviewCount: number;
  completedConsultations: number;
}

/**
 * Calculate dynamic average rating and count strictly from valid completed reviews.
 * - Sum of ratings / total count, rounded to 1 decimal place (e.g., 4.3).
 * - Empty/zero state returns 0.0 and 0 count.
 */
export function calculateReviewStats(reviews: Array<{ rating?: number | string }>): { avgRating: number; reviewCount: number } {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    return { avgRating: 0.0, reviewCount: 0 };
  }

  const validRatings = reviews
    .map(r => Number(r.rating))
    .filter(val => !isNaN(val) && val >= 1 && val <= 5);

  if (validRatings.length === 0) {
    return { avgRating: 0.0, reviewCount: 0 };
  }

  const sum = validRatings.reduce((acc, curr) => acc + curr, 0);
  const count = validRatings.length;
  const avg = Math.round((sum / count) * 10) / 10;

  return {
    avgRating: avg,
    reviewCount: count
  };
}

/**
 * Filter reviews from a master list that match a given expert by id, email, or name.
 */
export function filterReviewsForExpert(reviews: ExpertReview[], expert: { id?: string; email?: string; name?: string }): ExpertReview[] {
  if (!Array.isArray(reviews) || !expert) return [];

  const targetId = (expert.id || '').toLowerCase().trim();
  const targetEmail = (expert.email || '').toLowerCase().trim();
  const targetName = (expert.name || '').toLowerCase().trim();

  return reviews.filter(r => {
    if (!r) return false;
    const rId = (r.expertId || r.expert_id || '').toLowerCase().trim();
    const rEmail = (r.expertEmail || r.expert_email || '').toLowerCase().trim();
    const rName = (r.expertName || r.expert_name || '').toLowerCase().trim();

    if (targetId && rId && targetId === rId) return true;
    if (targetEmail && rEmail && targetEmail === rEmail) return true;
    if (targetName && rName && (targetName === rName || targetName.includes(rName) || rName.includes(targetName))) return true;

    return false;
  });
}

/**
 * Count total completed consultation sessions for an expert from localStorage & memory stores.
 */
export function getLocalCompletedSessionsCount(expert: { id?: string; email?: string; name?: string }): number {
  if (!expert) return 0;
  if (typeof window === 'undefined' || !window.localStorage) return 0;

  const targetId = (expert.id || '').toLowerCase().trim();
  const targetEmail = (expert.email || '').toLowerCase().trim();
  const targetName = (expert.name || '').toLowerCase().trim();

  const completedSessionIds = new Set<string>();

  // Any consultation with a submitted client rating was completed
  try {
    const revs = filterReviewsForExpert(getLocalReviews(), expert);
    revs.forEach(r => {
      const sId = r.sessionId || r.session_id;
      if (sId) completedSessionIds.add(String(sId).trim());
    });
  } catch {}

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith('expert_accepted_sessions_') || key.startsWith('client_upcoming_') || key === 'app_platform_sessions') {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const items = JSON.parse(raw);
          if (Array.isArray(items)) {
            items.forEach((s: any) => {
              if (!s || !s.id) return;
              const isCompleted = s.status === 'Completed' || s.completed === true || s.status === 'COMPLETED';
              if (!isCompleted) return;

              const sExp = (s.expert || s.expertName || '').toLowerCase().trim();
              const sEmail = (s.expertEmail || '').toLowerCase().trim();
              const sId = (s.expertId || '').toLowerCase().trim();

              const matches = (targetId && sId && targetId === sId) ||
                              (targetEmail && sEmail && targetEmail === sEmail) ||
                              (targetName && sExp && (targetName === sExp || targetName.includes(sExp) || sExp.includes(targetName)));

              if (matches) {
                completedSessionIds.add(s.id);
              }
            });
          }
        } catch {}
      }
    }
  } catch {}

  return completedSessionIds.size;
}

/**
 * Get all reviews currently in local storage / memory.
 */
export function getLocalReviews(): ExpertReview[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem('app_platform_reviews');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Fetch live dynamic stats for an expert from server API or local stores.
 */
export async function fetchExpertDynamicStats(expert: { id?: string; email?: string; name?: string; sessions?: number; total_sessions?: number; rating?: number }): Promise<ExpertDynamicStats> {
  if (!expert) {
    return { avgRating: 0.0, reviewCount: 0, completedConsultations: 0 };
  }

  // 1. Try server API
  try {
    const params = new URLSearchParams();
    if (expert.id) params.set('expertId', expert.id);
    if (expert.email) params.set('expertEmail', expert.email);
    if (expert.name) params.set('expertName', expert.name);

    const res = await fetch(`/api/reviews/stats?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        return {
          avgRating: Number(data.avgRating) || 0.0,
          reviewCount: Number(data.reviewCount) || 0,
          completedConsultations: Number(data.completedConsultations) || 0
        };
      }
    }
  } catch {}

  // 2. Fallback to computing from local stores
  const localRevs = getLocalReviews();
  const expertRevs = filterReviewsForExpert(localRevs, expert);
  const { avgRating, reviewCount } = calculateReviewStats(expertRevs);
  const completedConsultations = getLocalCompletedSessionsCount(expert);

  return {
    avgRating,
    reviewCount,
    completedConsultations
  };
}
