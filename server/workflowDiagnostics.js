import { supabase } from './supabaseClient.js';
import { isAuthorizedAdmin } from './session.js';
import { fail, readJsonBody, unwrap } from './workflowHttp.js';

export async function handleWorkflowDiagnostics(req, res, next) {
  const path = (req.originalUrl || req.url || '').split('?')[0];
  const health = req.method === 'GET' && path === '/api/health';
  const markup = req.method === 'POST' && path === '/api/experts/markup';
  if (!health && !markup) return next();
  let status = 200;
  let result;
  try {
    if (health) {
      unwrap(await supabase.from('users').select('id').limit(1));
      result = { success: true, database: 'connected', service: 'Supabase' };
    } else {
      if (!await isAuthorizedAdmin(req)) fail(403, 'Administrator access required');
      const input = await readJsonBody(req);
      const id = input.expertId || input.id;
      const baseRate = Number(input.baseRate ?? input.base_rate);
      const markup = Number(input.markup ?? input.adminMarkup ?? input.admin_markup);
      if (!id || !Number.isFinite(baseRate) || baseRate < 0 || baseRate > 1000 || !Number.isFinite(markup) || markup < 0) {
        fail(400, 'A valid expert, base rate and markup are required');
      }
      const rate = Math.round((baseRate + markup) * 100) / 100;
      const expert = unwrap(await supabase.from('experts').update({ base_rate: baseRate, admin_markup: markup, rate })
        .eq('id', id).select('id, base_rate, admin_markup, rate').maybeSingle());
      if (!expert) fail(404, 'Expert not found');
      result = { success: true, expert, rate };
    }
  } catch (error) {
    status = error.status || 503;
    result = { success: false, error: status >= 500 ? 'Supabase is unavailable' : error.message, ...(health && { database: 'unavailable', service: 'Supabase' }) };
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(result));
}
