// Test Supabase connection and seed user account
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.SUPABASE_URL || 'https://oitxwcspkelduxbuczux.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testAndSeed() {
  console.log('🔍 Testing Supabase connection...');
  console.log(`   URL: ${supabaseUrl}`);
  
  // 1. Test basic connection
  try {
    const { data, error } = await supabase.from('users').select('id, email, role').limit(5);
    if (error) {
      console.error('❌ Users table error:', error.message);
      console.log('\n📋 Checking if tables exist...');
      
      // Check if we need to create tables
      const { data: tables, error: tablesErr } = await supabase.rpc('exec_sql', { sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'" });
      if (tablesErr) {
        console.log('   Cannot query tables directly. The schema may need to be run.');
        console.log('   Please run supabase-schema.sql in your Supabase SQL Editor.');
      }
    } else {
      console.log('✅ Users table accessible');
      console.log(`   Found ${data?.length || 0} users:`, data?.map(u => `${u.email} (${u.role})`));
    }
  } catch (err) {
    console.error('❌ Connection error:', err.message);
  }

  // 2. Seed the user account
  const email = 'kushwahaashwani12@gmail.com';
  const password = 'H@a#n&u*m$a%n/J!i12/07/2006';
  const passwordHash = await bcrypt.hash(password, 10);
  
  console.log('\n🌱 Seeding user account...');
  console.log(`   Email: ${email}`);
  
  // Check if user already exists
  const { data: existing, error: existErr } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();
    
  if (existErr) {
    console.error('❌ Error checking existing user:', existErr.message);
    console.log('\n⚠️  The "users" table may not exist yet.');
    console.log('   Run this SQL in Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/oitxwcspkelduxbuczux/sql/new');
    console.log('\n   CREATE TABLE IF NOT EXISTS users (');
    console.log('     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),');
    console.log('     email VARCHAR(255) UNIQUE NOT NULL,');
    console.log('     password_hash VARCHAR(255) NOT NULL,');
    console.log('     full_name VARCHAR(255),');
    console.log('     role VARCHAR(50) NOT NULL DEFAULT \'admin\',');
    console.log('     phone VARCHAR(50),');
    console.log('     avatar_url TEXT,');
    console.log('     bio TEXT,');
    console.log('     is_verified BOOLEAN DEFAULT true,');
    console.log('     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),');
    console.log('     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()');
    console.log('   );');
    return;
  }
  
  if (existing) {
    console.log(`   User already exists (id: ${existing.id}, role: ${existing.role})`);
    
    // Update password to make sure it matches
    const { error: updateErr } = await supabase
      .from('users')
      .update({ 
        password_hash: passwordHash, 
        role: 'admin',
        full_name: 'Ashwani Kushwaha',
        is_verified: true
      })
      .eq('id', existing.id);
      
    if (updateErr) {
      console.error('❌ Error updating user:', updateErr.message);
    } else {
      console.log('✅ Updated password and role to admin');
    }
  } else {
    // Create the user
    const { data: newUser, error: createErr } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        full_name: 'Ashwani Kushwaha',
        role: 'admin',
        phone: '+91 98765 43210',
        is_verified: true
      })
      .select()
      .single();
      
    if (createErr) {
      console.error('❌ Error creating user:', createErr.message);
    } else {
      console.log(`✅ User created (id: ${newUser.id})`);
    }
  }
  
  // 3. Verify login would work
  console.log('\n🔐 Verifying login...');
  const { data: loginUser } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();
    
  if (loginUser) {
    const match = await bcrypt.compare(password, loginUser.password_hash);
    console.log(`   Password match: ${match ? '✅ YES' : '❌ NO'}`);
    console.log(`   Role: ${loginUser.role}`);
    console.log(`   Name: ${loginUser.full_name}`);
  }

  // 4. Check other tables
  console.log('\n📋 Checking other tables...');
  const tables = ['experts', 'expert_availability', 'project_reviews', 'bookings', 'notifications', 'platform_settings', 'blogs'];
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`   ❌ ${table}: ${error.message}`);
      } else {
        console.log(`   ✅ ${table}: accessible`);
      }
    } catch {
      console.log(`   ❌ ${table}: not accessible`);
    }
  }

  // 5. Make sure db.json also has the user for local fallback
  console.log('\n📁 Updating local db.json fallback...');
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dbPath = path.resolve(__dirname, '../db.json');
  
  try {
    let db = {};
    if (fs.existsSync(dbPath)) {
      db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    }
    if (!Array.isArray(db.users)) db.users = [];
    
    const existingIdx = db.users.findIndex(u => u.email?.toLowerCase() === email.toLowerCase());
    const localUser = {
      id: loginUser?.id || `usr-${Date.now()}`,
      email,
      password_hash: passwordHash,
      name: 'Ashwani Kushwaha',
      full_name: 'Ashwani Kushwaha',
      role: 'admin',
      phone: '+91 98765 43210',
      is_verified: true,
      createdAt: new Date().toISOString()
    };
    
    if (existingIdx >= 0) {
      db.users[existingIdx] = { ...db.users[existingIdx], ...localUser };
      console.log('   Updated existing user in db.json');
    } else {
      db.users.push(localUser);
      console.log('   Added user to db.json');
    }
    
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
    console.log('   ✅ db.json updated');
  } catch (err) {
    console.error('   ❌ db.json error:', err.message);
  }
  
  console.log('\n✅ Done! You can now login with:');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
}

testAndSeed().catch(console.error);
