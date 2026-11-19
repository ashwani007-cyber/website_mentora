// Supabase Client for KYC Workflow
// ---------------------------------------------------------------------------
// This file used to create a SECOND Supabase client. Two clients in one browser tab means two
// auth listeners and duplicate token refreshes. It now simply re-uses the shared client.
// ---------------------------------------------------------------------------
export { supabase } from '../supabaseClient';
