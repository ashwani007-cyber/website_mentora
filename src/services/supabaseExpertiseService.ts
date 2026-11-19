// Supabase-based Expertise Service
import { supabase } from '../supabaseClient';
import { cached, invalidate } from '../lib/requestCache';
import { COLUMNS } from '../lib/columns';

// ---------------------------------------------------------------------------
// EGRESS NOTES (why this file looks the way it does)
// - Expert lists are read through the database function get_experts_list(), which returns
//   every expert WITHOUT the heavy base64 file data that used to live in experts.documents.
//   (SQL: supabase/egress-fix/01_slim_read_functions.sql)
// - If that function is not installed yet, we fall back to a plain list query WITHOUT the documents
//   column (COLUMNS.EXPERT_LIST), so nothing breaks and the response stays small.
// - Results are cached for EXPERTS_TTL_MS and concurrent callers share one request.
// - Every write calls invalidate('experts') so the next read is fresh (no stale data).
// ---------------------------------------------------------------------------
const EXPERTS_TTL_MS = 60_000;

/** True when PostgREST says the RPC function doesn't exist (SQL not run yet). */
const isMissingFunction = (error: any) =>
  !!error && (error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message || ''));

/** Logs a failed Supabase call clearly instead of hiding it. */
const logSupabaseError = (where: string, error: any) => {
  if (error) console.error(`[experts] ${where} failed:`, error.message || error, error.code ? `(code ${error.code})` : '');
};

async function loadExpertsSlim(): Promise<Expert[] | null> {
  const { data, error } = await supabase.rpc('get_experts_list', undefined, { get: true });
  if (!error) return Array.isArray(data) ? (data as Expert[]) : [];
  if (!isMissingFunction(error)) {
    logSupabaseError('get_experts_list', error);
    return null;
  }
  // Fallback (SQL function not installed yet): list columns only, never the heavy documents JSON.
  const res = await supabase.from('experts').select(COLUMNS.EXPERT_LIST).order('created_at', { ascending: false }).limit(500);
  if (res.error) {
    logSupabaseError('select experts', res.error);
    return null;
  }
  return res.data as Expert[];
}

async function loadExpertSlimByKey(key: string): Promise<Expert | null> {
  const { data, error } = await supabase.rpc('get_expert_by_key', { p_key: key }, { get: true });
  if (!error) return (data as Expert) || null;
  if (!isMissingFunction(error)) {
    logSupabaseError('get_expert_by_key', error);
    return null;
  }
  // Fallback (SQL function not installed yet): same lookup the app used before.
  const res = await supabase.from('experts').select(COLUMNS.EXPERT_WITH_DOCUMENTS).or(`id.eq.${key},email.ilike.${key}`).limit(1);
  if (res.error) logSupabaseError('select expert', res.error);
  return (Array.isArray(res.data) && res.data[0] as Expert) || null;
}

/** Cached, slim expert-by-id-or-email lookup used by status checks and login. */
export async function getExpertSlimByKey(key: string, opts: { force?: boolean } = {}): Promise<Expert | null> {
  const clean = (key || '').trim();
  if (!clean) return null;
  const cacheKey = `experts:one:${clean.toLowerCase()}`;
  if (opts.force) invalidate(cacheKey);
  return cached(cacheKey, 15_000, () => loadExpertSlimByKey(clean));
}

export interface Expert {
  id: string;
  name: string;
  field: string;
  years_of_experience?: number;
  base_rate?: number;
  admin_markup?: number;
  rate?: number;
  project_rate?: number;
  rating?: number;
  total_sessions?: number;
  verified?: boolean;
  initials?: string;
  title?: string;
  phone?: string;
  email?: string;
  bio?: string;
  skills?: string[];
  documents?: any;
  created_at?: string;
  updated_at?: string;
}

export interface ExpertAvailability {
  id: string;
  expert_id: string;
  availability_date: string;
  start_time: string;
  end_time: string;
  status: 'AVAILABLE' | 'BOOKED' | 'DISABLED';
  booking_id?: string;
  client_id?: string;
  client_name?: string;
  created_at?: string;
  updated_at?: string;
}

const EXPERTISE_STORAGE_KEY = 'mentora_expertise_data';

