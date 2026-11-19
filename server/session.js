import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { supabase, supabaseServiceKey } from './supabaseClient.js';

const publicRoles = new Set(['client', 'expert']);
const lifetimeMs = 12 * 60 * 60 * 1000;

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
export const hashAdminToken = (token) => createHash('sha256').update(token).digest('hex');
export const createAdminToken = () => `adm_${randomBytes(32).toString('hex')}`;
export const sessionExpiresAt = () => new Date(Date.now() + lifetimeMs).toISOString();

function sign(value) {
  return createHmac('sha256', supabaseServiceKey)
    .update('mentora-public-session-v1:').update(value).digest();
}

export function createPublicToken(user) {
  const claims = {
    id: String(user.id), email: normalizeEmail(user.email), role: user.role,
    name: user.name || user.full_name || '', expires: Date.now() + lifetimeMs
  };
  const value = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `usr_${value}.${sign(value).toString('base64url')}`;
}

function readPublicToken(token) {
  try {
    const [value, signature, extra] = token.slice(4).split('.');
    if (!value || !signature || extra !== undefined) return null;
    const supplied = Buffer.from(signature, 'base64url');
    const expected = sign(value);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    const actor = JSON.parse(Buffer.from(value, 'base64url').toString());
    return actor.expires > Date.now() && actor.id && actor.email && publicRoles.has(actor.role) ? actor : null;
  } catch {
    return null;
  }
}

export function getRequestToken(req) {
  const headers = req.headers || {};
  const admin = headers['x-admin-token'] || headers.admin_token;
  return typeof admin === 'string' && admin ? admin : String(headers.authorization || '').match(/^Bearer (\S+)$/i)?.[1] || '';
}

export async function readActor(req) {
  const token = getRequestToken(req);
  if (token.startsWith('usr_')) return readPublicToken(token);
  if (!/^adm_[a-f0-9]{64}$/.test(token)) return null;
  const { data, error } = await supabase.from('admin_credentials').select('email')
    .eq('current_token_hash', hashAdminToken(token))
    .gt('session_expires_at', new Date().toISOString()).maybeSingle();
  if (error) throw error;
  return data && { id: data.email, email: data.email, name: 'Platform Admin', role: 'admin' };
}

export async function isAuthorizedAdmin(req) {
  try {
    return (await readActor(req))?.role === 'admin';
  } catch {
    return false;
  }
}
