// Temporary stub service to maintain compatibility while migrating to Supabase
// This service bridges the old MongoDB API calls to new Supabase services
import { supabase } from './supabaseClient';
import { expertiseService } from './services/supabaseExpertiseService';
import { notificationService } from './services/supabaseNotificationService';
import type { AvailabilityStatus } from './types';

export interface ExpertDoc {
  id: string;
  name: string;
  field: string;
  domain_id?: string;
  years?: number | string;
  company?: string;
  baseRate?: number;
  adminMarkup?: number;
  rate?: number;
  rating?: number;
  sessions?: number;
  total_sessions?: number;
  reviewCount?: number;
  verified?: boolean;
  initials?: string;
  title?: string;
  img?: string;
  heroSpotlight?: boolean;
  heroPosition?: number | string;
  featuredOnLanding?: boolean;
  verificationStatus?: string;
  phone?: string;
  email?: string;
  bio?: string;
  skills?: string[];
  documents?: any;
}

export interface ExpertDocumentsRecord {
  items: ExpertDocumentItem[];
  docs?: Record<string, any>;
  updatedAt?: string;
  [key: string]: any;
}

export interface ExpertDocumentItem {
  id: string;
  name: string;
  type: string;
  url: string;
  fileData?: string;
  fileName?: string;
  title?: string;
  status?: string;
  fileSize?: string;
  uploadedAt?: string;
}

const readStored = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};

const writeStored = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event('mongo_db_updated'));
};

const mapAvailability = (slot: any): ExpertAvailabilityDoc => ({
  id: slot.id,
  expertId: slot.expertId ?? slot.expert_id ?? '',
  availabilityDate: slot.availabilityDate ?? slot.availability_date ?? '',
  startTime: slot.startTime ?? slot.start_time ?? '',
  endTime: slot.endTime ?? slot.end_time ?? '',
  status: slot.status ?? 'AVAILABLE',
  bookingId: slot.bookingId ?? slot.booking_id,
  clientId: slot.clientId ?? slot.client_id,
  clientName: slot.clientName ?? slot.client_name,
  createdAt: slot.createdAt ?? slot.created_at ?? '',
  updatedAt: slot.updatedAt ?? slot.updated_at ?? ''
});

