import { supabase } from '../supabaseClient';
import { COLUMNS, PAGE } from '../lib/columns';
import {
  BOOKING_STATUS,
  BookingStatus,
  normalizeBookingStatus
} from '../constants/bookingStatuses';

export type { BookingStatus };

/**
 * Safely parses an Indian Standard Time (IST, UTC+05:30) date and time into UTC ISO timestamptz.
 * Supports "10:00 AM", "12:00 PM", 24-hour "14:30", and ranges like "10:00 AM - 11:00 AM".
 */
export function parseIstDateTimeToUtc(
  dateStr: string,
  timeStr: string,
  durationMinutes: number = 60
): { valid: boolean; scheduledStart?: string; scheduledEnd?: string; error?: string } {
  if (!dateStr || !timeStr) {
    return { valid: false, error: 'Both scheduled date and scheduled time are required.' };
  }

  const cleanDate = dateStr.trim().split('T')[0];
  const dateMatch = cleanDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!dateMatch) {
    return { valid: false, error: 'Invalid date format. Expected YYYY-MM-DD.' };
  }

  const [, yearStr, monthStr, dayStr] = dateMatch;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // If a range like "10:00 AM - 11:00 AM", extract the start time
  let cleanTime = timeStr.trim();
  if (cleanTime.includes('-')) {
    cleanTime = cleanTime.split('-')[0].trim();
  }

  let hours = 0;
  let minutes = 0;

  // 12-hour format with AM/PM
  const match12 = cleanTime.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    minutes = parseInt(match12[2], 10);
    const meridiem = match12[3].toUpperCase();
    if (meridiem === 'PM' && h < 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    hours = h;
  } else {
    // 24-hour format
    const match24 = cleanTime.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match24) {
      hours = parseInt(match24[1], 10);
      minutes = parseInt(match24[2], 10);
    } else {
      return { valid: false, error: `Invalid time format: "${timeStr}". Expected "10:00 AM" or "14:00".` };
    }
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return { valid: false, error: `Time values out of range: hours ${hours}, minutes ${minutes}.` };
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  // IST is UTC+05:30
  const istIsoStr = `${pad(year)}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00+05:30`;
  const startDate = new Date(istIsoStr);

  if (isNaN(startDate.getTime())) {
    return { valid: false, error: 'Could not compute valid UTC timestamp from date and time.' };
  }

  const scheduledStart = startDate.toISOString();
  const endDate = new Date(startDate.getTime() + (durationMinutes || 60) * 60000);
  const scheduledEnd = endDate.toISOString();

  return { valid: true, scheduledStart, scheduledEnd };
}

export interface ConsultationBooking {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  expert_id: string;
  expert_name: string;
  expert_email: string;
  topic: string;
  scheduled_date: string;
  scheduled_time: string;
  scheduled_start?: string;
  scheduled_end?: string;
  duration_minutes: number;
  package_type: string;
  value: number;
  price?: number;
  status: BookingStatus | string;
  meet_link?: string | null;
  meeting_link?: string | null;
  meeting_link_sent_at?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;

  // Soft-delete flags per portal role
  deleted_by_client?: boolean;
  deleted_by_expert?: boolean;
  deleted_by_admin?: boolean;
  deletedByClient?: boolean;
  deletedByExpert?: boolean;
  deletedByAdmin?: boolean;

  // Normalized frontend aliases for backward compatibility with existing components
  client: string;
  clientEmail: string;
  clientId: string;
  expert: string;
  expertEmail: string;
  expertId: string;
  when: string;
  date: string;
  time: string;
  duration: number;
  rate: number;
  type: string;
  meetUrl: string;
  completed: boolean;
  isLive: boolean;
  reviewed?: boolean;
  payoutTransferred?: boolean;
}

export interface CreateBookingInput {
  id?: string;
  clientId?: string;
  client_id?: string;
  clientName?: string;
  client_name?: string;
  clientEmail?: string;
  client_email?: string;
  expertId?: string;
  expert_id?: string;
  expertName?: string;
  expert_name?: string;
  expertEmail?: string;
  expert_email?: string;
  topic?: string;
  date?: string;
  scheduledDate?: string;
  scheduled_date?: string;
  time?: string;
  timeSlot?: string;
  scheduledTime?: string;
  scheduled_time?: string;
  durationMinutes?: number;
  duration_minutes?: number;
  packageType?: string;
  package_type?: string;
  value?: number;
  price?: number;
  rate?: number;
  status?: string;
  meetLink?: string;
  meet_link?: string;
  notes?: string;
  when?: string;
  [key: string]: any;
}

/**
 * Normalizes any Supabase bookings row or legacy booking object into
 * a standardized ConsultationBooking object.
 */
