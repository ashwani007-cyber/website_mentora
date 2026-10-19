// Supabase Client for Backend (Node.js)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://oitxwcspkelduxbuczux.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pdHh3Y3Nwa2VsZHV4YnVjenV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjM5NjU2NCwiZXhwIjoyMTA3OTcyNTY0fQ.WGi0P4ENT5nhKPmp4zQN5VgmZ1twXLb4INXTSu1jxdw';

// Create Supabase client with service role key (full admin access)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('✅ Supabase client initialized');
