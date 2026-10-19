import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGO_DB_NAME || 'silver_workforce';

// ── INTERNAL ADMIN CONFIGURATION ────────────────────────────────────────────
// These constants are NEVER sent to the frontend. They exist only in server memory.
// The admin role is determined silently inside the backend authentication endpoint.
export const ADMIN_EMAILS = [
  'kushwahaashwani12@gmail.com',
  'kushwaahaashwani12@gmail.com',
  'kushwaashwani12@gmail.com'
];

export function isAdminEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  return ADMIN_EMAILS.includes(clean);
}

const PRIMARY_ADMIN_EMAIL = 'kushwaahaashwani12@gmail.com';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || PRIMARY_ADMIN_EMAIL).trim().toLowerCase();
// ────────────────────────────────────────────────────────────────────────────

class AsyncLock {
  constructor() {
    this.queue = [];
    this.locked = false;
  }

  acquire() {
    return new Promise((resolve) => {
      const release = () => {
        if (this.queue.length > 0) {
          const next = this.queue.shift();
          next();
        } else {
          this.locked = false;
        }
      };
      if (this.locked) {
        this.queue.push(() => resolve(release));
      } else {
        this.locked = true;
        resolve(release);
      }
    });
  }
}

const bookingLock = new AsyncLock();
const projectReviewLock = new AsyncLock();

let mongoClient = null;
let dbInstance = null;

export async function getDb() {
  if (dbInstance) return dbInstance;
  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
      });
      await mongoClient.connect();
      console.log(`[mongoHandler] Successfully connected to MongoDB database: ${DB_NAME}`);
    }
    dbInstance = mongoClient.db(DB_NAME);
    return dbInstance;
  } catch (err) {
    console.error(`[mongoHandler] Failed to connect to MongoDB (${MONGO_URI}):`, err.message);
    throw err;
  }
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const clean = timeStr.trim();
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const ampm = match12[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }
  return null;
}

function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isSlotInPast(dateStr, startTimeStr) {
  const today = getTodayString();
  if (dateStr < today) return true;
  if (dateStr > today) return false;
  const startMin = parseTimeToMinutes(startTimeStr);
  if (startMin === null) return false;
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  return startMin <= currentMin;
}

// Helper to sanitize user object (never return password)
function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

