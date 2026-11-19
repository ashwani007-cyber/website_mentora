import { fail, readJsonBody } from './workflowHttp.js';
import { randomUUID } from 'node:crypto';
import { supabase } from './supabaseClient.js';
import { clampInt, COLUMNS } from './egressHelpers.js';
import { readActor } from './session.js';

const route = '/api/bookings';
const columns = `${COLUMNS.BOOKING}, payout_transferred, workflow_managed, reviewed, decline_reason, deleted_by_client, deleted_by_expert, deleted_by_admin`;


function bookingStatus(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.startsWith('accept') || raw.startsWith('confirm')) return 'accepted';
  if (raw.startsWith('reject') || raw.startsWith('declin')) return 'rejected';
  if (raw.startsWith('complete')) return 'completed';
  if (raw.startsWith('live')) return 'live';
  return null;
}


export async function handleConsultation(req, res, next) {
  const url = new URL(req.originalUrl || req.url || '/', 'http://localhost');
  const pathname = url.pathname.replace(/\/$/, '');
  if (!(pathname === route || pathname.startsWith(`${route}/`))) return next();
  let status = 200;
  let response;
  try {
    const actor = await readActor(req);
    if (!actor) fail(401, 'Sign in to access consultations');
    const method = req.method;
    let result;
    if (method === 'GET' && pathname === route) {
      const params = url.searchParams;
      const limit = clampInt(params.get('limit'), 200, 1, 500);
      const offset = clampInt(params.get('offset'), 0, 0, 100000);
      let query = supabase.from('bookings').select(columns).not(`deleted_by_${actor.role}`, 'is', true);
      if (actor.role !== 'admin') {
        const exact = actor.email.replace(/[\\%_]/g, '\\$&');
        query = query.ilike(`${actor.role}_email`, exact);
      } else {
        for (const [name, column] of [['expertId', 'expert_id'], ['clientId', 'client_id'], ['expertEmail', 'expert_email'], ['clientEmail', 'client_email']]) {
          if (params.get(name)) query = query.eq(column, params.get(name));
        }
      }
      if (params.get('status')) query = query.ilike('status', `%${params.get('status')}%`);
      result = await query.order('created_at', { ascending: false }).order('id').range(offset, offset + limit - 1);
      if (result.error) throw result.error;
      response = { bookings: result.data, data: result.data };
    } else if (method === 'POST' && pathname === route) {
      if (actor.role !== 'client') fail(403, 'A client account is required');
      const input = await readJsonBody(req);
      const availabilityId = input?.availability_id || input?.availabilitySlotId;
      const expertId = input?.expert_id || input?.expertId;
      const date = input?.scheduled_date || input?.scheduledDate;
      if (!availabilityId || !expertId || !date) fail(400, 'Time slot, expert, and date are required');
      const p_booking = {
        id: String(input.id || `book-${randomUUID()}`), client_id: actor.id, client_email: actor.email, client_name: actor.name || 'Client',
        availability_id: String(availabilityId), expert_id: String(expertId), scheduled_date: String(date),
        topic: String(input.topic || 'Consultation').trim() || 'Consultation',
        package_type: input.package_type === 'Project Advisory' ? 'Project Advisory' : 'Hourly Consultation'
      };
      if (typeof input.price === 'number' && Number.isFinite(input.price)) p_booking.price = input.price;
      result = await supabase.rpc('consultation_purchase', { p_booking });
      if (result.error) throw result.error;
      response = result.data;
    } else {
      const [id, subpath] = pathname.slice(route.length + 1).split('/').map(decodeURIComponent);
      const payout = method === 'POST' && subpath === 'payout';
      if (!id || (!payout && (subpath || !['PATCH', 'DELETE'].includes(method)))) fail(404, 'Consultation endpoint not found');
      const p_input = {};
      if (method === 'PATCH') {
        const input = await readJsonBody(req);
        p_input.status = bookingStatus(input?.status);
        if (!p_input.status) fail(400, 'Invalid consultation status');
        p_input.decline_reason = typeof input.decline_reason === 'string' ? input.decline_reason.trim() : '';
        const url = input.meet_link || input.meeting_link || input.meetUrl;
        if (url) {
          let link;
          try { link = new URL(url); } catch { fail(400, 'Enter a valid Google Meet URL'); }
          if (link.origin !== 'https://meet.google.com' || link.username || link.password || link.pathname === '/') fail(400, 'Enter a valid Google Meet URL');
          p_input.meet_link = link.href;
        }
      }
      result = await supabase.rpc('consultation_update', { p_id: id,
        p_actor: { id: actor.id, email: actor.email, role: actor.role },
        p_action: payout ? 'payout' : (method === 'DELETE' ? 'hide' : 'status'), p_input });
      if (result.error) throw result.error;
      response = result.data;
    }
    response = { success: true, ...response };
  } catch (error) {
    const mapped = { P0001: 400, P0002: 404, '23505': 409, '22007': 400 };
    const pgStatus = /^PT([45]\d\d)$/.exec(error.code || '')?.[1];
    status = error.status || Number(pgStatus) || mapped[error.code] || 503;
    if (status >= 500) console.error('[bookings]', error.code || error.name);
    response = { success: false, code: error.code, error: status >= 500 ? 'Consultation service unavailable. Please try again.' : error.message };
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(response));
}
