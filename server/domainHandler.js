// Domain Taxonomy Handler - Shared by server.js & vite.config.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../db.json');

export const CANONICAL_DOMAINS = [
  { name: 'Finance & Taxation', slug: 'finance-taxation', color: '#10B981', sort_order: 1 },
  { name: 'HR & Talent', slug: 'hr-talent', color: '#8B5CF6', sort_order: 2 },
  { name: 'Tech & Digital', slug: 'tech-digital', color: '#0EA5E9', sort_order: 3 },
  { name: 'Legal & Compliance', slug: 'legal-compliance', color: '#F59E0B', sort_order: 4 },
  { name: 'Marketing Strategy', slug: 'marketing-strategy', color: '#F43F5E', sort_order: 5 },
  { name: 'Operations & Logistics', slug: 'operations-logistics', color: '#14B8A6', sort_order: 6 },
  { name: 'School Mathematics', slug: 'school-mathematics', color: '#6366F1', sort_order: 7 },
  { name: 'Teaching & Academia', slug: 'teaching-academia', color: '#3B82F6', sort_order: 8 }
];

function readDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch {}
  return { experts: [], kv: {} };
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[DOMAIN DB] Write error:', err);
  }
}

export async function fetchLiveDomains() {
  let domainsList = [];
  let isFromSupabase = false;

  // 1. Try fetching from Supabase
  try {
    const { data, error } = await supabase
      .from('domains')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      domainsList = data;
      isFromSupabase = true;
    }
  } catch (err) {
    console.warn('[DOMAINS API] Supabase query note:', err.message);
  }

  // 2. Fallback to db.json / defaults
  if (domainsList.length === 0) {
    const db = readDb();
    if (Array.isArray(db.domains) && db.domains.length > 0) {
      domainsList = db.domains;
    } else {
      domainsList = CANONICAL_DOMAINS.map((d, idx) => ({
        id: `dom-${idx + 1}`,
        name: d.name,
        slug: d.slug,
        color: d.color,
        sort_order: d.sort_order,
        is_active: true,
        created_at: new Date().toISOString()
      }));
      db.domains = domainsList;
      writeDb(db);
    }
  }

  // 3. Compute expert counts per domain from Supabase or db.json
  const expertCounts = {};
  try {
    let { data: experts, error: expErr } = await supabase
      .from('experts')
      .select('id, field, domain_id');

    if (expErr && expErr.message?.includes('domain_id')) {
      const res = await supabase.from('experts').select('id, field');
      experts = res.data;
    }

    if (Array.isArray(experts)) {
      experts.forEach((exp) => {
        // Match by domain_id or name
        domainsList.forEach((dom) => {
          if (
            (exp.domain_id && exp.domain_id === dom.id) ||
            (exp.field && exp.field.trim().toLowerCase() === dom.name.trim().toLowerCase())
          ) {
            expertCounts[dom.id] = (expertCounts[dom.id] || 0) + 1;
          }
        });
      });
    }
  } catch {
    // Local db fallback counts
    const db = readDb();
    const localExperts = db.experts || [];
    localExperts.forEach((exp) => {
      domainsList.forEach((dom) => {
        if (
          (exp.domain_id && exp.domain_id === dom.id) ||
          (exp.field && exp.field.trim().toLowerCase() === dom.name.trim().toLowerCase())
        ) {
          expertCounts[dom.id] = (expertCounts[dom.id] || 0) + 1;
        }
      });
    });
  }

  return domainsList.map((d) => ({
    ...d,
    expert_count: expertCounts[d.id] || 0
  }));
}

export async function createDomain(name, color = '#F59E0B') {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    throw new Error('Expertise field / domain name cannot be empty');
  }

  const existing = await fetchLiveDomains();
  if (existing.some((d) => d.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error(`Domain "${trimmed}" already exists`);
  }

  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const nextOrder = existing.length + 1;

  // Try insert into Supabase
  let createdDomain = null;
  try {
    const { data, error } = await supabase
      .from('domains')
      .insert({
        name: trimmed,
        slug,
        color,
        sort_order: nextOrder,
        is_active: true
      })
      .select()
      .single();

    if (!error && data) {
      createdDomain = data;
    }
  } catch (err) {
    console.warn('[DOMAINS API] Note inserting to Supabase:', err.message);
  }

  // Also maintain in db.json
  const db = readDb();
  if (!createdDomain) {
    createdDomain = {
      id: `dom-${Date.now()}`,
      name: trimmed,
      slug,
      color,
      sort_order: nextOrder,
      is_active: true,
      created_at: new Date().toISOString()
    };
  }

  if (!Array.isArray(db.domains)) db.domains = existing;
  if (!db.domains.some(d => d.name.toLowerCase() === trimmed.toLowerCase())) {
    db.domains.push(createdDomain);
  }
  // Sync to app_expertise_fields in kv
  if (!db.kv) db.kv = {};
  db.kv.app_expertise_fields = db.domains.filter(d => d.is_active).map(d => d.name);
  writeDb(db);

  return createdDomain;
}

