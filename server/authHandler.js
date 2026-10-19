import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { supabase } from './supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../db.json');

const ADMIN_EMAILS = [
  'kushwahaashwani12@gmail.com',
  'kushwaahaashwani12@gmail.com'
];

function isAdminEmail(email = '') {
  return ADMIN_EMAILS.includes(String(email).toLowerCase().trim());
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body);
      return;
    }
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

function readLocalDb() {
  try {
    if (!fs.existsSync(DB_PATH)) return { users: [] };
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    if (!Array.isArray(db.users)) db.users = [];
    return db;
  } catch {
    return { users: [] };
  }
}

function writeLocalDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

function publicUser(user, extras = {}) {
  const name = user.full_name || user.fullName || user.name || extras.name || '';
  const role = user.role || extras.role || 'client';
  const token = role === 'admin' ? (extras.token || crypto.randomBytes(24).toString('hex')) : extras.token;
  return {
    id: user.id,
    email: user.email,
    role,
    name,
    full_name: name,
    phone: user.phone || extras.phone || '',
    company: user.company || extras.company || '',
    title: user.title || extras.title || '',
    field: user.field || extras.field || '',
    bio: user.bio || extras.bio || '',
    years: extras.years,
    baseRate: extras.baseRate,
    is_verified: user.is_verified ?? true,
    token
  };
}

function loginPayload(user, extras = {}) {
  const mapped = publicUser(user, extras);
  return {
    success: true,
    message: 'Authenticated successfully.',
    user: mapped,
    token: mapped.token || null
  };
}

async function passwordsMatch(password, user) {
  if (!user) return false;
  if (user.password_hash) return bcrypt.compare(password, user.password_hash);
  if (user.password) {
    if (String(user.password).startsWith('$2')) return bcrypt.compare(password, user.password);
    return user.password === password;
  }
  return false;
}

function findLocalUser(email) {
  const db = readLocalDb();
  const user = db.users.find((entry) => String(entry.email || '').toLowerCase() === email);
  return { db, user };
}

function upsertLocalUser(user) {
  const db = readLocalDb();
  const idx = db.users.findIndex((entry) => String(entry.email || '').toLowerCase() === String(user.email).toLowerCase());
  if (idx >= 0) db.users[idx] = { ...db.users[idx], ...user };
  else db.users.push(user);
  writeLocalDb(db);
  return user;
}

