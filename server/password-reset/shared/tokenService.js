import crypto from 'crypto';
import { getDb } from '../../mongoHandler.js';

const TOKEN_EXPIRY_MS = parseInt(process.env.PASSWORD_RESET_EXPIRY || '1800000', 10); // 30 minutes default

/**
 * Generate a cryptographically secure reset token.
 * Returns { rawToken, tokenHash }
 */
export function generateResetToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

/**
 * Store a reset token in the database.
 * Invalidates any previous unused tokens for the same user.
 */
export async function storeResetToken({ tokenHash, userId, userEmail, accountType }) {
  const db = await getDb();
  const col = db.collection('password_reset_tokens');
  
  // Invalidate all previous unused tokens for this email
  await col.updateMany(
    { userEmail: userEmail.trim().toLowerCase(), usedAt: null },
    { $set: { usedAt: new Date().toISOString(), invalidatedReason: 'superseded' } }
  );
  
  const doc = {
    tokenHash,
    userId,
    userEmail: userEmail.trim().toLowerCase(),
    accountType, // 'admin', 'client', 'expert'
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString(),
    usedAt: null,
    createdAt: new Date().toISOString()
  };
  
  await col.insertOne(doc);
  return doc;
}

/**
 * Validate a reset token. Returns the token record if valid, or an error.
 */
export async function validateResetToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 32) {
    return { valid: false, error: 'Invalid password reset link.', code: 'INVALID' };
  }
  
  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
  const db = await getDb();
  const col = db.collection('password_reset_tokens');
  
  const record = await col.findOne({ tokenHash });
  
  if (!record) {
    return { valid: false, error: 'Invalid password reset link. Please request a new reset link.', code: 'INVALID' };
  }
  
  if (record.usedAt) {
    return { valid: false, error: 'This password reset link has already been used. Please request a new reset link.', code: 'USED' };
  }
  
  if (new Date(record.expiresAt) < new Date()) {
    return { valid: false, error: 'This password reset link has expired. Please request a new reset link.', code: 'EXPIRED' };
  }
  
  return { valid: true, record };
}

/**
 * Mark a token as used (one-time use enforcement).
 */
export async function markTokenUsed(tokenHash) {
  const db = await getDb();
  await db.collection('password_reset_tokens').updateOne(
    { tokenHash },
    { $set: { usedAt: new Date().toISOString() } }
  );
}

/**
 * Clean up expired tokens (optional maintenance).
 */
export async function cleanupExpiredTokens() {
  const db = await getDb();
  const cutoff = new Date().toISOString();
  await db.collection('password_reset_tokens').deleteMany({
    expiresAt: { $lt: cutoff },
    usedAt: { $ne: null }
  });
}