export async function updateDomain(id, updates) {
  const { name, color, is_active } = updates;
  const trimmed = name ? String(name).trim() : undefined;

  if (trimmed !== undefined && !trimmed) {
    throw new Error('Domain name cannot be empty');
  }

  const existing = await fetchLiveDomains();
  const current = existing.find((d) => d.id === id);
  if (!current) {
    throw new Error('Domain not found');
  }

  if (trimmed && trimmed.toLowerCase() !== current.name.toLowerCase()) {
    if (existing.some((d) => d.id !== id && d.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`Another domain named "${trimmed}" already exists`);
    }
  }

  const patch = {};
  if (trimmed !== undefined) {
    patch.name = trimmed;
    patch.slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  if (color !== undefined) patch.color = color;
  if (is_active !== undefined) patch.is_active = is_active;

  let updatedDomain = null;
  try {
    const { data, error } = await supabase
      .from('domains')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      updatedDomain = data;

      // When domain name is changed, also update legacy text 'field' on experts
      if (trimmed && trimmed !== current.name) {
        await supabase
          .from('experts')
          .update({ field: trimmed, updated_at: new Date().toISOString() })
          .eq('domain_id', id);

        // Also update any experts matching old name
        await supabase
          .from('experts')
          .update({ field: trimmed, updated_at: new Date().toISOString() })
          .ilike('field', current.name);
      }
    }
  } catch (err) {
    console.warn('[DOMAINS API] Supabase update note:', err.message);
  }

  // Update in db.json
  const db = readDb();
  if (!Array.isArray(db.domains)) db.domains = existing;
  const idx = db.domains.findIndex((d) => d.id === id);
  if (idx >= 0) {
    db.domains[idx] = { ...db.domains[idx], ...patch };
    updatedDomain = db.domains[idx];
  } else if (!updatedDomain) {
    updatedDomain = { ...current, ...patch };
  }

  // Update local experts if renamed
  if (trimmed && trimmed !== current.name && Array.isArray(db.experts)) {
    db.experts.forEach((exp) => {
      if (exp.domain_id === id || (exp.field && exp.field.toLowerCase() === current.name.toLowerCase())) {
        exp.field = trimmed;
        exp.domain_id = id;
      }
    });
  }

  if (!db.kv) db.kv = {};
  db.kv.app_expertise_fields = db.domains.filter(d => d.is_active).map(d => d.name);
  writeDb(db);

  return updatedDomain;
}

export async function removeDomain(id, reassignDomainId) {
  const existing = await fetchLiveDomains();
  const target = existing.find((d) => d.id === id);
  if (!target) {
    throw new Error('Domain not found');
  }

  // Count tagged experts
  let taggedExperts = [];
  try {
    let { data, error } = await supabase
      .from('experts')
      .select('id, name, field, domain_id');

    if (error && error.message?.includes('domain_id')) {
      const res = await supabase.from('experts').select('id, name, field');
      data = res.data;
    }

    if (Array.isArray(data) && data.length > 0) {
      taggedExperts = data.filter(
        (e) => (e.domain_id && e.domain_id === id) || (e.field && e.field.trim().toLowerCase() === target.name.trim().toLowerCase())
      );
    } else {
      const db = readDb();
      taggedExperts = (db.experts || []).filter(
        (e) => (e.domain_id && e.domain_id === id) || (e.field && e.field.trim().toLowerCase() === target.name.trim().toLowerCase())
      );
    }
  } catch {
    const db = readDb();
    taggedExperts = (db.experts || []).filter(
      (e) => (e.domain_id && e.domain_id === id) || (e.field && e.field.trim().toLowerCase() === target.name.trim().toLowerCase())
    );
  }

  if (taggedExperts.length > 0 && !reassignDomainId) {
    throw new Error(`Cannot delete domain: ${taggedExperts.length} expert(s) are currently tagged. Please reassign them first.`);
  }

  // Reassign experts if needed
  if (taggedExperts.length > 0 && reassignDomainId) {
    const destDomain = existing.find((d) => d.id === reassignDomainId);
    if (!destDomain) {
      throw new Error('Reassignment destination domain not found');
    }

    try {
      // Reassign by domain_id
      await supabase
        .from('experts')
        .update({ domain_id: destDomain.id, field: destDomain.name, updated_at: new Date().toISOString() })
        .eq('domain_id', id);

      // Reassign by legacy field string
      await supabase
        .from('experts')
        .update({ domain_id: destDomain.id, field: destDomain.name, updated_at: new Date().toISOString() })
        .ilike('field', target.name);
    } catch (err) {
      console.warn('[DOMAINS API] Reassigning experts in Supabase note:', err.message);
    }

    // Reassign in db.json
    const db = readDb();
    if (Array.isArray(db.experts)) {
      db.experts.forEach((exp) => {
        if (exp.domain_id === id || (exp.field && exp.field.toLowerCase() === target.name.toLowerCase())) {
          exp.domain_id = destDomain.id;
          exp.field = destDomain.name;
        }
      });
    }
    writeDb(db);
  }

  // Delete from Supabase
  try {
    await supabase.from('domains').delete().eq('id', id);
  } catch (err) {
    console.warn('[DOMAINS API] Delete from Supabase note:', err.message);
  }

  // Delete from db.json
  const db = readDb();
  if (Array.isArray(db.domains)) {
    db.domains = db.domains.filter((d) => d.id !== id);
  }
  if (!db.kv) db.kv = {};
  db.kv.app_expertise_fields = (db.domains || []).filter(d => d.is_active).map(d => d.name);
  writeDb(db);

  return { success: true, deletedId: id, reassignedCount: taggedExperts.length };
}

