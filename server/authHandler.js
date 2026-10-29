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
    projectRate: extras.projectRate ?? user.projectRate ?? 1000,
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
  if (user.password_hash) return bcrypt.compare(password, user.password_hash);
  if (user.password) {
    if (String(user.password).startsWith('$2')) return bcrypt.compare(password, user.password);
    return user.password === password;
  }
  return false;
}

function findLocalUser(email, phone) {
  const db = readLocalDb();
  const cleanEmail = String(email || '').toLowerCase().trim();
  const phoneDigits = String(phone || '').replace(/\D/g, '');
  const user = db.users.find((entry) => {
    const entryEmail = String(entry.email || '').toLowerCase().trim();
    if (cleanEmail && entryEmail === cleanEmail) return true;
    if (phoneDigits && phoneDigits.length >= 8) {
      const entryDigits = String(entry.phone || '').replace(/\D/g, '');
      if (entryDigits && entryDigits.length >= 8 && entryDigits === phoneDigits) return true;
    }
    return false;
  });
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

function upsertLocalExpert(expert) {
  const db = readLocalDb();
  if (!Array.isArray(db.experts)) db.experts = [];
  const idx = db.experts.findIndex((entry) => String(entry.email || '').toLowerCase() === String(expert.email).toLowerCase() || (expert.id && entry.id === expert.id));
  if (idx >= 0) db.experts[idx] = { ...db.experts[idx], ...expert };
  else db.experts.unshift(expert);
  writeLocalDb(db);
  return expert;
}

function upsertLocalPending(pending) {
  const db = readLocalDb();
  if (!Array.isArray(db.pendingVerifications)) db.pendingVerifications = [];
  const idx = db.pendingVerifications.findIndex((entry) => String(entry.email || '').toLowerCase() === String(pending.email).toLowerCase() || (pending.id && entry.id === pending.id));
  if (idx >= 0) db.pendingVerifications[idx] = { ...db.pendingVerifications[idx], ...pending };
  else db.pendingVerifications.unshift(pending);
  writeLocalDb(db);
  return pending;
}

async function registerUser(payload) {
  const email = String(payload.email || '').toLowerCase().trim();
  const password = String(payload.password || '');
  const fullName = payload.fullName || payload.full_name || payload.name || '';
  const phone = String(payload.phone || '').trim();
  let role = String(payload.role || 'client').toLowerCase();
  if (isAdminEmail(email)) role = 'admin';

  if (!email || !password) {
    return { status: 400, body: { success: false, error: 'Email and password are required', message: 'Email and password are required.' } };
  }
  if (!['admin', 'expert', 'client'].includes(role)) {
    return { status: 400, body: { success: false, error: 'Invalid role', message: 'Invalid role selected.' } };
  }

  // Validate phone format if provided
  if (phone && phone.replace(/\D/g, '').length < 8) {
    return { status: 400, body: { success: false, error: 'Invalid phone', message: 'Please enter a valid phone number (at least 8 digits).' } };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const expertId = payload.id || `exp-${Date.now()}`;
  const localRecord = {
    id: role === 'expert' ? expertId : (payload.id || `usr-${Date.now()}`),
    email,
    password_hash: passwordHash,
    name: fullName,
    full_name: fullName,
    role,
    phone,
    company: payload.company || '',
    title: payload.title || (role === 'expert' ? 'Senior Executive Advisor' : ''),
    field: payload.field || (role === 'expert' ? 'Finance & Taxation' : ''),
    bio: payload.bio || '',
    years: Number(payload.years) || 0,
    baseRate: Number(payload.baseRate) || 600,
    projectRate: Number(payload.projectRate) || 1000,
    verified: false,
    is_verified: false,
    verificationStatus: 'pending',
    createdAt: new Date().toISOString()
  };

  // 1. Check duplicate registrations in local DB
  const { user: existingLocal } = findLocalUser(email, phone);
  if (existingLocal) {
    const digitsA = phone ? String(phone).replace(/\D/g, '') : '';
    const digitsB = existingLocal.phone ? String(existingLocal.phone).replace(/\D/g, '') : '';
    const isSamePhone = Boolean(digitsA && digitsB && digitsA.length >= 8 && digitsA === digitsB);
    const valid = await passwordsMatch(password, existingLocal);
    if (valid) {
      upsertLocalUser({ ...existingLocal, ...localRecord, id: existingLocal.id });
      return {
        status: 200,
        body: {
          ...loginPayload(existingLocal, localRecord),
          alreadyRegistered: true,
          message: 'Account already registered. Logging in to portal...'
        }
      };
    }
    const dupField = isSamePhone ? 'phone number' : 'email address';
    return {
      status: 409,
      body: {
        success: false,
        error: 'User already exists',
        message: `An account with this ${dupField} is already registered. Please sign in with your password.`
      }
    };
  }

  // 2. Check Supabase Auth and remote database
  let authUserId = null;
  try {
    const { data: authCreated, error: authCreateErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role, phone }
    });
    if (authCreated?.user?.id) {
      authUserId = authCreated.user.id;
      localRecord.id = authUserId;
      localRecord.user_id = authUserId;
    } else if (authCreateErr && authCreateErr.message?.toLowerCase().includes('already')) {
      // User already in Supabase Auth
    }
  } catch (authErr) {
    console.warn('[AUTH] Supabase Auth creation note:', authErr.message);
  }

  // 1. Insert/upsert into users table first so foreign keys (experts_user_id_fkey) are satisfied
  let userRowCreated = false;
  try {
    const { error: sbUserError } = await supabase.from('users').upsert({
      id: (authUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authUserId)) ? authUserId : undefined,
      email,
      password_hash: passwordHash,
      full_name: fullName,
      role,
      phone: phone || null,
      is_verified: false
    }, { onConflict: 'email' });
    if (sbUserError) {
      console.error('[AUTH] Supabase users upsert error:', sbUserError);
    } else {
      userRowCreated = true;
    }
  } catch (sbUserErr) {
    console.error('[AUTH] Supabase users upsert error:', sbUserErr);
  }

  try {
    if (role === 'expert') {
      const expertRecord = {
        id: localRecord.id,
        user_id: localRecord.id,
        name: fullName,
        field: payload.field || 'Finance & Taxation',
        years_of_experience: Number(payload.years) || 0,
        years: Number(payload.years) || 0,
        company: payload.company || '',
        base_rate: Number(payload.baseRate) || 600,
        baseRate: Number(payload.baseRate) || 600,
        admin_markup: 150,
        adminMarkup: 150,
        rate: (Number(payload.baseRate) || 600) + 150,
        project_rate: Number(payload.projectRate) || 1000,
        projectRate: Number(payload.projectRate) || 1000,
        rating: 0,
        total_sessions: 0,
        sessions: 0,
        verified: false,
        is_verified: false,
        verificationStatus: 'pending',
        initials: fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'EX',
        title: payload.title || 'Senior Executive Advisor',
        phone: phone || '',
        email,
        bio: payload.bio || '',
        skills: [payload.field || 'Finance & Taxation'],
        documents: {
          status: 'pending',
          verificationStatus: 'pending',
          items: {}
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const pendingRecord = {
        id: localRecord.id,
        expertId: localRecord.id,
        name: fullName,
        email,
        phone: phone || '',
        field: payload.field || 'Finance & Taxation',
        company: payload.company || '',
        title: payload.title || 'Senior Executive Advisor',
        years: Number(payload.years) || 0,
        baseRate: Number(payload.baseRate) || 600,
        projectRate: Number(payload.projectRate) || 1000,
        bio: payload.bio || '',
        status: 'Pending Audit',
        verificationStatus: 'pending',
        verified: false,
        is_verified: false,
        submittedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        documents: {}
      };

      upsertLocalExpert(expertRecord);
      upsertLocalPending(pendingRecord);

      try {
        const targetUserId = (userRowCreated && authUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authUserId)) ? authUserId : null;
        const { error: sbExpError } = await supabase.from('experts').upsert({
          id: localRecord.id,
          user_id: targetUserId,
          name: fullName,
          field: payload.field || 'Finance & Taxation',
          years_of_experience: Number(payload.years) || 0,
          base_rate: Number(payload.baseRate) || 600,
          admin_markup: 150,
          rate: (Number(payload.baseRate) || 600) + 150,
          project_rate: Number(payload.projectRate) || 1000,
          rating: 0,
          total_sessions: 0,
          verified: false,
          initials: fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'EX',
          title: payload.title || 'Senior Executive Advisor',
          phone: phone || null,
          email,
          bio: payload.bio || '',
          skills: [payload.field || 'Finance & Taxation'],
          documents: {
            status: 'pending',
            verificationStatus: 'pending',
            is_verified: false,
            company: payload.company || '',
            items: {}
          }
        }, { onConflict: 'id' });
        if (sbExpError) {
          console.error('[AUTH] Supabase experts upsert error:', sbExpError);
        }
      } catch (sbExpErr) {
        console.error('[AUTH] Supabase experts upsert error:', sbExpErr);
      }
    }

    upsertLocalUser(localRecord);
    return {
      status: 200,
      body: {
        success: true,
        message: 'Account registered successfully.',
        user: publicUser(localRecord, localRecord),
        token: publicUser(localRecord, localRecord).token || null
      }
    };
  } catch (err) {
    upsertLocalUser(localRecord);
    return {
      status: 200,
      body: {
        success: true,
        message: 'Account registered successfully.',
        user: publicUser(localRecord, localRecord),
        token: publicUser(localRecord, localRecord).token || null
      }
    };
  }
}

