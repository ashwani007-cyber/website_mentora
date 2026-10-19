import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateResetToken, storeResetToken, validateResetToken, markTokenUsed } from './shared/tokenService.js';
import { sendResetEmail } from './shared/emailService.js';
import { checkRateLimit } from './shared/rateLimiter.js';
import { findUserByEmail, updateUserPassword } from './shared/userLookup.js';

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  // If body is already parsed (by express.json()), use it
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

/**
 * Handle POST /api/auth/forgot-password
 * Generates a secure reset token and sends email.
 * NEVER reveals whether the email exists.
 */
export async function handleForgotPassword(req, res) {
  try {
    const body = await parseBody(req);
    const { email } = body;
    
    if (!email || typeof email !== 'string') {
      return sendJson(res, 400, { success: false, error: 'Email is required' });
    }
    
    const cleanEmail = email.trim().toLowerCase();
    
    // Rate limiting by email
    const rateCheck = checkRateLimit(`forgot:${cleanEmail}`);
    if (!rateCheck.allowed) {
      // Still return generic message to not reveal rate-limit info
      return sendJson(res, 200, {
        success: true,
        message: 'If an account exists with this email address, a password reset link has been sent. Please check your email.'
      });
    }
    
    // Also rate limit by IP
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const ipRateCheck = checkRateLimit(`forgot:ip:${clientIp}`);
    if (!ipRateCheck.allowed) {
      return sendJson(res, 200, {
        success: true,
        message: 'If an account exists with this email address, a password reset link has been sent. Please check your email.'
      });
    }
    
    // Always return the same success message regardless of whether the email exists
    const genericResponse = {
      success: true,
      message: 'If an account exists with this email address, a password reset link has been sent. Please check your email.'
    };
    
    // Look up user (silently)
    const lookup = await findUserByEmail(cleanEmail);
    
    if (!lookup.found) {
      // Email doesn't exist — return same generic message (account enumeration protection)
      return sendJson(res, 200, genericResponse);
    }
    
    // Generate secure token
    const { rawToken, tokenHash } = generateResetToken();
    
    // Store token in database
    await storeResetToken({
      tokenHash,
      userId: lookup.user.id || lookup.user._id?.toString() || cleanEmail,
      userEmail: cleanEmail,
      accountType: lookup.accountType
    });
    
    // Send reset email
    try {
      await sendResetEmail(cleanEmail, rawToken);
    } catch (emailErr) {
      console.error('[PasswordReset] Email delivery failed:', emailErr.message);
      // Still return generic message — don't reveal email delivery issues
    }
    
    return sendJson(res, 200, genericResponse);
  } catch (err) {
    console.error('[PasswordReset] Forgot password error:', err);
    return sendJson(res, 500, { success: false, error: 'An error occurred. Please try again later.' });
  }
}

/**
 * Handle POST /api/auth/validate-reset-token
 * Validates a token and returns the associated email (for display on reset page).
 */
export async function handleValidateResetToken(req, res) {
  try {
    const body = await parseBody(req);
    const { token } = body;
    
    if (!token) {
      return sendJson(res, 400, { success: false, error: 'Reset token is required.' });
    }
    
    const result = await validateResetToken(token);
    
    if (!result.valid) {
      return sendJson(res, 400, { success: false, error: result.error, code: result.code });
    }
    
    // Return email for display (read-only on frontend)
    return sendJson(res, 200, {
      success: true,
      email: result.record.userEmail,
      accountType: result.record.accountType
    });
  } catch (err) {
    console.error('[PasswordReset] Token validation error:', err);
    return sendJson(res, 500, { success: false, error: 'An error occurred. Please try again later.' });
  }
}

/**
 * Handle POST /api/auth/reset-password
 * Validates the token and updates the password.
 */
export async function handleResetPassword(req, res) {
  try {
    const body = await parseBody(req);
    const { token, newPassword, confirmPassword } = body;
    
    // 1. Token is required
    if (!token || typeof token !== 'string') {
      return sendJson(res, 400, { success: false, error: 'A valid reset token is required. Please use the link sent to your email.' });
    }
    
    // 2. Password validation
    if (!newPassword || typeof newPassword !== 'string') {
      return sendJson(res, 400, { success: false, error: 'New password is required.' });
    }
    
    if (newPassword.length < 6) {
      return sendJson(res, 400, { success: false, error: 'Password must be at least 6 characters long.' });
    }
    
    // 3. Confirm password match
    if (confirmPassword && newPassword !== confirmPassword) {
      return sendJson(res, 400, { success: false, error: 'Passwords do not match.' });
    }
    
    // Rate limit reset attempts
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const rateCheck = checkRateLimit(`reset:ip:${clientIp}`);
    if (!rateCheck.allowed) {
      return sendJson(res, 429, { success: false, error: 'Too many reset attempts. Please try again later.' });
    }
    
    // 4. Validate token
    const result = await validateResetToken(token);
    if (!result.valid) {
      return sendJson(res, 400, { success: false, error: result.error, code: result.code });
    }
    
    const { record } = result;
    
    // 5. Verify user still exists
    const lookup = await findUserByEmail(record.userEmail);
    if (!lookup.found) {
      return sendJson(res, 400, { success: false, error: 'Account not found. Please contact support.' });
    }
    
    // 6. Hash new password using bcrypt (same mechanism as existing app)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // 7. Update existing user's password in existing database
    await updateUserPassword(record.userEmail, hashedPassword, record.accountType);
    
    // 8. Mark token as used (one-time use)
    await markTokenUsed(record.tokenHash);
    
    console.log(`[PasswordReset] Password successfully reset for: ${record.userEmail} (${record.accountType})`);
    
    return sendJson(res, 200, {
      success: true,
      message: 'Password reset successfully. You can now log in using your new password.'
    });
  } catch (err) {
    console.error('[PasswordReset] Reset password error:', err);
    return sendJson(res, 500, { success: false, error: 'An error occurred. Please try again later.' });
  }
}
