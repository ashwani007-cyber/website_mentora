import { fail, readJsonBody, unwrap } from './workflowHttp.js';
import { randomUUID } from 'node:crypto';
import { supabase } from './supabaseClient.js';
import { normalizeEmail, readActor } from './session.js';

const route = '/api/notifications';
const targets = ['client', 'expert', 'admin', 'all', 'landing', 'custom'];



function present(row, receipt) {
  const metadata = row.metadata || {};
  const read = receipt?.is_read === true || (row.is_read === true && !receipt && !['all', 'landing'].includes(row.user_role));
  return {
    ...metadata.display, id: row.event_id || row.id, target: row.user_role, recipientId: row.user_id === '*' ? undefined : row.user_id,
    title: row.title, message: row.message, type: row.type, actionLink: row.link, createdAt: row.created_at,
    read, status: read ? 'read' : 'delivered'
  };
}

function scope(actor, isPublic) {
  if (!actor || isPublic) return { p_role: 'landing', p_identifiers: [] };
  return { p_role: actor.role, p_identifiers: [actor.email, normalizeEmail(actor.id), normalizeEmail(actor.name)].filter(Boolean) };
}

async function inbox(actor, isPublic) {
  const p_scope = scope(actor, isPublic);
  const list = unwrap(await supabase.rpc('notification_inbox', p_scope, { get: true })
    .select('id, event_id, user_id, user_role, title, message, type, link, is_read, metadata, created_at')
    .order('created_at', { ascending: false }).limit(100));
  const receipts = new Map();
  if (actor && !isPublic && list.length) {
    const account = `${actor.role}:${actor.email}`;
    const data = unwrap(await supabase.from('notification_receipts').select('notification_id, is_read, hidden')
      .eq('account', account).in('notification_id', list.map(row => row.id)));
    for (const receipt of data) receipts.set(receipt.notification_id, receipt);
  }
  return list.filter(row => !receipts.get(row.id)?.hidden).slice(0, 50).map(row => present(row, receipts.get(row.id)));
}

async function createNotification(actor, data) {
  const target = data?.target || data?.user_role;
  const recipientId = normalizeEmail(data?.recipientId || data?.user_id) || '*';
  const title = typeof data?.title === 'string' ? data.title.trim() : '';
  const message = typeof data?.message === 'string' ? data.message.trim() : '';
  if (!targets.includes(target) || !title || title.length > 255 || !message) fail(400, 'A target, title and message are required');
  if ((['all', 'landing'].includes(target) || (recipientId === '*' && target !== 'admin')) && actor.role !== 'admin') {
    fail(403, 'Only an administrator can broadcast');
  }
  const eventId = typeof data.id === 'string' && data.id.length <= 100 ? data.id : randomUUID();
  const row = {
    event_id: eventId, user_id: recipientId, user_role: target, title, message,
    type: String(data.type || 'announcement').slice(0, 50), link: data.actionLink || data.link || null,
    metadata: { display: {
      senderId: actor.id, audienceType: target, recipientType: target,
      recipientName: data.recipientName, channel: data.channel || 'in_app', channels: data.channels,
      eventId: data.eventId, eventName: data.eventName, metadata: data.metadata
    } }
  };
  const stored = await supabase.from('notifications').upsert(row, { onConflict: 'event_id', ignoreDuplicates: true }).select().maybeSingle();
  if (stored.error) throw stored.error;
  return stored.data ? { notification: present(stored.data) } : { duplicate: true };
}

export async function handleNotifications(req, res, next) {
  const url = new URL(req.originalUrl || req.url || '/', 'http://localhost');
  const path = url.pathname.replace(/\/$/, '');
  if (path !== route && !path.startsWith(`${route}/`)) return next();
  let status = 200;
  let result;
  try {
    const actor = await readActor(req);
    if (req.method === 'GET' && path === route) {
      const isPublic = url.searchParams.get('role') === 'landing' || (!actor && !url.searchParams.has('role'));
      if (!actor && !isPublic) fail(401, 'Sign in to open your notifications');
      result = { notifications: await inbox(actor, isPublic) };
    } else {
      if (!actor) fail(401, 'Sign in to manage notifications');
      if (req.method === 'POST' && path === route) result = await createNotification(actor, await readJsonBody(req));
      else {
        const action = path.slice(route.length + 1);
        const oldRead = req.method === 'PUT' && action.endsWith('/read');
        if (!oldRead && !(req.method === 'POST' && ['mark-read', 'mark-all-read', 'clear'].includes(action))) fail(405, 'Method not allowed');
        const event = oldRead ? decodeURIComponent(action.slice(0, -5)) : (action === 'mark-read' ? (await readJsonBody(req))?.id : null);
        if ((action === 'mark-read' || oldRead) && !event) fail(400, 'Notification ID is required');
        unwrap(await supabase.rpc('notification_record_receipts', {
          ...scope(actor), p_account: `${actor.role}:${actor.email}`, p_event: event, p_hide: action === 'clear'
        }));
      }
    }
    result = { success: true, ...result };
  } catch (error) {
    status = error.status || 503;
    if (status >= 500) console.error('[notifications]', error.code || error.name);
    result = { success: false, error: status >= 500 ? 'Notification service unavailable' : error.message };
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(result));
}
