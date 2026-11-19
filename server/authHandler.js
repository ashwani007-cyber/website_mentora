import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { supabase } from './supabaseClient.js';
import { createAdminToken, createPublicToken, getRequestToken, hashAdminToken, normalizeEmail, readActor, sessionExpiresAt } from './session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../db.json');

const ADMIN_EMAILS = [
  'kushwahaashwani12@gmail.com',
  'kushwaahaashwani12@gmail.com'
];

function isAdminEmail(email = '') {
  const configured = process.env.MENTORA_ADMIN_EMAILS?.split(',').map(normalizeEmail);
  return (configured || ADMIN_EMAILS).includes(normalizeEmail(email));
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
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

function publicUser(user, extras = {}) {
  const name = user.full_name || user.fullName || user.name || extras.name || '';
  const role = user.role || extras.role || 'client';
  const token = extras.token;
  const isVerified = Boolean(user.verified === true || extras.verified === true || user.is_verified === true || extras.is_verified === true);
  const status = isVerified ? 'approved' : (user.verificationStatus || extras.verificationStatus || 'pending');
  return {
    id: user.id || extras.id,
    email: user.email,
    role,
    name,
    full_name: name,
    phone: user.phone || extras.phone || '',
    company: user.company || extras.company || '',
    title: user.title || extras.title || '',
    field: user.field || extras.field || '',
    bio: user.bio || extras.bio || '',
    years: extras.years ?? user.years ?? 0,
    baseRate: extras.baseRate ?? user.baseRate ?? 600,
    projectRate: extras.projectRate ?? extras.project_rate ?? user.projectRate ?? 1500,
    verified: isVerified,
    is_verified: isVerified,
    verificationStatus: status,
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
  if (user.password_hash) return user.password_hash.startsWith('$2') ? bcrypt.compare(password, user.password_hash) : user.password_hash === password;
  if (user.password) {
    if (String(user.password).startsWith('$2')) return bcrypt.compare(password, user.password);
    return user.password === password;
  }
  return false;
}

function result(status, error) {
  return { status, body: { success: false, error, message: error } };
}

function signedIn(user, extras = {}) {
  const profile = publicUser(user, extras);
  const token = extras.token || createPublicToken(profile);
  return { status: 200, body: loginPayload(user, { ...extras, token }) };
}

async function startAdminSession(email, password, registration = false) {
  const { data: credentials, error } = await supabase.from('admin_credentials')
    .select('password_hash').eq('email', email).maybeSingle();
  if (error) throw error;
  if (credentials && registration) return result(409, 'Account already registered. Please sign in.');

  const { data: user, error: userError } = await supabase.from('users')
    .select('id, email, role, full_name, password_hash').eq('email', email).maybeSingle();
  if (userError) throw userError;
  const legacy = readLocalDb().users.find(entry => normalizeEmail(entry.email) === email && entry.role === 'admin');
  const hash = credentials?.password_hash || user?.password_hash || legacy?.password_hash || process.env.MENTORA_ADMIN_INITIAL_PASSWORD_HASH;
  if (!hash || !hash.startsWith('$2') || !await bcrypt.compare(password, hash)) {
    return result(401, 'Invalid administrator credentials');
  }

  const token = createAdminToken();
  const session = { current_token_hash: hashAdminToken(token), session_expires_at: sessionExpiresAt(), last_login: new Date().toISOString() };
  const write = credentials
    ? await supabase.from('admin_credentials').update(session).eq('email', email).eq('password_hash', hash).select('email').maybeSingle()
    : await supabase.from('admin_credentials').insert({ email, password_hash: hash, ...session }).select('email').single();
  if (write.error?.code === '23505') return result(409, 'Administrator account initialized. Please sign in.');
  if (write.error) throw write.error;
  if (!write.data) return result(409, 'Administrator credentials changed. Please sign in again.');
  return signedIn({ ...user, id: user?.id || email, email, role: 'admin' }, { token });
}

async function registerUser(payload) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || '');
  const fullName = String(payload.fullName || payload.full_name || payload.name || '').trim();
  const phone = String(payload.phone || '').trim();
  const requestedRole = String(payload.role || 'client').toLowerCase();
  if (!email || !password) return result(400, 'Email and password are required');
  if (isAdminEmail(email)) return startAdminSession(email, password, true);
  if (!['admin', 'expert', 'client'].includes(requestedRole)) return result(400, 'Invalid role selected');
  const role = requestedRole === 'expert' ? 'expert' : 'client';
  if (phone && phone.replace(/\D/g, '').length < 8) return result(400, 'Please enter a valid phone number (at least 8 digits)');

  const existing = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return result(409, 'Account already registered. Please sign in.');
  const legacy = readLocalDb().users.find(entry => normalizeEmail(entry.email) === email);
  if (legacy) return result(409, 'Account already registered. Please sign in.');

  const passwordHash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName, role, phone }
  });
  if (error?.code === 'email_exists' || error?.code === 'user_already_exists') return result(409, 'Account already registered. Please sign in.');
  if (error) throw error;

  const initialRate = Number(payload.baseRate ?? 600);
  const baseRate = Number.isFinite(initialRate) ? Math.min(1000, Math.max(0, initialRate)) : 600;
  const { data: user, error: profileError } = await supabase.rpc('register_mentora_profile', {
    p_user: {
      id: data.user.id, email, role, full_name: fullName, password_hash: passwordHash,
      phone, company: String(payload.company || ''), field: String(payload.field || ''),
      title: String(payload.title || 'Senior Executive Advisor'), years: Math.max(0, Math.trunc(Number(payload.years) || 0)),
      bio: String(payload.bio || ''), base_rate: baseRate
    }
  });
  if (profileError) {
    // A database error with a SQLSTATE rolled back the profile transaction.
    if (/^[0-9]{2}[0-9A-Z]{3}$/.test(profileError.code || '') || profileError.code === 'PGRST202') {
      const cleanup = await supabase.auth.admin.deleteUser(data.user.id);
      if (cleanup.error) console.error('[auth] Could not remove incomplete registration:', cleanup.error.code);
    }
    if (profileError.code === '23505') return result(409, 'An account with this email or phone number already exists');
    throw profileError;
  }
  const response = signedIn(user, { title: payload.title, years: Number(payload.years) || 0, baseRate, projectRate: 1500 });
  response.body.message = 'Account registered successfully.';
  return response;
}

