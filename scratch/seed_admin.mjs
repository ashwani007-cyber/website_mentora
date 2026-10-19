import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const email = 'kushwahaashwani12@gmail.com';
const password = 'H@a#n&u*m$a%n/J!i12/07/2006';
const fullName = 'Ashwani Kushwaha';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const passwordHash = await bcrypt.hash(password, 10);

const probe = await supabase.from('users').select('id').limit(1);
console.log('supabase_users_probe', { error: probe.error?.message || null, code: probe.error?.code || null });

if (!probe.error) {
  const { data: existing } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
  if (existing?.id) {
    const { error } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, full_name: fullName, role: 'admin', is_verified: true })
      .eq('id', existing.id);
    console.log('supabase_update', error ? error.message : 'ok');
  } else {
    const { error } = await supabase.from('users').insert({
      email,
      password_hash: passwordHash,
      full_name: fullName,
      role: 'admin',
      is_verified: true
    });
    console.log('supabase_insert', error ? error.message : 'ok');
  }
}

const dbPath = path.join(root, 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
if (!Array.isArray(db.users)) db.users = [];
const idx = db.users.findIndex((user) => String(user.email || '').toLowerCase() === email);
const localUser = {
  id: idx >= 0 ? db.users[idx].id : `usr-admin-${Date.now()}`,
  name: fullName,
  full_name: fullName,
  email,
  password_hash: passwordHash,
  phone: '+91 90000 00000',
  role: 'admin',
  initials: 'AK',
  createdAt: new Date().toISOString()
};
if (idx >= 0) db.users[idx] = { ...db.users[idx], ...localUser };
else db.users.push(localUser);
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log('local_db_seed', 'ok');
process.exit(0);
