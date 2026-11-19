// KYC Workflow Service Functions
import { supabase } from './supabaseClient';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: 'expert' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface ExpertProfile {
  id: string;
  user_id: string;
  bio?: string;
  skills?: string[];
  experience_years?: number;
  photo_url?: string;
  expertise_area?: string;
  status: 'pending_verification' | 'submitted' | 'under_review' | 'approved' | 'changes_requested' | 'rejected';
  rejection_reason?: string;
  admin_comments?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface KYCDocument {
  id: string;
  expert_id: string;
  doc_type: 'id_proof' | 'address_proof' | 'qualification_certificate' | 'experience_certificate' | 'other';
  file_path: string;
  file_name: string;
  file_size?: number;
  uploaded_at: string;
}

export interface StatusHistory {
  id: string;
  expert_id: string;
  old_status?: string;
  new_status: string;
  changed_by?: string;
  comment?: string;
  changed_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata?: any;
  created_at: string;
}

// ============================================================
// AUTHENTICATION
// ============================================================

export const authService = {
  async signUp(email: string, password: string, fullName: string, phone?: string, expertiseArea?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          role: 'expert',
          expertise_area: expertiseArea
        }
      }
    });

    if (error) throw error;
    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  onAuthStateChange(callback: any) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// ============================================================
// PROFILE
// ============================================================

export const profileService = {
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  async updateProfile(userId: string, updates: Partial<Profile>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getAllProfiles(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};

// ============================================================
// EXPERT PROFILE
// ============================================================

export const expertProfileService = {
  async getExpertProfile(userId: string): Promise<ExpertProfile | null> {
    const { data, error } = await supabase
      .from('expert_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  async getExpertProfileById(id: string): Promise<ExpertProfile | null> {
    const { data, error } = await supabase
      .from('expert_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async updateExpertProfile(id: string, updates: Partial<ExpertProfile>) {
    const { data, error } = await supabase
      .from('expert_profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async submitForReview(id: string) {
    return this.updateExpertProfile(id, { status: 'submitted' });
  },

  async getAllExpertProfiles(status?: string): Promise<ExpertProfile[]> {
    let query = supabase
      .from('expert_profiles')
      .select('*, profiles(full_name, email, phone)')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getApprovedExperts(): Promise<ExpertProfile[]> {
    return this.getAllExpertProfiles('approved');
  }
};

// ============================================================
// KYC DOCUMENTS
// ============================================================

export const kycDocumentService = {
  async uploadDocument(file: File, expertId: string, docType: string) {
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only PDF, JPG, and PNG are allowed.');
    }

    // Validate file size (5 MB max)
    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      throw new Error('File size exceeds 5 MB limit.');
    }

    // Generate file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `${expertId}/${docType}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .upload(filePath, file);

    if (error) throw error;

    // Save to database
    const { data: docData, error: dbError } = await supabase
      .from('kyc_documents')
      .insert({
        expert_id: expertId,
        doc_type: docType,
        file_path: filePath,
        file_name: fileName,
        file_size: file.size
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return docData;
  },

  async getExpertDocuments(expertId: string): Promise<KYCDocument[]> {
    const { data, error } = await supabase
      .from('kyc_documents')
      .select('*')
      .eq('expert_id', expertId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getSignedUrl(filePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .createSignedUrl(filePath, 60); // 60 seconds expiry

    if (error) throw error;
    return data.signedUrl;
  },

  async deleteDocument(documentId: string) {
    // Get document info first
    const { data: doc } = await supabase
      .from('kyc_documents')
      .select('file_path')
      .eq('id', documentId)
      .single();

    if (!doc) throw new Error('Document not found');

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('kyc-documents')
      .remove([doc.file_path]);

    if (storageError) throw storageError;

    // Delete from database
    const { error: dbError } = await supabase
      .from('kyc_documents')
      .delete()
      .eq('id', documentId);

    if (dbError) throw dbError;
  }
};

// ============================================================
// PROFILE PHOTO
// ============================================================

export const profilePhotoService = {
  async uploadProfilePhoto(file: File, userId: string): Promise<string> {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only JPG and PNG are allowed.');
    }

    // Validate file size (2 MB max)
    const maxSize = 2 * 1024 * 1024; // 2 MB
    if (file.size > maxSize) {
      throw new Error('File size exceeds 2 MB limit.');
    }

    // Generate file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}_profile.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('profile-photos')
      .upload(filePath, file, {
        upsert: true
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profile-photos')
      .getPublicUrl(filePath);

    return publicUrl;
  }
};

// ============================================================
// STATUS HISTORY
// ============================================================

export const statusHistoryService = {
  async getStatusHistory(expertId: string): Promise<StatusHistory[]> {
    const { data, error } = await supabase
      .from('status_history')
      .select('*')
      .eq('expert_id', expertId)
      .order('changed_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};

// ============================================================
// NOTIFICATIONS
// ============================================================

export const notificationService = {
  async getNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async markAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;
  },

  async markAllAsRead(userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId);

    if (error) throw error;
  },

  subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
    return supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => callback(payload.new as Notification)
      )
      .subscribe();
  }
};

// ============================================================
// ADMIN OPERATIONS
// ============================================================

export const adminService = {
  async approveExpert(expertId: string, adminId: string, comments?: string) {
    const { data, error } = await supabase
      .from('expert_profiles')
      .update({
        status: 'approved',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        admin_comments: comments,
        rejection_reason: null
      })
      .eq('id', expertId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async requestChanges(expertId: string, adminId: string, comments: string) {
    const { data, error } = await supabase
      .from('expert_profiles')
      .update({
        status: 'changes_requested',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        admin_comments: comments,
        rejection_reason: null
      })
      .eq('id', expertId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async rejectExpert(expertId: string, adminId: string, reason: string) {
    const { data, error } = await supabase
      .from('expert_profiles')
      .update({
        status: 'rejected',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
        admin_comments: null
      })
      .eq('id', expertId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async startReview(expertId: string, adminId: string) {
    const { data, error } = await supabase
      .from('expert_profiles')
      .update({
        status: 'under_review',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', expertId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