async function loginUser(payload) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || '');
  if (!email || !password) return result(400, 'Email and password are required');
  if (isAdminEmail(email)) return startAdminSession(email, password);

  const { data: user, error } = await supabase.from('users')
    .select('id, email, full_name, phone, company, field, password_hash, role, is_verified, bio')
    .eq('email', email).maybeSingle();
  if (error) throw error;
  if (!user) return result(404, 'Account not found. Please register first.');
  if (!['client', 'expert'].includes(user.role) || !await passwordsMatch(password, user)) return result(401, 'Invalid credentials');
  return finishPublicLogin(user, password);
}

async function finishPublicLogin(user, password) {
  const update = { last_login: new Date().toISOString() };
  if (password && !user.password_hash?.startsWith('$2')) update.password_hash = await bcrypt.hash(password, 10);
  const { error } = await supabase.from('users').update(update).eq('id', user.id);
  if (error) throw error;
  if (user.role !== 'expert') return signedIn(user);
  const expert = await supabase.from('experts').select('id, name, email, verified, title, field, base_rate, project_rate, years_of_experience')
    .eq('email', user.email).maybeSingle();
  if (expert.error) throw expert.error;
  return signedIn(user, { ...expert.data, baseRate: expert.data?.base_rate, years: expert.data?.years_of_experience });
}

async function exchangeSupabaseSession(req) {
  const token = getRequestToken(req);
  if (!token) return result(401, 'Sign in first');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.email) return result(401, 'Invalid session');
  const { data: user, error: profileError } = await supabase.from('users')
    .select('id, email, full_name, phone, company, field, role, is_verified, bio')
    .eq('id', data.user.id).eq('email', normalizeEmail(data.user.email)).maybeSingle();
  if (profileError) throw profileError;
  if (!user || isAdminEmail(user.email) || !['client', 'expert'].includes(user.role)) return result(403, 'No matching portal account');
  return finishPublicLogin(user);
}

