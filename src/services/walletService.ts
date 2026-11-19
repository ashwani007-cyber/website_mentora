import { apiSessionHeaders } from '../lib/apiSession';

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
  earnings?: number;
  trend?: Array<{ week: string; amount: number }>;
}

const walletKey = (email: string, role: string) => `${role}_wallet_${email || 'guest'}`;

export async function fetchWalletBalance(
  userId?: string,
  userEmail?: string,
  localFallback = 0,
  role: 'client' | 'expert' = 'client'
): Promise<WalletBalanceResult> {
  const email = (userEmail || '').toLowerCase().trim();
  if (!email && !userId) return { balance: 0, transactions: [] };
  const key = walletKey(email, role);
  try {
    const response = await fetch('/api/wallet', { headers: apiSessionHeaders(role) });
    const result = await response.json();
    if (response.ok && result.success) {
      const balance = Number(result.balance) || 0;
      localStorage.setItem(key, String(balance));
      return { balance, transactions: result.transactions || [], earnings: result.earnings, trend: result.trend };
    }
  } catch {}
  const cached = localStorage.getItem(key);
  return { balance: cached !== null && Number.isFinite(Number(cached)) ? Number(cached) : localFallback, transactions: [] };
}

export async function recordWalletTransaction(params: {
  userId?: string;
  userEmail: string;
  userRole?: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  description?: string;
  relatedBookingId?: string | null;
  relatedProjectReviewId?: string | null;
  requestId?: string;
}): Promise<{ success: boolean; newBalance: number; transaction?: WalletTransaction; error?: string; duplicate?: boolean }> {
  const cleanEmail = (params.userEmail || '').toLowerCase().trim();
  const role = params.userRole || 'client';
  const amount = Number(params.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, newBalance: 0, error: 'Transaction amount must be greater than 0' };
  }

  try {
    const res = await fetch(params.type === 'CREDIT' ? '/api/wallet/deposit' : '/api/wallet/deduct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...apiSessionHeaders(role) },
      body: JSON.stringify({ amount, requestId: params.requestId || crypto.randomUUID() })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      const error = json?.error || `Wallet update failed (HTTP ${res.status})`;
      console.error('[WALLET] save failed:', error);
      return { success: false, newBalance: 0, error };
    }
    const newBalance = Number(json.balance) || 0;
    localStorage.setItem(walletKey(cleanEmail, role), String(newBalance));
    return { success: true, newBalance, transaction: json.transaction, duplicate: Boolean(json.duplicate) };
  } catch (err: any) {
    console.error('[WALLET] save failed:', err);
    return { success: false, newBalance: 0, error: 'Could not confirm the wallet update. Try again to check whether it was saved.' };
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
  requestId?: string;
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
