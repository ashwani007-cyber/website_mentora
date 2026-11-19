import { supabase } from '../supabaseClient';
import { apiSessionHeaders } from '../lib/apiSession';
import { sendRealtimeBroadcast } from '../lib/realtimeBroadcast';
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
  payout?: number;
  workflowManaged?: boolean;
  declineReason?: string;
  availabilitySlotId?: string;
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
    payoutTransferred: row.payout_transferred === true || row.payoutTransferred === true,
    payout: row.workflow_managed ? value - Number(row.platform_fee || 0) : (row.payout ?? Math.round(value * 0.85)),
    workflowManaged: row.workflow_managed === true || row.workflowManaged === true,
    declineReason: row.decline_reason || row.declineReason,
    availabilitySlotId: row.availability_id || row.availabilitySlotId
  };
}

export async function createConsultationBooking(
  input: CreateBookingInput
): Promise<{ success: boolean; booking?: ConsultationBooking; balance?: number; duplicate?: boolean; error?: string; code?: string }> {
  try {
    const request = await fetch('/api/bookings', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...apiSessionHeaders('client') },
      body: JSON.stringify({
        id: input.id, expert_id: input.expertId || input.expert_id, availability_id: input.availability_id || input.availabilitySlotId,
        scheduled_date: input.scheduledDate || input.scheduled_date || input.date, topic: input.topic,
        package_type: input.packageType || input.package_type, price: input.price ?? input.value ?? input.rate
      })
    });
    const result = await request.json();
    if (!request.ok || !result.booking) return { success: false, error: result.error, code: result.code };
    return { success: true, booking: normalizeBooking(result.booking), balance: Number(result.balance), duplicate: result.duplicate };
  } catch {
    return { success: false, error: 'Unable to confirm the booking. Try again to check whether it was saved.' };
  }
}

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

async function fetchBookings(role: 'client' | 'expert' | 'admin') {
  const response = await fetch('/api/bookings', { headers: apiSessionHeaders(role) });
  if (!response.ok) throw new Error('Could not load consultations');
  const result = await response.json();
  return Array.isArray(result.bookings) ? result.bookings.map(normalizeBooking) : [];
}

function cachedBookings(key: string): ConsultationBooking[] {
  try {
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(data) ? data.map(normalizeBooking) : [];
  } catch {
    return [];
  }
}

export async function fetchClientBookings(_clientId: string, clientEmail?: string, _bookingIds?: string[]) {
  const email = (clientEmail || '').toLowerCase().trim();
  const list = await fetchBookings('client').catch(() => email ? cachedBookings(`client_upcoming_${email}`) : []);
  return list.filter(booking => !booking.deletedByClient && !isClientRoleDeleted(booking.id, email));
}

export async function fetchExpertBookings(_expertId: string, expertEmail?: string, statusFilter?: 'pending' | 'accepted' | 'all', _expertUserId?: string) {
  const email = (expertEmail || '').toLowerCase().trim();
  const list = await fetchBookings('expert').catch(() => email ? [...cachedBookings(`expert_requests_${email}`), ...cachedBookings(`expert_accepted_sessions_${email}`)] : []);
  const visible = list.filter(booking => !booking.deletedByExpert && !isExpertRoleDeleted(booking.id, email));
  return !statusFilter || statusFilter === 'all' ? visible : visible.filter(booking => normalizeBookingStatus(booking.status) === statusFilter);
}

export async function fetchAllBookingsForAdmin() {
  const list = await fetchBookings('admin').catch(() => cachedBookings('app_platform_sessions'));
  return list.filter(booking => !booking.deletedByAdmin && !isAdminRoleDeleted(booking.id));
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus | string,
  extraFields: Record<string, any> = {},
  callerInfo: { userId?: string; userEmail?: string; userRole?: string } = {}
): Promise<{ success: boolean; error?: string; booking?: ConsultationBooking; duplicate?: boolean }> {
  try {
    const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...apiSessionHeaders(callerInfo.userRole) },
      body: JSON.stringify({ ...extraFields, status: normalizeBookingStatus(status) })
    });
    const result = await response.json();
    if (!response.ok || !result.booking) return { success: false, error: result.error };
    const booking = normalizeBooking(result.booking);
    if (!result.duplicate) broadcastBookingUpdate(booking);
    return { success: true, booking, duplicate: result.duplicate };
  } catch {
    return { success: false, error: 'Could not save the consultation change. Please try again.' };
  }
}

export async function deleteBooking(
  bookingId: string, callerInfo: { userId?: string; userEmail?: string; userRole?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const role = callerInfo.userRole || 'admin';
    const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, { method: 'DELETE', headers: apiSessionHeaders(role) });
    const result = await response.json();
    if (!response.ok) return { success: false, error: result.error };
    recordRoleDeleted(bookingId, role, callerInfo.userEmail);
    return { success: true };
  } catch {
    return { success: false, error: 'Could not hide the consultation. Please try again.' };
  }
}

export async function disburseConsultationPayout(bookingId: string) {
  try {
    const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/payout`, { method: 'POST', headers: apiSessionHeaders('admin') });
    const result = await response.json();
    if (!response.ok || !result.booking) return { success: false, error: result.error };
    return { success: true, booking: normalizeBooking(result.booking), balance: Number(result.balance), duplicate: Boolean(result.duplicate) };
  } catch {
    return { success: false, error: 'Could not disburse the consultation payout. Please try again.' };
  }
}

/**
 * Subscribes to Supabase Realtime postgres_changes on the bookings table.
 * Automatically handles deduplication and triggers callbacks for INSERT, UPDATE, DELETE.
 */
export function subscribeToBookingsRealtime({
  channelName = 'bookings-realtime-channel',
  filter,
  onInsert,
  onUpdate,
  onDelete
}: {
  channelName?: string;
  /**
   * Row filter, e.g. "client_email=eq.ana@x.com". Without it, EVERY booking change in the whole
   * table is pushed to this browser (other users' data too). Only the admin should omit it.
   * Note: Supabase cannot filter DELETE events, so filtered listeners don't get deletes — the
   * 60 s refresh picks those up (bookings are normally soft-deleted, i.e. updated, anyway).
   */
  filter?: string;
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
        table: 'bookings',
        ...(filter ? { filter } : {})
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

  // Tell other browsers (one short message, no new channel left open — see realtimeBroadcast.ts).
  void sendRealtimeBroadcast('bookings-realtime-channel', 'booking_updated', detail as Record<string, unknown>);

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

  // Tell other browsers (one short message, no new channel left open — see realtimeBroadcast.ts).
  void sendRealtimeBroadcast('bookings-realtime-channel', 'booking_decision_updated', detail as Record<string, unknown>);

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