export function normalizeBooking(row: any): ConsultationBooking {
  const id = String(row.id || '');
  const clientId = String(row.client_id || row.clientId || '');
  const clientName = String(row.client_name || row.clientName || row.client || 'Client');
  const clientEmail = String(row.client_email || row.clientEmail || '').toLowerCase();
  
  const expertId = String(row.expert_id || row.expertId || '');
  const expertName = String(row.expert_name || row.expertName || row.expert || 'Expert');
  const expertEmail = String(row.expert_email || row.expertEmail || '').toLowerCase();

  const topic = String(row.topic || row.notes || 'Consultation');
  
  // Parse date and time from various formats
  let scheduledDate = String(row.scheduled_date || row.booking_date || row.date || '');
  let scheduledTime = String(row.scheduled_time || row.start_time || row.timeSlot || row.time || '');

  if (!scheduledDate && row.when && row.when.includes(',')) {
    const parts = row.when.split(',');
    scheduledDate = parts[0]?.trim() || '';
    if (!scheduledTime && parts[1]) {
      scheduledTime = parts[1]?.trim() || '';
    }
  }

  const durationMinutes = Number(row.duration_minutes || row.durationMinutes || row.duration || 60);
  const packageType = String(row.package_type || row.packageType || row.type || 'Hourly Consultation');
  const rawValue = Number(row.value !== undefined ? row.value : (row.price !== undefined ? row.price : (row.rate !== undefined ? row.rate : 600)));
  const value = isNaN(rawValue) ? 600 : rawValue;

  const rawStatus = String(row.status || BOOKING_STATUS.PENDING);
  const normalizedStatus = normalizeBookingStatus(rawStatus);
  const meetUrl = String(row.meet_link || row.meeting_link || row.meetUrl || '');

  // Normalized composite 'when' string e.g. "2026-10-26, 10:00 AM"
  const whenStr = (scheduledDate && scheduledTime)
    ? `${scheduledDate}, ${scheduledTime}`
    : (row.when || scheduledDate || scheduledTime || 'Scheduled Time');

  const isCompleted = normalizedStatus === BOOKING_STATUS.COMPLETED || rawStatus.toLowerCase().includes('complete') || row.completed === true;
  const isLive = !isCompleted && (rawStatus.toLowerCase().includes('live') || row.isLive === true);

  const deletedByClient = row.deleted_by_client === true || row.deletedByClient === true;
  const deletedByExpert = row.deleted_by_expert === true || row.deletedByExpert === true;
  const deletedByAdmin = row.deleted_by_admin === true || row.deletedByAdmin === true;

  return {
    id,
    client_id: clientId,
    client_name: clientName,
    client_email: clientEmail,
    expert_id: expertId,
    expert_name: expertName,
    expert_email: expertEmail,
    topic,
    scheduled_date: scheduledDate,
    scheduled_time: scheduledTime,
    scheduled_start: row.scheduled_start || undefined,
    scheduled_end: row.scheduled_end || undefined,
    duration_minutes: durationMinutes,
    package_type: packageType,
    value,
    price: value,
    status: rawStatus,
    meet_link: meetUrl || null,
    meeting_link: meetUrl || null,
    meeting_link_sent_at: row.meeting_link_sent_at || null,
    notes: row.notes || topic,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
    deleted_by_client: deletedByClient,
    deleted_by_expert: deletedByExpert,
    deleted_by_admin: deletedByAdmin,
    deletedByClient,
    deletedByExpert,
    deletedByAdmin,

    // Aliases for component compatibility
    client: clientName,
    clientEmail,
    clientId,
    expert: expertName,
    expertEmail,
    expertId,
    when: whenStr,
    date: scheduledDate,
    time: scheduledTime,
    duration: durationMinutes,
    rate: value,
    type: packageType,
    meetUrl,
    completed: isCompleted,
    isLive,
    reviewed: row.reviewed === true,
    payoutTransferred: row.payoutTransferred === true
  };
}

/**
 * Creates a consultation booking record and writes it into Supabase bookings table.
 * Falls back to local Express server endpoint if direct client insert is blocked.
 */
