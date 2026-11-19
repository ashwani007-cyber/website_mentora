#!/usr/bin/env node
/**
 * scripts/migrateBase64ToStorage.js
 * ---------------------------------------------------------------------------------------------
 * Moves files that are stored as base64 TEXT inside the `experts` table into Supabase Storage,
 * and replaces them in the row with a short storage path / URL.
 *
 *   experts.documents.*.fileData / url = "data:application/pdf;base64,…"  → bucket "expert-documents" (PRIVATE)
 *                                                                           row keeps: filePath + file_path
 *   experts.img = "data:image/png;base64,…"                               → bucket "avatars" (PUBLIC, CDN cached)
 *                                                                           row keeps: the public https URL
 *
 * WHY: those blobs made every expert-list download hundreds of KB (the main cause of the
 * 16.94 GB egress). After this script, each expert row is ~1–2 KB.
 *
 * SAFE + REVERSIBLE:
 *   1. Default is a DRY RUN: it only prints what it would do. Nothing is changed.
 *   2. With --apply it FIRST writes a full JSON backup of every affected row to ./backups/
 *      (git-ignored), THEN uploads files, THEN updates each row (only `documents` / `img`).
 *      A row is only updated if it was not changed by someone else meanwhile (updated_at check).
 *   3. --restore <backup-file> puts the original `documents` / `img` values back exactly.
 *      (Uploaded storage files are left in place; they are harmless.)
 *
 * HOW TO RUN (from the project folder, with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env):
 *   node scripts/migrateBase64ToStorage.js                      # dry run (report only)
 *   node scripts/migrateBase64ToStorage.js --apply              # backup + migrate
 *   node scripts/migrateBase64ToStorage.js --restore backups/experts-base64-backup-XXXX.json
 * ---------------------------------------------------------------------------------------------
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../server/supabaseClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT, 'backups');
const DOC_BUCKET = 'expert-documents';
const AVATAR_BUCKET = 'avatars';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const restoreIdx = args.indexOf('--restore');
const RESTORE_FILE = restoreIdx >= 0 ? args[restoreIdx + 1] : null;

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const isDataUrl = (v) => typeof v === 'string' && v.startsWith('data:');

function parseDataUrl(v) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(v);
  if (!m) return null;
  const mime = m[1] || 'application/octet-stream';
  const buffer = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
  return { mime, buffer };
}

const EXT = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' };
const cleanName = (s) => String(s || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);

async function ensureBucket(name, isPublic) {
  const { data } = await supabase.storage.getBucket(name);
  if (data) return;
  const { error } = await supabase.storage.createBucket(name, { public: isPublic });
  if (error && !/already exists/i.test(error.message || '')) throw error;
  console.log(`  created bucket "${name}" (${isPublic ? 'public' : 'private'})`);
}

/**
 * Walks experts.documents and returns a list of { holder, key, field, dataUrl, label }
 * for every inline blob. `holder` is the object that contains the blob.
 */
function findDocumentBlobs(documents) {
  const found = [];
  if (!documents || typeof documents !== 'object') return found;
  const visit = (obj, label) => {
    if (!obj || typeof obj !== 'object') return;
    for (const field of ['fileData', 'file_data', 'url', 'data', 'base64']) {
      if (isDataUrl(obj[field])) found.push({ holder: obj, field, dataUrl: obj[field], label, name: obj.fileName || obj.file_name || obj.title || label });
    }
  };
  for (const [key, value] of Object.entries(documents)) {
    if (key === 'items' && value && typeof value === 'object') {
      for (const [ik, iv] of Object.entries(value)) visit(iv, ik);
    } else {
      visit(value, key);
    }
  }
  return found;
}

async function restore(file) {
  const backup = JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
  console.log(`Restoring ${backup.rows.length} expert rows from ${file} …`);
  let ok = 0;
  for (const row of backup.rows) {
    const patch = { documents: row.documents };
    if ('img' in row) patch.img = row.img;
    const { error } = await supabase.from('experts').update(patch).eq('id', row.id);
    if (error) console.error(`  ✗ ${row.id}: ${error.message}`);
    else ok++;
  }
  console.log(`Done. Restored ${ok}/${backup.rows.length} rows.`);
}

