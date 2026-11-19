// Supabase Client for Frontend (React)
// ---------------------------------------------------------------------------
// This is the ONE shared Supabase client for the whole browser app.
// Every file must import { supabase } from here.
// Creating several clients wastes memory, duplicates auth token refreshes and causes
// "Multiple GoTrueClient instances" warnings.
//
// `global.fetch` routes every request through supabaseFetch, which de-duplicates identical
// requests, stops retry storms when the project is restricted (HTTP 402) or paused, and in
// development logs the size of every response (run `__supabaseStats()` in the console).
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js';
import { supabaseFetch } from './lib/supabaseFetch';

// The anon key is a PUBLIC key (it is meant to be shipped to browsers). Real protection comes
// from Row Level Security policies in the database. Prefer setting both values in `.env`.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://oitxwcspkelduxbuczux.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pdHh3Y3Nwa2VsZHV4YnVjenV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzOTY1NjQsImV4cCI6MjEwNzk3MjU2NH0.XecRrbZOG6enELdWxk3xptZca7D5bKeO7Gb51b3x6FY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: supabaseFetch
  }
});