async function changeAdminPassword(req, payload) {
  const actor = await readActor(req);
  if (actor?.role !== 'admin') return result(403, 'Administrator session required');
  const { currentPassword, newPassword, confirmPassword } = payload;
  if (typeof newPassword !== 'string' || newPassword.length < 6 || (confirmPassword !== undefined && confirmPassword !== newPassword)) {
    return result(400, 'Enter a matching password with at least 6 characters');
  }
  const currentHash = hashAdminToken(getRequestToken(req));
  const row = await supabase.from('admin_credentials').select('password_hash').eq('email', actor.email)
    .eq('current_token_hash', currentHash).maybeSingle();
  if (row.error) throw row.error;
  if (!row.data || !await bcrypt.compare(String(currentPassword || ''), row.data.password_hash)) return result(401, 'Current password is incorrect');
  const token = createAdminToken();
  const write = await supabase.from('admin_credentials').update({
    password_hash: await bcrypt.hash(newPassword, 12), current_token_hash: hashAdminToken(token),
    session_expires_at: sessionExpiresAt(), password_changed_at: new Date().toISOString()
  }).eq('email', actor.email).eq('current_token_hash', currentHash).select('email').maybeSingle();
  if (write.error) throw write.error;
  return write.data ? signedIn(actor, { token }) : result(409, 'Session changed. Please sign in again.');
}

async function updateClientProfile(req, payload) {
  const actor = await readActor(req);
  if (actor?.role !== 'client') return result(actor ? 403 : 401, 'A client session is required');
  if (payload.email && normalizeEmail(payload.email) !== actor.email) {
    return result(400, 'Sign-in email changes require account verification');
  }
  const fields = [['name', 'full_name'], ['company', 'company'], ['field', 'field'], ['phone', 'phone'], ['bio', 'bio']];
  const updates = {};
  for (const [key, column] of fields) if (typeof payload[key] === 'string') updates[column] = payload[key].trim();
  if (!updates.full_name || updates.full_name.length > 255 || (updates.phone && updates.phone.replace(/\D/g, '').length < 8)) {
    return result(400, 'Enter a valid name and phone number');
  }
  const query = await supabase.from('users').update(updates).eq('id', actor.id).eq('role', 'client')
    .select('id, email, full_name, phone, company, field, role, is_verified, bio').maybeSingle();
  if (query.error) throw query.error;
  return query.data ? signedIn(query.data) : result(404, 'Client profile not found');
}

export async function handleApiMiddleware(req, res, next) {
  const pathname = String(req.url || '').split('?')[0];
  if (!pathname.startsWith('/api/auth')) {
    next();
    return;
  }

  try {
    if (['PUT', 'PATCH'].includes(req.method) && pathname === '/api/auth/profile') {
      const response = await updateClientProfile(req, await readBody(req));
      sendJson(res, response.status, response.body);
      return;
    }
    if (req.method === 'GET' && pathname === '/api/auth/verify-admin') {
      const actor = await readActor(req);
      sendJson(res, 200, { success: true, authenticated: actor?.role === 'admin' });
      return;
    }
    if (req.method === 'POST' && pathname === '/api/auth/admin-logout') {
      const token = getRequestToken(req);
      if (/^adm_[a-f0-9]{64}$/.test(token)) {
        const { error } = await supabase.from('admin_credentials')
          .update({ current_token_hash: null, session_expires_at: null }).eq('current_token_hash', hashAdminToken(token));
        if (error) throw error;
      }
      sendJson(res, 200, { success: true });
      return;
    }
    if (req.method === 'POST' && pathname === '/api/auth/change-password') {
      const response = await changeAdminPassword(req, await readBody(req));
      sendJson(res, response.status, response.body);
      return;
    }
    if (req.method === 'POST' && pathname === '/api/auth/session') {
      const response = await exchangeSupabaseSession(req);
      sendJson(res, response.status, response.body);
      return;
    }
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
    console.error('[auth]', err.code || err.name);
    sendJson(res, 503, { success: false, error: 'Authentication service unavailable. Please try again.' });
  }
}
