// Supabase Client for Frontend (React)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://oitxwcspkelduxbuczux.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pdHh3Y3Nwa2VsZHV4YnVjenV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzOTY1NjQsImV4cCI6MjEwNzk3MjU2NH0.XecRrbZOG6enELdWxk3xptZca7D5bKeO7Gb51b3x6FY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('✅ Supabase client initialized (frontend)');