async function registerUser(payload) {
  const email = String(payload.email || '').toLowerCase().trim();
  const password = String(payload.password || '');
  const fullName = payload.fullName || payload.full_name || payload.name || '';
  let role = String(payload.role || 'client').toLowerCase();
  if (isAdminEmail(email)) role = 'admin';
  if (!email || !password) {
    return { status: 400, body: { success: false, error: 'Email and password are required', message: 'Email and password are required' } };
  }
  if (!['admin', 'expert', 'client'].includes(role)) {
    return { status: 400, body: { success: false, error: 'Invalid role', message: 'Invalid role' } };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const localRecord = {
    id: payload.id || `usr-${Date.now()}`,
    email,
    password_hash: passwordHash,
    name: fullName,
    full_name: fullName,
    role,
    phone: payload.phone || '',
    company: payload.company || '',
    title: payload.title || '',
    field: payload.field || '',
    bio: payload.bio || '',
    years: payload.years,
    baseRate: payload.baseRate,
    createdAt: new Date().toISOString()
  };

  try {
    const { data: existing } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
    if (existing) {
      const valid = await passwordsMatch(password, existing);
      if (!valid && isAdminEmail(email)) {
        await supabase.from('users').update({ password_hash: passwordHash, full_name: fullName || existing.full_name, role: 'admin', phone: payload.phone || existing.phone }).eq('id', existing.id);
        upsertLocalUser({ ...localRecord, id: existing.id, role: 'admin' });
        return { status: 200, body: { ...loginPayload({ ...existing, role: 'admin', full_name: fullName || existing.full_name, phone: payload.phone || existing.phone }, localRecord), message: 'Admin account updated and signed in.' } };
      }
      if (valid) {
        upsertLocalUser({ ...localRecord, id: existing.id, role: existing.role || role });
        return { status: 200, body: { ...loginPayload(existing, localRecord), message: 'Account already exists. Signed in.' } };
      }
      return { status: 409, body: { success: false, error: 'User already exists', message: 'User already exists. Please sign in.' } };
    }

    const { data: user, error } = await supabase.from('users').insert({
      email,
      password_hash: passwordHash,
      full_name: fullName,
      role,
      phone: payload.phone || null
    }).select().single();

    if (error) throw error;
    upsertLocalUser({ ...localRecord, id: user.id });
    return { status: 200, body: { success: true, message: 'Account registered successfully.', user: publicUser(user, localRecord), token: publicUser(user, localRecord).token || null } };
  } catch (err) {
    const { user: localUser } = findLocalUser(email);
    if (localUser) {
      const valid = await passwordsMatch(password, localUser);
      if (valid || isAdminEmail(email)) {
        const saved = upsertLocalUser({ ...localUser, ...localRecord, id: localUser.id, role: isAdminEmail(email) ? 'admin' : localUser.role });
        return { status: 200, body: { ...loginPayload(saved, localRecord), message: valid ? 'Account already exists. Signed in.' : 'Admin account updated and signed in.' } };
      }
      return { status: 409, body: { success: false, error: 'User already exists', message: 'User already exists. Please sign in.' } };
    }
    upsertLocalUser(localRecord);
    return { status: 200, body: { success: true, message: 'Account registered successfully.', user: publicUser(localRecord, localRecord), token: publicUser(localRecord, localRecord).token || null } };
  }
}

async function loginUser(payload) {
  const email = String(payload.email || '').toLowerCase().trim();
  const password = String(payload.password || '');
  if (!email || !password) {
    return { status: 400, body: { success: false, error: 'Email and password are required', message: 'Email and password are required' } };
  }

  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
    if (!error && user) {
      const valid = await passwordsMatch(password, user);
      if (!valid) {
        return { status: 401, body: { success: false, error: 'Invalid credentials', message: 'Invalid credentials' } };
      }
      const extras = findLocalUser(email).user || {};
      const mappedRole = isAdminEmail(email) ? 'admin' : (user.role || extras.role);
      return { status: 200, body: loginPayload({ ...user, role: mappedRole }, extras) };
    }
  } catch {}

  const { user: localUser } = findLocalUser(email);
  if (!localUser) {
    return { status: 401, body: { success: false, error: 'MUST REGISTER FIRST', message: 'Account not found. MUST REGISTER FIRST.' } };
  }
  const valid = await passwordsMatch(password, localUser);
  if (!valid) {
    return { status: 401, body: { success: false, error: 'Invalid credentials', message: 'Invalid credentials' } };
  }
  const mappedRole = isAdminEmail(email) ? 'admin' : localUser.role;
  return { status: 200, body: loginPayload({ ...localUser, role: mappedRole }, localUser) };
}

export async function handleApiMiddleware(req, res, next) {
  const pathname = String(req.url || '').split('?')[0];
  if (!pathname.startsWith('/api/auth')) {
    next();
    return;
  }

  try {
    if (req.method === 'POST' && (pathname === '/api/auth/register' || pathname.endsWith('/register'))) {
      const payload = await readBody(req);
      const result = await registerUser(payload);
      sendJson(res, result.status, result.body);
      return;
    }

    if (req.method === 'POST' && (pathname === '/api/auth/login' || pathname === '/api/auth')) {
      const payload = await readBody(req);
      const result = await loginUser(payload);
      sendJson(res, result.status, result.body);
      return;
    }

    sendJson(res, 404, { success: false, error: 'Auth endpoint not found', message: 'Auth endpoint not found' });
  } catch (err) {
    sendJson(res, 500, { success: false, error: err.message, message: err.message });
  }
}
