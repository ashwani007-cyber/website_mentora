import { supabase } from '../supabaseClient';
import { mongoDB } from '../mongoDBService';

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

/**
 * Fetches the client's authoritative wallet balance and transaction history from Supabase / Backend.
 * Automatically migrates existing local/kv balance if no backend transactions exist yet.
 */
export async function fetchWalletBalance(
  userId?: string,
  userEmail?: string,
  localFallback?: number
): Promise<WalletBalanceResult> {
  const cleanEmail = (userEmail || '').toLowerCase().trim();
  const cleanId = String(userId || '').trim();
  const walletStorageKey = `client_wallet_${cleanEmail || 'guest'}`;

  try {
    if (cleanEmail || cleanId) {
      let query = supabase.from('wallet_transactions').select('*');

      if (cleanEmail && cleanId && cleanEmail !== cleanId) {
        query = query.or(`user_email.ilike.${cleanEmail},user_id.eq.${cleanId}`);
      } else if (cleanEmail) {
        query = query.ilike('user_email', cleanEmail);
      } else if (cleanId) {
        query = query.eq('user_id', cleanId);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (!error && Array.isArray(data) && data.length > 0) {
        let balance = 0;
        data.forEach((tx: any) => {
          const amt = Number(tx.amount) || 0;
          const status = (tx.status || 'SUCCESS').toUpperCase();
          if (status === 'SUCCESS') {
            if (tx.type === 'CREDIT') balance += amt;
            else if (tx.type === 'DEBIT') balance -= amt;
          }
        });
        balance = Math.max(0, balance);

        // Cache locally for fast startup
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(walletStorageKey, String(balance));
            mongoDB.syncKv(walletStorageKey, String(balance));
          } catch {}
        }

        return { balance, transactions: data as WalletTransaction[] };
      }
    }
  } catch (err) {
    console.warn('[WALLET SERVICE] Error querying Supabase wallet_transactions:', err);
  }

  // Fallback & Migration: If no Supabase transactions yet, check backend KV or localFallback
  let candidateBalance = 0;
  try {
    const serverKv = await mongoDB.getKv(walletStorageKey);
    if (serverKv !== null && serverKv !== undefined && !isNaN(Number(serverKv))) {
      candidateBalance = Number(serverKv);
    }
  } catch {}

  if (candidateBalance <= 0 && typeof localFallback === 'number' && localFallback > 0) {
    candidateBalance = localFallback;
  }

  // Safe migration: If we have an existing positive balance, record it as an opening credit in Supabase
  if (candidateBalance > 0 && (cleanEmail || cleanId)) {
    try {
      const migrationTx = {
        id: `tx-mig-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        user_id: cleanId || cleanEmail,
        user_email: cleanEmail || cleanId,
        user_role: 'client',
        amount: candidateBalance,
        type: 'CREDIT' as const,
        status: 'SUCCESS' as const,
        description: 'Opening Balance (Migrated from Previous Session)'
      };

      const { data: inserted } = await supabase
        .from('wallet_transactions')
        .insert(migrationTx)
        .select()
        .single();

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(walletStorageKey, String(candidateBalance));
          mongoDB.syncKv(walletStorageKey, String(candidateBalance));
        } catch {}
      }

      return {
        balance: candidateBalance,
        transactions: inserted ? [inserted as WalletTransaction] : [migrationTx as WalletTransaction]
      };
    } catch (migErr) {
      console.warn('[WALLET SERVICE] Migration note:', migErr);
    }
  }

  return { balance: candidateBalance, transactions: [] };
}

/**
 * Records a wallet transaction (CREDIT or DEBIT) in Supabase and syncs the new balance.
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
}): Promise<{ success: boolean; newBalance: number; transaction?: WalletTransaction; error?: string }> {
  const cleanEmail = (params.userEmail || '').toLowerCase().trim();
  const cleanId = String(params.userId || cleanEmail).trim();
  const amount = Number(params.amount) || 0;
  const walletStorageKey = `client_wallet_${cleanEmail || 'guest'}`;

  if (amount <= 0) {
    return { success: false, newBalance: 0, error: 'Transaction amount must be greater than 0' };
  }

  const txRecord: WalletTransaction = {
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    user_id: cleanId || cleanEmail,
    user_email: cleanEmail,
    user_role: params.userRole || 'client',
    amount,
    type: params.type,
    status: 'SUCCESS',
    description: params.description || (params.type === 'CREDIT' ? 'Wallet Top-up' : 'Consultation Booking Payment'),
    related_booking_id: params.relatedBookingId || null,
    related_project_review_id: params.relatedProjectReviewId || null
  };

  try {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .insert(txRecord)
      .select()
      .single();

    if (error) {
      console.warn('[WALLET SERVICE] Supabase insert warning:', error.message);
    }

    // Refresh and return the newly recalculated authoritative balance
    const updated = await fetchWalletBalance(cleanId, cleanEmail);
    return {
      success: true,
      newBalance: updated.balance,
      transaction: data ? (data as WalletTransaction) : txRecord
    };
  } catch (err: any) {
    console.error('[WALLET SERVICE] recordWalletTransaction error:', err);
    // Optimistic fallback in case of connection drop
    const currentRaw = typeof window !== 'undefined' ? localStorage.getItem(walletStorageKey) : null;
    const current = currentRaw ? Number(currentRaw) || 0 : 0;
    const next = params.type === 'CREDIT' ? current + amount : Math.max(0, current - amount);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(walletStorageKey, String(next));
        mongoDB.syncKv(walletStorageKey, String(next));
      } catch {}
    }
    return { success: true, newBalance: next, transaction: txRecord };
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
