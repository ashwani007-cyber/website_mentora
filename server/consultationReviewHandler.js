import { fail, readJsonBody, unwrap } from './workflowHttp.js';
import { supabase } from './supabaseClient.js';
import { withCamelAliases } from './egressHelpers.js';
import { normalizeEmail, readActor } from './session.js';

const path = '/api/reviews';
const publicColumns = 'id, expert_id, expert_name, client_name, rating, comment, created_at, status, visible_to_expert, featured_on_landing';
const adminColumns = `${publicColumns}, session_id, client_id, client_email, expert_email`;

function displayReview(row) {
  return withCamelAliases({ ...row, date: row.created_at?.split('T')[0] });
}


export async function handleConsultationReview(req, res, next) {
  const url = new URL(req.originalUrl || req.url || '/', 'http://localhost');
  const pathname = url.pathname.replace(/\/$/, '');
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return next();
  let status = 200;
  let output;
  try {
    const method = req.method;
    const expertId = url.searchParams.get('expertId') || null;
    const expertEmail = normalizeEmail(url.searchParams.get('expertEmail')) || null;
    let result;
    if (method === 'GET' && pathname === `${path}/stats`) {
      result = unwrap(await supabase.rpc('consultation_review_stats', { p_expert_id: expertId, p_expert_email: expertEmail }, { get: true }));
    } else if (method === 'GET' && pathname === path) {
      const admin = url.searchParams.get('role') === 'admin';
      const featured = url.searchParams.get('featured') === 'true';
      const actor = featured ? null : await readActor(req);
      if (admin && actor?.role !== 'admin') fail(403, 'Administrator session required');
      if (!admin && !featured && actor?.role !== 'expert') fail(403, 'Expert session required');
      let query = supabase.from('reviews').select(admin ? adminColumns : publicColumns).order('created_at', { ascending: false }).limit(200);
      if (!admin) query = query.eq('visible_to_expert', true).eq('status', 'approved');
      if (featured) query = query.eq('featured_on_landing', true);
      else if (!admin) query = query.ilike('expert_email', actor.email.replace(/[\\%_]/g, '\\$&'));
      else if (expertId) query = query.eq('expert_id', expertId);
      result = { reviews: unwrap(await query).map(displayReview) };
    } else if (method === 'POST' && pathname === path) {
      const actor = await readActor(req);
      if (actor?.role !== 'client') fail(actor ? 403 : 401, 'Client session required');
      const input = await readJsonBody(req);
      if (!input?.sessionId || !Number.isInteger(input.rating) || typeof input.comment !== 'string') fail(400, 'Session ID, rating, and comment are required');
      const saved = unwrap(await supabase.rpc('consultation_submit_review', {
        p_session: input.sessionId, p_client_id: actor.id, p_client_email: actor.email, p_rating: input.rating, p_comment: input.comment
      }));
      result = { review: displayReview(saved.review), duplicate: saved.duplicate };
    } else if (['PATCH', 'DELETE'].includes(method) && pathname !== path) {
      if ((await readActor(req))?.role !== 'admin') fail(403, 'Administrator session required');
      const reviewId = decodeURIComponent(pathname.slice(path.length + 1));
      const input = method === 'PATCH' ? await readJsonBody(req) : { action: 'delete' };
      if (method === 'PATCH' && (typeof input?.value !== 'boolean' || !['visibility', 'feature'].includes(input.action))) fail(400, 'Invalid moderation action');
      const saved = unwrap(await supabase.rpc('consultation_review_moderate', { p_id: reviewId, p_action: input.action, p_value: input.value || false }));
      result = { review: displayReview(saved) };
    } else fail(405, 'Method not allowed');
    output = { success: true, ...result };
  } catch (error) {
    status = error.status || Number(/^PT(4\d\d)$/.exec(error.code || '')?.[1]) || ({ P0002: 404, '23505': 409 }[error.code]) || 503;
    if (status >= 500) console.error('[reviews]', error.code || error.name);
    output = { success: false, error: status >= 500 ? 'Review service unavailable. Please try again.' : error.message };
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(output));
}
