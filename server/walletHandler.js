import { fail, readJsonBody } from './workflowHttp.js';
import { randomUUID } from 'node:crypto';
import { supabase } from './supabaseClient.js';
import { getWalletBalance, getWalletHistory } from './egressHelpers.js';
import { readActor } from './session.js';


export async function handleWallet(req, res, next) {
  const path = (req.originalUrl || req.url || '').split('?')[0].replace(/\/$/, '');
  if (!['/api/wallet', '/api/wallet/deposit', '/api/wallet/deduct'].includes(path)) return next();
  let status = 200;
  let payload;
  try {
    const actor = await readActor(req);
    if (!actor) fail(401, 'Sign in to open your wallet');
    if (!['client', 'expert'].includes(actor.role)) fail(403, 'A client or expert wallet is required');
    if (req.method === 'GET' && path === '/api/wallet') {
      const [balance, transactions, summary] = await Promise.all([
        getWalletBalance(actor.email, actor.id),
        getWalletHistory(actor.email, actor.id, 50),
        actor.role === 'expert' ? supabase.rpc('expert_wallet_summary', { p_email: actor.email, p_id: actor.id }, { get: true }) : null
      ]);
      if (summary?.error) throw summary.error;
      payload = { success: true, balance, transactions, ...summary?.data };
    } else if (req.method === 'POST' && path !== '/api/wallet') {
      const deposit = path.endsWith('/deposit');
      if (actor.role !== (deposit ? 'client' : 'expert')) fail(403, 'This operation is unavailable for this wallet');
      const input = await readJsonBody(req, 8192);
      const amount = Math.round(Number(input?.amount) * 100) / 100;
      if (!Number.isFinite(amount) || amount <= 0 || amount > 99_999_999.99) fail(400, 'Enter a valid wallet amount');
      const id = input.requestId || randomUUID();
      if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) fail(400, 'Invalid wallet request ID');
      const operation = deposit ? 'topup' : 'withdrawal';
      const result = await supabase.rpc('workflow_wallet_apply', { p_tx: {
        id: `${operation}:${id}`, user_id: actor.id, user_email: actor.email, user_role: actor.role,
        amount, type: deposit ? 'CREDIT' : 'DEBIT',
        description: deposit ? 'Simulated UPI wallet top-up' : 'Simulated expert wallet withdrawal'
      } });
      if (result.error) throw result.error;
      payload = { success: true, ...result.data };
    } else fail(405, 'Method not allowed');
  } catch (error) {
    status = error.status || ({ P0001: 400, '22000': 409 }[error.code]) || 503;
    if (status >= 500) console.error('[wallet]', error.code || error.name);
    payload = { success: false, error: status >= 500 ? 'Wallet service unavailable. Please try again.' : error.message };
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}