// Parse request body
function parseBody(req) {
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

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

// -------------------------------------------------------------
// MAIN API MIDDLEWARE
// -------------------------------------------------------------
export async function handleApiMiddleware(req, res, next) {
  const url = req.url || '';
  if (!url.startsWith('/api/')) {
    if (next) return next();
    return;
  }

  let db;
  try {
    db = await getDb();
  } catch (err) {
    return sendJson(res, 503, {
      success: false,
      error: 'MongoDB database is currently unreachable',
      details: err.message
    });
  }

  const parsedUrl = new URL(url, 'http://localhost');
  const pathname = parsedUrl.pathname;

  // ===========================================================
  // 1. AUTHENTICATION & USERS APIS
  // ===========================================================
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const payload = await parseBody(req);
      const { email, password, role = 'client', name, phone, company, title, field, bio, years, baseRate } = payload;

      if (!email || !password) {
        return sendJson(res, 400, { success: false, error: 'Email and password are required' });
      }

      const cleanEmail = email.trim().toLowerCase();

      // If attempting to register with the authoritative admin email
      if (isAdminEmail(cleanEmail)) {
        const adminCol = db.collection('admin_credentials');
        const usersCol = db.collection('users');

        let adminRecord = await adminCol.findOne({
          $or: [
            { email: { $in: ADMIN_EMAILS } },
            { email: cleanEmail }
          ]
        });

        let userRecord = await usersCol.findOne({
          $or: [
            { email: { $in: ADMIN_EMAILS } },
            { email: cleanEmail }
          ]
        });

        const isUninitialized = (
          !adminRecord ||
          adminRecord.initialized === false ||
          adminRecord.adminPasswordInitialized === false ||
          adminRecord.isPasswordInitialized === false ||
          !adminRecord.password ||
          typeof adminRecord.password !== 'string' ||
          adminRecord.password.trim() === '' ||
          adminRecord.password === 'UNINITIALIZED' ||
          adminRecord.password === 'PENDING_FIRST_LOGIN' ||
          (!adminRecord.password.startsWith('$2a$') && !adminRecord.password.startsWith('$2b$')) ||
          (userRecord && (userRecord.isPasswordInitialized === false || userRecord.adminPasswordInitialized === false))
        );

        if (!isUninitialized) {
          return sendJson(res, 409, {
            success: false,
            error: `Account already registered in MongoDB with email "${email}". Please switch to Sign In!`
          });
        }

        // Establish first admin password!
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const token = 'adm_' + crypto.randomBytes(32).toString('hex');
        const nowIso = new Date().toISOString();

        await adminCol.updateOne(
          {
            $or: [
              { email: { $in: ADMIN_EMAILS } },
              { email: cleanEmail }
            ]
          },
          {
            $set: {
              email: cleanEmail,
              password: hashedPassword,
              role: 'admin',
              initialized: true,
              adminPasswordInitialized: true,
              isPasswordInitialized: true,
              currentToken: token,
              lastLogin: nowIso,
              failedLoginAttempts: 0,
              lockedUntil: null,
              updatedAt: nowIso,
              createdAt: adminRecord?.createdAt || nowIso
            }
          },
          { upsert: true }
        );

        await usersCol.updateOne(
          {
            $or: [
              { email: { $in: ADMIN_EMAILS } },
              { email: cleanEmail }
            ]
          },
          {
            $set: {
              id: 'usr-admin-ashwani',
              name: 'Executive Governance Admin',
              email: cleanEmail,
              password: hashedPassword,
              role: 'admin',
              initialized: true,
              adminPasswordInitialized: true,
              isPasswordInitialized: true,
              lastLogin: nowIso,
              updatedAt: nowIso
            },
            $setOnInsert: {
              createdAt: nowIso
            }
          },
          { upsert: true }
        );

        console.log(`[mongoHandler] Admin account initialized via register flow: ${cleanEmail}`);
        return sendJson(res, 200, {
          success: true,
          message: `Admin account initialized and registered successfully in MongoDB!`,
          token: token,
          user: {
            id: 'usr-admin-ashwani',
            name: 'Executive Governance Admin',
            email: cleanEmail,
            role: 'admin',
            token: token
          }
        });
      }

      // Role conflict protection: Normal accounts cannot register with role=admin
      const enforcedRole = (role === 'admin') ? 'client' : role;

      const usersCol = db.collection('users');
      const existing = await usersCol.findOne({ email: cleanEmail });

      if (existing) {
        return sendJson(res, 409, {
          success: false,
          error: `Account already registered in MongoDB with email "${email}". Please switch to Sign In!`
        });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const userId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const nowIso = new Date().toISOString();

      const userDoc = {
        id: userId,
        name: name || (enforcedRole === 'client' ? 'Client Partner' : 'Executive Expert'),
        email: cleanEmail,
        password: hashedPassword,
        phone: phone || '+91 98765 43210',
        role: enforcedRole,
        company: company || (role === 'client' ? 'Corporate Advisory Client' : ''),
        companyName: company || '',
        title: title || (role === 'expert' ? `Senior ${field || 'Executive'} Specialist` : ''),
        domain: field || 'Finance & Advisory',
        field: field || 'Finance & Advisory',
        yearsExperience: Number(years) || 25,
        years: Number(years) || 25,
        baseRate: Math.max(0, Math.min(1000, Number(baseRate) || 600)),
        hourlyRate: Math.max(0, Math.min(1000, Number(baseRate) || 600)) + 150,
        rate: Math.max(0, Math.min(1000, Number(baseRate) || 600)) + 150,
        projectRate: 1500,
        walletBalance: role === 'client' ? 25000 : 15000,
        subscriptionTier: 'free',
        bio: bio || (role === 'client' ? 'Enterprise client seeking expert advisory.' : 'Seasoned executive with decades of industry experience.'),
        skills: [],
        location: 'India',
        avatar: '',
        verifiedStatus: role === 'admin' ? 'approved' : role === 'client' ? 'approved' : 'pending',
        isFeatured: false,
        rating: 5.0,
        reviewsCount: 0,
        completedSessions: 0,
        totalEarnings: 0,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await usersCol.insertOne(userDoc);

      // If registering as Expert, also create expert document and pending verification in MongoDB
      if (role === 'expert') {
        const expId = `exp-${Date.now()}`;
        const expertDoc = {
          id: expId,
          name: userDoc.name,
          email: cleanEmail,
          field: userDoc.field,
          years: userDoc.years,
          baseRate: userDoc.baseRate,
          adminMarkup: 150,
          rate: userDoc.baseRate + 150,
          rating: 5.0,
          sessions: 0,
          verified: false,
          verificationStatus: 'pending',
          rejected: false,
          initials: userDoc.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
          title: userDoc.title,
          phone: userDoc.phone,
          bio: userDoc.bio,
          skills: [],
          experience: [],
          education: 'Executive Leadership Program',
          projectRate: 1500,
          company: userDoc.company,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        await db.collection('experts').updateOne({ email: cleanEmail }, { $set: expertDoc }, { upsert: true });

        const pendDoc = {
          id: `pv-${Date.now()}`,
          name: userDoc.name,
          email: cleanEmail,
          field: userDoc.field,
          years: userDoc.years,
          title: userDoc.title,
          company: userDoc.company,
          baseRate: userDoc.baseRate,
          phone: userDoc.phone,
          bio: userDoc.bio,
          verified: false,
          verificationStatus: 'pending',
          rejected: false,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        await db.collection('pending_verifications').updateOne({ email: cleanEmail }, { $set: pendDoc }, { upsert: true });
      }

      console.log(`[mongoHandler] Registered new user in MongoDB: ${cleanEmail} (${role})`);
      return sendJson(res, 201, {
        success: true,
        message: `Registration successful in MongoDB! Account created for ${cleanEmail}.`,
        user: sanitizeUser(userDoc)
      });
    } catch (err) {
      console.error('[mongoHandler] Register error:', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const { email, password } = await parseBody(req);
      if (!email || !password) {
        return sendJson(res, 400, { success: false, error: 'Email and password are required' });
      }

      const cleanEmail = email.trim().toLowerCase();

      // ── ADMIN LOGIN VALIDATION ───────────────────────────────────────────
      if (isAdminEmail(cleanEmail)) {
        const adminCol = db.collection('admin_credentials');
        const usersCol = db.collection('users');

        let adminRecord = await adminCol.findOne({
          $or: [
            { email: { $in: ADMIN_EMAILS } },
            { email: cleanEmail }
          ]
        });

        let userRecord = await usersCol.findOne({
          $or: [
            { email: { $in: ADMIN_EMAILS } },
            { email: cleanEmail }
          ]
        });

        // FIRST PASSWORD SETUP: Check if admin account is uninitialized
        const isUninitialized = (
          !adminRecord ||
          adminRecord.initialized === false ||
          adminRecord.adminPasswordInitialized === false ||
          adminRecord.isPasswordInitialized === false ||
          !adminRecord.password ||
          typeof adminRecord.password !== 'string' ||
          adminRecord.password.trim() === '' ||
          adminRecord.password === 'UNINITIALIZED' ||
          adminRecord.password === 'PENDING_FIRST_LOGIN' ||
          (!adminRecord.password.startsWith('$2a$') && !adminRecord.password.startsWith('$2b$')) ||
          (userRecord && (userRecord.isPasswordInitialized === false || userRecord.adminPasswordInitialized === false))
        );

        if (isUninitialized) {
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(password, salt);
          const token = 'adm_' + crypto.randomBytes(32).toString('hex');
          const nowIso = new Date().toISOString();

          await adminCol.updateOne(
            {
              $or: [
                { email: { $in: ADMIN_EMAILS } },
                { email: cleanEmail }
              ]
            },
            {
              $set: {
                email: cleanEmail,
                password: hashedPassword,
                role: 'admin',
                initialized: true,
                adminPasswordInitialized: true,
                isPasswordInitialized: true,
                currentToken: token,
                lastLogin: nowIso,
                failedLoginAttempts: 0,
                lockedUntil: null,
                updatedAt: nowIso,
                createdAt: adminRecord?.createdAt || nowIso
              }
            },
            { upsert: true }
          );

          await usersCol.updateOne(
            {
              $or: [
                { email: { $in: ADMIN_EMAILS } },
                { email: cleanEmail }
              ]
            },
            {
              $set: {
                id: 'usr-admin-ashwani',
                name: 'Executive Governance Admin',
                email: cleanEmail,
                password: hashedPassword,
                role: 'admin',
                initialized: true,
                adminPasswordInitialized: true,
                isPasswordInitialized: true,
                lastLogin: nowIso,
                updatedAt: nowIso
              },
              $setOnInsert: {
                createdAt: nowIso
              }
            },
            { upsert: true }
          );

          console.log(`[mongoHandler] Admin first-password established and authenticated: ${cleanEmail}`);
          return sendJson(res, 200, {
            success: true,
            message: 'Admin password established and authenticated via MongoDB Database.',
            token: token,
            user: {
              id: 'usr-admin-ashwani',
              name: 'Executive Governance Admin',
              email: cleanEmail,
              role: 'admin',
              token: token
            }
          });
        }

        // SUBSEQUENT LOGINS: Verify against stored bcrypt password hash
        let isValid = await bcrypt.compare(password, adminRecord.password);
        if (!isValid && userRecord && userRecord.password) {
          if (userRecord.password.startsWith('$2a$') || userRecord.password.startsWith('$2b$')) {
            isValid = await bcrypt.compare(password, userRecord.password);
          }
        }

        if (!isValid) {
          return sendJson(res, 401, {
            success: false,
            error: `Incorrect password for ${email}. Please check your credentials.`
          });
        }

        // Generate secure server-side session token
        const token = 'adm_' + crypto.randomBytes(32).toString('hex');
        const nowIso = new Date().toISOString();

        // Update token and last login timestamp in database
        await adminCol.updateOne(
          { _id: adminRecord._id },
          { $set: { currentToken: token, lastLogin: nowIso, failedLoginAttempts: 0, lockedUntil: null, updatedAt: nowIso } }
        );

        console.log(`[mongoHandler] Admin authenticated: ${cleanEmail}`);
        return sendJson(res, 200, {
          success: true,
          message: 'Welcome back! Authenticated via MongoDB Database.',
          token: token,
          user: {
            id: userRecord?.id || 'usr-admin-ashwani',
            name: userRecord?.name || 'Executive Governance Admin',
            email: cleanEmail,
            role: 'admin',
            token: token
          }
        });
      }
      // ── END ADMIN LOGIN VALIDATION ────────────────────────────────────────

      // Normal client / expert login flow
      const usersCol = db.collection('users');
      const user = await usersCol.findOne({ email: cleanEmail });

      if (!user) {
        return sendJson(res, 404, {
          success: false,
          error: `No account registered in MongoDB with email "${email}". You MUST REGISTER FIRST before signing in!`
        });
      }

      // Verify bcrypt password hash
      let isValidPassword = false;
      if (user.password) {
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
          isValidPassword = await bcrypt.compare(password, user.password);
        } else {
          // Legacy plain password match check, then immediately upgrade to bcrypt
          if (user.password === password) {
            isValidPassword = true;
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(password, salt);
            await usersCol.updateOne({ _id: user._id }, { $set: { password: hashed } });
          }
        }
      }

      if (!isValidPassword) {
        return sendJson(res, 401, {
          success: false,
          error: `Incorrect password for ${email}. Please check your credentials.`
        });
      }

      // Update lastLogin timestamp in MongoDB
      await usersCol.updateOne({ _id: user._id }, { $set: { lastLogin: new Date().toISOString() } });

      console.log(`[mongoHandler] Successfully authenticated MongoDB user: ${cleanEmail} (${user.role})`);
      return sendJson(res, 200, {
        success: true,
        message: `Welcome back! Authenticated via MongoDB Database.`,
        user: sanitizeUser(user)
      });
    } catch (err) {
      console.error('[mongoHandler] Login error:', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // ── FORGOT PASSWORD (INITIATE PASSWORD RESET) ──────────────────────────────
  if (pathname === '/api/auth/forgot-password' && req.method === 'POST') {
    try {
      const { email } = await parseBody(req);
      if (!email) {
        return sendJson(res, 400, { success: false, error: 'Email is required' });
      }
      const cleanEmail = email.trim().toLowerCase();
      const adminCol = db.collection('admin_credentials');
      const adminRecord = await adminCol.findOne({ email: cleanEmail });

      const rawToken = crypto.randomBytes(16).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      if (adminRecord || cleanEmail === ADMIN_EMAIL) {
        await adminCol.updateOne(
          { email: cleanEmail },
          { $set: { resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt, resetTokenUsed: false } },
          { upsert: true }
        );
      }

      return sendJson(res, 200, {
        success: true,
        message: 'Password reset request verified. You may now enter your new password.',
        resetToken: rawToken
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // ── SECURE PASSWORD RESET ──────────────────────────────────────────────────
  if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
    try {
      const { email, newPassword, confirmPassword, token } = await parseBody(req);
      if (!email || !newPassword) {
        return sendJson(res, 400, { success: false, error: 'Email and new password are required' });
      }
      if (newPassword.length < 6) {
        return sendJson(res, 400, { success: false, error: 'Password must be at least 6 characters long' });
      }
      if (confirmPassword && newPassword !== confirmPassword) {
        return sendJson(res, 400, { success: false, error: 'Passwords do not match' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const adminCol = db.collection('admin_credentials');
      const usersCol = db.collection('users');

      // Verify token if provided
      if (token) {
        const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
        const record = await adminCol.findOne({ email: cleanEmail, resetTokenHash: tokenHash });
        if (record && record.resetTokenExpiresAt && new Date(record.resetTokenExpiresAt) < new Date()) {
          return sendJson(res, 400, { success: false, error: 'Reset token has expired. Please request a new one.' });
        }
      }

      // Hash new password using bcrypt
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      const nowIso = new Date().toISOString();

      if (isAdminEmail(cleanEmail)) {
        // Update admin_credentials
        await adminCol.updateOne(
          {
            $or: [
              { email: { $in: ADMIN_EMAILS } },
              { email: cleanEmail }
            ]
          },
          {
            $set: {
              email: cleanEmail,
              password: hashedPassword,
              role: 'admin',
              initialized: true,
              adminPasswordInitialized: true,
              isPasswordInitialized: true,
              currentToken: null,
              resetTokenHash: null,
              resetTokenExpiresAt: null,
              resetTokenUsed: true,
              failedLoginAttempts: 0,
              lockedUntil: null,
              passwordChangedAt: nowIso,
              updatedAt: nowIso
            }
          },
          { upsert: true }
        );

        // Also sync users collection for this email
        await usersCol.updateOne(
          {
            $or: [
              { email: { $in: ADMIN_EMAILS } },
              { email: cleanEmail }
            ]
          },
          {
            $set: {
              password: hashedPassword,
              role: 'admin',
              initialized: true,
              adminPasswordInitialized: true,
              isPasswordInitialized: true,
              updatedAt: nowIso
            }
          }
        );
      } else {
        // Normal user / expert password reset
        const existingUser = await usersCol.findOne({ email: cleanEmail });
        if (!existingUser) {
          return sendJson(res, 404, {
            success: false,
            error: `No registered account found in MongoDB with email "${cleanEmail}". You must register first!`
          });
        }
        await usersCol.updateOne(
          { email: cleanEmail },
          { $set: { password: hashedPassword, updatedAt: nowIso } }
        );
      }

      console.log(`[mongoHandler] Password successfully reset for: ${cleanEmail}`);
      return sendJson(res, 200, {
        success: true,
        message: `Password reset successfully for ${cleanEmail}! You may now sign in with your new password.`
      });
    } catch (err) {
      console.error('[mongoHandler] Reset password error:', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // ── AUTHENTICATED PASSWORD CHANGE ──────────────────────────────────────────
  if (pathname === '/api/auth/change-password' && req.method === 'POST') {
    try {
      const authHeader = req.headers['authorization'] || '';
      const tokenHeader = req.headers['x-admin-token'] || '';
      const token = (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : tokenHeader);

      if (!token) return sendJson(res, 401, { success: false, error: 'Administrative session required' });
      const adminCol = db.collection('admin_credentials');
      const adminRecord = await adminCol.findOne({ currentToken: token });
      if (!adminRecord) return sendJson(res, 401, { success: false, error: 'Invalid or expired admin session' });

      const { currentPassword, newPassword, confirmPassword } = await parseBody(req);
      if (!currentPassword || !newPassword) {
        return sendJson(res, 400, { success: false, error: 'Current and new password required' });
      }
      if (newPassword !== confirmPassword) {
        return sendJson(res, 400, { success: false, error: 'Passwords do not match' });
      }

      const isValid = await bcrypt.compare(currentPassword, adminRecord.password);
      if (!isValid) {
        return sendJson(res, 400, { success: false, error: 'Current password is incorrect' });
      }

      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      const newToken = 'adm_' + crypto.randomBytes(32).toString('hex');
      const nowIso = new Date().toISOString();

      await adminCol.updateOne(
        { _id: adminRecord._id },
        { $set: { password: hashedPassword, currentToken: newToken, passwordChangedAt: nowIso, updatedAt: nowIso } }
      );
      await db.collection('users').updateOne(
        { email: adminRecord.email },
        { $set: { password: hashedPassword, updatedAt: nowIso } }
      );

      return sendJson(res, 200, { success: true, message: 'Password changed successfully', token: newToken });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // ── ADMIN SESSION VERIFICATION (Backend Server-Authoritative) ──────────────
  if (pathname === '/api/auth/verify-admin' && req.method === 'GET') {
    try {
      const authHeader = req.headers['authorization'] || '';
      const tokenHeader = req.headers['x-admin-token'] || '';
      const queryToken = parsedUrl.searchParams.get('token') || '';
      const token = (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : tokenHeader) || queryToken;

      if (!token) {
        return sendJson(res, 401, { success: false, authenticated: false, error: 'No admin token provided' });
      }

      const adminCol = db.collection('admin_credentials');
      const adminRecord = await adminCol.findOne({ currentToken: token });

      if (!adminRecord) {
        return sendJson(res, 401, { success: false, authenticated: false, error: 'Invalid or expired admin session' });
      }

      return sendJson(res, 200, {
        success: true,
        authenticated: true,
        user: {
          id: 'usr-admin-ashwani',
          name: 'Executive Governance Admin',
          email: adminRecord.email,
          role: 'admin'
        }
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // ── ADMIN LOGOUT (Clears session token in database) ────────────────────────
  if (pathname === '/api/auth/admin-logout' && req.method === 'POST') {
    try {
      const authHeader = req.headers['authorization'] || '';
      const tokenHeader = req.headers['x-admin-token'] || '';
      const token = (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : tokenHeader);

      if (token) {
        const adminCol = db.collection('admin_credentials');
        await adminCol.updateOne({ currentToken: token }, { $unset: { currentToken: "" } });
      }

      return sendJson(res, 200, { success: true, message: 'Admin session terminated' });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  if (pathname === '/api/auth/users' && req.method === 'GET') {
    try {
      const users = await db.collection('users').find({}).project({ password: 0 }).toArray();
      return sendJson(res, 200, { success: true, users });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // PUT /api/auth/profile or /api/auth/users/:id (Real-time Profile Auto-Save)
  if ((pathname === '/api/auth/profile' || pathname.startsWith('/api/auth/users/')) && (req.method === 'PUT' || req.method === 'PATCH')) {
    try {
      const payload = await parseBody(req);
      const email = (payload.email || '').toLowerCase().trim();
      const originalEmail = (payload.originalEmail || payload.prevEmail || '').toLowerCase().trim();
      const pathId = pathname.startsWith('/api/auth/users/') ? pathname.replace('/api/auth/users/', '') : '';
      const id = pathId || payload.id;

      const orConditions = [];
      if (id) orConditions.push({ id });
      if (originalEmail) orConditions.push({ email: originalEmail });
      if (email) orConditions.push({ email });

      const filter = orConditions.length > 0 ? (orConditions.length === 1 ? orConditions[0] : { $or: orConditions }) : { email };

      const updateData = { ...payload, updatedAt: new Date().toISOString() };
      delete updateData._id;
      delete updateData.password; // Do not overwrite password hash
      delete updateData.originalEmail;
      delete updateData.prevEmail;

      // Ensure normalized field names for client and expert
      if (updateData.company && !updateData.companyName) updateData.companyName = updateData.company;
      if (updateData.companyName && !updateData.company) updateData.company = updateData.companyName;
      if (updateData.field && !updateData.domain) updateData.domain = updateData.field;
      if (updateData.domain && !updateData.field) updateData.field = updateData.domain;

      let result = await db.collection('users').findOneAndUpdate(
        filter,
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result && (id || originalEmail || email)) {
        // Fallback: try by email or id individually
        result = await db.collection('users').findOneAndUpdate(
          { $or: [{ email: originalEmail || email }, { id: id || '' }] },
          { $set: updateData },
          { returnDocument: 'after' }
        );
      }

      // If expert, also update experts collection in MongoDB
      if (payload.role === 'expert' || payload.field || payload.baseRate !== undefined) {
        const expertFilter = [];
        if (id) expertFilter.push({ id });
        if (originalEmail) expertFilter.push({ email: originalEmail });
        if (email) expertFilter.push({ email });
        
        await db.collection('experts').updateOne(
          expertFilter.length > 1 ? { $or: expertFilter } : expertFilter[0],
          { $set: updateData },
          { upsert: false }
        );
      }

      console.log(`[mongoHandler] Profile auto-saved in MongoDB for: ${email || id}`);
      return sendJson(res, 200, { success: true, user: sanitizeUser(result) });
    } catch (err) {
      console.error('[mongoHandler] Profile update error:', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // DELETE /api/auth/users/:id (Delete user from MongoDB)
  if (pathname.startsWith('/api/auth/users/') && req.method === 'DELETE') {
    const id = pathname.replace('/api/auth/users/', '');
    try {
      await db.collection('users').deleteOne({ $or: [{ id }, { email: id.toLowerCase() }] });
      await db.collection('experts').deleteOne({ $or: [{ id }, { email: id.toLowerCase() }] });
      await db.collection('pending_verifications').deleteOne({ $or: [{ id }, { email: id.toLowerCase() }] });
      return sendJson(res, 200, { success: true });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // ===========================================================
  // 2. ENDPOINT: /api/db (Full MongoDB collections sync)
  // ===========================================================
  if (url.startsWith('/api/db')) {
    if (req.method === 'GET') {
      try {
        const experts = await db.collection('experts').find({}).toArray();
        const users = await db.collection('users').find({}).project({ password: 0 }).toArray();
        const pendingVerifications = await db.collection('pending_verifications').find({}).toArray();
        const availabilities = await db.collection('availabilities').find({}).toArray();
        const projectReviews = await db.collection('project_reviews').find({}).toArray();
        const notifications = await db.collection('notifications').find({}).toArray();
        const pricingAuditLogs = await db.collection('pricing_audit_logs').find({}).toArray();
        const kvDocs = await db.collection('kv_settings').find({}).toArray();

        const kv = {};
        let projectReviewConfig = { platformCharge: 100, feeType: 'fixed', feeValue: 100 };
        kvDocs.forEach((d) => {
          if (d.key === 'projectReviewConfig') {
            projectReviewConfig = d.value;
          } else {
            kv[d.key] = d.value;
          }
        });

        return sendJson(res, 200, {
          success: true,
          experts,
          users,
          pendingVerifications,
          deletedExperts: [],
          kv,
          availabilities,
          projectReviews,
          notifications,
          pricingAuditLogs,
          projectReviewConfig
        });
      } catch (err) {
        console.error('[mongoHandler] /api/db GET error:', err);
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    if (req.method === 'POST') {
      try {
        const payload = await parseBody(req);

        if (Array.isArray(payload.experts)) {
          for (const exp of payload.experts) {
            const filter = exp.id ? { id: exp.id } : { email: exp.email };
            await db.collection('experts').updateOne(filter, { $set: exp }, { upsert: true });
          }
        }

        if (Array.isArray(payload.deletedExperts)) {
          for (const dKey of payload.deletedExperts) {
            await db.collection('experts').deleteMany({
              $or: [{ id: dKey }, { email: (dKey || '').toLowerCase() }, { name: dKey }]
            });
            await db.collection('pending_verifications').deleteMany({
              $or: [{ id: dKey }, { email: (dKey || '').toLowerCase() }, { name: dKey }]
            });
          }
        }

        if (Array.isArray(payload.pendingVerifications)) {
          for (const pv of payload.pendingVerifications) {
            const filter = pv.id ? { id: pv.id } : { email: pv.email };
            await db.collection('pending_verifications').updateOne(filter, { $set: pv }, { upsert: true });
          }
        }

        if (Array.isArray(payload.users)) {
          for (const u of payload.users) {
            const cleanEmail = (u.email || '').toLowerCase().trim();
            if (!cleanEmail) continue;
            const updateDoc = { ...u };
            delete updateDoc._id;
            delete updateDoc.password; // Do not overwrite password hash with empty
            await db.collection('users').updateOne({ email: cleanEmail }, { $set: updateDoc }, { upsert: true });
          }
        }

        if (payload.kv && typeof payload.kv === 'object') {
          for (const [key, value] of Object.entries(payload.kv)) {
            await db.collection('kv_settings').updateOne({ key }, { $set: { key, value, updatedAt: new Date() } }, { upsert: true });
          }
        }

        if (payload.projectReviewConfig) {
          await db.collection('kv_settings').updateOne(
            { key: 'projectReviewConfig' },
            { $set: { key: 'projectReviewConfig', value: payload.projectReviewConfig, updatedAt: new Date() } },
            { upsert: true }
          );
        }

        return sendJson(res, 200, { success: true, message: 'Updated in MongoDB successfully' });
      } catch (err) {
        console.error('[mongoHandler] /api/db POST error:', err);
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }
  }

  // ===========================================================
  // 3. ENDPOINT: /api/kv (Key-Value persistent settings)
  // ===========================================================
  if (url.startsWith('/api/kv')) {
    const kvCol = db.collection('kv_settings');

    if (req.method === 'GET') {
      const key = parsedUrl.searchParams.get('key');
      if (key) {
        const item = await kvCol.findOne({ key });
        return sendJson(res, 200, { success: true, key, value: item ? item.value : null });
      } else {
        const items = await kvCol.find({}).toArray();
        const kv = {};
        items.forEach((it) => { kv[it.key] = it.value; });
        return sendJson(res, 200, { success: true, kv });
      }
    }

    if (req.method === 'POST') {
      try {
        const payload = await parseBody(req);
        if (payload.key) {
          await kvCol.updateOne(
            { key: payload.key },
            { $set: { key: payload.key, value: payload.value, updatedAt: new Date() } },
            { upsert: true }
          );
        }
        if (payload.updates && typeof payload.updates === 'object') {
          for (const [k, v] of Object.entries(payload.updates)) {
            await kvCol.updateOne(
              { key: k },
              { $set: { key: k, value: v, updatedAt: new Date() } },
              { upsert: true }
            );
          }
        }
        return sendJson(res, 200, { success: true, message: 'Saved to MongoDB kv_settings' });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }
  }

  // ===========================================================
  // 4. ENDPOINT: /api/availability
  // ===========================================================
  if (url.startsWith('/api/availability')) {
    const availCol = db.collection('availabilities');

    // GET /api/availability
    if (req.method === 'GET' && pathname === '/api/availability') {
      const expertId = parsedUrl.searchParams.get('expertId');
      const date = parsedUrl.searchParams.get('date');
      const status = parsedUrl.searchParams.get('status');

      const filter = {};
      if (expertId) filter.expertId = expertId;
      if (date) filter.availabilityDate = date;
      if (status) filter.status = status;

      const list = await availCol.find(filter).toArray();
      return sendJson(res, 200, { success: true, availabilities: list });
    }

    // POST /api/availability/batch
    if (req.method === 'POST' && pathname === '/api/availability/batch') {
      try {
        const payload = await parseBody(req);
        const { expertId, availabilityDate, slots, requesterRole, requesterId } = payload;

        if (!expertId || !availabilityDate || !Array.isArray(slots)) {
          return sendJson(res, 400, { success: false, error: 'expertId, availabilityDate, and slots array are required' });
        }

        if (requesterRole === 'client') {
          return sendJson(res, 403, { success: false, error: 'Clients are not permitted to manage availability' });
        }
        if (requesterRole === 'expert' && requesterId && requesterId !== expertId) {
          return sendJson(res, 403, { success: false, error: 'Experts can only manage their own availability' });
        }

        const todayStr = getTodayString();
        if (availabilityDate < todayStr) {
          return sendJson(res, 400, { success: false, error: 'Cannot configure availability for past dates' });
        }

        const existingSlots = await availCol.find({ expertId, availabilityDate }).toArray();
        const newAvailabilities = [];
        const nowIso = new Date().toISOString();

        for (const s of slots) {
          const startMin = parseTimeToMinutes(s.startTime);
          const endMin = parseTimeToMinutes(s.endTime);
          if (startMin === null || endMin === null) {
            return sendJson(res, 400, { success: false, error: `Invalid time format: "${s.startTime}" - "${s.endTime}"` });
          }
          if (startMin >= endMin) {
            return sendJson(res, 400, { success: false, error: `Start time (${s.startTime}) must be strictly before end time (${s.endTime})` });
          }
          if (isSlotInPast(availabilityDate, s.startTime)) {
            return sendJson(res, 400, { success: false, error: `Cannot create time slot that has already passed today (${s.startTime})` });
          }

          const isDuplicate = existingSlots.some(ex => ex.startTime === s.startTime && ex.endTime === s.endTime) ||
            newAvailabilities.some(na => na.startTime === s.startTime && na.endTime === s.endTime);

          if (isDuplicate) {
            return sendJson(res, 400, { success: false, error: `Duplicate time slot already exists: ${s.startTime} - ${s.endTime}` });
          }

          const newSlot = {
            id: `avail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            expertId,
            availabilityDate,
            startTime: s.startTime,
            endTime: s.endTime,
            status: s.status || 'AVAILABLE',
            bookingId: null,
            clientId: null,
            clientName: null,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          newAvailabilities.push(newSlot);
        }

        if (newAvailabilities.length > 0) {
          await availCol.insertMany(newAvailabilities);
        }

        return sendJson(res, 201, { success: true, availabilities: newAvailabilities });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // POST /api/availability/book (Atomic Concurrency Protection)
    if (req.method === 'POST' && pathname === '/api/availability/book') {
      const release = await bookingLock.acquire();
      try {
        const payload = await parseBody(req);
        const { slotId, bookingId, clientId, clientName, expertId, date } = payload;

        if (!slotId) {
          return sendJson(res, 400, { success: false, error: 'slotId is required for booking' });
        }

        const slot = await availCol.findOne({ id: slotId });
        if (!slot) {
          return sendJson(res, 404, { success: false, error: 'Availability slot not found' });
        }

        if (expertId && slot.expertId !== expertId) {
          return sendJson(res, 400, { success: false, error: 'Availability slot does not belong to the specified expert' });
        }

        if (date && slot.availabilityDate !== date) {
          return sendJson(res, 400, { success: false, error: 'Availability slot date does not match the booking date' });
        }

        if (slot.status !== 'AVAILABLE') {
          return sendJson(res, 409, {
            success: false,
            error: `Availability slot is no longer available (current status: ${slot.status})`
          });
        }

        const nowIso = new Date().toISOString();
        const updatedSlot = await availCol.findOneAndUpdate(
          { id: slotId, status: 'AVAILABLE' },
          {
            $set: {
              status: 'BOOKED',
              bookingId: bookingId || `book-${Date.now()}`,
              clientId: clientId || null,
              clientName: clientName || 'Client',
              updatedAt: nowIso
            }
          },
          { returnDocument: 'after' }
        );

        return sendJson(res, 200, { success: true, availability: updatedSlot });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      } finally {
        release();
      }
    }

    // POST /api/availability (single slot creation)
    if (req.method === 'POST' && pathname === '/api/availability') {
      try {
        const payload = await parseBody(req);
        const { expertId, availabilityDate, startTime, endTime, status, requesterRole, requesterId } = payload;

        if (!expertId || !availabilityDate || !startTime || !endTime) {
          return sendJson(res, 400, { success: false, error: 'expertId, availabilityDate, startTime, and endTime are required' });
        }

        if (requesterRole === 'client') {
          return sendJson(res, 403, { success: false, error: 'Clients are not permitted to manage availability' });
        }
        if (requesterRole === 'expert' && requesterId && requesterId !== expertId) {
          return sendJson(res, 403, { success: false, error: 'Experts can only manage their own availability' });
        }

        if (availabilityDate < getTodayString()) {
          return sendJson(res, 400, { success: false, error: 'Cannot configure availability for past dates' });
        }

        const existing = await availCol.findOne({ expertId, availabilityDate, startTime, endTime });
        if (existing) {
          return sendJson(res, 400, { success: false, error: 'Duplicate time slot already exists for this expert and date' });
        }

        const nowIso = new Date().toISOString();
        const newSlot = {
          id: payload.id || `avail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          expertId,
          availabilityDate,
          startTime,
          endTime,
          status: status || 'AVAILABLE',
          bookingId: null,
          clientId: null,
          clientName: null,
          createdAt: nowIso,
          updatedAt: nowIso
        };

        await availCol.insertOne(newSlot);
        return sendJson(res, 201, { success: true, availability: newSlot });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // POST /api/availability/cancel (Cancel booking and free up slot in MongoDB)
    if (req.method === 'POST' && pathname === '/api/availability/cancel') {
      try {
        const { slotId, bookingId, reason } = await parseBody(req);
        const filter = slotId ? { id: slotId } : { bookingId };
        const updatedSlot = await availCol.findOneAndUpdate(
          filter,
          {
            $set: {
              status: 'AVAILABLE',
              bookingId: null,
              clientId: null,
              clientName: null,
              cancellationReason: reason || 'Cancelled by user',
              updatedAt: new Date().toISOString()
            }
          },
          { returnDocument: 'after' }
        );
        return sendJson(res, 200, { success: true, availability: updatedSlot });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // PUT /api/availability/:id
    if ((req.method === 'PUT' || req.method === 'PATCH') && pathname.startsWith('/api/availability/')) {
      const id = pathname.replace('/api/availability/', '');
      try {
        const payload = await parseBody(req);
        const existing = await availCol.findOne({ id });

        if (!existing) {
          return sendJson(res, 404, { success: false, error: 'Availability slot not found' });
        }

        const updated = await availCol.findOneAndUpdate(
          { id },
          { $set: { ...payload, id, updatedAt: new Date().toISOString() } },
          { returnDocument: 'after' }
        );

        return sendJson(res, 200, { success: true, availability: updated });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // DELETE /api/availability/:id
    if (req.method === 'DELETE' && pathname.startsWith('/api/availability/')) {
      const id = pathname.replace('/api/availability/', '');
      try {
        const existing = await availCol.findOne({ id });
        if (!existing) {
          return sendJson(res, 404, { success: false, error: 'Availability slot not found' });
        }
        if (existing.status === 'BOOKED' && req.headers['x-admin-override'] !== 'true') {
          return sendJson(res, 400, { success: false, error: 'Cannot delete a booked availability slot directly' });
        }
        await availCol.deleteOne({ id });
        return sendJson(res, 200, { success: true });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }
  }

  // ===========================================================
  // 5. ENDPOINT: /api/project-reviews
  // ===========================================================
  if (url.startsWith('/api/project-reviews')) {
    const projCol = db.collection('project_reviews');
    const expertsCol = db.collection('experts');
    const logsCol = db.collection('pricing_audit_logs');
    const kvCol = db.collection('kv_settings');

    // GET /api/project-reviews/pricing
    if (pathname === '/api/project-reviews/pricing' && req.method === 'GET') {
      const expertId = parsedUrl.searchParams.get('expertId');
      const all = parsedUrl.searchParams.get('all') === 'true';
      const role = parsedUrl.searchParams.get('role');

      const feeItem = await kvCol.findOne({ key: 'projectReviewConfig' });
      const feeConfig = feeItem ? feeItem.value : { platformCharge: 100, feeType: 'fixed', feeValue: 100 };
      const platformCharge = typeof feeConfig.platformCharge === 'number' ? feeConfig.platformCharge : 100;

      if (expertId) {
        const exp = await expertsCol.findOne({
          $or: [
            { id: expertId },
            { email: expertId.toLowerCase() },
            { name: new RegExp(`^${expertId}$`, 'i') }
          ]
        });
        if (!exp) {
          return sendJson(res, 404, { success: false, error: 'Expert not found' });
        }
        const activePrice = typeof exp.projectRate === 'number'
          ? Math.min(2000, Math.max(0, exp.projectRate))
          : 1500;

        return sendJson(res, 200, {
          success: true,
          expertId: exp.id,
          expertName: exp.name,
          projectRate: activePrice,
          platformCharge,
          clientPrice: activePrice + platformCharge,
          totalPrice: activePrice + platformCharge,
          lastUpdated: exp.updatedAt || new Date().toISOString(),
          minPrice: 0,
          maxPrice: 2000
        });
      }

      if (all || role === 'admin') {
        const experts = await expertsCol.find({}).toArray();
        const list = experts.map((e) => {
          const activePrice = typeof e.projectRate === 'number'
            ? Math.min(2000, Math.max(0, e.projectRate))
            : 1500;
          return {
            id: e.id,
            name: e.name,
            field: e.field,
            rate: e.rate,
            baseRate: e.baseRate,
            projectRate: activePrice,
            platformCharge,
            clientPrice: activePrice + platformCharge,
            totalPrice: activePrice + platformCharge,
            lastUpdated: e.updatedAt || new Date().toISOString()
          };
        });

        return sendJson(res, 200, {
          success: true,
          platformCharge,
          platformFeeConfig: { ...feeConfig, platformCharge },
          experts: list,
          minPrice: 0,
          maxPrice: 2000
        });
      }

      return sendJson(res, 400, { success: false, error: 'expertId or all=true query parameter is required' });
    }

    // POST /api/project-reviews/pricing (Update expert project price)
    if (pathname === '/api/project-reviews/pricing' && req.method === 'POST') {
      try {
        const payload = await parseBody(req);
        const { expertId, price, newPrice, projectRate, reason = 'Price adjustment', changedBy = 'admin' } = payload;
        const targetPrice = Number(newPrice ?? projectRate ?? price);

        if (isNaN(targetPrice) || targetPrice < 0 || targetPrice > 2000) {
          return sendJson(res, 400, { success: false, error: 'Project Review price must be between ₹0 and ₹2,000' });
        }

        const exp = await expertsCol.findOne({ id: expertId });
        if (!exp) {
          return sendJson(res, 404, { success: false, error: 'Expert not found' });
        }

        const oldPrice = exp.projectRate || 1500;
        const nowIso = new Date().toISOString();

        await expertsCol.updateOne(
          { id: expertId },
          { $set: { projectRate: targetPrice, updatedAt: nowIso } }
        );

        // Record Audit Log in MongoDB
        const logEntry = {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          expertId,
          expertName: exp.name,
          oldPrice,
          newPrice: targetPrice,
          priceType: 'projectReview',
          reason,
          changedBy,
          timestamp: nowIso
        };
        await logsCol.insertOne(logEntry);

        return sendJson(res, 200, {
          success: true,
          message: 'Project Review price updated in MongoDB',
          expertId,
          projectRate: targetPrice
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // GET /api/project-reviews/platform-fee
    if (pathname === '/api/project-reviews/platform-fee' && req.method === 'GET') {
      const feeItem = await kvCol.findOne({ key: 'projectReviewConfig' });
      const feeConfig = feeItem ? feeItem.value : { platformCharge: 100, feeType: 'fixed', feeValue: 100 };
      return sendJson(res, 200, { success: true, platformCharge: feeConfig.platformCharge || 100, config: feeConfig });
    }

    // POST /api/project-reviews/platform-fee
    if (pathname === '/api/project-reviews/platform-fee' && req.method === 'POST') {
      try {
        const payload = await parseBody(req);
        const charge = Number(payload.platformCharge ?? payload.feeValue ?? 100);
        const newConfig = {
          platformCharge: charge,
          feeType: 'fixed',
          feeValue: charge,
          updatedAt: new Date().toISOString(),
          updatedBy: payload.updatedBy || 'admin'
        };

        await kvCol.updateOne(
          { key: 'projectReviewConfig' },
          { $set: { key: 'projectReviewConfig', value: newConfig, updatedAt: new Date() } },
          { upsert: true }
        );

        return sendJson(res, 200, { success: true, config: newConfig });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // GET /api/project-reviews (List reviews)
    if (pathname === '/api/project-reviews' && req.method === 'GET') {
      const clientId = parsedUrl.searchParams.get('clientId');
      const expertId = parsedUrl.searchParams.get('expertId');
      const role = parsedUrl.searchParams.get('role');

      const filter = {};
      if (role === 'client' && clientId) {
        filter.clientId = clientId;
      } else if (role === 'expert' && expertId) {
        filter.expertId = expertId;
      }

      const reviews = await projCol.find(filter).sort({ createdAt: -1 }).toArray();
      return sendJson(res, 200, { success: true, reviews });
    }

    // POST /api/project-reviews/request (Client creates review request)
    if (pathname === '/api/project-reviews/request' && req.method === 'POST') {
      const release = await projectReviewLock.acquire();
      try {
        const payload = await parseBody(req);
        const prId = `pr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const nowIso = new Date().toISOString();

        const newPr = {
          ...payload,
          id: prId,
          projectReviewId: prId,
          status: payload.status || 'PendingExpertAcceptance',
          paymentStatus: payload.paymentStatus || 'EscrowHeld',
          createdAt: nowIso,
          updatedAt: nowIso
        };

        await projCol.insertOne(newPr);

        // Also add system notification to MongoDB notifications
        const notif = {
          id: `notif-${Date.now()}`,
          senderId: payload.clientId || 'client',
          target: 'expert',
          recipientId: payload.expertId,
          title: 'New Project Review Request',
          message: `${payload.clientName || 'A Client'} submitted a Project Review request.`,
          read: false,
          createdAt: nowIso
        };
        await db.collection('notifications').insertOne(notif);

        return sendJson(res, 201, { success: true, review: newPr });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      } finally {
        release();
      }
    }

    // Dynamic routes for Project Reviews: /api/project-reviews/:id/...
    const matchPr = pathname.match(/^\/api\/project-reviews\/([^\/]+)(?:\/(.*))?$/);
    if (matchPr) {
      const prId = matchPr[1];
      const action = matchPr[2];

      if (req.method === 'GET') {
        const pr = await projCol.findOne({ $or: [{ projectReviewId: prId }, { id: prId }] });
        if (!pr) return sendJson(res, 404, { success: false, error: 'Project Review not found' });
        return sendJson(res, 200, { success: true, review: pr });
      }

      if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
        try {
          const payload = await parseBody(req);
          const nowIso = new Date().toISOString();

          const updateObj = { ...payload, updatedAt: nowIso };
          delete updateObj._id;

          const updated = await projCol.findOneAndUpdate(
            { $or: [{ projectReviewId: prId }, { id: prId }] },
            { $set: updateObj },
            { returnDocument: 'after' }
          );

          return sendJson(res, 200, { success: true, review: updated });
        } catch (err) {
          return sendJson(res, 500, { success: false, error: err.message });
        }
      }

      if (req.method === 'DELETE') {
        try {
          await projCol.deleteOne({ $or: [{ projectReviewId: prId }, { id: prId }] });
          return sendJson(res, 200, { success: true, message: 'Project Review deleted from MongoDB' });
        } catch (err) {
          return sendJson(res, 500, { success: false, error: err.message });
        }
      }
    }
  }

  // ===========================================================
  // 6. ENDPOINT: /api/documents (Binary PDF/file handling & MongoDB sync)
  // ===========================================================
  if (url.startsWith('/api/documents')) {
    const docCol = db.collection('documents');
    const UPLOAD_DIR = path.resolve(rootDir, 'public', 'uploaded_docs');
    const SERVER_DIR = path.resolve(rootDir, 'server_docs');
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    if (!fs.existsSync(SERVER_DIR)) fs.mkdirSync(SERVER_DIR, { recursive: true });

    if (req.method === 'GET') {
      const key = parsedUrl.searchParams.get('key') || parsedUrl.searchParams.get('id') || '';
      if (!key) {
        const docs = await docCol.find({}).toArray();
        return sendJson(res, 200, { success: true, documents: docs });
      }

      const doc = await docCol.findOne({ $or: [{ key }, { id: key }, { 'docData.id': key }, { 'docData.fileName': key }] });
      if (doc && doc.docData && doc.docData.fileData) {
        return sendJson(res, 200, {
          success: true,
          fileName: doc.docData.fileName,
          fileData: doc.docData.fileData,
          url: doc.docData.url || `/uploaded_docs/${encodeURIComponent(doc.docData.fileName || 'file.pdf')}`
        });
      }

      // Check filesystem fallback
      const cleanKey = key.toLowerCase().trim();
      const files = fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : [];
      const found = files.find(f => f.toLowerCase() === cleanKey || f.toLowerCase().includes(cleanKey));
      if (found) {
        const filePath = path.join(UPLOAD_DIR, found);
        const buf = fs.readFileSync(filePath);
        return sendJson(res, 200, {
          success: true,
          fileName: found,
          fileData: `data:application/pdf;base64,${buf.toString('base64')}`,
          url: `/uploaded_docs/${encodeURIComponent(found)}`
        });
      }

      return sendJson(res, 404, { success: false, error: 'Document not found' });
    }

    if (req.method === 'POST') {
      try {
        const payload = await parseBody(req);
        const docId = payload.id || `doc-${Date.now()}`;
        const fileName = payload.fileName || payload.name || `doc_${Date.now()}.pdf`;

        // Save to MongoDB documents collection
        await docCol.updateOne(
          { key: docId },
          { $set: { key: docId, id: docId, docData: payload, updatedAt: new Date() } },
          { upsert: true }
        );

        // Also save to disk for fast static serving
        if (payload.fileData) {
          const base64Data = payload.fileData.includes(',') ? payload.fileData.split(',')[1] : payload.fileData;
          const buf = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(path.join(UPLOAD_DIR, path.basename(fileName)), buf);
          fs.writeFileSync(path.join(SERVER_DIR, path.basename(fileName)), buf);
        }

        return sendJson(res, 200, {
          success: true,
          fileName,
          url: `/uploaded_docs/${encodeURIComponent(path.basename(fileName))}`
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    if (req.method === 'DELETE') {
      try {
        const key = parsedUrl.searchParams.get('key') || parsedUrl.searchParams.get('id') || pathname.replace('/api/documents/', '');
        if (key) {
          await docCol.deleteOne({ $or: [{ key }, { id: key }, { 'docData.id': key }, { 'docData.fileName': key }] });
          return sendJson(res, 200, { success: true, message: 'Document deleted from MongoDB' });
        }
        return sendJson(res, 400, { success: false, error: 'Document key or id required' });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }
  }

  // ===========================================================
  // 7. ENDPOINT: /api/notifications
  // ===========================================================
  if (url.startsWith('/api/notifications')) {
    const notifCol = db.collection('notifications');

    // GET /api/notifications
    if (req.method === 'GET' && pathname === '/api/notifications') {
      const role = (parsedUrl.searchParams.get('role') || '').toLowerCase().trim();
      const recipientId = (parsedUrl.searchParams.get('recipientId') || '').toLowerCase().trim();
      const unreadOnly = parsedUrl.searchParams.get('unreadOnly') === 'true';

      let list = await notifCol.find({}).sort({ createdAt: -1 }).toArray();

      if (role === 'landing' || (!role && !recipientId)) {
        list = list.filter((n) => (!n.recipientId || n.recipientId === 'all') && (n.target === 'landing' || n.target === 'all'));
      } else if (role === 'expert') {
        list = list.filter((n) => {
          const isBroadcast = !n.recipientId || n.recipientId === 'expert-user' || n.recipientId === 'expert' || n.recipientId === 'all';
          if ((n.target === 'all' || n.target === 'expert') && isBroadcast) return true;
          if (recipientId && n.recipientId && n.recipientId.toLowerCase().includes(recipientId)) return true;
          return false;
        });
      } else if (role === 'client') {
        list = list.filter((n) => {
          const isBroadcast = !n.recipientId || n.recipientId === 'client-user' || n.recipientId === 'client' || n.recipientId === 'all';
          if ((n.target === 'all' || n.target === 'client') && isBroadcast) return true;
          if (recipientId && n.recipientId && n.recipientId.toLowerCase().includes(recipientId)) return true;
          return false;
        });
      }

      if (unreadOnly) {
        list = list.filter((n) => !n.read);
      }

      return sendJson(res, 200, { success: true, notifications: list, count: list.length });
    }

    // POST /api/notifications (Create notification)
    if (req.method === 'POST' && pathname === '/api/notifications') {
      try {
        const payload = await parseBody(req);
        if (!payload.title || !payload.message) {
          return sendJson(res, 400, { success: false, error: 'Both Title and Message are required' });
        }

        const notifId = payload.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newNotif = {
          id: notifId,
          senderId: payload.senderId || 'admin',
          target: payload.target || 'all',
          recipientId: payload.recipientId || undefined,
          recipientName: payload.recipientName || undefined,
          type: payload.type || 'announcement',
          title: payload.title.trim(),
          message: payload.message.trim(),
          createdAt: new Date().toISOString(),
          read: false,
          status: 'delivered',
          actionLink: payload.actionLink || 'landing',
          channel: payload.channel || 'in_app'
        };

        await notifCol.insertOne(newNotif);
        return sendJson(res, 201, { success: true, notification: newNotif });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // POST /api/notifications/mark-read
    if (req.method === 'POST' && pathname === '/api/notifications/mark-read') {
      try {
        const { id } = await parseBody(req);
        await notifCol.updateOne({ id }, { $set: { read: true, readAt: new Date().toISOString(), status: 'read' } });
        return sendJson(res, 200, { success: true, id, read: true });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // POST /api/notifications/mark-all-read
    if (req.method === 'POST' && pathname === '/api/notifications/mark-all-read') {
      try {
        const result = await notifCol.updateMany({ read: false }, { $set: { read: true, readAt: new Date().toISOString(), status: 'read' } });
        return sendJson(res, 200, { success: true, updatedCount: result.modifiedCount });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // POST /api/notifications/clear
    if (req.method === 'POST' && pathname === '/api/notifications/clear') {
      try {
        const result = await notifCol.deleteMany({});
        return sendJson(res, 200, { success: true, removedCount: result.deletedCount });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }
  }

  // ===========================================================
  // 8. ENDPOINT: /api/experts (Expert catalog & markup)
  // ===========================================================
  if (url.startsWith('/api/experts')) {
    const expertsCol = db.collection('experts');

    if (req.method === 'GET' && pathname === '/api/experts') {
      const list = await expertsCol.find({}).toArray();
      return sendJson(res, 200, { success: true, experts: list });
    }

    if (req.method === 'POST' && pathname === '/api/experts/markup') {
      try {
        const { expertId, adminMarkup } = await parseBody(req);
        const exp = await expertsCol.findOne({ id: expertId });
        if (!exp) return sendJson(res, 404, { success: false, error: 'Expert not found' });

        const newMarkup = Number(adminMarkup);
        const newRate = (exp.baseRate || 600) + newMarkup;

        await expertsCol.updateOne(
          { id: expertId },
          { $set: { adminMarkup: newMarkup, rate: newRate, updatedAt: new Date().toISOString() } }
        );

        return sendJson(res, 200, { success: true, expertId, adminMarkup: newMarkup, rate: newRate });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/experts/')) {
      const id = pathname.replace('/api/experts/', '');
      await expertsCol.deleteOne({ id });
      return sendJson(res, 200, { success: true });
    }
  }

  if (next) return next();
}
