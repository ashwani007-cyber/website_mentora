import { fail, readJsonBody, unwrap } from './workflowHttp.js';
import { randomUUID } from 'node:crypto';
import { supabase } from './supabaseClient.js';
import { isAuthorizedAdmin } from './session.js';

const publicPath = '/api/blogs';
const adminPath = '/api/admin/blogs';
const mediaPrefix = 'storage://site-media/';
const media = () => supabase.storage.from('site-media');
const clean = (value) => typeof value === 'string' ? value.trim() : '';
const slugOf = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const validId = (value) => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);


function present(row, covers) {
  const metadata = row.editor_metadata || {};
  const coverImage = row.cover_image_url?.startsWith(mediaPrefix) ? covers.get(row.cover_image_url.slice(mediaPrefix.length)) || '' : row.cover_image_url || '';
  return {
    ...metadata, id: row.id, title: row.title, slug: row.slug, category: row.category, excerpt: row.excerpt || '',
    summary: row.excerpt || '', content: row.content, coverImage, image: coverImage,
    authorName: row.author_name, author: metadata.author || { name: row.author_name || 'Mentora Editorial Team' },
    type: metadata.type || 'article', readTime: metadata.readTime || '5 min read',
    status: row.is_published ? 'published' : 'draft', featured: row.featured, displayOrder: row.display_order,
    publishedAt: row.published_at, date: metadata.date || row.published_at?.slice(0, 10), createdAt: row.created_at, updatedAt: row.updated_at
  };
}

async function display(rows) {
  const paths = [...new Set(rows.map(row => row.cover_image_url).filter(url => url?.startsWith(mediaPrefix)).map(url => url.slice(mediaPrefix.length)))];
  const covers = new Map();
  if (paths.length) {
    const { data } = await media().createSignedUrls(paths, 900);
    for (const cover of data || []) if (cover.signedUrl) covers.set(cover.path, cover.signedUrl);
  }
  return rows.map(row => present(row, covers));
}

async function listCategories() {
  return unwrap(await supabase.from('blog_categories').select('id, name, slug, description, created_at').order('name'));
}

function count(rows, categories) {
  return { total: rows.length, published: rows.filter(row => row.is_published).length, drafts: rows.filter(row => !row.is_published).length,
    featured: rows.filter(row => row.featured).length, categories: categories.length };
}

function filter(rows, query) {
  const search = clean(query.get('search')).toLowerCase();
  const status = query.get('status');
  const type = query.get('type');
  const category = query.get('category');
  const featured = query.get('featured');
  return rows.filter(row => {
    if (status && status !== 'all' && row.is_published !== (status === 'published')) return false;
    if (type && type !== 'all' && (row.editor_metadata?.type || 'article') !== type) return false;
    if (category && category.toLowerCase() !== 'all' && row.category !== category) return false;
    if ((featured === 'featured' || featured === 'true') && !row.featured) return false;
    if ((featured === 'unfeatured' || featured === 'false') && row.featured) return false;
    return !search || [row.title, row.slug, row.author_name, row.category, row.excerpt, row.content]
      .filter(Boolean).some(value => value.toLowerCase().includes(search));
  });
}

async function readBlogList(admin, query) {
  let request = supabase.from('blogs').select('*').order('display_order').order('published_at', { ascending: false }).order('id');
  if (!admin) request = request.eq('is_published', true);
  const [rows, categories] = await Promise.all([request.then(unwrap), listCategories()]);
  const managed = !admin && !rows.length ? unwrap(await supabase.from('blogs').select('id').limit(1)) : [];
  return { articles: await display(filter(rows, query)), categories,
    ...(admin ? { stats: count(rows, categories) } : { seedFallback: !rows.length && !managed.length }) };
}

async function publicBlog(slug) {
  const row = unwrap(await supabase.from('blogs').select('*').eq('slug', slug).maybeSingle());
  if (row && !row.is_published) return { missing: true, managed: true };
  if (!row) return { missing: true };
  const related = unwrap(await supabase.from('blogs').select('*').eq('is_published', true).eq('category', row.category)
    .neq('id', row.id).order('published_at', { ascending: false }).limit(3));
  const [article, ...relatedArticles] = await display([row, ...related]);
  return { article, relatedArticles };
}

async function saveCover(value, previous, id) {
  const input = clean(value);
  if (!input) return null;
  const original = previous?.cover_image_url;
  if (original?.startsWith(mediaPrefix) && input.includes(`/site-media/${original.slice(mediaPrefix.length)}?`)) return original;
  if (/^https?:\/\//i.test(input) || /^\/(?!\/)/.test(input)) return input;
  const encoded = input.match(/^data:(image\/(?:png|jpeg|webp|gif|avif));base64,([a-z0-9+/]+={0,2})$/i);
  if (!encoded) fail(400, 'Use a supported image file or an image URL');
  const bytes = Buffer.from(encoded[2], 'base64');
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) fail(413, 'Cover images must be 5 MB or less');
  const path = `blog-covers/${id}/${randomUUID()}.${encoded[1].slice(6)}`;
  unwrap(await media().upload(path, bytes, { contentType: encoded[1] }));
  return mediaPrefix + path;
}