async function main() {
  if (RESTORE_FILE) return restore(RESTORE_FILE);

  console.log(APPLY ? '=== APPLY MODE: backup → upload → update ===' : '=== DRY RUN (nothing will be changed). Use --apply to migrate. ===');

  const { data: experts, error } = await supabase.from('experts').select('*');
  if (error) throw error;

  const plan = [];
  let totalBefore = 0;
  let totalAfter = 0;
  for (const e of experts) {
    const docsClone = e.documents ? JSON.parse(JSON.stringify(e.documents)) : null;
    const blobs = findDocumentBlobs(docsClone);
    const imgBlob = isDataUrl(e.img) ? e.img : null;
    const before = Buffer.byteLength(JSON.stringify(e));
    totalBefore += before;
    if (blobs.length === 0 && !imgBlob) {
      totalAfter += before;
      continue;
    }
    const blobBytes = blobs.reduce((n, b) => n + b.dataUrl.length, 0) + (imgBlob ? imgBlob.length : 0);
    totalAfter += before - blobBytes;
    plan.push({ expert: e, docsClone, blobs, imgBlob, before, blobBytes });
  }

  console.log(`\nExperts scanned: ${experts.length}. Rows with inline files: ${plan.length}.`);
  for (const p of plan) {
    console.log(`  • ${p.expert.id} (${p.expert.email || p.expert.name}): ${p.blobs.length} document blob(s)${p.imgBlob ? ' + base64 photo' : ''}, row ${kb(p.before)} → ~${kb(p.before - p.blobBytes)}`);
  }
  console.log(`\nWhole experts table: ${kb(totalBefore)} → ~${kb(totalAfter)} per full download.`);

  if (!APPLY || plan.length === 0) {
    if (!APPLY) console.log('\nDry run finished. Re-run with --apply to migrate (a backup is written first).');
    return;
  }

  // 1) BACKUP FIRST
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backupFile = path.join(BACKUP_DIR, `experts-base64-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify({ createdAt: new Date().toISOString(), rows: plan.map((p) => ({ id: p.expert.id, updated_at: p.expert.updated_at, documents: p.expert.documents, ...('img' in p.expert ? { img: p.expert.img } : {}) })) }, null, 2)
  );
  console.log(`\nBackup written: ${path.relative(ROOT, backupFile)}  (keep it until you've checked everything)`);

  await ensureBucket(DOC_BUCKET, false);
  await ensureBucket(AVATAR_BUCKET, true);

  // 2) UPLOAD + 3) UPDATE, one expert at a time
  let migrated = 0;
  for (const p of plan) {
    const id = p.expert.id;
    try {
      const uploadedByDataUrl = new Map(); // same file stored twice (fileData + url) → upload once
      for (const b of p.blobs) {
        let storagePath = uploadedByDataUrl.get(b.dataUrl);
        if (!storagePath) {
          const parsed = parseDataUrl(b.dataUrl);
          if (!parsed) throw new Error(`could not parse data URL in ${b.label}.${b.field}`);
          const ext = EXT[parsed.mime] || 'bin';
          const base = cleanName(String(b.name).replace(/\.[a-z0-9]+$/i, ''));
          storagePath = `${cleanName(id)}/${cleanName(b.label)}/migrated_${Date.now()}_${base}.${ext}`;
          const { error: upErr } = await supabase.storage.from(DOC_BUCKET).upload(storagePath, parsed.buffer, {
            contentType: parsed.mime,
            cacheControl: '31536000',
            upsert: false
          });
          if (upErr) throw upErr;
          uploadedByDataUrl.set(b.dataUrl, storagePath);
        }
        delete b.holder[b.field];
        b.holder.filePath = storagePath; // what the document viewer reads
        b.holder.file_path = storagePath;
        b.holder.storageBucket = DOC_BUCKET;
      }

      const patch = { documents: p.docsClone };
      if (p.imgBlob) {
        const parsed = parseDataUrl(p.imgBlob);
        if (!parsed) throw new Error('could not parse img data URL');
        const imgPath = `${cleanName(id)}/migrated_${Date.now()}.${EXT[parsed.mime] || 'png'}`;
        const { error: imgErr } = await supabase.storage.from(AVATAR_BUCKET).upload(imgPath, parsed.buffer, {
          contentType: parsed.mime,
          cacheControl: '31536000',
          upsert: false
        });
        if (imgErr) throw imgErr;
        patch.img = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(imgPath).data.publicUrl;
      }

      // Only update if nobody changed the row since we read it.
      let q = supabase.from('experts').update(patch).eq('id', id);
      if (p.expert.updated_at) q = q.eq('updated_at', p.expert.updated_at);
      const { data: updated, error: updErr } = await q.select('id');
      if (updErr) throw updErr;
      if (!updated || updated.length === 0) {
        console.warn(`  ! ${id}: row changed while migrating — skipped (run the script again).`);
        continue;
      }
      migrated++;
      console.log(`  ✓ ${id}: moved ${p.blobs.length} blob(s)${p.imgBlob ? ' + photo' : ''} to Storage`);
    } catch (err) {
      console.error(`  ✗ ${id}: ${err.message} — row left unchanged`);
    }
  }
  console.log(`\nDone. Migrated ${migrated}/${plan.length} rows. Backup: ${path.relative(ROOT, backupFile)}`);
  console.log('Next: open the admin KYC desk and an expert profile, view a document and a photo to confirm.');
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
