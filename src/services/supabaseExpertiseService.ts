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
  // Get all experts
  async getExperts(): Promise<Expert[]> {
    try {
      const { data, error } = await supabase
        .from('experts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching experts:', err);
      return [];
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

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error fetching expert:', err);
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
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching availability:', err);
      return [];
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

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error booking availability:', err);
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

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error creating expert:', err);
      return null;
    }
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

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error updating expert:', err);
      return null;
    }
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
