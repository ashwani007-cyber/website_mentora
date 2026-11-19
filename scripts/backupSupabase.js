#!/usr/bin/env node
/**
 * scripts/backupSupabase.js — READ-ONLY backup of your Supabase data.
 * ---------------------------------------------------------------------------------------------
 * What it saves (into ./backups/<date-time>/, which is git-ignored):
 *   tables/<table>.json   every row of every table in the `public` schema (read in pages of 1000)
 *   storage/<bucket>/…    every file in every Storage bucket
 *   manifest.json         row counts, file counts and sizes, so you can check the backup is complete
 *
 * It never writes, updates or deletes anything in Supabase. It does NOT copy the database
 * structure (functions, policies, triggers) — use `npx supabase db dump` for that.
 *
 * Run:  node scripts/backupSupabase.js
 * Needs SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.
 * ---------------------------------------------------------------------------------------------
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../server/supabaseClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const OUT = path.join(ROOT, 'backups', `supabase-${stamp}`);
const PAGE = 1000;

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Table names come from PostgREST's own description of the API (read-only). */
async function listTables() {
  const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`Could not list tables (HTTP ${res.status})`);
  const spec = await res.json();
  return Object.keys(spec.definitions || {}).sort();
}

async function backupTable(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  const file = path.join(OUT, 'tables', `${table}.json`);
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
  return { rows: rows.length, bytes: fs.statSync(file).size };
}

/** Lists every file in a bucket, walking into folders. */
async function listAllFiles(bucket, prefix = '') {
  const files = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) files.push(...(await listAllFiles(bucket, full))); // folder
      else files.push(full);
    }
    if (data.length < 100) break;
  }
  return files;
}

async function backupBucket(bucket) {
  const files = await listAllFiles(bucket);
  let bytes = 0;
  const failed = [];
  for (const f of files) {
    const { data, error } = await supabase.storage.from(bucket).download(f);
    if (error) {
      failed.push(`${f}: ${error.message}`);
      continue;
    }
    const buf = Buffer.from(await data.arrayBuffer());
    const dest = path.join(OUT, 'storage', bucket, ...f.split('/'));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    bytes += buf.length;
  }
  return { files: files.length, saved: files.length - failed.length, bytes, failed };
}

async function main() {
  fs.mkdirSync(path.join(OUT, 'tables'), { recursive: true });
  const manifest = { createdAt: new Date().toISOString(), project: new URL(url).host.split('.')[0], tables: {}, storage: {}, errors: [] };

  console.log('Backing up tables…');
  for (const t of await listTables()) {
    try {
      manifest.tables[t] = await backupTable(t);
      console.log(`  ✓ ${t.padEnd(28)} ${String(manifest.tables[t].rows).padStart(5)} rows  ${(manifest.tables[t].bytes / 1024).toFixed(1)} KB`);
    } catch (err) {
      manifest.errors.push(err.message);
      console.log(`  ✗ ${t}: ${err.message}`);
    }
  }

  console.log('Backing up Storage…');
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) manifest.errors.push(`listBuckets: ${error.message}`);
  for (const b of buckets || []) {
    try {
      manifest.storage[b.name] = { public: b.public, ...(await backupBucket(b.name)) };
      const s = manifest.storage[b.name];
      console.log(`  ✓ ${b.name.padEnd(28)} ${s.saved}/${s.files} files  ${(s.bytes / 1024).toFixed(1)} KB${s.failed.length ? `  (${s.failed.length} failed)` : ''}`);
    } catch (err) {
      manifest.errors.push(err.message);
      console.log(`  ✗ ${b.name}: ${err.message}`);
    }
  }

  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nBackup folder: ${path.relative(ROOT, OUT)}`);
  console.log(manifest.errors.length ? `Finished with ${manifest.errors.length} error(s) — see manifest.json` : 'Finished with no errors.');
}

main().catch((err) => {
  console.error('Backup failed:', err.message);
  process.exit(1);
});
