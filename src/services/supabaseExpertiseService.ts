// Supabase-based Expertise Service
import { supabase } from '../supabaseClient';

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
  async getExperts(): Promise<Expert[]> {
    try {
      const { data, error } = await supabase
        .from('experts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return await this.getLocalExperts();
      }
      if (Array.isArray(data) && data.length > 0) return data;
      return await this.getLocalExperts();
    } catch {
      return await this.getLocalExperts();
    }
  },

  // Get single expert
  async getExpert(id: string): Promise<Expert | null> {
    try {
      const { data, error } = await supabase
        .from('experts')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) return data;
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
        .select('*')
        .eq('expert_id', expertId);

      if (date) {
        query = query.eq('availability_date', date);
      }

      const { data, error } = await query;
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
        .select()
        .single();

      if (!error && data) return data;
    } catch {}

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
        .select()
        .single();

      if (!error && data) return data;
    } catch {}

    try {
      const res = await fetch('/api/experts/markup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates })
      });
      if (res.ok) {
        const json = await res.json();
        return json.expert || json;
      }
    } catch {}
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
