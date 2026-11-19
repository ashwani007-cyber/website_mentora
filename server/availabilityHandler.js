import { fail, readJsonBody, unwrap } from './workflowHttp.js';
import { randomUUID } from 'node:crypto';
import { supabase } from './supabaseClient.js';
import { clampInt, COLUMNS } from './egressHelpers.js';
import { normalizeEmail, readActor } from './session.js';

const root = '/api/availability';


async function listAvailability(actor, params) {
  const expertId = params.get('expertId') || params.get('expert_id');
  let allowed = actor?.role === 'admin';
  if (expertId && actor?.role === 'expert') {
    const expert = unwrap(await supabase.from('experts').select('id,user_id,email').eq('id', expertId).maybeSingle());
    allowed = expert && (expert.user_id === actor.id || normalizeEmail(expert.email) === actor.email);
  }
  const limit = clampInt(params.get('limit'), 500, 1, 1000);
  const offset = clampInt(params.get('offset'), 0, 0, 100000);
  let list = supabase.from('expert_availability').select(allowed ? COLUMNS.AVAILABILITY : 'id, expert_id, availability_date, start_time, end_time, status');
  if (expertId) list = list.eq('expert_id', expertId);
  if (!allowed) list = list.eq('status', 'AVAILABLE');
  else if (params.get('status')) list = list.eq('status', params.get('status'));
  if (params.get('date')) list = list.eq('availability_date', params.get('date'));
  return unwrap(await list.order('availability_date').order('id').range(offset, offset + limit - 1));
}

async function changeSlot(actor, action, input, id) {
  if (!actor) fail(401, 'Sign in to manage availability');
  if (action === 'add' && !['expert', 'admin'].includes(actor.role)) fail(403, 'Only an expert or administrator can add slots');
  const slot = {
    id: id || input?.slotId || input?.id || `avail-${randomUUID()}`,
    expertId: input?.expertId || input?.expert_id, availabilityDate: input?.availabilityDate || input?.availability_date,
    startTime: input?.startTime || input?.start_time, endTime: input?.endTime || input?.end_time, status: input?.status,
    bookingId: input?.bookingId || input?.booking_id, date: input?.date, reason: input?.reason || input?.cancellationReason
  };
  return unwrap(await supabase.rpc('mentora_availability_change', { p_action: action, p_slot: slot,
    p_actor: { id: actor.id, email: actor.email, role: actor.role, name: actor.name } }));
}

export async function handleAvailability(req, res, next) {
  const url = new URL(req.originalUrl || req.url || '/', 'http://localhost');
  const path = url.pathname.replace(/\/$/, '');
  if (path !== root && !path.startsWith(`${root}/`)) return next();
  let status = 200;
  let response;
  try {
    const actor = await readActor(req);
    const suffix = decodeURIComponent(path.slice(root.length + 1));
    const method = req.method;
    if (method === 'GET' && !suffix) response = { availabilities: await listAvailability(actor, url.searchParams) };
    else if (method === 'POST' && suffix === 'batch') {
      if (!['expert', 'admin'].includes(actor?.role)) fail(actor ? 403 : 401, 'Expert or administrator session required');
      const data = await readJsonBody(req);
      if (!Array.isArray(data?.slots) || !data.slots.length || data.slots.length > 50) fail(400, 'Provide one to 50 availability slots');
      const availabilities = [];
      const errors = [];
      for (const item of data.slots) {
        try { availabilities.push(await changeSlot(actor, 'add', { ...data, ...item })); }
        catch (error) { errors.push(error.message || 'Could not add slot'); }
      }
      if (!availabilities.length) fail(400, errors[0] || 'No availability slots were added');
      response = { availabilities, errors };
    } else if (method === 'POST' && ['', 'book', 'release', 'cancel'].includes(suffix)) {
      const action = suffix === 'cancel' ? 'release' : suffix || 'add';
      response = { availability: await changeSlot(actor, action, await readJsonBody(req)) };
    } else if (['PUT', 'PATCH', 'DELETE'].includes(method) && suffix) {
      response = { availability: await changeSlot(actor, method === 'DELETE' ? 'delete' : 'edit',
        method === 'DELETE' ? {} : await readJsonBody(req), suffix) };
    } else fail(405, 'Method not allowed');
    response = { success: true, ...response };
  } catch (error) {
    status = error.status || Number(/^PT(4\d\d)$/.exec(error.code || '')?.[1]) || ({ P0002: 404, '22007': 400, '22008': 400, '23505': 409 }[error.code]) || 503;
    if (status >= 500) console.error('[availability]', error.code || error.name);
    response = { success: false, error: status >= 500 ? 'Availability service unavailable' : error.message };
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(response));
}
