import { mongoDB } from '../mongoDBService';

// ---------------------------------------------------------------------------
// Wallet service (browser side).
//
// WHAT CHANGED AND WHY
// - Reads and writes now go through our server (/api/wallet…), which uses the
//   service key and the database functions wallet_balance / wallet_apply_transaction:
//     * the balance is ONE number computed in the database (no full history download),
//     * a payment is saved atomically and never twice for the same booking (double-click safe).
// - A failed save is now reported as a failure (success: false + error). Previously a failed
//   insert still returned success: true with an "optimistic" balance, so money movements could
//   be silently lost while the screen showed them as done.
// ---------------------------------------------------------------------------

export interface WalletTransaction {
  id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  description: string;
  related_booking_id?: string | null;
  related_project_review_id?: string | null;
  created_at?: string;
}

export interface WalletBalanceResult {
  balance: number;
  transactions: WalletTransaction[];
}

const walletKey = (email: string) => `client_wallet_${email || 'guest'}`;

function cacheBalanceLocally(email: string, balance: number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(walletKey(email), String(balance));
  } catch {}
}

/**
 * Fetches the client's authoritative wallet balance and latest 50 transactions.
 * If there are no transactions yet, a legacy local balance (from before Supabase) is
 * migrated once as an "Opening Balance" credit — same behaviour as before, but now through
 * the server so it is saved safely (and only once).
 */
export async function fetchWalletBalance(
  userId?: string,
  userEmail?: string,
  localFallback?: number
): Promise<WalletBalanceResult> {
  const cleanEmail = (userEmail || '').toLowerCase().trim();
  const cleanId = String(userId || '').trim();
  if (!cleanEmail && !cleanId) return { balance: 0, transactions: [] };

  try {
    const params = new URLSearchParams({ userId: cleanId, userEmail: cleanEmail });
    const res = await fetch(`/api/wallet?${params.toString()}`);
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) {
      const transactions: WalletTransaction[] = Array.isArray(json.transactions) ? json.transactions : [];
      const balance = Number(json.balance) || 0;

      if (transactions.length > 0 || balance > 0) {
        cacheBalanceLocally(cleanEmail, balance);
        return { balance, transactions };
      }

      // No server-side history yet → one-time migration of a legacy local balance.
      const legacy = typeof localFallback === 'number' && localFallback > 0 ? localFallback : 0;
      if (legacy > 0) {
        const migrated = await recordWalletTransaction({
          userId: cleanId || cleanEmail,
          userEmail: cleanEmail || cleanId,
          userRole: 'client',
          amount: legacy,
          type: 'CREDIT',
          description: 'Opening Balance (Migrated from Previous Session)'
        });
        if (migrated.success) {
          return { balance: migrated.newBalance, transactions: migrated.transaction ? [migrated.transaction] : [] };
        }
      }
      return { balance, transactions };
    }
    console.error('[WALLET] balance request failed:', json?.error || `HTTP ${res.status}`);
  } catch (err) {
    console.error('[WALLET] balance request failed:', err);
  }

  // Network/server problem: show the last known balance, but don't write anything.
  try {
    const cached = typeof window !== 'undefined' ? localStorage.getItem(walletKey(cleanEmail)) : null;
    if (cached !== null && !isNaN(Number(cached))) return { balance: Number(cached), transactions: [] };
  } catch {}
  return { balance: typeof localFallback === 'number' ? localFallback : 0, transactions: [] };
}

/**
 * Records a wallet transaction (CREDIT or DEBIT) through the server and returns the new balance.
 * Returns { success: false, error } if it could not be saved — callers must show that error.
 */
export async function recordWalletTransaction(params: {
  userId?: string;
  userEmail: string;
  userRole?: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  description?: string;
  relatedBookingId?: string | null;
  relatedProjectReviewId?: string | null;
}): Promise<{ success: boolean; newBalance: number; transaction?: WalletTransaction; error?: string; duplicate?: boolean }> {
  const cleanEmail = (params.userEmail || '').toLowerCase().trim();
  const cleanId = String(params.userId || cleanEmail).trim();
  const amount = Number(params.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, newBalance: 0, error: 'Transaction amount must be greater than 0' };
  }

  try {
    const res = await fetch(params.type === 'CREDIT' ? '/api/wallet/deposit' : '/api/wallet/deduct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: cleanId,
        userEmail: cleanEmail,
        userRole: params.userRole || 'client',
        amount,
        description: params.description || (params.type === 'CREDIT' ? 'Wallet Top-up' : 'Consultation Booking Payment'),
        relatedBookingId: params.relatedBookingId || null,
        relatedProjectReviewId: params.relatedProjectReviewId || null
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      const error = json?.error || `Wallet update failed (HTTP ${res.status})`;
      console.error('[WALLET] save failed:', error);
      return { success: false, newBalance: 0, error };
    }
    const newBalance = Number(json.balance) || 0;
    cacheBalanceLocally(cleanEmail, newBalance);
    try { mongoDB.syncKv(walletKey(cleanEmail), String(newBalance)); } catch {}
    return { success: true, newBalance, transaction: json.transaction, duplicate: Boolean(json.duplicate) };
  } catch (err: any) {
    console.error('[WALLET] save failed:', err);
    return { success: false, newBalance: 0, error: 'Could not reach the server. Your wallet was NOT changed — please try again.' };
  }
}

/**
 * Deposits money into the client wallet.
 */
export async function depositWallet(params: {
  userId?: string;
  userEmail: string;
  userRole?: string;
  amount: number;
  description?: string;
}) {
  return recordWalletTransaction({
    ...params,
    type: 'CREDIT',
    description: params.description || 'Wallet Top-up'
  });
}

/**
 * Deducts money from the client wallet for a booked consultation.
 * Pass relatedBookingId so a double click / retry can never charge the same booking twice.
 */
export async function deductWallet(params: {
  userId?: string;
  userEmail: string;
  userRole?: string;
  amount: number;
  description?: string;
  relatedBookingId?: string | null;
}) {
  return recordWalletTransaction({
    ...params,
    type: 'DEBIT',
    description: params.description || 'Consultation Booking Payment'
  });
}