export async function resetCanonicalDomains() {
  const existing = await fetchLiveDomains();

  // Insert or activate canonical defaults in Supabase
  for (const def of CANONICAL_DOMAINS) {
    try {
      await supabase
        .from('domains')
        .upsert({
          name: def.name,
          slug: def.slug,
          color: def.color,
          sort_order: def.sort_order,
          is_active: true
        }, { onConflict: 'name' });
    } catch (err) {
      console.warn('[DOMAINS RESET] Supabase default upsert note:', err.message);
    }
  }

  // Update in db.json
  const db = readDb();
  const resetList = CANONICAL_DOMAINS.map((d, idx) => ({
    id: `dom-${idx + 1}`,
    name: d.name,
    slug: d.slug,
    color: d.color,
    sort_order: d.sort_order,
    is_active: true,
    created_at: new Date().toISOString()
  }));
  db.domains = resetList;
  if (!db.kv) db.kv = {};
  db.kv.app_expertise_fields = CANONICAL_DOMAINS.map(d => d.name);
  writeDb(db);

  return fetchLiveDomains();
}

async function readRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

function sendJsonResponse(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export async function handleDomainApiMiddleware(req, res, next) {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (!pathname.startsWith('/api/domains')) {
    if (next) next();
    return;
  }

  try {
    // 1. GET /api/domains
    if (req.method === 'GET' && (pathname === '/api/domains' || pathname === '/api/domains/')) {
      const domains = await fetchLiveDomains();
      sendJsonResponse(res, 200, domains);
      return;
    }

    // 2. POST /api/domains/reset
    if (req.method === 'POST' && pathname === '/api/domains/reset') {
      const reset = await resetCanonicalDomains();
      sendJsonResponse(res, 200, { success: true, message: 'Reset to default canonical domains', domains: reset });
      return;
    }

    // 3. POST /api/domains
    if (req.method === 'POST' && (pathname === '/api/domains' || pathname === '/api/domains/')) {
      const body = await readRequestBody(req);
      const created = await createDomain(body.name, body.color);
      sendJsonResponse(res, 201, { success: true, message: 'Domain created', domain: created });
      return;
    }

    // 4. PUT /api/domains/:id
    const putMatch = pathname.match(/^\/api\/domains\/([^/]+)$/);
    if (req.method === 'PUT' && putMatch) {
      const id = putMatch[1];
      const body = await readRequestBody(req);
      const updated = await updateDomain(id, body);
      sendJsonResponse(res, 200, { success: true, message: 'Domain updated', domain: updated });
      return;
    }

    // 5. DELETE /api/domains/:id
    const delMatch = pathname.match(/^\/api\/domains\/([^/]+)$/);
    if (req.method === 'DELETE' && delMatch) {
      const id = delMatch[1];
      const body = await readRequestBody(req);
      // query param fallback for reassignDomainId
      const parsedUrl = new URL(url, 'http://localhost:5173');
      const reassignId = body.reassignDomainId || parsedUrl.searchParams.get('reassignDomainId') || undefined;
      const result = await removeDomain(id, reassignId);
      sendJsonResponse(res, 200, result);
      return;
    }

    sendJsonResponse(res, 404, { success: false, error: 'Endpoint not found' });
  } catch (err) {
    sendJsonResponse(res, 400, { success: false, error: err.message, message: err.message });
  }
}