async function saveBlog(previous, input) {
  if (!input || typeof input !== 'object') fail(400, 'Article fields are required');
  const id = previous?.id || randomUUID();
  const title = clean(input.title ?? previous?.title);
  const slug = slugOf(input.slug ?? previous?.slug);
  const category = clean(input.category ?? previous?.category);
  const content = clean(input.content ?? previous?.content);
  const excerpt = clean(input.excerpt ?? input.summary ?? previous?.excerpt);
  if (!title || !slug || !category || (!content && !excerpt)) fail(400, 'Title, slug, category and content or excerpt are required');
  const editor = { ...previous?.editor_metadata };
  for (const key of ['type', 'author', 'authorRole', 'readTime', 'date', 'keywords', 'keyTakeaways', 'sections']) if (key in input) editor[key] = input[key];
  const published = input.status ? input.status === 'published' : Boolean(previous?.is_published);
  const coverProvided = 'coverImage' in input || 'image' in input;
  const cover = coverProvided ? await saveCover(input.coverImage ?? input.image, previous, id) : previous?.cover_image_url;
  const update = { id, title, slug, category, content, excerpt, editor_metadata: editor,
    author_name: clean(input.authorName ?? input.author?.name ?? previous?.author_name), cover_image_url: cover,
    is_published: published, featured: typeof input.featured === 'boolean' ? input.featured : Boolean(previous?.featured),
    display_order: Number.isSafeInteger(input.displayOrder) ? input.displayOrder : (previous?.display_order ?? 1),
    published_at: published ? (previous?.published_at || new Date().toISOString()) : null, updated_at: new Date().toISOString() };
  const result = previous ? await supabase.from('blogs').update(update).eq('id', id).select().single()
    : await supabase.from('blogs').insert(update).select().single();
  if (result.error?.code && cover?.startsWith(mediaPrefix) && cover !== previous?.cover_image_url) {
    await media().remove([cover.slice(mediaPrefix.length)]).catch(() => {});
  }
  return (await display([unwrap(result)]))[0];
}

export async function handleBlogs(req, res, next) {
  const url = new URL(req.originalUrl || req.url || '/', 'http://localhost');
  const pathname = url.pathname.replace(/\/$/, '');
  const admin = pathname === adminPath || pathname.startsWith(`${adminPath}/`);
  if (!admin && pathname !== publicPath && !pathname.startsWith(`${publicPath}/`)) return next();
  const method = req.method;
  let status = 200;
  let payload;
  try {
    const [part, action] = pathname.slice((admin ? adminPath : publicPath).length + 1).split('/').map(decodeURIComponent);
    if (admin && !await isAuthorizedAdmin(req)) fail(403, 'Administrator session required');
    if (!admin && method !== 'GET') fail(405, 'Method not allowed');
    if (method === 'GET') {
      if (!part) payload = await readBlogList(admin, url.searchParams);
      else if (part === 'categories') payload = { categories: await listCategories() };
      else if (admin && part === 'stats') payload = { stats: (await readBlogList(true, new URLSearchParams())).stats };
      else if (!admin) {
        payload = await publicBlog(part);
        if (payload.missing) status = 404;
      } else fail(404, 'Blog endpoint not found');
    } else if (part === 'categories') {
      const input = await readJsonBody(req, 8 * 1024 * 1024);
      if (method === 'POST' && !action) {
        const name = clean(input?.name);
        const slug = slugOf(input?.slug || name);
        if (!name || !slug) fail(400, 'Enter a valid category name');
        const row = unwrap(await supabase.from('blog_categories').insert({ name, slug, description: clean(input.description) }).select().single());
        payload = { category: row };
      } else if (method === 'DELETE' && validId(action)) {
        unwrap(await supabase.rpc('mentora_delete_blog_category', { p_id: action, p_force: input?.force === true || url.searchParams.get('force') === 'true' }));
      } else fail(404, 'Category endpoint not found');
    } else if (part === 'reorder' && method === 'POST') {
      const input = await readJsonBody(req, 8 * 1024 * 1024);
      const ids = input?.ids;
      if (!Array.isArray(ids) || !ids.length || ids.length !== new Set(ids).size || !ids.every(validId)) fail(400, 'Send unique article IDs in the desired order');
      unwrap(await supabase.rpc('mentora_reorder_blogs', { p_ids: ids }));
    } else if (!part && method === 'POST') {
      payload = { article: await saveBlog(null, await readJsonBody(req, 8 * 1024 * 1024)), message: 'Article saved.' };
      status = 201;
    } else if (validId(part)) {
      const previous = unwrap(await supabase.from('blogs').select('*').eq('id', part).maybeSingle());
      if (!previous) fail(404, 'Article not found');
      if (method === 'DELETE' && !action) unwrap(await supabase.from('blogs').delete().eq('id', part));
      else if (['PUT', 'PATCH'].includes(method) && !action) payload = { article: await saveBlog(previous, await readJsonBody(req, 8 * 1024 * 1024)) };
      else if (method === 'POST' && ['publish', 'unpublish', 'feature'].includes(action)) {
        const input = await readJsonBody(req, 8 * 1024 * 1024);
        payload = { article: await saveBlog(previous, action === 'feature' ? { featured: input?.featured ?? !previous.featured }
          : { status: action === 'publish' ? 'published' : 'draft' }) };
      } else fail(405, 'Method not allowed');
    } else fail(404, 'Blog endpoint not found');
    payload = { success: status < 400, ...payload };
  } catch (error) {
    status = error.status || (error instanceof URIError ? 400 : 0) || Number(/^PT(4\d\d)$/.exec(error.code || '')?.[1]) || ({ '23505': 409, P0002: 404 }[error.code]) || 503;
    if (status >= 500) console.error('[blogs]', error.code || error.name);
    payload = { success: false, error: status >= 500 ? 'Blog service unavailable' : (error.code === '23505' ? 'That slug already exists' : error.message) };
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}
