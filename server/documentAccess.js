import { supabase } from './supabaseClient.js';
import { normalizeEmail, readActor } from './session.js';

const fields = 'id,user_id,email';
const aliases = new Set(['/api/documents', '/api/documents/signed-url', '/api/expert-documents/signed-url']);
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const unwrap = ({ data, error }) => { if (error) throw error; return data; };

async function findExpert(id) {
  if (!id || typeof id !== 'string') return null;
  const direct = unwrap(await supabase.from('experts').select(fields).eq('id', id).maybeSingle());
  if (direct) return direct;
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) return null;
  return unwrap(await supabase.from('experts').select(fields).eq('user_id', id).limit(1).maybeSingle());
}

export async function authorizeCredentialAccess(req, expertId, requireAdmin = false) {
  const actor = await readActor(req);
  if (!actor) fail(401, 'Sign in to access credentials');
  if (requireAdmin && actor.role !== 'admin') fail(403, 'Administrator access required');
  const expert = await findExpert(expertId);
  if (!expert) fail(404, 'Expert not found');
  if (actor.role !== 'admin' && !(actor.role === 'expert' && (expert.user_id === actor.id || normalizeEmail(expert.email) === actor.email))) {
    fail(403, 'You do not have access to these credentials');
  }
  return expert;
}

export async function handleCredentialRead(req, res, next) {
  const url = new URL(req.originalUrl || req.url || '/', 'http://localhost');
  if (req.method !== 'GET' || !aliases.has(url.pathname)) return next();
  let status = 200;
  let payload;
  try {
    const actor = await readActor(req);
    if (!actor) fail(401, 'Sign in to access credentials');
    if (!['admin', 'expert'].includes(actor.role)) fail(403, 'You do not have access to credentials');
    const storagePath = url.searchParams.get('filePath');
    const fileName = url.searchParams.get('key');
    const expertId = url.searchParams.get('expertId');
    if (!storagePath && (!expertId || !fileName)) fail(404, 'Document not found');
    let lookup = supabase.from('expert_documents').select('expert_id,file_path,file_name');
    if (storagePath) lookup = lookup.eq('file_path', storagePath);
    else {
      const owner = await authorizeCredentialAccess(req, expertId);
      lookup = lookup.eq('expert_id', owner.id).eq('file_name', fileName);
    }
    const item = unwrap(await lookup.limit(1).maybeSingle());
    if (!item) fail(404, 'Document not found');
    await authorizeCredentialAccess(req, item.expert_id);
    const data = unwrap(await supabase.storage.from('expert-documents').createSignedUrl(item.file_path, 900));
    payload = { success: true, signedUrl: data.signedUrl, url: data.signedUrl };
  } catch (error) {
    status = error.status || (error.statusCode === '404' ? 404 : 503);
    if (status >= 500) console.error('[credentials]', error.code || error.name);
    payload = { success: false, error: status >= 500 ? 'Credential storage unavailable' : error.message };
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}