export async function createConsultationBooking(
  input: CreateBookingInput
): Promise<{ success: boolean; booking?: ConsultationBooking; error?: string; code?: string }> {
  try {
    const bookingId = input.id || `bkg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    const clientId = String(input.clientId || input.client_id || 'client-1');
    const clientName = String(input.clientName || input.client_name || input.client || 'Client');
    const clientEmail = String(input.clientEmail || input.client_email || 'client@company.com').toLowerCase();

    const expertId = String(input.expertId || input.expert_id || '');
    const expertName = String(input.expertName || input.expert_name || input.expert || 'Expert');
    const expertEmail = String(input.expertEmail || input.expert_email || '').toLowerCase();

    let scheduledDate = String(input.scheduledDate || input.scheduled_date || input.date || '');
    let scheduledTime = String(input.scheduledTime || input.scheduled_time || input.timeSlot || input.time || '');

    if (!scheduledDate && input.when && input.when.includes(',')) {
      const parts = input.when.split(',');
      scheduledDate = parts[0]?.trim() || '';
      if (!scheduledTime && parts[1]) {
        scheduledTime = parts[1]?.trim() || '';
      }
    }

    const dateToUse = scheduledDate || new Date().toISOString().split('T')[0];
    const timeToUse = scheduledTime || '10:00 AM';

    const topic = String(input.topic || 'Consultation');
    const durationMinutes = Number(input.durationMinutes || input.duration_minutes || 60);

    // FIX 4: Build scheduled_start from scheduled_date + scheduled_time as IST (+05:30), converting to UTC timestamptz
    const timeParse = parseIstDateTimeToUtc(dateToUse, timeToUse, durationMinutes);
    if (!timeParse.valid) {
      console.error('❌ [BOOKINGS INSERT] Date/Time parsing error:', timeParse.error);
      return { success: false, error: timeParse.error || 'Invalid scheduled date or time' };
    }

    const scheduledStart = timeParse.scheduledStart!;
    const scheduledEnd = timeParse.scheduledEnd!;

    const packageType = String(input.packageType || input.package_type || (input.type === 'hourly' || input.type === 'Hourly' ? 'Hourly Consultation' : 'Project Advisory'));
    const val = Number(input.value !== undefined ? input.value : (input.price !== undefined ? input.price : (input.rate !== undefined ? input.rate : 600)));
    const cost = isNaN(val) ? 600 : val;
    const initialStatus = input.status ? normalizeBookingStatus(input.status) : BOOKING_STATUS.PENDING;
    const meetLink = input.meetLink || input.meet_link || null;

    // Full Supabase row payload with non-null columns and UTC timestamptz
    const sbPayload: Record<string, any> = {
      id: bookingId,
      client_id: clientId,
      client_name: clientName,
      client_email: clientEmail,
      expert_id: expertId,
      expert_name: expertName,
      expert_email: expertEmail,
      topic: topic,
      scheduled_date: dateToUse,
      scheduled_time: timeToUse,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      duration_minutes: durationMinutes,
      package_type: packageType,
      value: cost,
      price: cost,
      status: initialStatus,
      meet_link: meetLink,
      meeting_link: meetLink,
      // Legacy column compatibility
      booking_date: dateToUse,
      start_time: timeToUse,
      end_time: '11:00 AM',
      notes: topic,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('📝 [BOOKINGS INSERT] Payload:', sbPayload);

    // 1. Primary Write Path: Call backend endpoint /api/bookings with caller headers
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': clientId,
          'x-user-email': clientEmail,
          'x-user-role': 'client'
        },
        body: JSON.stringify(sbPayload)
      });
      const json = await res.json();
      if (json.success && json.booking) {
        console.log('✅ [BOOKINGS INSERT] Booking created via backend endpoint:', json.booking.id);
        return { success: true, booking: normalizeBooking(json.booking) };
      }
      if (json.code === '23505' || String(json.error).includes('23505') || String(json.error).includes('just booked') || String(json.error).includes('unique constraint')) {
        return {
          success: false,
          code: '23505',
          error: 'This slot was just booked, please choose another time'
        };
      }
      if (json.error) {
        return { success: false, code: json.code, error: json.error };
      }
    } catch (backendErr: any) {
      console.warn('[BOOKINGS INSERT] Backend endpoint call failed, attempting direct Supabase fallback:', backendErr.message);
    }

    // 2. Direct Supabase Client fallback (if backend endpoint unreachable)
    const { data, error } = await supabase
      .from('bookings')
      .insert(sbPayload)
      .select(COLUMNS.BOOKING)
      .maybeSingle();

    console.log('📡 [BOOKINGS INSERT] Direct Supabase Response/Error:', { data, error: error?.message });

    if (!error && data) {
      console.log('✅ [BOOKINGS INSERT] Booking successfully created in Supabase directly:', data.id);
      return { success: true, booking: normalizeBooking(data) };
    }

    if (error) {
      console.warn('[BOOKINGS INSERT] Direct Supabase insert warning:', error.message);
      if (error.code === '23505' || error.message?.includes('23505') || error.message?.includes('unique constraint') || error.message?.includes('idx_bookings_no_double_booking')) {
        return {
          success: false,
          code: '23505',
          error: 'This slot was just booked, please choose another time'
        };
      }
      return { success: false, code: error.code, error: error.message };
    }

    return { success: true, booking: normalizeBooking(sbPayload) };
  } catch (err: any) {
    console.error('❌ [BOOKINGS INSERT] Unexpected error creating booking:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Role-scoped soft-delete persistence helpers.
 * Ensures soft-deleted bookings stay hidden per role across reloads and real-time events.
 */
export function isClientRoleDeleted(id: string, email?: string): boolean {
  if (!id) return false;
  try {
    const cleanEmail = (email || '').toLowerCase().trim();
    const keys = [
      cleanEmail ? `client_deleted_sessions_${cleanEmail}` : '',
      'client_deleted_sessions'
    ].filter(Boolean);
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.includes(id)) return true;
      }
    }
  } catch {}
  return false;
}

export function isExpertRoleDeleted(id: string, email?: string): boolean {
  if (!id) return false;
  try {
    const cleanEmail = (email || '').toLowerCase().trim();
    const keys = [
      cleanEmail ? `expert_deleted_sessions_${cleanEmail}` : '',
      'expert_deleted_sessions'
    ].filter(Boolean);
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.includes(id)) return true;
      }
    }
  } catch {}
  return false;
}

export function isAdminRoleDeleted(id: string): boolean {
  if (!id) return false;
  try {
    const raw = localStorage.getItem('admin_deleted_sessions');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.includes(id)) return true;
    }
  } catch {}
  return false;
}

export function recordRoleDeleted(id: string, role: string, email?: string): void {
  if (!id) return;
  try {
    const r = (role || 'admin').toLowerCase();
    const cleanEmail = (email || '').toLowerCase().trim();
    let key = 'admin_deleted_sessions';
    if (r === 'client') {
      key = cleanEmail ? `client_deleted_sessions_${cleanEmail}` : 'client_deleted_sessions';
    } else if (r === 'expert') {
      key = cleanEmail ? `expert_deleted_sessions_${cleanEmail}` : 'expert_deleted_sessions';
    }
    const raw = localStorage.getItem(key);
    const existing = raw ? JSON.parse(raw) : [];
    const next = Array.from(new Set([...existing, id]));
    localStorage.setItem(key, JSON.stringify(next));
  } catch {}
}

/**
 * Fetches all bookings for a client by ID and/or email.
 */
export async function fetchClientBookings(
  clientId: string,
  clientEmail?: string,
  bookingIds?: string[]
): Promise<ConsultationBooking[]> {
  const cleanEmail = (clientEmail || '').toLowerCase().trim();
  const cleanId = (clientId || '').trim();

  // 1. Primary Read Path: Call backend endpoint /api/bookings
  try {
    const params = new URLSearchParams();
    if (cleanId) params.append('clientId', cleanId);
    if (cleanEmail) params.append('clientEmail', cleanEmail);
    params.append('role', 'client');

    const res = await fetch(`/api/bookings?${params.toString()}`, {
      headers: {
        'x-user-id': cleanId,
        'x-user-email': cleanEmail,
        'x-user-role': 'client'
      }
    });
    if (res.ok) {
      const json = await res.json();
      const list = json.bookings || json.data;
      if (json.success && Array.isArray(list)) {
        const normalized = list.map(normalizeBooking);
        return normalized.filter(b => !b.deletedByClient && !isClientRoleDeleted(b.id, cleanEmail));
      }
    }
  } catch (apiErr: any) {
    console.warn('[BOOKINGS SERVICE] /api/bookings endpoint fetch failed, falling back:', apiErr.message);
  }

  // 2. Direct Supabase Query fallback
  try {
    // Only real booking columns (never select('*')); newest first, capped — see src/lib/columns.ts
    let query = supabase.from('bookings').select(COLUMNS.BOOKING);

    const validIds = Array.isArray(bookingIds) ? bookingIds.filter(Boolean) : [];

    if (validIds.length > 0 && cleanEmail) {
      query = query.or(`client_email.ilike.${cleanEmail},id.in.(${validIds.join(',')})`);
    } else if (validIds.length > 0) {
      query = query.in('id', validIds);
    } else if (cleanId && cleanEmail) {
      query = query.or(`client_id.eq.${cleanId},client_email.ilike.${cleanEmail}`);
    } else if (cleanEmail) {
      query = query.ilike('client_email', cleanEmail);
    } else if (cleanId) {
      query = query.eq('client_id', cleanId);
    }

    query = query.order('created_at', { ascending: false }).order('id', { ascending: true }).limit(PAGE.BOOKINGS);

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      const normalized = data.map(normalizeBooking);
      return normalized.filter(b => !b.deletedByClient && !isClientRoleDeleted(b.id, cleanEmail));
    }
  } catch (sbErr: any) {
    console.warn('[BOOKINGS SERVICE] Supabase direct query fallback note:', sbErr.message);
  }

  // 3. Ephemeral local storage cache fallback
  try {
    if (typeof localStorage !== 'undefined' && cleanEmail) {
      const localRaw = localStorage.getItem(`client_upcoming_${cleanEmail}`);
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizeBooking).filter(b => !b.deletedByClient && !isClientRoleDeleted(b.id, cleanEmail));
        }
      }
    }
  } catch {}

  return [];
}

/**
 * Fetches bookings for an expert by ID and/or email, optionally filtering by status.
 */
export async function fetchExpertBookings(
  expertId: string,
  expertEmail?: string,
  statusFilter?: 'pending' | 'accepted' | 'all',
  expertUserId?: string
): Promise<ConsultationBooking[]> {
  const cleanEmail = (expertEmail || '').toLowerCase().trim();
  const cleanId = (expertId || '').trim();
  const cleanUserId = (expertUserId || '').trim();

  console.log('🔍 [EXPERT PORTAL FETCH] Query params:', { expertId: cleanId, expertEmail: cleanEmail, expertUserId: cleanUserId, statusFilter });

  // 1. Primary Read Path: Call backend endpoint /api/bookings
  try {
    const params = new URLSearchParams();
    if (cleanId) params.append('expertId', cleanId);
    if (cleanEmail) params.append('expertEmail', cleanEmail);
    if (cleanUserId) params.append('expertUserId', cleanUserId);
    params.append('role', 'expert');

    const res = await fetch(`/api/bookings?${params.toString()}`, {
      headers: {
        'x-user-id': cleanId || cleanUserId,
        'x-user-email': cleanEmail,
        'x-user-role': 'expert'
      }
    });
    if (res.ok) {
      const json = await res.json();
      const list = json.bookings || json.data;
      if (json.success && Array.isArray(list)) {
        let normalized = list.map(normalizeBooking);
        normalized = normalized.filter(b => !b.deletedByExpert && !isExpertRoleDeleted(b.id, cleanEmail));
        if (statusFilter === 'pending') {
          return normalized.filter(b => {
            const st = (b.status || '').toLowerCase();
            return st === 'pending' || st.includes('pending');
          });
        } else if (statusFilter === 'accepted') {
          return normalized.filter(b => {
            const st = (b.status || '').toLowerCase();
            return st === 'accepted' || st.includes('accept') || st.includes('confirmed');
          });
        }
        return normalized;
      }
    }
  } catch (apiErr: any) {
    console.warn('[EXPERT PORTAL FETCH] /api/bookings endpoint fetch failed, falling back:', apiErr.message);
  }

  // 2. Direct Supabase Query fallback
  try {
    // Only real booking columns (never select('*')); newest first, capped — see src/lib/columns.ts
    let query = supabase.from('bookings').select(COLUMNS.BOOKING);

    const orClauses: string[] = [];
    if (cleanId) orClauses.push(`expert_id.eq.${cleanId}`);
    if (cleanUserId && cleanUserId !== cleanId) orClauses.push(`expert_id.eq.${cleanUserId}`);
    if (cleanEmail) orClauses.push(`expert_email.ilike.${cleanEmail}`);

    if (orClauses.length > 0) {
      query = query.or(orClauses.join(','));
    }

    if (statusFilter === 'pending') {
      query = query.or('status.eq.pending,status.ilike.%pending%');
    } else if (statusFilter === 'accepted') {
      query = query.or('status.eq.accepted,status.ilike.%accepted%,status.ilike.%confirmed%');
    }

    query = query.order('created_at', { ascending: false }).order('id', { ascending: true }).limit(PAGE.BOOKINGS);

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      const normalized = data.map(normalizeBooking);
      return normalized.filter(b => !b.deletedByExpert && !isExpertRoleDeleted(b.id, cleanEmail));
    }
  } catch (sbErr: any) {
    console.warn('[EXPERT PORTAL FETCH] Supabase direct query fallback note:', sbErr.message);
  }

  // 3. Ephemeral local storage cache fallback
  try {
    if (typeof localStorage !== 'undefined' && cleanEmail) {
      const accRaw = localStorage.getItem(`expert_accepted_sessions_${cleanEmail}`);
      const reqRaw = localStorage.getItem(`expert_requests_${cleanEmail}`);
      const accList = accRaw ? JSON.parse(accRaw) : [];
      const reqList = reqRaw ? JSON.parse(reqRaw) : [];
      const combined = [...(Array.isArray(accList) ? accList : []), ...(Array.isArray(reqList) ? reqList : [])];
      if (combined.length > 0) {
        const normalized = combined.map(normalizeBooking).filter(b => !b.deletedByExpert && !isExpertRoleDeleted(b.id, cleanEmail));
        if (statusFilter === 'pending') {
          return normalized.filter(b => (b.status || '').toLowerCase().includes('pending'));
        } else if (statusFilter === 'accepted') {
          return normalized.filter(b => (b.status || '').toLowerCase().includes('accept') || (b.status || '').toLowerCase().includes('confirmed'));
        }
        return normalized;
      }
    }
  } catch {}

  return [];
}

/**
 * Fetches all bookings across the platform for the Admin Ops Desk.
 */
export async function fetchAllBookingsForAdmin(): Promise<ConsultationBooking[]> {
  console.log('🔍 [ADMIN PORTAL FETCH] Fetching all bookings for Admin Ops Desk...');

  // 1. Primary Read Path: Call backend endpoint /api/bookings?role=admin
  try {
    const res = await fetch('/api/bookings?role=admin', {
      headers: {
        'x-user-role': 'admin'
      }
    });
    if (res.ok) {
      const json = await res.json();
      const list = json.bookings || json.data;
      if (json.success && Array.isArray(list) && list.length > 0) {
        const normalized = list.map(normalizeBooking);
        return normalized.filter(b => !b.deletedByAdmin && !isAdminRoleDeleted(b.id));
      }
    }
  } catch (apiErr: any) {
    console.warn('[ADMIN PORTAL FETCH] /api/bookings endpoint fetch failed, falling back:', apiErr.message);
  }

  // 2. Direct Supabase Query fallback
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(COLUMNS.BOOKING)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(PAGE.BOOKINGS);

    if (!error && Array.isArray(data) && data.length > 0) {
      const normalized = data.map(normalizeBooking);
      return normalized.filter(b => !b.deletedByAdmin && !isAdminRoleDeleted(b.id));
    }
  } catch (sbErr: any) {
    console.warn('[ADMIN PORTAL FETCH] Supabase direct query fallback note:', sbErr.message);
  }

  // 3. Ephemeral local storage cache fallback
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('app_platform_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizeBooking).filter(b => !b.deletedByAdmin && !isAdminRoleDeleted(b.id));
        }
      }
    }
  } catch {}

  return [];
}

/**
 * Updates booking status (e.g. 'accepted', 'rejected', 'completed', 'live') and extra fields.
 */
export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus | string,
  extraFields: Record<string, any> = {},
  callerInfo: { userId?: string; userEmail?: string; userRole?: string } = {}
): Promise<{ success: boolean; error?: string; booking?: ConsultationBooking }> {
  try {
    const canonicalStatus = normalizeBookingStatus(status);
    
    // Whitelist and map only valid columns in Supabase bookings table schema
    const payload: Record<string, any> = {
      status: canonicalStatus,
      updated_at: new Date().toISOString()
    };

    const meet = extraFields.meet_link ?? extraFields.meeting_link ?? extraFields.meetUrl ?? extraFields.meetLink;
    if (meet !== undefined) {
      payload.meet_link = meet;
      payload.meeting_link = meet;
    }
    const sentAt = extraFields.meeting_link_sent_at ?? extraFields.meetingLinkSentAt;
    if (sentAt !== undefined) {
      payload.meeting_link_sent_at = sentAt;
    } else if (meet !== undefined && meet) {
      payload.meeting_link_sent_at = new Date().toISOString();
    }
    if (extraFields.notes !== undefined) payload.notes = extraFields.notes;
    if (extraFields.scheduled_date !== undefined) payload.scheduled_date = extraFields.scheduled_date;
    if (extraFields.scheduled_time !== undefined) payload.scheduled_time = extraFields.scheduled_time;
    if (extraFields.scheduled_start !== undefined) payload.scheduled_start = extraFields.scheduled_start;
    if (extraFields.scheduled_end !== undefined) payload.scheduled_end = extraFields.scheduled_end;
    if (extraFields.duration_minutes !== undefined) payload.duration_minutes = extraFields.duration_minutes;
    if (extraFields.deleted_by_client !== undefined) payload.deleted_by_client = extraFields.deleted_by_client;
    if (extraFields.deleted_by_expert !== undefined) payload.deleted_by_expert = extraFields.deleted_by_expert;
    if (extraFields.deleted_by_admin !== undefined) payload.deleted_by_admin = extraFields.deleted_by_admin;

    console.log('🔄 [BOOKINGS UPDATE] Updating booking status:', { bookingId, status: canonicalStatus, payload });

    // Primary write path: Call backend endpoint /api/bookings/:id with caller headers
    let updatedBookingData: any = null;
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': callerInfo.userId || '',
          'x-user-email': callerInfo.userEmail || '',
          'x-user-role': callerInfo.userRole || 'admin'
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        updatedBookingData = json.booking || { id: bookingId, ...payload };
      } else if (json.error) {
        console.warn('[BOOKINGS UPDATE] API endpoint returned error:', json.error);
        return { success: false, error: json.error };
      }
    } catch (apiErr: any) {
      console.warn('[BOOKINGS UPDATE] API endpoint call failed, attempting direct Supabase fallback:', apiErr.message);
    }

    // Direct Supabase Client fallback (or primary if API failed)
    if (!updatedBookingData) {
      const { data, error } = await supabase
        .from('bookings')
        .update(payload)
        .eq('id', bookingId)
        .select(COLUMNS.BOOKING)
        .maybeSingle();

      if (error) {
        console.warn('[BOOKINGS UPDATE] Direct update error:', error.message);
        return { success: false, error: error.message };
      }
      updatedBookingData = data || { id: bookingId, ...payload };
    }

    // Broadcast update across cross-portal channels
    try {
      broadcastBookingUpdate(normalizeBooking(updatedBookingData));
    } catch (bcErr) {
      console.warn('[BOOKINGS UPDATE] Broadcast note:', bcErr);
    }

    return { success: true, booking: normalizeBooking(updatedBookingData) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Soft-deletes a booking for the caller's role (client, expert, or admin).
 * NEVER hard-deletes the row or touches other portals' visibility.
 */
export async function deleteBooking(
  bookingId: string,
  callerInfo: { userId?: string; userEmail?: string; userRole?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const role = (callerInfo.userRole || 'admin').toLowerCase().trim();
    console.log(`🗑️ [BOOKINGS SOFT-DELETE] Soft-deleting booking ${bookingId} for role: ${role}`);

    // Track in local persistent role deleted store immediately
    recordRoleDeleted(bookingId, role, callerInfo.userEmail);

    const updateField = role === 'admin'
      ? { deleted_by_admin: true, updated_at: new Date().toISOString() }
      : role === 'expert'
        ? { deleted_by_expert: true, updated_at: new Date().toISOString() }
        : { deleted_by_client: true, updated_at: new Date().toISOString() };

    // Primary write path: Call backend endpoint /api/bookings/:id with caller headers & body
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': callerInfo.userId || '',
          'x-user-email': callerInfo.userEmail || '',
          'x-user-role': role
        },
        body: JSON.stringify({ role })
      });
      const json = await res.json();
      if (json.success) return { success: true };
      if (json.error) console.warn('[BOOKINGS SOFT-DELETE] API endpoint note:', json.error);
    } catch (apiErr: any) {
      console.warn('[BOOKINGS SOFT-DELETE] API endpoint call failed, attempting direct Supabase fallback:', apiErr.message);
    }

    // Direct Supabase Client fallback (SOFT DELETE - UPDATE ONLY, NEVER DELETE)
    try {
      const { error } = await supabase
        .from('bookings')
        .update(updateField)
        .eq('id', bookingId);

      if (error) {
        console.warn('[BOOKINGS SOFT-DELETE] Direct Supabase update note (columns might need migration):', error.message);
      }
    } catch (sbErr: any) {
      console.warn('[BOOKINGS SOFT-DELETE] Supabase fallback catch note:', sbErr.message);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Subscribes to Supabase Realtime postgres_changes on the bookings table.
 * Automatically handles deduplication and triggers callbacks for INSERT, UPDATE, DELETE.
 */
export function subscribeToBookingsRealtime({
  channelName = 'bookings-realtime-channel',
  onInsert,
  onUpdate,
  onDelete
}: {
  channelName?: string;
  onInsert?: (booking: ConsultationBooking) => void;
  onUpdate?: (booking: ConsultationBooking) => void;
  onDelete?: (deletedId: string) => void;
}): () => void {
  console.log(`🔌 [BOOKINGS REALTIME] Subscribing channel: "${channelName}"`);
  
  const channel = supabase.channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings'
      },
      (payload: any) => {
        const { eventType, new: newRec, old: oldRec } = payload;
        console.log(`⚡ [BOOKINGS REALTIME] Event ${eventType}:`, {
          id: newRec?.id || oldRec?.id,
          status: newRec?.status,
          client: newRec?.client_name,
          expert: newRec?.expert_name
        });

        if (eventType === 'INSERT' && newRec && onInsert) {
          onInsert(normalizeBooking(newRec));
        } else if (eventType === 'UPDATE' && newRec && onUpdate) {
          onUpdate(normalizeBooking(newRec));
        } else if (eventType === 'DELETE' && oldRec?.id && onDelete) {
          onDelete(String(oldRec.id));
        }
      }
    )
    .on(
      'broadcast',
      { event: 'booking_decision_updated' },
      (e: any) => {
        const p = e.payload;
        console.log('⚡ [BOOKINGS REALTIME BROADCAST] booking_decision_updated:', p);
        if (p && p.bookingId && onUpdate) {
          onUpdate(normalizeBooking({
            id: p.bookingId,
            status: p.status || p.decision,
            expert_name: p.expertName,
            client_email: p.clientEmail,
            topic: p.topic,
            meet_link: p.meet_link || p.meetUrl,
            meeting_link: p.meeting_link || p.meetUrl
          }));
        }
      }
    )
    .on(
      'broadcast',
      { event: 'booking_updated' },
      (e: any) => {
        const p = e.payload;
        console.log('⚡ [BOOKINGS REALTIME BROADCAST] booking_updated:', p);
        if (p && (p.id || p.bookingId) && onUpdate) {
          onUpdate(normalizeBooking(p.id ? p : { ...p, id: p.bookingId }));
        }
      }
    )
    .subscribe((status: string) => {
      console.log(`📡 [BOOKINGS REALTIME] Channel "${channelName}" status:`, status);
    });

  return () => {
    console.log(`🔌 [BOOKINGS REALTIME] Unsubscribing channel: "${channelName}"`);
    supabase.removeChannel(channel);
  };
}

// Module-level persistent BroadcastChannel singletons to prevent premature closure on postMessage
let bcUpdatesChannel: BroadcastChannel | null = null;
let bcDecisionsChannel: BroadcastChannel | null = null;

function getBcUpdatesChannel(): BroadcastChannel | null {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    if (!bcUpdatesChannel) {
      try { bcUpdatesChannel = new BroadcastChannel('mentora_booking_updates'); } catch {}
    }
    return bcUpdatesChannel;
  }
  return null;
}

function getBcDecisionsChannel(): BroadcastChannel | null {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    if (!bcDecisionsChannel) {
      try { bcDecisionsChannel = new BroadcastChannel('mentora_booking_decisions'); } catch {}
    }
    return bcDecisionsChannel;
  }
  return null;
}

/**
 * Emits a real-time booking update event across Supabase channels,
 * BroadcastChannel, and window events for instantaneous cross-tab/cross-portal sync.
 */
export function broadcastBookingUpdate(payload: Partial<ConsultationBooking> & { id: string; meetUrl?: string; meet_link?: string | null; meeting_link_sent_at?: string | null }) {
  console.log('📢 [BROADCAST BOOKING UPDATE]:', payload);
  const meet = payload.meetUrl || payload.meet_link || payload.meeting_link || '';
  const detail = {
    ...payload,
    bookingId: payload.id,
    meetUrl: meet,
    meet_link: meet || null,
    meeting_link: meet || null,
    meeting_link_sent_at: payload.meeting_link_sent_at || (meet ? new Date().toISOString() : null),
    timestamp: new Date().toISOString()
  };

  try {
    const broadcastChannel = supabase.channel('bookings-realtime-channel');
    broadcastChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        broadcastChannel.send({
          type: 'broadcast',
          event: 'booking_updated',
          payload: detail
        });
      }
    });
  } catch (err) {
    console.warn('[BROADCAST ERROR]:', err);
  }

  // Native Web API BroadcastChannel for instant cross-tab / cross-window sync (do NOT close channel immediately)
  try {
    const bc1 = getBcUpdatesChannel();
    if (bc1) bc1.postMessage(detail);

    const bc2 = getBcDecisionsChannel();
    if (bc2) bc2.postMessage(detail);
  } catch (err) {
    console.warn('[BROADCAST CHANNEL ERROR]:', err);
  }

  // Cross-tab storage event trigger via localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mentora_last_booking_update', JSON.stringify({ ...detail, _ts: Date.now() }));
    }
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('booking_updated', { detail }));
    window.dispatchEvent(new CustomEvent('booking_decision_updated', { detail }));
    window.dispatchEvent(new CustomEvent('mongo_kv_updated', { detail: { key: 'client_upcoming' } }));
    window.dispatchEvent(new CustomEvent('mongo_kv_updated', { detail: { key: 'app_platform_sessions' } }));
    window.dispatchEvent(new CustomEvent('app_platform_sessions_updated', { detail }));
    window.dispatchEvent(new Event('storage'));
  }
}

/**
 * Emits a real-time booking decision event across Supabase channels and window events.
 * Dispatched AFTER existing accept/reject action succeeds.
 */
export function broadcastBookingDecision(payload: {
  bookingId: string;
  decision: 'accepted' | 'rejected';
  expertName: string;
  clientEmail?: string;
  topic?: string;
}) {
  console.log('📢 [BROADCAST BOOKING DECISION]:', payload);
  const detail = {
    bookingId: payload.bookingId,
    id: payload.bookingId,
    status: payload.decision,
    decision: payload.decision,
    expertName: payload.expertName,
    clientEmail: payload.clientEmail,
    topic: payload.topic,
    timestamp: new Date().toISOString()
  };

  try {
    const broadcastChannel = supabase.channel('bookings-realtime-channel');
    broadcastChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        broadcastChannel.send({
          type: 'broadcast',
          event: 'booking_decision_updated',
          payload: detail
        });
      }
    });
  } catch (err) {
    console.warn('[BROADCAST ERROR]:', err);
  }

  // Native Web API BroadcastChannel for instant cross-tab / cross-window sync (do NOT close channel immediately)
  try {
    const bcDec = getBcDecisionsChannel();
    if (bcDec) bcDec.postMessage(detail);

    const bcUpd = getBcUpdatesChannel();
    if (bcUpd) bcUpd.postMessage(detail);
  } catch (err) {
    console.warn('[BROADCAST CHANNEL ERROR]:', err);
  }

  // Cross-tab storage event trigger via localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mentora_last_booking_decision', JSON.stringify({ ...detail, _ts: Date.now() }));
      localStorage.setItem('mentora_last_booking_update', JSON.stringify({ ...detail, _ts: Date.now() }));
    }
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('booking_decision_updated', { detail }));
    window.dispatchEvent(new CustomEvent('booking_updated', { detail }));
    window.dispatchEvent(new CustomEvent('mongo_kv_updated', { detail: { key: 'client_upcoming' } }));
    window.dispatchEvent(new CustomEvent('mongo_kv_updated', { detail: { key: 'app_platform_sessions' } }));
    window.dispatchEvent(new CustomEvent('app_platform_sessions_updated', { detail }));
    window.dispatchEvent(new Event('storage'));
  }
}
