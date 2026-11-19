import { apiSessionHeaders } from './lib/apiSession';
// Temporary stub service to maintain compatibility while migrating to Supabase
// This service bridges the old MongoDB API calls to new Supabase services
import { expertiseService, getExpertSlimByKey } from './services/supabaseExpertiseService';
import { cached, invalidate } from './lib/requestCache';
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
async function postProjectReview(path: string, body: unknown, role?: string) {
  try {
    const response = await fetch(`/api/project-reviews/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...apiSessionHeaders(role) },
      body: JSON.stringify(body)
    });
    return await response.json();
  } catch {
    return { success: false, error: 'Project Review service unavailable. Check your connection and try again.' };
  }
}

async function requestBlog(path: string, method = 'GET', body?: unknown, admin = false) {
  try {
    const response = await fetch(path, {
      method, headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(admin && apiSessionHeaders('admin')) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const result = await response.json();
    if (response.ok && method !== 'GET') {
      localStorage.setItem('mentora_blogs_updated', String(Date.now()));
      window.dispatchEvent(new Event('blogs_updated'));
    }
    return result;
  } catch {
    return { success: false, error: 'Blog service unavailable. Please try again.' };
  }
}

async function writeAvailability(path: string, method: string, data?: unknown) {
  const response = await fetch(path, {
    method, headers: { 'Content-Type': 'application/json', ...apiSessionHeaders() },
    body: data === undefined ? undefined : JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || 'Unable to save availability');
  window.dispatchEvent(new Event('mongo_db_updated'));
  return result;
}

export const mongoDB = {
  // Slim + cached list (see supabaseExpertiseService). { force: true } skips the cache.
  async getExperts(opts: { force?: boolean } = {}): Promise<any[]> {
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

    const remote = await expertiseService.getExperts(opts);
    if (remote.length > 0) return remote.map(mapExpert);

    try {
      const response = await fetch('/api/db');
      const db = await response.json();
      return Array.isArray(db?.experts) ? db.experts.map(mapExpert) : [];
    } catch {
      return [];
    }
  },

  // Admin KYC queue. Cached for 60 s and shared between callers so several components asking
  // at once cause ONE request. { force: true } skips the cache (e.g. right after approve/reject).
  // Raw KYC queue exactly as the server returns it (all statuses, incl. rejected), through the
  // same 15 s cache. Used by the admin KYC desk so its refreshes never bypass the cache.
  async getPendingVerificationsRaw(status?: string, opts: { force?: boolean } = {}): Promise<any[]> {
    const url = status ? `/api/admin/pending-verifications?status=${status}` : '/api/admin/pending-verifications';
    const cacheKey = `pending:${status || 'all'}`;
    if (opts.force) invalidate(cacheKey);
    // 60 s: the KYC desk timer and the app timer both ask once a minute; a broadcast or your own
    // save forces a fresh read, so the queue is never stale after a change.
    const data = await cached(cacheKey, 60_000, async () => {
      // The server only answers this admin route when the admin session token is sent.
      // (Before, no token was sent → HTTP 403 every time → the app fell back to downloading the
      // whole local db.json, about 2.5 MB, on every refresh.)
      let adminToken = '';
      try {
        adminToken = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token') || localStorage.getItem('admin_session_token') || '';
      } catch {}
      const response = await fetch(url, adminToken ? { headers: { 'x-admin-token': adminToken } } : undefined);
      if (!response.ok) throw new Error(`pending-verifications HTTP ${response.status}`);
      return response.json();
    });
    return Array.isArray(data) ? data : [];
  },

  async getPendingVerifications(status?: string, opts: { force?: boolean } = {}): Promise<any[]> {
    try {
      const data = await this.getPendingVerificationsRaw(status, opts);
      if (Array.isArray(data)) {
        return data.filter((e: any) => !e.verified && e.verificationStatus !== 'approved');
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

  async getAuditStatus(id: string, opts: { force?: boolean } = {}): Promise<any> {
    try {
      const key = (id || '').trim().toLowerCase();
      if (!key) return { success: false, status: null };

      // 1. Query Supabase experts table (authoritative single source of truth).
      //    Slim (no base64 documents) and cached for 15 s — see getExpertSlimByKey.
      const expert: any = await getExpertSlimByKey(key, opts);
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
    const response = await fetch('/api/auth/verify-admin', { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('Administrator session verification unavailable');
    return response.json();
  },

  subscribe(listener: () => void) {
    window.addEventListener('mongo_db_updated', listener);
    window.addEventListener('storage', listener);
    return () => {
      window.removeEventListener('mongo_db_updated', listener);
      window.removeEventListener('storage', listener);
    };
  },

  async adminLogout() {
    const headers = apiSessionHeaders('admin');
    localStorage.removeItem('admin_session_token');
    localStorage.removeItem('admin_logged_in');
    window.dispatchEvent(new Event('mongo_db_updated'));
    const response = await fetch('/api/auth/admin-logout', { method: 'POST', headers });
    if (!response.ok) throw new Error('Administrator session could not be revoked.');
  },

  async submitExpertVerification(data: any): Promise<any> {
    const response = await fetch('/api/experts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    return await response.json();
  },

  async saveExpertMarkup(expertId: string, baseRate: number, markup: number): Promise<any> {
    const response = await fetch('/api/experts/markup', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...apiSessionHeaders('admin') },
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

    try {
      const response = await fetch('/api/admin/approve-expert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...apiSessionHeaders('admin') },
        body: JSON.stringify({ expertId: id, email, comments: item.comments || '' })
      });
      const result = await response.json();

      if (result.success) {
        console.log('[AUDIT] Expert approved:', id);
        return { success: true, experts: await this.getExperts(), pendingVerifications: await this.getPendingVerifications() };
      }
      throw new Error(result.error || 'Approval failed');
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Approval failed' };
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
    return { ...result, user, message: result.message || result.error || '' };
  },

  // Experts
  async searchAndRankExperts(query: string) {
    const stopWords = new Set(['an', 'and', 'at', 'for', 'help', 'in', 'is', 'me', 'my', 'of', 'on', 'the', 'to', 'with']);
    const terms = (query.toLowerCase().match(/[a-z0-9]+/g) || []).filter(term => term.length > 1 && !stopWords.has(term));
    const related = [
      ['math', 'maths', 'mathematics', 'teaching', 'education'], ['civil', 'construction', 'infrastructure'],
      ['bank', 'banking', 'lending', 'credit'], ['tax', 'taxation', 'gst', 'cfo', 'finance'],
      ['legal', 'law', 'compliance'], ['hr', 'recruitment', 'personnel'], ['marketing', 'branding', 'advertising'],
      ['manufacturing', 'production', 'factory'], ['textile', 'apparel', 'garment']
    ];
    const expanded = new Set(terms);
    for (const group of related) if (group.some(word => expanded.has(word))) group.forEach(word => expanded.add(word));
    const experts = await this.getExperts();
    return experts.filter(expert => {
      if (expert.verified !== true || expert.rejected || expert.verificationStatus === 'rejected') return false;
      const searchable = [expert.name, expert.field, expert.title, expert.bio, expert.company, expert.education, expert.skills]
        .flat().filter(Boolean).join(' ').toLowerCase();
      return Array.from(expanded).some(term => searchable.includes(term));
    }).sort((a, b) => (Number(b.rating) - Number(a.rating)) || (Number(a.rate) - Number(b.rate)));
  },

  getExpertDocuments(_idOrEmailOrName: string): ExpertDocumentsRecord | null {
    // Documents are fetched directly from Supabase expert_documents table, not localStorage
    return { items: [], docs: {} };
  },

  // Availability
  async getAvailabilities(expertId: string): Promise<any[]> {
    const response = await fetch(`/api/availability?expertId=${encodeURIComponent(expertId)}`, { headers: apiSessionHeaders() });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to load availability');
    const slots = (result.availabilities || []).map(mapAvailability);
    writeStored(`availabilities_${expertId}`, slots);
    return slots;
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
      headers: { 'Content-Type': 'application/json', ...apiSessionHeaders('client') },
      body: JSON.stringify({ slotId, ...data })
    });
    return await response.json();
  },

  async releaseAvailability(slotId: string, bookingId?: string) {
    try {
      const response = await fetch('/api/availability/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...apiSessionHeaders('client') },
        body: JSON.stringify({ slotId, bookingId })
      });
      return await response.json();
    } catch (err: any) {
      console.warn('releaseAvailability error:', err);
      return { success: false, error: err.message };
    }
  },

  // Project Reviews
  // Project review LISTS. The server sends small summary rows (no chat / activity timeline) in
  // pages of 20. We follow `nextOffset` until every page is loaded (max 10 pages = 200 reviews),
  // so the lists stay complete. Full details load only when one review is opened (?id=…).
  async getProjectReviews(filters: any) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters || {})) {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    }
    const headers = apiSessionHeaders();
    if (params.has('id')) {
      const response = await fetch(`/api/project-reviews?${params}`, { headers });
      const data = response.ok ? await response.json() : {};
      return data.projectReview ? [data.projectReview] : [];
    }
    const all: any[] = [];
    let offset = 0;
    for (let page = 0; page < 10; page++) {
      params.set('offset', String(offset));
      const response = await fetch(`/api/project-reviews?${params}`, { headers });
      if (!response.ok) break;
      const data = await response.json();
      all.push(...(Array.isArray(data.projectReviews) ? data.projectReviews : []));
      if (!data.hasMore || data.nextOffset == null) break;
      offset = data.nextOffset;
    }
    return all;
  },

  async getProjectReviewActivity(limit = 100): Promise<any[]> {
    const response = await fetch(`/api/project-reviews/activity?limit=${limit}`, { headers: apiSessionHeaders('admin') });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.events) ? data.events : [];
  },

  async getProjectReviewPricing(expertId: string | undefined, all: boolean, role: string) {
    const params = new URLSearchParams({ all: String(all) });
    if (expertId) params.set('expertId', expertId);
    const response = await fetch(`/api/project-reviews/pricing?${params}`, { headers: apiSessionHeaders(role) });
    return response.json();
  },

  async updateProjectReviewPrice(expertId: string, price: number, role?: string, ..._metadata: any[]) {
    return postProjectReview('pricing', { expertId, price }, role);
  },

  async respondProjectReview(reviewId: string, action: string, data: any) {
    return postProjectReview(`${encodeURIComponent(reviewId)}/respond`, { action, ...data }, 'expert');
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
  async getProjectReviewPlatformFee() {
    try {
      const response = await fetch('/api/platform-settings');
      return await response.json();
    } catch {
      return { success: false, config: readStored('project_review_platform_fee', { feeType: 'fixed', feeValue: 200 }) };
    }
  },

  async updateProjectReviewPlatformFee(feeType: string, feeValue: number, ..._metadata: any[]) {
    const result = await postProjectReview('platform-fee', { feeType, feeValue }, 'admin');
    if (result.success) {
      writeStored('project_review_platform_fee', result.config);
      window.dispatchEvent(new Event('platform_fee_updated'));
    }
    return result;
  },

  async requestProjectReview(data: any) {
    return postProjectReview('request', data, 'client');
  },

  async getProjectReview(id: string) {
    const response = await fetch(`/api/project-reviews/${encodeURIComponent(id)}`, { headers: apiSessionHeaders() });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to open this Project Review');
    return data.projectReview;
  },

  async sendProjectReviewChat(reviewId: string, message: any) {
    return postProjectReview(`${encodeURIComponent(reviewId)}/chat`, message);
  },

  async submitProjectMaterials(reviewId: string, materials: any) {
    return postProjectReview(`${encodeURIComponent(reviewId)}/submit-project`, materials, 'client');
  },

  async proposeProjectReviewTime(reviewId: string, time: any) {
    return postProjectReview(`${encodeURIComponent(reviewId)}/propose-time`, time);
  },

  async respondProjectReviewTime(reviewId: string, proposedTimeId: string, action: string, _responderRole: string) {
    return postProjectReview(`${encodeURIComponent(reviewId)}/respond-time`, { proposedTimeId, action });
  },

  async sendProjectReviewMeetLink(reviewId: string, meetingId: string, link: string) {
    return postProjectReview(`${encodeURIComponent(reviewId)}/send-meet-link`, { meetingId, googleMeetLink: link }, 'expert');
  },

  async completeProjectReviewMeeting(reviewId: string, meetingId: string) {
    return postProjectReview(`${encodeURIComponent(reviewId)}/complete-meeting`, { meetingId });
  },

  async completeProjectReview(reviewId: string, feedback: any) {
    return postProjectReview(`${encodeURIComponent(reviewId)}/complete-review`, feedback, 'expert');
  },

  async archiveProjectReview(reviewId: string, role: string) {
    return postProjectReview(`${encodeURIComponent(reviewId)}/archive`, {}, role);
  },

  async getPublicBlogs() {
    return requestBlog('/api/blogs');
  },

  async getPublicBlogBySlug(slug: string) {
    return requestBlog(`/api/blogs/${encodeURIComponent(slug)}`);
  },

  async getAdminBlogs(_role: string, filters: Record<string, any> = {}) {
    return requestBlog(`/api/admin/blogs?${new URLSearchParams(filters)}`, 'GET', undefined, true);
  },

  async createAdminBlog(payload: any, _role: string) {
    return requestBlog('/api/admin/blogs', 'POST', payload, true);
  },

  async updateAdminBlog(id: string, payload: any, _role: string) {
    return requestBlog(`/api/admin/blogs/${encodeURIComponent(id)}`, 'PUT', payload, true);
  },

  async publishAdminBlog(id: string, _role: string) {
    return requestBlog(`/api/admin/blogs/${encodeURIComponent(id)}/publish`, 'POST', {}, true);
  },

  async unpublishAdminBlog(id: string, _role: string) {
    return requestBlog(`/api/admin/blogs/${encodeURIComponent(id)}/unpublish`, 'POST', {}, true);
  },

  async toggleFeatureAdminBlog(id: string, featured: boolean, _role: string) {
    return requestBlog(`/api/admin/blogs/${encodeURIComponent(id)}/feature`, 'POST', { featured }, true);
  },

  async deleteAdminBlog(id: string, _role: string) {
    return requestBlog(`/api/admin/blogs/${encodeURIComponent(id)}`, 'DELETE', undefined, true);
  },

  async createBlogCategory(category: any, _role: string) {
    return requestBlog('/api/admin/blogs/categories', 'POST', category, true);
  },

  async deleteBlogCategory(id: string, force: boolean, _role: string) {
    return requestBlog(`/api/admin/blogs/categories/${encodeURIComponent(id)}?force=${force}`, 'DELETE', undefined, true);
  },

  async saveAvailability(data: any) {
    const path = data.id ? `/api/availability/${encodeURIComponent(data.id)}` : '/api/availability';
    const result = await writeAvailability(path, data.id ? 'PUT' : 'POST', data);
    return { ...result, availability: mapAvailability(result.availability) };
  },

  async saveAvailabilityBatch(expertId: string, availabilityDate: string, slots: Array<{ startTime: string; endTime: string }>) {
    return writeAvailability('/api/availability/batch', 'POST', { expertId, availabilityDate, slots });
  },

  async deleteAvailability(id: string) {
    return writeAvailability(`/api/availability/${encodeURIComponent(id)}`, 'DELETE');
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