async function loginUser(payload) {
  const email = String(payload.email || '').toLowerCase().trim();
  const password = String(payload.password || '');
  if (!email || !password) {
    return { status: 400, body: { success: false, error: 'Email and password are required', message: 'Email and password are required' } };
  }

  const { user: localUser, db } = findLocalUser(email);
  const localExpert = (db?.experts || []).find((e) => String(e.email || '').toLowerCase() === email);

  let supaExpert = null;
  try {
    const { data: se } = await supabase.from('experts').select('*').eq('email', email).maybeSingle();
    if (se) supaExpert = se;
  } catch {}

  const isExpVerified = Boolean(supaExpert?.verified === true || localExpert?.verified === true);

  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
    if (!error && user) {
      const valid = await passwordsMatch(password, user);
      if (!valid) {
        return { status: 401, body: { success: false, error: 'Invalid credentials', message: 'Invalid credentials' } };
      }
      const extras = { ...(localExpert || {}), ...(localUser || {}), ...(supaExpert || {}) };
      if (isExpVerified) {
        user.verified = true;
        user.is_verified = true;
        user.verificationStatus = 'approved';
        extras.verified = true;
        extras.is_verified = true;
        extras.verificationStatus = 'approved';
      }
      const mappedRole = isAdminEmail(email) ? 'admin' : (user.role || extras.role);
      return { status: 200, body: loginPayload({ ...user, role: mappedRole }, extras) };
    }
  } catch {}

  if (!localUser) {
    return { status: 401, body: { success: false, error: 'MUST REGISTER FIRST', message: 'Account not found. MUST REGISTER FIRST.' } };
  }
  const valid = await passwordsMatch(password, localUser);
  if (!valid) {
    return { status: 401, body: { success: false, error: 'Invalid credentials', message: 'Invalid credentials' } };
  }
  const mappedRole = isAdminEmail(email) ? 'admin' : localUser.role;
  const extras = { ...(localExpert || {}), ...(localUser || {}), ...(supaExpert || {}) };
  if (isExpVerified) {
    localUser.verified = true;
    localUser.is_verified = true;
    localUser.verificationStatus = 'approved';
    extras.verified = true;
    extras.is_verified = true;
    extras.verificationStatus = 'approved';
  }
  return { status: 200, body: loginPayload({ ...localUser, role: mappedRole }, extras) };
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