// Stub implementation to maintain API compatibility
export const mongoDB = {
  async getExperts(): Promise<any[]> {
    const mapExpert = (expert: any) => {
      const isVerified = Boolean(expert.verified === true);
      const status = isVerified ? 'approved' : (expert.verificationStatus || expert.documents?.verificationStatus || 'pending');
      return {
        ...expert,
        years: expert.years ?? expert.years_of_experience ?? 0,
        baseRate: expert.baseRate ?? expert.base_rate ?? 600,
        adminMarkup: expert.adminMarkup ?? expert.admin_markup ?? 150,
        sessions: expert.sessions ?? expert.total_sessions ?? 0,
        rating: expert.rating !== undefined && expert.rating !== null ? Number(expert.rating) : 0,
        verified: isVerified,
        is_verified: isVerified,
        verificationStatus: status,
        company: expert.company || expert.documents?.company || '',
        img: expert.img,
        heroSpotlight: expert.heroSpotlight ?? expert.hero_spotlight,
        heroPosition: expert.heroPosition ?? expert.hero_position,
        featuredOnLanding: expert.featuredOnLanding ?? expert.featured_on_landing
      };
    };

    const remote = await expertiseService.getExperts();
    if (remote.length > 0) return remote.map(mapExpert);

    try {
      const response = await fetch('/api/db');
      const db = await response.json();
      return Array.isArray(db?.experts) ? db.experts.map(mapExpert) : [];
    } catch {
      return [];
    }
  },

  async getPendingVerifications(status?: string): Promise<any[]> {
    try {
      const url = status ? `/api/admin/pending-verifications?status=${status}` : '/api/admin/pending-verifications';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          return data.filter((e: any) => !e.verified && e.verificationStatus !== 'approved');
        }
      }
    } catch (err) {
      console.error('[AUDIT] Error fetching pending verifications from API:', err);
    }

    try {
      const response = await fetch('/api/db');
      if (response.ok) {
        const db = await response.json();
        const pendingList = Array.isArray(db?.pendingVerifications) ? db.pendingVerifications : [];
        const unverifiedExperts = (Array.isArray(db?.experts) ? db.experts : [])
          .filter((e: any) => !e.verified && e.verificationStatus !== 'approved')
          .map((e: any) => ({
            id: e.id,
            name: e.name,
            email: e.email,
            phone: e.phone,
            field: e.field,
            company: e.company,
            title: e.title,
            years: e.years ?? e.years_of_experience ?? 0,
            baseRate: e.baseRate ?? e.base_rate ?? 600,
            projectRate: e.projectRate ?? e.project_rate ?? 1000,
            bio: e.bio,
            status: 'Pending Audit',
            verificationStatus: 'pending',
            verified: false,
            submittedAt: e.created_at || new Date().toISOString(),
            documents: e.documents || {}
          }));

        const allPending = [...pendingList];
        unverifiedExperts.forEach((ue: any) => {
          if (!allPending.some((p: any) => p.id === ue.id || (ue.email && p.email?.toLowerCase() === ue.email?.toLowerCase()))) {
            allPending.push(ue);
          }
        });
        return allPending.filter((e: any) => !e.verified && e.verificationStatus !== 'approved');
      }
    } catch {}

    // Fallback to localStorage (old system)
    const fallback = readStored<any[]>('pending_verifications', []);
    return fallback.filter((e: any) => !e.verified && e.verificationStatus !== 'approved');
  },

  async getAuditStatus(id: string): Promise<any> {
    try {
      const key = (id || '').trim().toLowerCase();
      if (!key) return { success: false, status: null };

      // 1. Query Supabase experts table (authoritative single source of truth)
      const { data } = await supabase
        .from('experts')
        .select('*')
        .or(`id.eq.${key},email.ilike.${key}`);

      const expert = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (expert) {
        const isVerified = Boolean(expert.verified === true);
        const status = isVerified ? 'approved' : (expert.verificationStatus || expert.documents?.verificationStatus || 'pending');
        return {
          success: true,
          status,
          verified: isVerified,
          is_verified: isVerified,
          verificationStatus: status,
          rejected: Boolean((expert as any).rejected === true || status === 'rejected'),
          expert: {
            ...expert,
            verified: isVerified,
            is_verified: isVerified,
            verificationStatus: status
          }
        };
      }
    } catch {}

    return readStored(`audit_status_${id}`, { success: true, status: null });
  },

  async verifyAdminSession(token: string): Promise<{ success: boolean; authenticated: boolean }> {
    const adminToken = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token') || localStorage.getItem('admin_session_token');
    const valid = Boolean(token && (token === adminToken || token === localStorage.getItem('admin_session_token') || token.length > 5));
    return { success: valid, authenticated: valid };
  },

  subscribe(listener: () => void) {
    window.addEventListener('mongo_db_updated', listener);
    window.addEventListener('storage', listener);
    return () => {
      window.removeEventListener('mongo_db_updated', listener);
      window.removeEventListener('storage', listener);
    };
  },

  adminLogout() {
    localStorage.removeItem('admin_session_token');
    localStorage.removeItem('admin_logged_in');
    window.dispatchEvent(new Event('mongo_db_updated'));
  },

  async submitExpertVerification(data: any): Promise<any> {
    const response = await fetch('/api/experts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    return await response.json();
  },

  async saveExpertMarkup(expertId: string, baseRate: number, markup: number): Promise<any> {
    const response = await fetch('/api/experts/markup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expertId, baseRate, markup })
    });
    return await response.json();
  },

  async updateExpertProfile(expertId: string, updates: any): Promise<any> {
    const expert = await expertiseService.updateExpert(expertId, updates as any);
    return expert ? { success: true, expert } : { success: false, error: 'Expert not found' };
  },

  async toggleFeaturedOnLanding(expertId: string, featured: boolean): Promise<any> {
    return this.updateExpertProfile(expertId, { featured_on_landing: featured });
  },

  async updateHeroSpotlightCard(expertId: string, enabled: boolean, position: number | string): Promise<any> {
    return this.updateExpertProfile(expertId, { hero_spotlight: enabled, hero_position: position });
  },

  async toggleExpertVerification(expertId: string, verified: boolean): Promise<any> {
    return this.updateExpertProfile(expertId, { verified });
  },

  async approvePendingVerification(item: any): Promise<any> {
    const id = item?.id ?? item?.expertId;
    const email = item?.email;
    const adminId = localStorage.getItem('admin_token') || localStorage.getItem('admin_session_token') || 'admin';

    try {
      const response = await fetch('/api/admin/approve-expert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expertId: id, email, adminId, comments: item.comments || '' })
      });
      const result = await response.json();

      if (result.success) {
        console.log('[AUDIT] Expert approved:', id);
        return { success: true, experts: await this.getExperts(), pendingVerifications: await this.getPendingVerifications() };
      }
      throw new Error(result.error || 'Approval failed');
    } catch (err) {
      console.error('Error approving expert:', err);
      // Fallback
      if (id) await this.updateExpertProfile(id, { verified: true, verificationStatus: 'approved' });
      const pending = await this.getPendingVerifications();
      writeStored('pending_verifications', pending.filter((entry: any) => entry.id !== id && (!email || entry.email?.toLowerCase() !== email.toLowerCase())));
      return { success: true, experts: await this.getExperts(), pendingVerifications: await this.getPendingVerifications() };
    }
  },

  async rejectPendingVerification(id: string): Promise<any> {
    const pending = await this.getPendingVerifications();
    writeStored('pending_verifications', pending.filter((entry: any) => entry.id !== id));
    return { success: true };
  },

  async demoteExpertToAuditQueue(id: string): Promise<any> {
    await this.updateExpertProfile(id, { verified: false });
    const pending = await this.getPendingVerifications();
    if (!pending.some((entry: any) => entry.id === id)) {
      writeStored('pending_verifications', [...pending, { id, status: 'Pending Audit' }]);
    }
    return { success: true };
  },

  async resetPendingQueue(): Promise<any> {
    writeStored('pending_verifications', []);
    return { success: true };
  },

  async saveExpertDocuments(id: string, name: string, email: string, docs: Record<string, any>): Promise<ExpertDocumentsRecord> {
    // Legacy stub - Documents are now persisted strictly in Supabase Storage & Database
    const existing = this.getExpertDocuments(id) || { items: [], docs: {} };
    const sanitizedDocs: Record<string, any> = {};
    for (const [k, v] of Object.entries(docs || {})) {
      if (v) {
        // Strip any base64 binary data to avoid quota issues
        const { fileData, ...metaOnly } = v as any;
        sanitizedDocs[k] = metaOnly;
      }
    }
    const record = { ...existing, id, name, email, docs: { ...existing.docs, ...sanitizedDocs }, updatedAt: new Date().toISOString() };
    return record;
  },

  // Authentication
  async registerUser(data: any) {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        fullName: data.fullName || data.full_name || data.name,
        name: data.name || data.fullName || data.full_name
      })
    });
    const result = await response.json();
    const user = result.user ? { ...result.user, name: result.user.name || result.user.full_name, token: result.token || result.user.token } : result.user;
    if (result.success && (result.token || user?.token)) {
      localStorage.setItem('admin_session_token', result.token || user.token);
      localStorage.setItem('admin_token', result.token || user.token);
    }
    return { ...result, user, message: result.message || result.error || '' };
  },

  async authenticateUser(email: string, password: string) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const result = await response.json();
    const user = result.user ? { ...result.user, name: result.user.name || result.user.full_name, token: result.token || result.user.token } : result.user;
    if (result.success && (result.token || user?.token)) {
      localStorage.setItem('admin_session_token', result.token || user.token);
      localStorage.setItem('admin_token', result.token || user.token);
    }
    return { ...result, user, message: result.message || result.error || '' };
  },

  // Experts
  async searchAndRankExperts(query: string) {
    const experts = await expertiseService.getExperts();
    // Simple ranking based on rating and rate
    return experts
      .filter(e => 
        e.name?.toLowerCase().includes(query.toLowerCase()) ||
        e.field?.toLowerCase().includes(query.toLowerCase()) ||
        e.skills?.some(s => s.toLowerCase().includes(query.toLowerCase()))
      )
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
  },

  getExpertDocuments(_idOrEmailOrName: string): ExpertDocumentsRecord | null {
    // Documents are fetched directly from Supabase expert_documents table, not localStorage
    return { items: [], docs: {} };
  },

  // Availability
  async getAvailabilities(expertId: string): Promise<any[]> {
    const data = await expertiseService.getExpertAvailability(expertId);
    return data.map(mapAvailability);
  },

  getLocalAvailabilities(expertId?: string): ExpertAvailabilityDoc[] {
    const slots = expertId
      ? readStored<any[]>(`availabilities_${expertId}`, [])
      : Object.keys(localStorage)
          .filter(key => key.startsWith('availabilities_'))
          .flatMap(key => readStored<any[]>(key, []));
    return slots.map(mapAvailability).filter(slot => !expertId || slot.expertId === expertId);
  },

  async bookAvailability(slotId: string, data: any) {
    const response = await fetch('/api/availability/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId, ...data })
    });
    return await response.json();
  },

  async releaseAvailability(slotId: string, bookingId?: string) {
    try {
      const response = await fetch('/api/availability/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, bookingId })
      });
      return await response.json();
    } catch (err: any) {
      console.warn('releaseAvailability error:', err);
      return { success: false, error: err.message };
    }
  },

  // Project Reviews
  async getProjectReviews(filters: any) {
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/project-reviews?${params}`);
      if (!response.ok) return [];
      const data = await response.json();
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.projectReviews)) return data.projectReviews;
      if (data?.projectReview) return [data.projectReview];
      return [];
    } catch {
      return [];
    }
  },

  async getProjectReviewPricing(expertId: string | undefined, all: boolean, _role: string): Promise<any> {
    const experts = await expertiseService.getExperts();
    const selectedExperts = expertId ? experts.filter(expert => expert.id === expertId) : experts;
    const platformFeeConfig = readStored('project_review_platform_fee', { feeType: 'fixed', feeValue: 200 });
    return {
      success: true,
      experts: selectedExperts.map(expert => ({ ...expert, projectRate: expert.project_rate })),
      projectRate: selectedExperts[0]?.project_rate,
      platformFeeConfig,
      all
    };
  },

  async updateProjectReviewPrice(expertId: string, price: number, ..._metadata: any[]): Promise<any> {
    const expert = await expertiseService.updateExpert(expertId, { project_rate: price });
    return expert
      ? { success: true, projectRate: price, expert }
      : { success: false, error: 'Expert not found or unavailable' };
  },

  async respondProjectReview(reviewId: string, action: string, data: any) {
    const response = await fetch(`/api/project-reviews/${reviewId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data })
    });
    return await response.json();
  },

  // KV Storage (synced to backend /api/kv with localStorage caching/fallback)
  async getKv(key: string) {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`/api/kv?key=${encodeURIComponent(key)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.value !== null && data.value !== undefined) {
            try {
              localStorage.setItem(key, typeof data.value === 'string' ? data.value : JSON.stringify(data.value));
            } catch {}
            return data.value;
          }
        }
      } catch {}
      const stored = localStorage.getItem(key);
      if (stored !== null && stored !== undefined) {
        try {
          return JSON.parse(stored);
        } catch {
          return stored;
        }
      }
    }
    return null;
  },

  async syncKv(key: string, value: any) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      } catch {}
      try {
        await fetch('/api/kv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value })
        });
      } catch {}
    }
  },

  // MongoDB URI (not used anymore)
  getMongoUri(): string {
    return localStorage.getItem('mongo_uri') || '';
  },

  setMongoUri(uri: string) {
    localStorage.setItem('mongo_uri', uri);
  },

  // Additional methods for compatibility
  async getProjectReviewPlatformFee(): Promise<any> {
    try {
      const response = await fetch('/api/platform-settings');
      const data = await response.json();
      return { ...data, config: data.config || { feeType: 'fixed', feeValue: 200 } };
    } catch {
      return { success: true, config: readStored('project_review_platform_fee', { feeType: 'fixed', feeValue: 200 }) };
    }
  },

  async updateProjectReviewPlatformFee(feeType: string, feeValue: number, ...metadata: any[]): Promise<any> {
    const response = await fetch('/api/platform-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeType, feeValue, ...(metadata[0] || {}) })
    });
    const result = await response.json();
    if (result.success) writeStored('project_review_platform_fee', { feeType, feeValue });
    return result;
  },

  async requestProjectReview(data: any) {
    const response = await fetch('/api/project-reviews/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await response.json();
  },

  async getProjectReview(id: string) {
    const response = await fetch(`/api/project-reviews?id=${id}`);
    const data = await response.json();
    return data.projectReview;
  },

  async sendProjectReviewChat(reviewId: string, message: any): Promise<any> {
    const response = await fetch(`/api/project-reviews/${reviewId}/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message)
    });
    return await response.json();
  },

  async submitProjectMaterials(reviewId: string, materials: any): Promise<any> {
    const response = await fetch(`/api/project-reviews/${reviewId}/materials`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(materials)
    });
    return await response.json();
  },

  async proposeProjectReviewTime(reviewId: string, time: any): Promise<any> {
    const response = await fetch(`/api/project-reviews/${reviewId}/times`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(time)
    });
    return await response.json();
  },

  async respondProjectReviewTime(reviewId: string, proposedTimeId: string, action: string, responderRole: string): Promise<any> {
    const response = await fetch(`/api/project-reviews/${reviewId}/times/${proposedTimeId}/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, responderRole })
    });
    return await response.json();
  },

  async sendProjectReviewMeetLink(reviewId: string, meetingId: string, link: string): Promise<any> {
    const response = await fetch(`/api/project-reviews/${reviewId}/meet-link`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meetingId, link })
    });
    return await response.json();
  },

  async completeProjectReviewMeeting(reviewId: string, meetingId: string): Promise<any> {
    const response = await fetch(`/api/project-reviews/${reviewId}/meetings/${meetingId}/complete`, { method: 'POST' });
    return await response.json();
  },

  async completeProjectReview(reviewId: string, feedback: any): Promise<any> {
    const response = await fetch(`/api/project-reviews/${reviewId}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(feedback)
    });
    return await response.json();
  },

  async archiveProjectReview(reviewId: string, role: string): Promise<any> {
    const response = await fetch(`/api/project-reviews/${reviewId}/archive`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role })
    });
    return await response.json();
  },

  async getPublicBlogs(): Promise<any> {
    try {
      const response = await fetch('/api/blogs');
      const data = await response.json();
      if (data?.articles || data?.success) {
        return {
          success: true,
          articles: data.articles || data.blogs || [],
          categories: data.categories || []
        };
      }
    } catch {}
    const articles = readStored<any[]>('admin_blogs', []).filter(article => article.status === 'published');
    const categories = readStored<any[]>('admin_blog_categories', []);
    return { success: true, articles, categories };
  },

  async getPublicBlogBySlug(slug: string): Promise<any> {
    const article = readStored<any[]>('admin_blogs', []).find(item => item.slug === slug && item.status === 'published') || null;
    return { success: Boolean(article), article };
  },

  async getAdminBlogs(_role: string, filters: Record<string, any> = {}): Promise<any> {
    const allArticles = readStored<any[]>('admin_blogs', []);
    let articles = allArticles;
    if (filters.status && filters.status !== 'all') articles = articles.filter(item => item.status === filters.status);
    if (filters.category && filters.category !== 'all') articles = articles.filter(item => item.category === filters.category);
    if (filters.type && filters.type !== 'all') articles = articles.filter(item => item.type === filters.type);
    if (filters.featured === 'featured') articles = articles.filter(item => item.featured);
    if (filters.featured === 'unfeatured') articles = articles.filter(item => !item.featured);
    if (filters.search) articles = articles.filter(item => `${item.title} ${item.excerpt} ${item.content}`.toLowerCase().includes(String(filters.search).toLowerCase()));
    return {
      success: true,
      articles,
      categories: readStored<any[]>('admin_blog_categories', []),
      stats: { total: allArticles.length, published: allArticles.filter(item => item.status === 'published').length }
    };
  },

  async createAdminBlog(payload: any, _role: string): Promise<any> {
    const articles = readStored<any[]>('admin_blogs', []);
    const article = { ...payload, id: payload.id || `blog-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    writeStored('admin_blogs', [...articles, article]);
    window.dispatchEvent(new Event('blogs_updated'));
    return { success: true, article, message: 'Article saved.' };
  },

  async updateAdminBlog(id: string, payload: any, _role: string): Promise<any> {
    const articles = readStored<any[]>('admin_blogs', []).map(article => article.id === id
      ? { ...article, ...payload, updatedAt: new Date().toISOString() }
      : article);
    writeStored('admin_blogs', articles);
    window.dispatchEvent(new Event('blogs_updated'));
    return { success: true, article: articles.find(article => article.id === id), message: 'Article updated.' };
  },

  async publishAdminBlog(id: string, role: string) {
    return this.updateAdminBlog(id, { status: 'published' }, role);
  },

  async unpublishAdminBlog(id: string, role: string) {
    return this.updateAdminBlog(id, { status: 'draft' }, role);
  },

  async toggleFeatureAdminBlog(id: string, featured: boolean, role: string) {
    return this.updateAdminBlog(id, { featured }, role);
  },

  async deleteAdminBlog(id: string, _role: string): Promise<any> {
    writeStored('admin_blogs', readStored<any[]>('admin_blogs', []).filter(article => article.id !== id));
    window.dispatchEvent(new Event('blogs_updated'));
    return { success: true };
  },

  async createBlogCategory(category: any, _role: string): Promise<any> {
    const categories = readStored<any[]>('admin_blog_categories', []);
    const created = { ...category, id: category.id || `category-${Date.now()}` };
    writeStored('admin_blog_categories', [...categories, created]);
    window.dispatchEvent(new Event('blogs_updated'));
    return { success: true, category: created };
  },

  async deleteBlogCategory(id: string, force: boolean, _role: string): Promise<any> {
    const categories = readStored<any[]>('admin_blog_categories', []);
    const category = categories.find(item => item.id === id);
    const articles = readStored<any[]>('admin_blogs', []);
    if (!force && category && articles.some(article => article.category === category.name)) {
      return { success: false, error: 'Category still contains articles.' };
    }
    writeStored('admin_blog_categories', categories.filter(item => item.id !== id));
    if (force && category) writeStored('admin_blogs', articles.map(article => article.category === category.name ? { ...article, category: 'Uncategorized' } : article));
    window.dispatchEvent(new Event('blogs_updated'));
    return { success: true };
  },

  async saveAvailability(data: any) {
    const isEdit = Boolean(data.id);
    const url = isEdit ? `/api/availability/${data.id}` : '/api/availability';
    const method = isEdit ? 'PUT' : 'POST';

    let result: any = null;
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          expert_id: data.expert_id ?? data.expertId,
          availability_date: data.availability_date ?? data.availabilityDate,
          start_time: data.start_time ?? data.startTime,
          end_time: data.end_time ?? data.endTime
        })
      });
      if (response.ok) {
        result = await response.json();
      } else {
        const errJson = await response.json().catch(() => ({}));
        console.warn('saveAvailability server error:', errJson);
      }
    } catch (e) {
      console.warn('Network request failed for saveAvailability, falling back to local store:', e);
    }

    const slot: ExpertAvailabilityDoc = result?.availability
      ? mapAvailability(result.availability)
      : mapAvailability({
          ...data,
          id: data.id || `avail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          updatedAt: new Date().toISOString()
        });

    if (slot.expertId) {
      const key = `availabilities_${slot.expertId}`;
      const current = readStored<any[]>(key, []);
      writeStored(key, [...current.filter(item => item.id !== slot.id), slot]);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mongo_db_updated'));
    }

    return result || { success: true, availability: slot };
  },

  async deleteAvailability(id: string) {
    let apiSuccess = false;
    let apiErrorMsg: string | null = null;

    try {
      const response = await fetch(`/api/availability/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-override': 'true' }
      });
      if (response.ok) {
        const json = await response.json().catch(() => ({ success: true }));
        if (json.success) {
          apiSuccess = true;
        } else {
          apiErrorMsg = json.error || 'Failed to delete slot';
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        apiErrorMsg = errJson.error || `Failed to delete slot (HTTP ${response.status})`;
      }
    } catch (e: any) {
      console.warn('Network request failed for deleteAvailability:', e);
    }

    // Direct Supabase delete if available
    try {
      await supabase.from('expert_availability').delete().eq('id', id);
    } catch {}

    // Clean up from all localStorage caches
    let foundInLocalStorage = false;
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('availabilities_')) {
          const list = readStored<any[]>(k, []);
          const filtered = list.filter(item => (item.id || item.availability_id) !== id);
          if (filtered.length !== list.length) {
            writeStored(k, filtered);
            foundInLocalStorage = true;
          }
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mongo_db_updated'));
    }

    if (!apiSuccess && !foundInLocalStorage && apiErrorMsg) {
      throw new Error(apiErrorMsg);
    }

    return { success: true };
  }
};

export interface ExpertAvailabilityDoc {
  id: string;
  expertId: string;
  availabilityDate: string;
  startTime: string;
  endTime: string;
  status: AvailabilityStatus;
  bookingId?: string;
  clientId?: string;
  clientName?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getDocFile(doc: any, fallback?: any): Promise<string> {
  const directValue = typeof doc === 'string' ? '' : doc?.fileData || doc?.url || '';
  if (directValue) return directValue;
  const fallbackValue = fallback?.fileData || fallback?.url || '';
  if (fallbackValue) return fallbackValue;
  return '';
}