export const expertiseService = {
  // Helper to fetch from local API if Supabase table is unavailable
  async getLocalExperts(): Promise<Expert[]> {
    try {
      const response = await fetch('/api/experts');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
      const dbRes = await fetch('/api/db');
      if (dbRes.ok) {
        const db = await dbRes.json();
        if (Array.isArray(db?.experts) && db.experts.length > 0) return db.experts;
      }
    } catch {}
    return this.loadFromLocalStorage();
  },

  // Helper to fetch local availability
  async getLocalAvailability(expertId: string, date?: string): Promise<ExpertAvailability[]> {
    try {
      const url = `/api/availability?expertId=${encodeURIComponent(expertId)}${date ? `&date=${encodeURIComponent(date)}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.availabilities)) return json.availabilities;
      }
    } catch {}
    return [];
  },

  // Get all experts
  // Slim + cached. Pass { force: true } right after a save to skip the cache.
  async getExperts(opts: { force?: boolean } = {}): Promise<Expert[]> {
    try {
      if (opts.force) invalidate('experts:list');
      const data = await cached('experts:list', EXPERTS_TTL_MS, async () => {
        const rows = await loadExpertsSlim();
        // Don't cache a failure — throw so the next call retries.
        if (rows === null) throw new Error('experts list unavailable');
        return rows;
      });
      if (Array.isArray(data) && data.length > 0) return data;
      return await this.getLocalExperts();
    } catch {
      return await this.getLocalExperts();
    }
  },

  // Get single expert
  async getExpert(id: string): Promise<Expert | null> {
    try {
      const data = await getExpertSlimByKey(id);
      if (data) return data;
    } catch {}

    try {
      const list = await this.getLocalExperts();
      return list.find(e => e.id === id || (e as any)._id === id) || null;
    } catch {
      return null;
    }
  },

  // Get expert availability
  async getExpertAvailability(expertId: string, date?: string): Promise<ExpertAvailability[]> {
    try {
      let query = supabase
        .from('expert_availability')
        .select('id, expert_id, availability_date, start_time, end_time, status, booking_id, client_id, client_name, created_at, updated_at')
        .eq('expert_id', expertId);

      if (date) {
        query = query.eq('availability_date', date);
      }

      // Stable order + a safety cap (one expert's calendar is far below 500 slots).
      const { data, error } = await query.order('availability_date', { ascending: true }).order('start_time', { ascending: true }).limit(500);
      if (!error && data && data.length > 0) return data;
      return await this.getLocalAvailability(expertId, date);
    } catch {
      return await this.getLocalAvailability(expertId, date);
    }
  },

  // Book availability slot
  async bookAvailability(slotId: string, bookingId: string, clientId: string, clientName: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('expert_availability')
        .update({
          status: 'BOOKED',
          booking_id: bookingId,
          client_id: clientId,
          client_name: clientName,
          updated_at: new Date().toISOString()
        })
        .eq('id', slotId)
        .eq('status', 'AVAILABLE');

      if (!error) return true;
    } catch {}

    try {
      const res = await fetch('/api/availability/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, bookingId, clientId, clientName })
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // Create expert
  async createExpert(expert: Partial<Expert>): Promise<Expert | null> {
    try {
      const { data, error } = await supabase
        .from('experts')
        .insert(expert)
        .select('id') // only the id comes back; the full row can be large
        .single();

      if (!error && data) {
        invalidate('experts');
        return (await getExpertSlimByKey(data.id, { force: true })) || ({ ...expert, id: data.id } as Expert);
      }
      logSupabaseError('createExpert (direct, will try server API next)', error);
    } catch (err) {
      logSupabaseError('createExpert (direct, will try server API next)', err);
    }

    try {
      const res = await fetch('/api/experts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expert)
      });
      if (res.ok) {
        const json = await res.json();
        return json.expert || json;
      }
    } catch {}
    return null;
  },

  // Update expert
  async updateExpert(id: string, updates: Partial<Expert>): Promise<Expert | null> {
    try {
      const { data, error } = await supabase
        .from('experts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id') // only the id comes back; the full row can be large
        .single();

      if (!error && data) {
        invalidate('experts');
        return (await getExpertSlimByKey(id, { force: true })) || ({ ...updates, id } as Expert);
      }
      logSupabaseError('updateExpert (direct, will try server API next)', error);
    } catch (err) {
      logSupabaseError('updateExpert (direct, will try server API next)', err);
    }

    try {
      const res = await fetch('/api/experts/markup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates })
      });
      if (res.ok) {
        invalidate('experts');
        const json = await res.json();
        return json.expert || json;
      }
      console.error('[experts] updateExpert via server API failed: HTTP', res.status);
    } catch (err) {
      console.error('[experts] updateExpert via server API failed:', err);
    }
    return null;
  },

  // Save to local storage (for offline support)
  saveToLocalStorage(experts: Expert[]): void {
    try {
      localStorage.setItem(EXPERTISE_STORAGE_KEY, JSON.stringify(experts));
    } catch (err) {
      console.error('Error saving to localStorage:', err);
    }
  },

  // Load from local storage
  loadFromLocalStorage(): Expert[] {
    try {
      const data = localStorage.getItem(EXPERTISE_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Error loading from localStorage:', err);
      return [];
    }
  }
};
