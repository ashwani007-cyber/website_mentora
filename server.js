// Express + Supabase Server for Mentora Platform
// Run with: node server.js

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { supabase } from './server/supabaseClient.js';
import {
  COLUMNS,
  PROJECT_REVIEW_PAGE_SIZE,
  withCamelAliases,
  isMissingFunction,
  clampInt,
  clearMemo,
  fetchExpertsSlim,
  fetchExpertByKeySlim,
  fetchUnverifiedExpertsSlim,
  getWalletBalance,
  getWalletHistory,
  applyWalletTransaction,
  uploadAvatarFromDataUrl
} from './server/egressHelpers.js';
import { handleApiMiddleware } from './server/authHandler.js';
import { handleDomainApiMiddleware } from './server/domainHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[server] Unhandled Rejection:', reason);
});

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.raw({ type: ['application/pdf', 'application/octet-stream'], limit: '20mb' }));

// Gracefully handle malformed JSON bodies
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, error: 'Malformed JSON payload' });
  }
  next(err);
});

// After any write request (POST/PUT/PATCH/DELETE) finishes, drop the short server-side read
// cache so the next read returns the freshly saved data (see server/egressHelpers.js).
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') res.on('finish', () => clearMemo());
  next();
});

// Compressed profile photos → public "avatars" bucket (CDN cached). Only the URL is stored in
// the database — never the image itself. The browser compresses to WebP first.
app.post('/api/uploads/avatar', async (req, res) => {
  try {
    const { ownerId, fileData, contentType } = req.body || {};
    const url = await uploadAvatarFromDataUrl({ ownerId, fileData, contentType });
    res.json({ success: true, url });
  } catch (err) {
    console.error('[uploads/avatar] failed:', err.message);
    res.status(err.status || 500).json({ success: false, error: err.message || 'Upload failed' });
  }
});

console.log('🚀 Starting Mentora Server with Supabase...');

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', async (req, res) => {
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;
    res.json({ success: true, message: 'Server is healthy', database: 'connected' });
  } catch (err) {
    res.status(200).json({ success: true, message: 'Server is healthy', database: 'local-fallback', warning: err.message });
  }
});

app.use('/api/auth', (req, res, next) => {
  req.url = `/api/auth${req.url === '/' ? '' : req.url}`;
  handleApiMiddleware(req, res, next);
});

app.use('/api/domains', (req, res, next) => {
  handleDomainApiMiddleware(req, res, next);
});

app.get('/api/db', (req, res) => {
  try {
    const dbPath = path.resolve(__dirname, 'db.json');
    if (fs.existsSync(dbPath)) {
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      return res.json(data);
    }
    res.json({ experts: [], users: [], bookings: [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// EXPERTS ENDPOINTS
// ============================================================

// Get All Experts
app.get('/api/experts', async (req, res) => {
  try {
    // Slim list (no base64 documents), cached for 10 s on the server.
    const experts = await fetchExpertsSlim();
    res.json(experts || []);
  } catch (err) {
    try {
      const dbPath = path.resolve(__dirname, 'db.json');
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      res.json(db.experts || []);
    } catch {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// Get Single Expert
app.get('/api/experts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const expert = await fetchExpertByKeySlim(id); // slim, no base64 documents
    if (!expert) return res.status(404).json({ success: false, error: 'Expert not found' });
    res.json(expert);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create Expert
app.post('/api/experts', async (req, res) => {
  try {
    const expertData = req.body;
    const { data: expert, error } = await supabase
      .from('experts')
      .insert(expertData)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, expert });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Expert Markup
app.post('/api/experts/markup', async (req, res) => {
  try {
    const { id, baseRate, adminMarkup } = req.body;
    const rate = baseRate + adminMarkup;

    const { data: expert, error } = await supabase
      .from('experts')
      .update({ base_rate: baseRate, admin_markup: adminMarkup, rate })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, expert });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: Check admin authorization for admin endpoints
function isAuthorizedAdmin(req) {
  const authHeader = req.headers['authorization'] || '';
  const adminToken = req.headers['x-admin-token'] || req.headers['admin_token'] || req.body?.adminToken || '';
  const adminId = req.headers['x-admin-id'] || req.body?.adminId || '';
  const role = req.headers['x-user-role'] || req.body?.role || req.body?.userRole || '';
  
  if (adminId === 'admin' || role === 'admin' || adminToken === 'admin-session-token') return true;
  if (authHeader.startsWith('Bearer ') && authHeader.length > 10) return true;
  if (typeof adminToken === 'string' && adminToken.length > 5) return true;
  return false;
}

// Helper: Normalize & Resolve Documents for an Expert
function resolveDocsForExpert(exp, db) {
  const dbDocs = (db?.expertDocuments && (db.expertDocuments[exp.id] || db.expertDocuments[exp.user_id])) || {};
  const expDocs = exp.documents || {};
  const items = expDocs.items || {};

  const workCert = dbDocs.work_experience_cert || expDocs.work_experience_cert || items.work_experience_cert || items.expCert || (typeof expDocs.expCert === 'object' ? expDocs.expCert : (expDocs.expCert ? { file_name: expDocs.expCert, fileName: expDocs.expCert } : null));
  const offerLetter = dbDocs.offer_relieving_letter || expDocs.offer_relieving_letter || items.offer_relieving_letter || items.offerLetter || (typeof expDocs.offerLetter === 'object' ? expDocs.offerLetter : (expDocs.offerLetter ? { file_name: expDocs.offerLetter, fileName: expDocs.offerLetter } : null));
  const execCv = dbDocs.executive_cv || expDocs.executive_cv || items.executive_cv || items.resume || (typeof expDocs.resume === 'object' ? expDocs.resume : (expDocs.resume ? { file_name: expDocs.resume, fileName: expDocs.resume } : null));

  const hasWorkCert = Boolean(workCert);
  const hasOfferLetter = Boolean(offerLetter);
  const hasCv = Boolean(execCv);
  const docCount = (hasWorkCert ? 1 : 0) + (hasOfferLetter ? 1 : 0) + (hasCv ? 1 : 0);

  return {
    documents: {
      work_experience_cert: workCert || null,
      offer_relieving_letter: offerLetter || null,
      executive_cv: execCv || null,
      expCert: workCert?.file_name || workCert?.fileName || (typeof expDocs.expCert === 'string' ? expDocs.expCert : null),
      offerLetter: offerLetter?.file_name || offerLetter?.fileName || (typeof expDocs.offerLetter === 'string' ? expDocs.offerLetter : null),
      resume: execCv?.file_name || execCv?.fileName || (typeof expDocs.resume === 'string' ? expDocs.resume : null),
      items: {
        work_experience_cert: workCert || null,
        offer_relieving_letter: offerLetter || null,
        executive_cv: execCv || null
      }
    },
    docCount,
    hasWorkCert,
    hasOfferLetter,
    hasCv
  };
}

// Helper: Determine accurate KYC status
function determineKycStatus(exp, docCount) {
  const kycStatus = exp.documents?.kyc_status || exp.kyc_status;
  const verStatus = exp.verificationStatus || exp.documents?.verificationStatus || exp.status;

  if (verStatus === 'rejected' || exp.status === 'Rejected' || kycStatus === 'Rejected' || exp.rejected === true) {
    return { status: 'Rejected', verificationStatus: 'rejected' };
  }
  if (verStatus === 'pending_resubmitted' || exp.status === 'Pending Review (Re-submitted)' || kycStatus === 'Pending Review (Re-submitted)') {
    return { status: 'Pending Review (Re-submitted)', verificationStatus: 'pending_resubmitted' };
  }
  if (docCount === 3 || exp.status === 'Pending Review' || kycStatus === 'Pending Review') {
    return { status: 'Pending Review', verificationStatus: 'pending' };
  }
  return { status: 'Registered / Documents Pending', verificationStatus: 'pending_docs' };
}

// Get Pending Verifications (for Admin Dashboard)
app.get('/api/admin/pending-verifications', async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required' });
    }

    const { status } = req.query;
    console.log('[ADMIN API] Fetching pending verifications, status filter:', status);

    const dbPath = path.resolve(__dirname, 'db.json');
    let db = { experts: [], pendingVerifications: [], expertDocuments: {} };
    if (fs.existsSync(dbPath)) {
      try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch {}
    }

    // 1. Fetch from Supabase experts table
    let supaList = [];
    try {
      // Only unverified experts, without base64 file data, cached 10 s (egress fix).
      const expRows = await fetchUnverifiedExpertsSlim();
      if (Array.isArray(expRows)) {
        supaList = expRows;
      }
    } catch (err) {
      console.warn('[ADMIN API] Supabase experts fetch note:', err.message);
    }

    // 2. Fetch from db.json
    const dbExperts = Array.isArray(db.experts) ? db.experts : [];
    const dbPending = Array.isArray(db.pendingVerifications) ? db.pendingVerifications : [];

    // Combine all unverified candidates
    const allCandidates = [];
    const seenMap = new Set();

    const addCandidate = (e) => {
      if (!e) return;
      if (e.verified === true || e.verificationStatus === 'approved' || e.status === 'Approved') return;
      const key = `${e.id || ''}::${(e.email || '').toLowerCase()}`;
      if (seenMap.has(key)) return;
      seenMap.add(key);
      allCandidates.push(e);
    };

    supaList.forEach(addCandidate);
    dbExperts.forEach(addCandidate);
    dbPending.forEach(addCandidate);

    // 3. Map candidates to standard audit queue card shape
    const resultList = allCandidates.map((exp) => {
      const { documents, docCount } = resolveDocsForExpert(exp, db);
      const { status: computedStatus, verificationStatus } = determineKycStatus(exp, docCount);

      return {
        id: exp.id,
        expertId: exp.id,
        user_id: exp.user_id || null,
        name: exp.name || exp.full_name || 'Senior Professional',
        email: exp.email || '',
        phone: exp.phone || '',
        field: exp.field || 'Strategic Leadership',
        company: exp.company || exp.documents?.company || 'Enterprise Firm',
        years: exp.years ?? exp.years_of_experience ?? 0,
        baseRate: exp.baseRate ?? exp.base_rate ?? 600,
        projectRate: exp.projectRate ?? exp.project_rate ?? 1000,
        bio: exp.bio || '',
        verified: false,
        status: computedStatus,
        verificationStatus,
        rejectionReason: exp.rejectionReason || exp.documents?.rejectionReason || null,
        submittedAt: exp.created_at || exp.submittedAt || new Date().toISOString(),
        documents
      };
    });

    // 4. Apply status filter if provided
    let filtered = resultList;
    if (status && status !== 'all') {
      filtered = resultList.filter((item) => {
        if (status === 'rejected') return item.status === 'Rejected';
        if (status === 'pending') return item.status === 'Pending Review' || item.status === 'Pending Review (Re-submitted)';
        if (status === 'missing_docs') return item.status === 'Registered / Documents Pending';
        return item.status.toLowerCase() === String(status).toLowerCase();
      });
    }

    res.json(filtered);
  } catch (err) {
    console.error('Error fetching pending verifications:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: Read and Write db.json
function readDb() {
  const dbPath = path.resolve(__dirname, 'db.json');
  if (fs.existsSync(dbPath)) {
    try {
      return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    } catch {}
  }
  return {};
}

function writeDb(data) {
  const dbPath = path.resolve(__dirname, 'db.json');
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
}

// UUID validation & safe PostgREST filters for Supabase
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(val) {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

function getExpertFilter(expertId, cleanEmail) {
  const parts = [];
  if (expertId) {
    parts.push(`id.eq.${expertId}`);
    if (isUuid(expertId)) {
      parts.push(`user_id.eq.${expertId}`);
    }
  }
  if (cleanEmail) {
    parts.push(`email.ilike.${cleanEmail}`);
  }
  return parts.join(',');
}

async function findSupabaseExpert(sbClient, expertId, email) {
  const cleanEmail = (email || '').toLowerCase().trim();
  const filter = getExpertFilter(expertId, cleanEmail);
  if (!filter) return null;
  // Single-expert lookup used before updates — needs documents to merge changes safely.
  const { data, error } = await sbClient.from('experts').select(COLUMNS.EXPERT_WITH_DOCUMENTS).or(filter).limit(5);
  if (error) {
    throw error;
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

// Helper: Execute Expert Approval
async function executeApproveExpert({ expertId, email, adminId = 'admin' }) {
  const cleanEmail = (email || '').toLowerCase().trim();

  // 1. Find expert in Supabase safely
  const matchedRow = await findSupabaseExpert(supabase, expertId, cleanEmail);
  if (!matchedRow) {
    throw new Error(`Expert "${expertId || cleanEmail}" not found in Supabase`);
  }

  const targetExpertId = matchedRow.id;
  const targetUserId = matchedRow.user_id;

  const updatedDocs = {
    ...(matchedRow.documents || {}),
    kyc_status: 'Verified',
    status: 'Approved',
    verificationStatus: 'approved',
    rejectionReason: null,
    reviewedAt: new Date().toISOString(),
    reviewedBy: adminId
  };

  // 2. Update Supabase experts table and verify affected rows
  const { data: updatedRows, error: updateErr } = await supabase
    .from('experts')
    .update({
      verified: true,
      documents: updatedDocs,
      updated_at: new Date().toISOString()
    })
    .eq('id', targetExpertId)
    .select();

  if (updateErr) {
    throw new Error(`Supabase approve failed: ${updateErr.message}`);
  }
  if (!updatedRows || updatedRows.length === 0) {
    throw new Error('Supabase approve affected 0 rows');
  }

  // 3. Update Supabase users table safely (only compare id against UUID)
  const userFilters = [];
  if (targetUserId && isUuid(targetUserId)) {
    userFilters.push(`id.eq.${targetUserId}`);
  } else if (expertId && isUuid(expertId)) {
    userFilters.push(`id.eq.${expertId}`);
  }
  if (cleanEmail) {
    userFilters.push(`email.ilike.${cleanEmail}`);
  }
  if (userFilters.length > 0) {
    try {
      await supabase.from('users').update({
        is_verified: true,
        updated_at: new Date().toISOString()
      }).or(userFilters.join(','));
    } catch {}
  }

  // 4. Send notification (notifications.user_id is text)
  const notifMsg = 'Your documents have been audited and your account has been verified by Admin. Your profile is now live and you are ready to take work.';
  try {
    await supabase.from('notifications').insert({
      user_id: targetUserId || targetExpertId,
      title: 'Credentials Approved & Profile Verified!',
      message: notifMsg,
      type: 'verification',
      is_read: false,
      created_at: new Date().toISOString()
    });
  } catch {}

  // 5. Broadcast realtime status update
  try {
    const ch = supabase.channel('admin-kyc-desk');
    await ch.send({
      type: 'broadcast',
      event: 'expert_status_changed',
      payload: {
        expertId: targetExpertId,
        email: cleanEmail,
        status: 'approved',
        verified: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch {}

  // 6. Only after Supabase succeeds, sync db.json
  const db = readDb();
  if (Array.isArray(db.experts)) {
    db.experts = db.experts.map(e => {
      if (e.id === expertId || e.id === targetExpertId || (cleanEmail && e.email?.toLowerCase() === cleanEmail)) {
        return {
          ...e,
          verified: true,
          verificationStatus: 'approved',
          status: 'Approved',
          rejected: false,
          rejectionReason: null,
          documents: {
            ...(e.documents || {}),
            kyc_status: 'Verified',
            status: 'Approved',
            verificationStatus: 'approved',
            rejectionReason: null
          }
        };
      }
      return e;
    });
  }

  if (Array.isArray(db.users)) {
    db.users = db.users.map(u => {
      if (u.id === expertId || u.id === targetUserId || (cleanEmail && u.email?.toLowerCase() === cleanEmail)) {
        return { ...u, verified: true, is_verified: true, verificationStatus: 'approved', rejected: false };
      }
      return u;
    });
  }

  if (Array.isArray(db.pendingVerifications)) {
    db.pendingVerifications = db.pendingVerifications.filter(p =>
      p.id !== expertId && p.id !== targetExpertId && (!cleanEmail || p.email?.toLowerCase() !== cleanEmail)
    );
  }

  writeDb(db);
  return { success: true, message: 'Expert approved successfully' };
}

// Helper: Execute Expert Rejection
async function executeRejectExpert({ expertId, email, reason, adminId = 'admin' }) {
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanReason = (reason || '').trim() || 'Your submission has been rejected because the uploaded documents were not valid. Please upload valid documents and re-apply.';

  // 1. Find expert in Supabase safely
  const matchedRow = await findSupabaseExpert(supabase, expertId, cleanEmail);
  if (!matchedRow) {
    throw new Error(`Expert "${expertId || cleanEmail}" not found in Supabase`);
  }

  const targetExpertId = matchedRow.id;
  const targetUserId = matchedRow.user_id;

  const updatedDocs = {
    ...(matchedRow.documents || {}),
    kyc_status: 'Rejected',
    status: 'Rejected',
    verificationStatus: 'rejected',
    rejectionReason: cleanReason,
    rejectedAt: new Date().toISOString(),
    rejectedBy: adminId
  };

  // 2. Update Supabase experts table and verify affected rows
  const { data: updatedRows, error: updateErr } = await supabase
    .from('experts')
    .update({
      verified: false,
      documents: updatedDocs,
      updated_at: new Date().toISOString()
    })
    .eq('id', targetExpertId)
    .select();

  if (updateErr) {
    throw new Error(`Supabase reject failed: ${updateErr.message}`);
  }
  if (!updatedRows || updatedRows.length === 0) {
    throw new Error('Supabase reject affected 0 rows');
  }

  // 3. Update Supabase users table safely (only compare id against UUID)
  const userFilters = [];
  if (targetUserId && isUuid(targetUserId)) {
    userFilters.push(`id.eq.${targetUserId}`);
  } else if (expertId && isUuid(expertId)) {
    userFilters.push(`id.eq.${expertId}`);
  }
  if (cleanEmail) {
    userFilters.push(`email.ilike.${cleanEmail}`);
  }
  if (userFilters.length > 0) {
    try {
      await supabase.from('users').update({
        is_verified: false,
        updated_at: new Date().toISOString()
      }).or(userFilters.join(','));
    } catch {}
  }

  // 4. Send notification
  const notifMsg = 'Your submission has been rejected because the uploaded documents were not valid. Please upload valid documents and re-apply.';
  try {
    await supabase.from('notifications').insert({
      user_id: targetUserId || targetExpertId,
      title: 'Credential Verification Rejected',
      message: notifMsg,
      type: 'kyc_rejection',
      is_read: false,
      created_at: new Date().toISOString()
    });
  } catch {}

  // 5. Broadcast realtime event
  try {
    const ch = supabase.channel('admin-kyc-desk');
    await ch.send({
      type: 'broadcast',
      event: 'expert_status_changed',
      payload: {
        expertId: targetExpertId,
        email: cleanEmail,
        status: 'Rejected',
        verificationStatus: 'rejected',
        isRejected: true,
        rejectionReason: cleanReason,
        timestamp: new Date().toISOString()
      }
    });
  } catch {}

  // 6. Only after Supabase succeeds, sync db.json
  const db = readDb();
  if (Array.isArray(db.experts)) {
    db.experts = db.experts.map(e => {
      if (e.id === expertId || e.id === targetExpertId || (cleanEmail && e.email?.toLowerCase() === cleanEmail)) {
        return {
          ...e,
          verified: false,
          verificationStatus: 'rejected',
          status: 'Rejected',
          rejected: true,
          rejectionReason: cleanReason,
          documents: {
            ...(e.documents || {}),
            kyc_status: 'Rejected',
            status: 'Rejected',
            verificationStatus: 'rejected',
            rejectionReason: cleanReason
          }
        };
      }
      return e;
    });
  }

  if (Array.isArray(db.pendingVerifications)) {
    db.pendingVerifications = db.pendingVerifications.map(p => {
      if (p.id === expertId || p.id === targetExpertId || (cleanEmail && p.email?.toLowerCase() === cleanEmail)) {
        return {
          ...p,
          status: 'Rejected',
          verificationStatus: 'rejected',
          rejected: true,
          rejectionReason: cleanReason
        };
      }
      return p;
    });
  }

  writeDb(db);
  return { success: true, message: 'Expert rejected and notified successfully' };
}

// Helper: Execute Expert Permanent Deletion
async function executePermanentDeleteExpert({ expertId, email }) {
  const cleanEmail = (email || '').toLowerCase().trim();

  // 1. Find expert in Supabase safely
  const matchedRow = await findSupabaseExpert(supabase, expertId, cleanEmail);
  if (!matchedRow) {
    throw new Error(`Expert "${expertId || cleanEmail}" not found in Supabase`);
  }

  const targetExpertId = matchedRow.id;
  const targetUserId = matchedRow.user_id;
  const targetEmail = (matchedRow.email || cleanEmail).toLowerCase().trim();

  // 2. Clean up files in Supabase Storage bucket 'expert-documents'
  const directPaths = new Set();
  const folderNames = new Set([expertId, targetExpertId, targetUserId].filter(Boolean));

  if (matchedRow.documents && typeof matchedRow.documents === 'object') {
    const items = matchedRow.documents.items || {};
    for (const item of Object.values(items)) {
      if (item && typeof item === 'object') {
        const p = item.filePath || item.file_path;
        if (typeof p === 'string' && p.trim()) {
          directPaths.add(p.trim());
          const folderPart = p.trim().split('/')[0];
          if (folderPart) folderNames.add(folderPart);
        }
        if (item.expert_id) folderNames.add(item.expert_id);
      }
    }
  }

  if (directPaths.size > 0) {
    try {
      await supabase.storage.from('expert-documents').remove(Array.from(directPaths));
    } catch {}
  }

  for (const folder of folderNames) {
    try {
      const { data: files } = await supabase.storage.from('expert-documents').list(folder);
      if (Array.isArray(files) && files.length > 0) {
        const paths = files.filter(f => f.name).map(f => `${folder}/${f.name}`);
        if (paths.length > 0) {
          await supabase.storage.from('expert-documents').remove(paths);
        }
      }
      for (const sub of ['work_experience_cert', 'offer_relieving_letter', 'executive_cv']) {
        const { data: subFiles } = await supabase.storage.from('expert-documents').list(`${folder}/${sub}`);
        if (Array.isArray(subFiles) && subFiles.length > 0) {
          const subPaths = subFiles.filter(f => f.name).map(f => `${folder}/${sub}/${f.name}`);
          if (subPaths.length > 0) {
            await supabase.storage.from('expert-documents').remove(subPaths);
          }
        }
      }
    } catch {}
  }

  // 3. Delete from expert_documents table if present (expert_id is text)
  try {
    const docFilters = [`expert_id.eq.${targetExpertId}`];
    if (expertId && expertId !== targetExpertId) docFilters.push(`expert_id.eq.${expertId}`);
    if (targetUserId) docFilters.push(`expert_id.eq.${targetUserId}`);
    await supabase.from('expert_documents').delete().or(docFilters.join(','));
  } catch {}

  // 4. Delete expert availability (expert_id is text)
  try {
    const availFilters = [`expert_id.eq.${targetExpertId}`];
    if (expertId && expertId !== targetExpertId) availFilters.push(`expert_id.eq.${expertId}`);
    await supabase.from('expert_availability').delete().or(availFilters.join(','));
  } catch {}

  // 5. Delete expert record from Supabase 'experts' table
  const { data: deletedRows, error: delErr } = await supabase
    .from('experts')
    .delete()
    .eq('id', targetExpertId)
    .select();

  if (delErr) {
    throw new Error(`Supabase delete failed: ${delErr.message}`);
  }
  if (!deletedRows || deletedRows.length === 0) {
    throw new Error('Supabase delete affected 0 rows');
  }

  // 6. Delete user and auth user safely
  if (targetUserId && isUuid(targetUserId)) {
    try {
      await supabase.from('users').delete().eq('id', targetUserId);
    } catch {}
    try {
      await supabase.auth.admin.deleteUser(targetUserId);
    } catch {}
  } else if (targetEmail) {
    try {
      await supabase.from('users').delete().ilike('email', targetEmail);
    } catch {}
  }

  // 7. Delete notifications
  const notifTargets = [targetExpertId, expertId, targetUserId, targetEmail].filter(Boolean);
  const notifFilters = notifTargets.map(t => `user_id.eq.${t}`).join(',');
  if (notifFilters) {
    try {
      await supabase.from('notifications').delete().or(notifFilters);
    } catch {}
  }

  // 8. Broadcast deletion
  try {
    const ch = supabase.channel('admin-kyc-desk');
    await ch.send({
      type: 'broadcast',
      event: 'expert_deleted',
      payload: { expertId: targetExpertId, email: targetEmail }
    });
  } catch {}

  // 9. Clean up db.json
  const db = readDb();
  if (Array.isArray(db.experts)) {
    db.experts = db.experts.filter(e => e.id !== expertId && e.id !== targetExpertId && (!targetEmail || e.email?.toLowerCase() !== targetEmail));
  }
  if (Array.isArray(db.users)) {
    db.users = db.users.filter(u => u.id !== expertId && u.id !== targetUserId && (!targetEmail || u.email?.toLowerCase() !== targetEmail));
  }
  if (Array.isArray(db.pendingVerifications)) {
    db.pendingVerifications = db.pendingVerifications.filter(p => p.id !== expertId && p.id !== targetExpertId && (!targetEmail || p.email?.toLowerCase() !== targetEmail));
  }
  if (db.expertDocuments) {
    delete db.expertDocuments[expertId];
    delete db.expertDocuments[targetExpertId];
    if (targetUserId) delete db.expertDocuments[targetUserId];
  }
  if (Array.isArray(db.availabilities)) {
    db.availabilities = db.availabilities.filter(a => a.expertId !== expertId && a.expertId !== targetExpertId);
  }

  writeDb(db);
  return { success: true, message: 'Expert permanently deleted from database and storage' };
}

// Admin Action: Approve Document / Approve Expert
app.post(['/api/admin/approve-document', '/api/admin/approve-expert'], async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required' });
    }
    const { expertId, email, adminId = 'admin' } = req.body;
    if (!expertId && !email) {
      return res.status(400).json({ success: false, error: 'expertId or email is required' });
    }

    const result = await executeApproveExpert({ expertId, email, adminId });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Action: Reject Document / Reject Expert
app.post(['/api/admin/reject-document', '/api/admin/reject-expert'], async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required' });
    }
    const { expertId, email, reason, adminId = 'admin' } = req.body;
    if (!expertId && !email) {
      return res.status(400).json({ success: false, error: 'expertId or email is required' });
    }

    const result = await executeRejectExpert({ expertId, email, reason, adminId });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Action: Permanently Delete Expert
app.post(['/api/admin/remove-expert', '/api/admin/delete-expert'], async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required' });
    }
    const { expertId, email } = req.body;
    if (!expertId && !email) {
      return res.status(400).json({ success: false, error: 'expertId or email is required' });
    }

    const result = await executePermanentDeleteExpert({ expertId, email });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Document Upload to Supabase Storage Bucket (handles binary streams, FormData & JSON)
app.post(['/api/expert-documents/upload', '/api/documents/upload'], async (req, res) => {
  try {
    let expertId = req.headers['x-expert-id'] || req.body?.expertId;
    let docType = req.headers['x-doc-type'] || req.body?.docType || req.body?.documentType;
    let fileName = req.headers['x-file-name'] ? decodeURIComponent(req.headers['x-file-name']) : req.body?.fileName;
    let oldFilePath = req.headers['x-old-file-path'] ? decodeURIComponent(req.headers['x-old-file-path']) : req.body?.oldFilePath;
    let buffer = null;

    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (req.body?.fileData) {
      const fileData = req.body.fileData;
      if (fileData.startsWith('data:')) {
        const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        buffer = Buffer.from(matches ? matches[2] : fileData, 'base64');
      } else {
        buffer = Buffer.from(fileData, 'base64');
      }
    }

    if (!expertId || !docType || !buffer || buffer.length === 0) {
      return res.status(400).json({ success: false, error: 'expertId, docType, and valid PDF buffer are required' });
    }

    const typeMap = {
      expCert: 'work_experience_cert',
      offerLetter: 'offer_relieving_letter',
      resume: 'executive_cv',
      work_experience_cert: 'work_experience_cert',
      offer_relieving_letter: 'offer_relieving_letter',
      executive_cv: 'executive_cv'
    };
    const targetDocType = typeMap[docType] || docType;
    const timestamp = Date.now();
    const sanitizedName = (fileName || `${targetDocType}.pdf`)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.pdf$/i, '');
    const cleanFileName = `${sanitizedName}.pdf`;
    const filePath = `${expertId}/${targetDocType}/${timestamp}_${cleanFileName}`;

    // 1. Remove old file from storage if replacing
    if (oldFilePath && oldFilePath !== filePath) {
      try {
        console.log('[STORAGE SERVICE] Removing old document version:', oldFilePath);
        await supabase.storage.from('expert-documents').remove([oldFilePath]);
      } catch (rmErr) {
        console.warn('[STORAGE SERVICE] Note removing old file:', rmErr.message);
      }
    }

    // 2. Upload to Supabase Storage private bucket
    console.log(`[STORAGE SERVICE] Uploading ${filePath} (${buffer.length} bytes)...`);
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('expert-documents')
      .upload(filePath, buffer, { contentType: 'application/pdf', upsert: true });

    if (uploadErr) {
      console.error('[STORAGE SERVICE] Supabase upload error:', uploadErr);
      return res.status(500).json({ success: false, error: uploadErr.message });
    }

    // 3. Generate signed URL for immediate preview (3600s)
    const { data: signedData } = await supabase.storage
      .from('expert-documents')
      .createSignedUrl(filePath, 3600);

    // 4. Upsert into expert_documents table
    const docRecord = {
      id: crypto.randomUUID(),
      expert_id: expertId,
      doc_type: targetDocType,
      file_path: filePath,
      file_name: cleanFileName,
      file_size: buffer.length,
      mime_type: 'application/pdf',
      status: 'pending',
      admin_remark: null,
      uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const { data: dbData } = await supabase
        .from('expert_documents')
        .upsert(docRecord, { onConflict: 'expert_id,doc_type' })
        .select()
        .single();
      if (dbData) Object.assign(docRecord, dbData);
    } catch (dbErr) {
      console.warn('[EXPERT_DOCUMENTS] DB upsert note:', dbErr.message);
    }

    // 5. Sync to experts table JSON documents column
    try {
      const { data: expRow } = await supabase.from('experts').select('id, documents').or(getExpertFilter(expertId)).maybeSingle();
      if (expRow) {
        const docsObj = expRow.documents || {};
        if (!docsObj.items) docsObj.items = {};
        const legacyKey = targetDocType === 'work_experience_cert' ? 'expCert' : targetDocType === 'offer_relieving_letter' ? 'offerLetter' : 'resume';
        docsObj.items[legacyKey] = {
          id: docRecord.id,
          type: legacyKey,
          title: cleanFileName,
          status: 'pending',
          expertId,
          fileName: cleanFileName,
          fileSize: buffer.length,
          filePath: filePath,
          uploadedAt: new Date().toISOString()
        };
        docsObj[legacyKey] = cleanFileName;
        await supabase.from('experts').update({ documents: docsObj, verified: false, updated_at: new Date().toISOString() }).eq('id', expRow.id);
      }
    } catch (expErr) {
      console.warn('[SUPABASE] experts update note:', expErr.message);
    }

    res.json({
      success: true,
      filePath,
      signedUrl: signedData?.signedUrl || null,
      document: docRecord
    });
  } catch (err) {
    console.error('[STORAGE SERVICE] Exception:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Expert Documents endpoint (with fallback to experts table)
app.get('/api/expert-documents', async (req, res) => {
  try {
    const { expertId } = req.query;
    if (!expertId) return res.status(400).json({ success: false, error: 'expertId is required' });

    let docsList = [];
    try {
      const { data, error } = await supabase
        .from('expert_documents')
        .select(COLUMNS.EXPERT_DOCUMENT)
        .eq('expert_id', expertId)
        .limit(20);

      if (!error && Array.isArray(data) && data.length > 0) {
        docsList = data;
      }
    } catch {}

    if (docsList.length === 0) {
      try {
        const { data: exp } = await supabase.from('experts').select('documents').or(getExpertFilter(expertId)).maybeSingle();
        const items = exp?.documents?.items || {};
        const typeMap = {
          expCert: 'work_experience_cert',
          offerLetter: 'offer_relieving_letter',
          resume: 'executive_cv'
        };
        Object.entries(items).forEach(([legacyKey, item]) => {
          if (item && (item.filePath || item.fileName)) {
            const dt = typeMap[legacyKey] || legacyKey;
            docsList.push({
              id: item.id || `doc-${expertId}-${dt}`,
              expert_id: expertId,
              doc_type: dt,
              file_path: item.filePath || `${expertId}/${dt}/${item.fileName}`,
              file_name: item.fileName || `${dt}.pdf`,
              file_size: typeof item.fileSize === 'number' ? item.fileSize : 500000,
              mime_type: 'application/pdf',
              status: (item.status || 'pending').toLowerCase() === 'verified' ? 'verified' : (item.status || 'pending').toLowerCase() === 'rejected' ? 'rejected' : 'pending',
              admin_remark: item.adminRemark || item.rejectionReason || null,
              uploaded_at: item.uploadedAt || new Date().toISOString(),
              updated_at: item.updatedAt || new Date().toISOString()
            });
          }
        });
      } catch {}
    }

    res.json({ success: true, documents: docsList });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Expert Document endpoint
app.post('/api/expert-documents/delete', async (req, res) => {
  try {
    const { expertId, docType, filePath } = req.body;
    if (filePath) {
      await supabase.storage.from('expert-documents').remove([filePath]).catch(() => {});
    }
    try {
      await supabase.from('expert_documents').delete().match({ expert_id: expertId, doc_type: docType });
    } catch {}
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Sync Document Record endpoint
app.post('/api/expert-documents/sync-record', async (req, res) => {
  try {
    const docRecord = req.body;
    try {
      await supabase.from('expert_documents').upsert(docRecord, { onConflict: 'expert_id,doc_type' });
    } catch {}
    res.json({ success: true, document: docRecord });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Expert Document Status endpoint
app.post('/api/expert-documents/update-status', async (req, res) => {
  try {
    const { docId, expertId, docType, status, adminRemark } = req.body;
    if (!docId && (!expertId || !docType)) {
      return res.status(400).json({ success: false, error: 'docId or (expertId and docType) is required' });
    }

    let updatedDoc = null;
    try {
      if (docId) {
        const { data } = await supabase
          .from('expert_documents')
          .update({
            status,
            admin_remark: adminRemark || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', docId)
          .select()
          .single();
        if (data) updatedDoc = data;
      }
    } catch {}

    res.json({ success: true, document: updatedDoc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Generate Signed URL for Document Viewing (60 min expiry)
app.get('/api/documents/signed-url', async (req, res) => {
  try {
    const { filePath } = req.query;
    if (!filePath) return res.status(400).json({ success: false, error: 'filePath is required' });

    const { data, error } = await supabase.storage
      .from('expert-documents')
      .createSignedUrl(String(filePath), 3600);

    if (error) throw error;
    res.json({ success: true, signedUrl: data.signedUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Profile Change Audit Log & Realtime Broadcast
app.post('/api/expert/profile-change', async (req, res) => {
  try {
    const { expertId, fieldName, oldValue, newValue, changedBy = 'expert' } = req.body;
    if (!expertId || !fieldName) {
      return res.status(400).json({ success: false, error: 'expertId and fieldName are required' });
    }

    const changeRecord = {
      expert_id: expertId,
      field_name: fieldName,
      old_value: String(oldValue ?? ''),
      new_value: String(newValue ?? ''),
      changed_at: new Date().toISOString(),
      changed_by: changedBy
    };

    // 1. Insert into expert_profile_changes
    try {
      await supabase.from('expert_profile_changes').insert(changeRecord);
    } catch {}

    // 2. Update expert_profiles
    const updateFieldMap = {
      baseRate: 'base_rate',
      projectRate: 'project_rate',
      years: 'years',
      bio: 'bio',
      field: 'field',
      company: 'company',
      phone: 'phone'
    };
    const dbField = updateFieldMap[fieldName] || fieldName;
    try {
      await supabase
        .from('expert_profiles')
        .update({ [dbField]: newValue, updated_at: new Date().toISOString() })
        .eq('id', expertId);
    } catch {}

    res.json({ success: true, change: changeRecord });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Action: Start Review
app.post('/api/admin/start-review', async (req, res) => {
  try {
    const { expertId, adminId } = req.body;

    const { data, error } = await supabase
      .from('expert_profiles')
      .update({
        status: 'under_review',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', expertId)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, expert: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// EXPERT AVAILABILITY ENDPOINTS
// ============================================================

// Get Availability
app.get('/api/availability', async (req, res) => {
  try {
    const { expertId, date, status } = req.query;
    // Explicit columns, stable order, capped (paged with ?limit=&offset=, default 500).
    const aLimit = clampInt(req.query.limit, 500, 1, 1000);
    const aOffset = clampInt(req.query.offset, 0, 0, 100000);
    let query = supabase.from('expert_availability').select(COLUMNS.AVAILABILITY);

    if (expertId) query = query.eq('expert_id', expertId);
    if (date) query = query.eq('availability_date', date);
    if (status) query = query.eq('status', status);

    const { data: availabilities, error } = await query
      .order('availability_date', { ascending: true })
      .order('start_time', { ascending: true })
      .range(aOffset, aOffset + aLimit - 1);
    if (error) throw error;

    res.json({ success: true, availabilities });
  } catch (err) {
    try {
      const dbPath = path.resolve(__dirname, 'db.json');
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      let list = db.availabilities || [];
      if (req.query.expertId) list = list.filter(a => a.expertId === req.query.expertId || a.expert_id === req.query.expertId);
      res.json({ success: true, availabilities: list });
    } catch {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// Create Availability Slot
app.post('/api/availability', async (req, res) => {
  try {
    const slotData = req.body;
    const dbPayload = {
      id: slotData.id || `avail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      expert_id: slotData.expert_id || slotData.expertId,
      availability_date: slotData.availability_date || slotData.availabilityDate,
      start_time: slotData.start_time || slotData.startTime,
      end_time: slotData.end_time || slotData.endTime,
      status: slotData.status || 'AVAILABLE',
      booking_id: slotData.booking_id || slotData.bookingId || null,
      client_id: slotData.client_id || slotData.clientId || null,
      client_name: slotData.client_name || slotData.clientName || null
    };

    const { data: slot, error } = await supabase
      .from('expert_availability')
      .upsert(dbPayload)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, availability: slot });
  } catch (err) {
    try {
      const dbPath = path.resolve(__dirname, 'db.json');
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const list = db.availabilities || [];
      const nowIso = new Date().toISOString();
      const newSlot = {
        id: req.body.id || `avail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        expertId: req.body.expertId || req.body.expert_id,
        availabilityDate: req.body.availabilityDate || req.body.availability_date,
        startTime: req.body.startTime || req.body.start_time,
        endTime: req.body.endTime || req.body.end_time,
        status: req.body.status || 'AVAILABLE',
        bookingId: req.body.bookingId || null,
        clientId: req.body.clientId || null,
        clientName: req.body.clientName || null,
        createdAt: req.body.createdAt || nowIso,
        updatedAt: nowIso
      };
      list.push(newSlot);
      db.availabilities = list;
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
      res.json({ success: true, availability: newSlot });
    } catch {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// Update Availability Slot
app.put('/api/availability/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const dbPayload = {
      updated_at: new Date().toISOString()
    };
    if (updateData.expertId || updateData.expert_id) dbPayload.expert_id = updateData.expertId || updateData.expert_id;
    if (updateData.availabilityDate || updateData.availability_date) dbPayload.availability_date = updateData.availabilityDate || updateData.availability_date;
    if (updateData.startTime || updateData.start_time) dbPayload.start_time = updateData.startTime || updateData.start_time;
    if (updateData.endTime || updateData.end_time) dbPayload.end_time = updateData.endTime || updateData.end_time;
    if (updateData.status) dbPayload.status = updateData.status;

    const { data: slot, error } = await supabase
      .from('expert_availability')
      .update(dbPayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, availability: slot });
  } catch (err) {
    try {
      const dbPath = path.resolve(__dirname, 'db.json');
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const list = db.availabilities || [];
      const idx = list.findIndex(a => a.id === req.params.id);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          ...req.body,
          id: req.params.id,
          updatedAt: new Date().toISOString()
        };
        db.availabilities = list;
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
        return res.json({ success: true, availability: list[idx] });
      }
      res.status(404).json({ success: false, error: 'Availability slot not found' });
    } catch {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// Delete Availability Slot
app.delete('/api/availability/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('expert_availability')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    try {
      const dbPath = path.resolve(__dirname, 'db.json');
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const list = db.availabilities || [];
      db.availabilities = list.filter(a => a.id !== req.params.id);
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// Book Availability Slot
app.post('/api/availability/book', async (req, res) => {
  try {
    const { slotId, bookingId, clientId, clientName } = req.body;

    const { data: slot, error } = await supabase
      .from('expert_availability')
      .update({
        status: 'BOOKED',
        booking_id: bookingId,
        client_id: clientId,
        client_name: clientName,
        updated_at: new Date().toISOString()
      })
      .eq('id', slotId)
      .eq('status', 'AVAILABLE')
      .select()
      .single();

    if (error || !slot) {
      return res.status(409).json({ success: false, error: 'Slot is not available or already booked' });
    }

    res.json({ success: true, availability: slot });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Release Availability Slot (Undo lock on failed booking)
app.post('/api/availability/release', async (req, res) => {
  try {
    const { slotId, bookingId } = req.body;
    if (!slotId) {
      return res.status(400).json({ success: false, error: 'slotId is required' });
    }
    let query = supabase
      .from('expert_availability')
      .update({
        status: 'AVAILABLE',
        booking_id: null,
        client_id: null,
        client_name: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', slotId);

    if (bookingId) {
      query = query.eq('booking_id', bookingId);
    }

    const { data: slot, error } = await query.select().maybeSingle();
    if (error) throw error;
    res.json({ success: true, availability: slot });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// CLIENT CONSULTATION REVIEWS & RATINGS ENDPOINTS
// ============================================================

// Helper: Calculate average and count
function calculateReviewAggregate(reviewsList) {
  if (!Array.isArray(reviewsList) || reviewsList.length === 0) {
    return { avgRating: 0.0, reviewCount: 0 };
  }
  const valid = reviewsList
    .map(r => Number(r.rating))
    .filter(val => !isNaN(val) && val >= 1 && val <= 5);
  if (valid.length === 0) return { avgRating: 0.0, reviewCount: 0 };
  const sum = valid.reduce((a, b) => a + b, 0);
  const avg = Math.round((sum / valid.length) * 10) / 10;
  return { avgRating: avg, reviewCount: valid.length };
}

// Helper: Find all reviews matching an expert from db.json and Supabase
async function getExpertReviewsFromStores(expertId, expertEmail, expertName) {
  const normId = (expertId || '').toLowerCase().trim();
  const normEmail = (expertEmail || '').toLowerCase().trim();
  const normName = (expertName || '').toLowerCase().trim();

  let allReviews = [];

  // Try Supabase reviews table first
  try {
    // NOTE: the `reviews` table does not exist in the database yet (404) — see EGRESS_FIX_GUIDE.md.
    let query = supabase.from('reviews').select(COLUMNS.REVIEW);
    if (expertId) query = query.or(`expert_id.eq.${expertId},expert_email.ilike.${expertEmail || expertId}`);
    const { data: sbRevs, error } = await query.order('created_at', { ascending: false }).limit(500);
    if (!error && Array.isArray(sbRevs)) {
      allReviews = sbRevs;
    }
  } catch {}

  // Merge with db.json reviews and db.kv.app_platform_reviews
  try {
    const dbPath = path.resolve(__dirname, 'db.json');
    if (fs.existsSync(dbPath)) {
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const localRevs = [
        ...(Array.isArray(db.reviews) ? db.reviews : []),
        ...(Array.isArray(db.kv?.app_platform_reviews) ? db.kv.app_platform_reviews : [])
      ];

      const seenIds = new Set(allReviews.map(r => r.id));
      for (const r of localRevs) {
        if (!r || !r.id || seenIds.has(r.id)) continue;
        const rId = (r.expert_id || r.expertId || '').toLowerCase().trim();
        const rEmail = (r.expert_email || r.expertEmail || '').toLowerCase().trim();
        const rName = (r.expert_name || r.expertName || '').toLowerCase().trim();

        const match = (normId && rId && normId === rId) ||
                      (normEmail && rEmail && normEmail === rEmail) ||
                      (normName && rName && (normName === rName || normName.includes(rName) || rName.includes(normName)));

        if (match) {
          allReviews.push(r);
          seenIds.add(r.id);
        }
      }
    }
  } catch {}

  return allReviews;
}

// Helper: Count completed sessions for an expert
async function getExpertCompletedSessionsCount(expertId, expertEmail, expertName) {
  const normId = (expertId || '').toLowerCase().trim();
  const normEmail = (expertEmail || '').toLowerCase().trim();
  const normName = (expertName || '').toLowerCase().trim();

  const completedSessionIds = new Set();

  // 1. Any session with a verified client review is completed by definition
  try {
    const reviews = await getExpertReviewsFromStores(expertId, expertEmail, expertName);
    reviews.forEach(r => {
      const sId = r.sessionId || r.session_id;
      if (sId) completedSessionIds.add(String(sId).trim());
    });
  } catch {}

  // 2. Check Supabase bookings
  try {
    let query = supabase.from('bookings').select('id, status');
    if (expertId) query = query.eq('expert_id', expertId);
    const { data: bData } = await query;
    if (Array.isArray(bData)) {
      bData.forEach(b => {
        if (b.status?.toLowerCase() === 'completed') completedSessionIds.add(b.id);
      });
    }
  } catch {}

  // 2. Check db.json bookings, availabilities, and kv sessions
  try {
    const dbPath = path.resolve(__dirname, 'db.json');
    if (fs.existsSync(dbPath)) {
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

      if (Array.isArray(db.bookings)) {
        db.bookings.forEach(b => {
          if (!b || !b.id) return;
          const bId = (b.expertId || b.expert_id || '').toLowerCase().trim();
          const bEmail = (b.expertEmail || b.expert_email || '').toLowerCase().trim();
          const bName = (b.expertName || b.expert || '').toLowerCase().trim();
          const match = (normId && bId && normId === bId) ||
                        (normEmail && bEmail && normEmail === bEmail) ||
                        (normName && bName && (normName === bName || normName.includes(bName) || bName.includes(normName)));
          if (match && (b.status?.toLowerCase() === 'completed' || b.completed)) {
            completedSessionIds.add(b.id);
          }
        });
      }

      if (db.kv && typeof db.kv === 'object') {
        Object.keys(db.kv).forEach(k => {
          if (k.startsWith('expert_accepted_sessions_') || k.startsWith('client_upcoming_')) {
            const arr = db.kv[k];
            if (Array.isArray(arr)) {
              arr.forEach(s => {
                if (!s || !s.id) return;
                const isCompleted = s.status === 'Completed' || s.completed === true || s.status === 'COMPLETED';
                if (!isCompleted) return;
                const sId = (s.expertId || '').toLowerCase().trim();
                const sEmail = (s.expertEmail || '').toLowerCase().trim();
                const sName = (s.expert || s.expertName || '').toLowerCase().trim();
                const match = (normId && sId && normId === sId) ||
                              (normEmail && sEmail && normEmail === sEmail) ||
                              (normName && sName && (normName === sName || normName.includes(sName) || sName.includes(normName)));
                if (match) {
                  completedSessionIds.add(s.id);
                }
              });
            }
          }
        });
      }
    }
  } catch {}

  return completedSessionIds.size;
}

// Get Reviews
app.get('/api/reviews', async (req, res) => {
  try {
    const { expertId, expertEmail, expertName } = req.query;
    const reviews = await getExpertReviewsFromStores(expertId, expertEmail, expertName);
    const { avgRating, reviewCount } = calculateReviewAggregate(reviews);
    const completedConsultations = await getExpertCompletedSessionsCount(expertId, expertEmail, expertName);

    res.json({
      success: true,
      reviews,
      avgRating,
      reviewCount,
      completedConsultations
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Live Review Stats for an Expert
app.get('/api/reviews/stats', async (req, res) => {
  try {
    const { expertId, expertEmail, expertName } = req.query;
    const reviews = await getExpertReviewsFromStores(expertId, expertEmail, expertName);
    const { avgRating, reviewCount } = calculateReviewAggregate(reviews);
    const completedConsultations = await getExpertCompletedSessionsCount(expertId, expertEmail, expertName);

    res.json({
      success: true,
      avgRating,
      reviewCount,
      completedConsultations
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Submit Client Review for a Completed Consultation Session
app.post('/api/reviews', async (req, res) => {
  try {
    const {
      expertId,
      expertEmail,
      expertName,
      clientId,
      clientEmail,
      clientName,
      sessionId,
      rating,
      comment
    } = req.body;

    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be a number between 1 and 5' });
    }

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Completed session ID is required to submit a review' });
    }

    const normSessionId = String(sessionId).trim();
    const normClientEmail = String(clientEmail || clientId || '').toLowerCase().trim();

    // 1. Check for duplicate review for this session by this client
    const existingReviews = await getExpertReviewsFromStores(expertId, expertEmail, expertName);
    const isDuplicate = existingReviews.some(r => {
      const sId = String(r.sessionId || r.session_id || '').trim();
      const cEmail = String(r.clientEmail || r.client_email || r.clientId || r.client_id || '').toLowerCase().trim();
      return sId === normSessionId && (cEmail === normClientEmail || !cEmail);
    });

    if (isDuplicate) {
      return res.status(400).json({
        success: false,
        error: 'A review has already been submitted for this consultation session.'
      });
    }

    // 2. Build review record
    const reviewId = `rev-${Date.now()}`;
    const newReview = {
      id: reviewId,
      expert_id: expertId || '',
      expert_email: expertEmail || '',
      expert_name: expertName || '',
      client_id: clientId || '',
      client_email: clientEmail || '',
      client_name: clientName || 'Corporate Client',
      session_id: normSessionId,
      rating: Math.round(numRating),
      comment: (comment || '').trim(),
      created_at: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      status: 'approved',
      visibleToExpert: true,
      featuredOnLanding: false
    };

    // 3. Save to Supabase reviews table if available
    try {
      await supabase.from('reviews').insert(newReview);
    } catch (sbErr) {
      console.warn('[REVIEWS] Supabase table note:', sbErr.message);
    }

    // 4. Save to db.json (db.reviews and db.kv.app_platform_reviews)
    const dbPath = path.resolve(__dirname, 'db.json');
    let db = {};
    if (fs.existsSync(dbPath)) {
      db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }

    if (!Array.isArray(db.reviews)) db.reviews = [];
    db.reviews.unshift(newReview);

    if (!db.kv) db.kv = {};
    if (!Array.isArray(db.kv.app_platform_reviews)) db.kv.app_platform_reviews = [];
    db.kv.app_platform_reviews.unshift({
      ...newReview,
      expertName: expertName || newReview.expert_name,
      expertEmail: expertEmail || newReview.expert_email,
      clientName: clientName || newReview.client_name,
      clientEmail: clientEmail || newReview.client_email,
      sessionId: normSessionId
    });

    // 5. Calculate new dynamic aggregate
    const allExpertReviews = [...existingReviews, newReview];
    const { avgRating, reviewCount } = calculateReviewAggregate(allExpertReviews);
    let completedConsultations = await getExpertCompletedSessionsCount(expertId, expertEmail, expertName);
    if (completedConsultations === 0) completedConsultations = 1; // session was completed

    // 6. Update expert in db.json
    if (Array.isArray(db.experts)) {
      db.experts.forEach(exp => {
        const matches = (expertId && exp.id === expertId) ||
                        (expertEmail && exp.email?.toLowerCase().trim() === expertEmail.toLowerCase().trim()) ||
                        (expertName && exp.name?.toLowerCase().trim() === expertName.toLowerCase().trim());
        if (matches) {
          exp.rating = avgRating;
          exp.sessions = completedConsultations;
          exp.total_sessions = completedConsultations;
        }
      });
    }

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

    // 7. Update expert in Supabase
    try {
      if (expertId) {
        await supabase
          .from('experts')
          .update({ rating: avgRating, total_sessions: completedConsultations })
          .eq('id', expertId);
      } else if (expertEmail) {
        await supabase
          .from('experts')
          .update({ rating: avgRating, total_sessions: completedConsultations })
          .ilike('email', expertEmail);
      }
    } catch (sbUpdateErr) {
      console.warn('[REVIEWS] Supabase expert rating update note:', sbUpdateErr.message);
    }

    res.json({
      success: true,
      review: newReview,
      avgRating,
      reviewCount,
      completedConsultations
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// PROJECT REVIEWS ENDPOINTS
// ============================================================

// Get Project Reviews
// ============================================================
// PROJECT REVIEWS — read routes (egress-safe)
// ------------------------------------------------------------
// - LIST (no ?id): summary columns only (no chat / activity_timeline / proposed_times),
//   plus a chat_count, paged with ?limit= (max 20) & ?offset=. Response has hasMore/nextOffset.
// - ONE (?id=…): the full row, only when a review is opened.
// - /activity: the latest N audit events, computed in the database.
// Rows include camelCase copies of each field (projectReviewId, clientName…) because the
// screens read camelCase names.
// ============================================================
app.get('/api/project-reviews/activity', async (req, res) => {
  try {
    const limit = clampInt(req.query.limit, 100, 1, 200);
    const { data, error } = await supabase.rpc('get_project_review_activity', { p_limit: limit }, { get: true });
    if (error) {
      if (isMissingFunction(error)) return res.json({ success: true, events: [], note: 'Run supabase/egress-fix/05 to enable' });
      throw error;
    }
    res.json({ success: true, events: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/project-reviews', async (req, res) => {
  try {
    const { id, clientId, expertId, status } = req.query;

    // One opened review → full row.
    if (id) {
      const { data, error } = await supabase
        .from('project_reviews')
        .select(COLUMNS.PROJECT_REVIEW_FULL)
        .eq('project_review_id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: 'Project Review not found' });
      return res.json({ success: true, projectReview: withCamelAliases(data) });
    }

    // List → slim summary page.
    const limit = clampInt(req.query.limit, PROJECT_REVIEW_PAGE_SIZE, 1, PROJECT_REVIEW_PAGE_SIZE);
    const offset = clampInt(req.query.offset, 0, 0, 100000);
    const runList = async (columns) => {
      let query = supabase.from('project_reviews').select(columns);
      if (clientId) query = query.eq('client_id', clientId);
      if (expertId) query = query.eq('expert_id', expertId);
      if (status) query = query.eq('status', status);
      // Stable order (updated_at, then id) so pages never skip or repeat rows.
      // We ask for one extra row to know whether another page exists.
      return query
        .order('updated_at', { ascending: false })
        .order('project_review_id', { ascending: true })
        .range(offset, offset + limit);
    };
    let { data, error } = await runList(`${COLUMNS.PROJECT_REVIEW_SUMMARY}, chat_count`);
    if (error && /chat_count/i.test(error.message || '')) {
      // SQL 05 not installed yet → same list without the message count.
      ({ data, error } = await runList(COLUMNS.PROJECT_REVIEW_SUMMARY));
    }
    if (error) throw error;

    const rows = data || [];
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).map((r) => withCamelAliases({ ...r, chatCount: r.chat_count ?? 0 }));
    res.json({ success: true, projectReviews: page, hasMore, nextOffset: hasMore ? offset + limit : null });
  } catch (err) {
    console.error('[project-reviews] read failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create Project Review Request
app.post('/api/project-reviews/request', async (req, res) => {
  try {
    const payload = req.body;

    // Get platform settings
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_charge')
      .single();

    const feeConfig = settings?.value || { feeType: 'fixed', feeValue: 200, currency: 'INR' };

    // Get expert rate
    const { data: expert } = await supabase
      .from('experts')
      .select('project_rate, rate')
      .eq('id', payload.expertId)
      .single();

    const rawPrice = expert?.project_rate || (expert?.rate ? expert.rate * 3 : 1000);
    const expertCharge = Math.min(2000, Math.max(0, Math.round(rawPrice)));

    let platformFee = 0;
    if (feeConfig.feeType === 'fixed') {
      platformFee = Math.max(0, Number(feeConfig.feeValue) ?? 200);
    } else {
      platformFee = Math.round(expertCharge * ((Number(feeConfig.feeValue) || 15) / 100));
    }

    const price = expertCharge + platformFee;
    const projectReviewId = `pr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const clientWalletTxId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const { data: review, error } = await supabase
      .from('project_reviews')
      .insert({
        ...payload,
        project_review_id: projectReviewId,
        price,
        expert_earning: expertCharge,
        platform_fee: platformFee,
        platform_charge_type: feeConfig.feeType,
        client_wallet_tx_id: clientWalletTxId,
        status: 'PendingExpertAcceptance',
        payment_status: 'PaymentSuccessful',
        expert_earning_status: 'EarningPending',
        chat: [{
          id: `msg-${Date.now()}-sys`,
          project_review_id: projectReviewId,
          sender_id: 'system',
          sender_role: 'system',
          sender_name: 'System',
          content: `Project Review request initiated for ₹${price.toLocaleString('en-IN')}. Escrow payment confirmed (Tx: ${clientWalletTxId}). Awaiting Expert decision.`,
          timestamp: nowIso,
          read: true
        }],
        activity_timeline: [{
          activity_id: `act-${Date.now()}`,
          project_review_id: projectReviewId,
          user_id: payload.clientId,
          user_name: payload.clientName || 'Client',
          role: 'client',
          event_type: 'request_created',
          description: `Client requested Project Review (₹${price.toLocaleString('en-IN')})`,
          new_status: 'PendingExpertAcceptance',
          timestamp: nowIso
        }]
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, projectReview: review });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Respond to Project Review
app.post('/api/project-reviews/:id/respond', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason, responderId, responderRole } = req.body;

    const updateData = {
      status: action === 'accept' ? 'ExpertAccepted' : 'ExpertRejected',
      updated_at: new Date().toISOString()
    };

    if (reason) {
      updateData.request_notes = reason;
    }

    const { data: review, error } = await supabase
      .from('project_reviews')
      .update(updateData)
      .eq('project_review_id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, projectReview: review });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// PLATFORM SETTINGS ENDPOINTS
// ============================================================

// Get Platform Settings
app.get('/api/platform-settings', async (req, res) => {
  try {
    const { data: settings } = await supabase
      .from('platform_settings')
      .select(COLUMNS.PLATFORM_SETTING);

    const config = settings?.find(s => s.key === 'platform_charge')?.value ||
                  { feeType: 'fixed', feeValue: 200, currency: 'INR' };

    res.json({ success: true, config, platformCharge: config });
  } catch (err) {
    try {
      const dbPath = path.resolve(__dirname, 'db.json');
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const config = db.platformCharge || { feeType: 'fixed', feeValue: 200, currency: 'INR' };
      res.json({ success: true, config, platformCharge: config });
    } catch {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// Update Platform Settings
app.post('/api/platform-settings', async (req, res) => {
  try {
    const { feeType, feeValue, role } = req.body;

    if (role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required' });
    }

    const config = {
      feeType,
      feeValue: Number(feeValue),
      currency: 'INR',
      updatedAt: new Date().toISOString()
    };

    const { data: settings, error } = await supabase
      .from('platform_settings')
      .update({ value: config, updated_at: new Date().toISOString() })
      .eq('key', 'platform_charge')
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, config, platformCharge: config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// NOTIFICATIONS ENDPOINTS
// ============================================================

// Get User Notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const { userId } = req.query;
    const { data: notifications, error } = await supabase
      .from('notifications')
      // Only the fields the notification centre shows, newest 50 (egress fix).
      .select('id, user_id, user_role, title, message, type, link, is_read, metadata, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ success: true, notifications: notifications || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create Notification
app.post('/api/notifications', async (req, res) => {
  try {
    const notificationData = req.body;
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark Notification as Read
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: notification, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// BOOKINGS ENDPOINTS
// ============================================================

// Helper to retrieve and filter bookings from db.json
function getBookingsFromDb(dbObj, filters) {
  let list = [];
  if (Array.isArray(dbObj.bookings) && dbObj.bookings.length > 0) {
    list = dbObj.bookings;
  } else if (Array.isArray(dbObj.kv?.app_platform_sessions) && dbObj.kv.app_platform_sessions.length > 0) {
    list = dbObj.kv.app_platform_sessions;
  }

  const cEmail = (filters.clientEmail || '').toLowerCase().trim();
  const cId = String(filters.clientId || '').trim();
  const eEmail = (filters.expertEmail || '').toLowerCase().trim();
  const eId = String(filters.expertId || '').trim();
  const st = (filters.status || '').toLowerCase().trim();
  const softDeletes = dbObj.bookingSoftDeletes || {};

  return list.filter(b => {
    if (!b || !b.id) return false;
    const bClientEmail = (b.client_email || b.clientEmail || '').toLowerCase().trim();
    const bClientId = String(b.client_id || b.clientId || '').trim();
    const bExpertEmail = (b.expert_email || b.expertEmail || '').toLowerCase().trim();
    const bExpertId = String(b.expert_id || b.expertId || '').trim();
    const bStatus = (b.status || '').toLowerCase().trim();

    if (cEmail && cId) {
      if (bClientEmail !== cEmail && bClientId !== cId) return false;
    } else if (cEmail) {
      if (bClientEmail !== cEmail) return false;
    } else if (cId) {
      if (bClientId !== cId) return false;
    }

    if (eEmail && eId) {
      if (bExpertEmail !== eEmail && bExpertId !== eId) return false;
    } else if (eEmail) {
      if (bExpertEmail !== eEmail) return false;
    } else if (eId) {
      if (bExpertId !== eId) return false;
    }

    if (st && !bStatus.includes(st)) {
      return false;
    }

    const sd = softDeletes[b.id] || {};
    const delByClient = b.deleted_by_client === true || b.deletedByClient === true || sd.client === true;
    const delByExpert = b.deleted_by_expert === true || b.deletedByExpert === true || sd.expert === true;
    const delByAdmin = b.deleted_by_admin === true || b.deletedByAdmin === true || sd.admin === true;

    if (filters.role === 'client' && delByClient) return false;
    if (filters.role === 'expert' && delByExpert) return false;
    if (filters.role === 'admin' && delByAdmin) return false;

    return true;
  }).map(b => {
    const sd = softDeletes[b.id] || {};
    return {
      ...b,
      deleted_by_client: b.deleted_by_client === true || b.deletedByClient === true || sd.client === true,
      deleted_by_expert: b.deleted_by_expert === true || b.deletedByExpert === true || sd.expert === true,
      deleted_by_admin: b.deleted_by_admin === true || b.deletedByAdmin === true || sd.admin === true,
      deletedByClient: b.deleted_by_client === true || b.deletedByClient === true || sd.client === true,
      deletedByExpert: b.deleted_by_expert === true || b.deletedByExpert === true || sd.expert === true,
      deletedByAdmin: b.deleted_by_admin === true || b.deletedByAdmin === true || sd.admin === true
    };
  });
}

// Get Bookings
app.get('/api/bookings', async (req, res) => {
  try {
    const { clientId, clientEmail, expertId, expertEmail, status, role } = req.query;

    let bookings = [];
    try {
      // Only real booking columns (never select('*')); paged with ?limit=&offset= (default 200).
      const bLimit = clampInt(req.query.limit, 200, 1, 500);
      const bOffset = clampInt(req.query.offset, 0, 0, 100000);
      let query = supabase.from('bookings').select(COLUMNS.BOOKING);

      if (clientId && clientEmail) {
        query = query.or(`client_id.eq.${clientId},client_email.ilike.${clientEmail.toLowerCase()}`);
      } else if (clientId) {
        query = query.eq('client_id', clientId);
      } else if (clientEmail) {
        query = query.ilike('client_email', clientEmail.toLowerCase());
      }

      if (expertId && expertEmail) {
        query = query.or(`expert_id.eq.${expertId},expert_email.ilike.${expertEmail.toLowerCase()}`);
      } else if (expertId) {
        query = query.eq('expert_id', expertId);
      } else if (expertEmail) {
        query = query.ilike('expert_email', expertEmail.toLowerCase());
      }

      if (status) {
        query = query.ilike('status', `%${status}%`);
      }

      query = query.order('created_at', { ascending: false }).order('id', { ascending: true }).range(bOffset, bOffset + bLimit - 1);

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        bookings = data;
      }
    } catch {}

    if (bookings.length === 0) {
      const db = readDb();
      bookings = getBookingsFromDb(db, { clientId, clientEmail, expertId, expertEmail, status, role });
    }

    res.json({ success: true, data: bookings, bookings });
  } catch (err) {
    const db = readDb();
    const fallback = getBookingsFromDb(db, req.query);
    res.json({ success: true, data: fallback, bookings: fallback });
  }
});

// Helper: Extract caller identity from request headers/body
function getCallerIdentity(req) {
  const userId = req.headers['x-user-id'] || req.body?.callerId || req.body?.clientId || '';
  const userEmail = (req.headers['x-user-email'] || req.body?.callerEmail || req.body?.clientEmail || '').toLowerCase().trim();
  const userRole = (req.headers['x-user-role'] || req.body?.callerRole || req.body?.role || '').toLowerCase().trim();
  const isAdmin = isAuthorizedAdmin(req);
  return { userId, userEmail, userRole: isAdmin ? 'admin' : userRole, isAdmin };
}

// Create Booking (Backend Protected Endpoint using Service Role Key)
app.post('/api/bookings', async (req, res) => {
  try {
    const caller = getCallerIdentity(req);
    const bookingData = req.body;

    // Security Check 1: User identity required
    if (!caller.isAdmin && !caller.userId && !caller.userEmail) {
      return res.status(401).json({ success: false, error: 'Unauthenticated: User identity is required to create a booking' });
    }

    // Security Check 2: A client cannot insert with another client's id
    if (!caller.isAdmin && caller.userId && bookingData.client_id && String(caller.userId) !== String(bookingData.client_id)) {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot book on behalf of another client' });
    }

    // Security Check 3: A client cannot set status 'accepted' on creation
    if (!caller.isAdmin && bookingData.status && ['accepted', 'Confirmed', 'Live', 'completed'].includes(bookingData.status)) {
      return res.status(400).json({ success: false, error: "Forbidden: New client consultations cannot be created with 'accepted' status" });
    }
    bookingData.status = bookingData.status || 'pending';

    // FIX 3: NOT NULL field validation
    if (!bookingData.topic || (!bookingData.scheduled_date && !bookingData.when) || (!bookingData.client_id && !bookingData.clientId && !bookingData.clientEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: topic, scheduled_date, scheduled_time, client_id, and expert_id are required'
      });
    }

    // Persist to db.json immediately as authoritative single source of truth
    const db = readDb();
    if (!Array.isArray(db.bookings)) {
      db.bookings = Array.isArray(db.kv?.app_platform_sessions) ? [...db.kv.app_platform_sessions] : [];
    }
    const bIdx = db.bookings.findIndex(b => b.id === bookingData.id);
    if (bIdx >= 0) {
      db.bookings[bIdx] = { ...db.bookings[bIdx], ...bookingData };
    } else {
      db.bookings.unshift(bookingData);
    }

    if (!db.kv) db.kv = {};
    if (!Array.isArray(db.kv.app_platform_sessions)) db.kv.app_platform_sessions = [];
    const sIdx = db.kv.app_platform_sessions.findIndex(s => s.id === bookingData.id);
    if (sIdx >= 0) {
      db.kv.app_platform_sessions[sIdx] = { ...db.kv.app_platform_sessions[sIdx], ...bookingData };
    } else {
      db.kv.app_platform_sessions.unshift(bookingData);
    }

    const clientEmail = (bookingData.client_email || bookingData.clientEmail || '').toLowerCase().trim();
    if (clientEmail) {
      const clientKey = `client_upcoming_${clientEmail}`;
      if (!Array.isArray(db.kv[clientKey])) db.kv[clientKey] = [];
      const cIdx = db.kv[clientKey].findIndex(b => b.id === bookingData.id);
      if (cIdx >= 0) db.kv[clientKey][cIdx] = { ...db.kv[clientKey][cIdx], ...bookingData };
      else db.kv[clientKey].unshift(bookingData);
    }

    const expertEmail = (bookingData.expert_email || bookingData.expertEmail || '').toLowerCase().trim();
    if (expertEmail) {
      const expertKey = `expert_requests_${expertEmail}`;
      if (!Array.isArray(db.kv[expertKey])) db.kv[expertKey] = [];
      const eIdx = db.kv[expertKey].findIndex(b => b.id === bookingData.id);
      if (eIdx >= 0) db.kv[expertKey][eIdx] = { ...db.kv[expertKey][eIdx], ...bookingData };
      else db.kv[expertKey].unshift(bookingData);
    }

    writeDb(db);

    // Try Supabase insert in background
    try {
      await supabase.from('bookings').insert(bookingData);
    } catch (sbErr) {
      console.warn('[server] Supabase insert warning (persisted to db.json):', sbErr.message);
    }

    res.json({ success: true, booking: bookingData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Booking (Backend Protected Endpoint using Service Role Key)
app.patch('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const caller = getCallerIdentity(req);

    const db = readDb();
    if (!Array.isArray(db.bookings)) {
      db.bookings = Array.isArray(db.kv?.app_platform_sessions) ? [...db.kv.app_platform_sessions] : [];
    }

    // Find existing booking in db.json or Supabase
    let existing = db.bookings.find(b => b.id === id) || (db.kv?.app_platform_sessions || []).find(s => s.id === id);
    if (!existing) {
      try {
        const { data: supaExisting } = await supabase.from('bookings').select(COLUMNS.BOOKING).eq('id', id).maybeSingle();
        if (supaExisting) existing = supaExisting;
      } catch {}
    }

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (!caller.isAdmin) {
      const isAssignedExpert = (caller.userId && String(existing.expert_id || existing.expertId) === String(caller.userId)) ||
        (caller.userEmail && (existing.expert_email || existing.expertEmail) && String(existing.expert_email || existing.expertEmail).toLowerCase() === caller.userEmail);

      const isOwningClient = (caller.userId && String(existing.client_id || existing.clientId) === String(caller.userId)) ||
        (caller.userEmail && (existing.client_email || existing.clientEmail) && String(existing.client_email || existing.clientEmail).toLowerCase() === caller.userEmail);

      // Security: Expert can only update their own bookings
      if (caller.userRole === 'expert' || isAssignedExpert) {
        if (!isAssignedExpert) {
          return res.status(403).json({ success: false, error: 'Forbidden: Experts can only update their own assigned consultations' });
        }
      } else if (caller.userRole === 'client' || isOwningClient) {
        if (!isOwningClient) {
          return res.status(403).json({ success: false, error: "Forbidden: You cannot update another user's booking" });
        }
        if (req.body.status && ['accepted', 'completed', 'Confirmed', 'Live'].includes(req.body.status)) {
          return res.status(403).json({ success: false, error: 'Forbidden: Clients cannot accept consultations' });
        }
      }
    }

    const updateData = {
      ...existing,
      ...req.body,
      updated_at: new Date().toISOString()
    };

    const meetVal = req.body.meet_link ?? req.body.meeting_link ?? req.body.meetUrl ?? req.body.meetLink;
    if (meetVal !== undefined) {
      if (meetVal && typeof meetVal === 'string' && meetVal.trim() !== '') {
        const cleanMeet = meetVal.trim();
        const isGoogleMeet = /^https:\/\/meet\.google\.com\/[a-zA-Z0-9_\-]+(\?.*)?$/i.test(cleanMeet);
        if (!isGoogleMeet) {
          return res.status(400).json({ success: false, error: 'Invalid Google Meet URL. Format must be https://meet.google.com/xxx-yyyy-zzz' });
        }
      }
      updateData.meet_link = meetVal;
      updateData.meeting_link = meetVal;
      updateData.meetUrl = meetVal;
      updateData.meeting_link_sent_at = req.body.meeting_link_sent_at || updateData.meeting_link_sent_at || (meetVal ? new Date().toISOString() : null);
    }

    // Update in db.bookings
    const bIdx = db.bookings.findIndex(b => b.id === id);
    if (bIdx >= 0) {
      db.bookings[bIdx] = { ...db.bookings[bIdx], ...updateData };
    } else {
      db.bookings.unshift(updateData);
    }

    // Sync to db.kv caches
    if (!db.kv) db.kv = {};
    if (Array.isArray(db.kv.app_platform_sessions)) {
      const sIdx = db.kv.app_platform_sessions.findIndex(s => s.id === id);
      if (sIdx >= 0) {
        db.kv.app_platform_sessions[sIdx] = { ...db.kv.app_platform_sessions[sIdx], ...updateData };
      } else {
        db.kv.app_platform_sessions.unshift(updateData);
      }
    }

    const cEmail = (updateData.client_email || updateData.clientEmail || '').toLowerCase().trim();
    const eEmail = (updateData.expert_email || updateData.expertEmail || '').toLowerCase().trim();
    const eName = (updateData.expert_name || updateData.expert || '').toLowerCase().trim();

    for (const kvKey of Object.keys(db.kv)) {
      if (kvKey.startsWith('client_upcoming_') && Array.isArray(db.kv[kvKey])) {
        const cIdx = db.kv[kvKey].findIndex(b => b.id === id);
        if (cIdx >= 0) {
          db.kv[kvKey][cIdx] = { ...db.kv[kvKey][cIdx], ...updateData };
        } else if (cEmail && kvKey === `client_upcoming_${cEmail}`) {
          db.kv[kvKey].unshift(updateData);
        }
      }
      if (kvKey.startsWith('expert_accepted_sessions_') && Array.isArray(db.kv[kvKey])) {
        const aIdx = db.kv[kvKey].findIndex(b => b.id === id);
        if (aIdx >= 0) {
          db.kv[kvKey][aIdx] = { ...db.kv[kvKey][aIdx], ...updateData };
        } else if (updateData.status && (updateData.status.toLowerCase().includes('accept') || updateData.status.toLowerCase().includes('confirm'))) {
          if ((eEmail && kvKey === `expert_accepted_sessions_${eEmail}`) || (eName && kvKey === `expert_accepted_sessions_${eName}`)) {
            db.kv[kvKey].unshift(updateData);
          }
        }
      }
      if (kvKey.startsWith('expert_requests_') && Array.isArray(db.kv[kvKey])) {
        if (updateData.status && (updateData.status.toLowerCase().includes('accept') || updateData.status.toLowerCase().includes('reject') || updateData.status.toLowerCase().includes('decline'))) {
          db.kv[kvKey] = db.kv[kvKey].filter(r => r.id !== id);
        }
      }
    }

    writeDb(db);

    // Try Supabase update in background
    try {
      const sbPayload = {
        updated_at: new Date().toISOString()
      };
      if (req.body.status) sbPayload.status = req.body.status;
      if (meetVal !== undefined) {
        sbPayload.meet_link = meetVal;
        sbPayload.meeting_link = meetVal;
        sbPayload.meeting_link_sent_at = updateData.meeting_link_sent_at;
      }
      await supabase.from('bookings').update(sbPayload).eq('id', id);
    } catch (sbErr) {
      console.warn('[server] Supabase update warning (persisted to db.json):', sbErr.message);
    }

    // Broadcast update across Supabase realtime channel
    try {
      const ch = supabase.channel('bookings-realtime-channel');
      await ch.send({
        type: 'broadcast',
        event: 'booking_updated',
        payload: updateData
      });
    } catch {}

    res.json({ success: true, booking: updateData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Soft-Delete Booking per Portal Role (Backend Protected Endpoint using Service Role Key)
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const caller = getCallerIdentity(req);
    const role = (caller.isAdmin ? 'admin' : (caller.userRole || req.body?.role || req.query?.role || 'client')).toLowerCase().trim();

    const db = readDb();
    if (!db.bookingSoftDeletes) db.bookingSoftDeletes = {};
    if (!db.bookingSoftDeletes[id]) {
      db.bookingSoftDeletes[id] = { client: false, expert: false, admin: false };
    }
    if (role === 'admin' || caller.isAdmin) db.bookingSoftDeletes[id].admin = true;
    else if (role === 'expert') db.bookingSoftDeletes[id].expert = true;
    else db.bookingSoftDeletes[id].client = true;

    writeDb(db);

    // Try Supabase update in background
    try {
      const updateData = role === 'admin'
        ? { deleted_by_admin: true, updated_at: new Date().toISOString() }
        : role === 'expert'
          ? { deleted_by_expert: true, updated_at: new Date().toISOString() }
          : { deleted_by_client: true, updated_at: new Date().toISOString() };
      await supabase.from('bookings').update(updateData).eq('id', id);
    } catch {}

    res.json({ success: true, message: `Booking removed from ${role} view successfully`, role });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// RAZORPAY PAYMENT ENDPOINTS
// ============================================================

// Create Razorpay Order
app.post('/api/payment/create-order', async (req, res) => {
  try {
    const { amount, receipt, notes } = req.body;

    if (!amount || !receipt) {
      return res.status(400).json({ success: false, error: 'Amount and receipt are required' });
    }

    // Create order using Razorpay API
    // Note: You need to install razorpay package: npm install razorpay
    // And add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env
    const Razorpay = (await import('razorpay')).default;
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency: 'INR',
      receipt,
      notes: notes || {}
    };

    const order = await razorpay.orders.create(options);

    res.json({ success: true, order });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify Razorpay Payment
app.post('/api/payment/verify', async (req, res) => {
  try {
    const { paymentId, orderId, signature } = req.body;

    if (!paymentId || !orderId || !signature) {
      return res.status(400).json({ success: false, error: 'Payment ID, Order ID, and Signature are required' });
    }

    const crypto = (await import('crypto')).default;
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

    const generatedSignature = crypto
      .createHmac('sha256', razorpaySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const isVerified = generatedSignature === signature;

    if (isVerified) {
      // Update payment status in database
      await supabase
        .from('wallet_transactions')
        .insert({
          id: `tx-${Date.now()}`,
          user_id: req.body.userId || 'unknown',
          user_email: req.body.userEmail || 'unknown',
          user_role: req.body.userRole || 'client',
          amount: req.body.amount,
          type: 'CREDIT',
          status: 'SUCCESS',
          description: 'Payment successful',
          related_booking_id: req.body.bookingId,
          related_project_review_id: req.body.projectReviewId
        });

      res.json({ success: true, verified: true });
    } else {
      res.json({ success: false, verified: false, error: 'Invalid signature' });
    }
  } catch (err) {
    console.error('Error verifying payment:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Payment Status
app.get('/api/payment/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const Razorpay = (await import('razorpay')).default;
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const order = await razorpay.orders.fetch(orderId);

    res.json({ success: true, order });
  } catch (err) {
    console.error('Error fetching payment status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// WALLET & KV ENDPOINTS
// ============================================================
app.get('/api/kv', (req, res) => {
  try {
    const key = req.query.key;
    const db = readDb();
    const kv = db.kv || {};
    if (key) {
      res.json({ success: true, key, value: kv[key] ?? null });
    } else {
      res.json({ success: true, kv });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/kv', (req, res) => {
  try {
    const { key, value, updates } = req.body || {};
    const db = readDb();
    if (!db.kv) db.kv = {};
    if (key) db.kv[key] = value;
    if (updates && typeof updates === 'object') Object.assign(db.kv, updates);
    writeDb(db);
    res.json({ success: true, kv: db.kv });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// WALLET (egress-safe + data-safe)
// ------------------------------------------------------------
// - The balance is computed IN THE DATABASE (wallet_balance SQL function) → one number,
//   instead of downloading every transaction on every request.
// - History is capped to the latest 50 rows, newest first.
// - Deposits/deductions go through wallet_apply_transaction(): one atomic step, and the same
//   payment for the same booking/project review is never recorded twice (double-click/retry safe).
// - The db.json mirror is best-effort only: on Vercel the disk is read-only, and a failure there
//   must NOT turn a successful payment into an error (which made users retry → double charge).
// ============================================================
function mirrorWalletBalanceToDbJson(cleanEmail, balance) {
  try {
    const db = readDb();
    if (!db.kv) db.kv = {};
    db.kv[`client_wallet_${cleanEmail}`] = String(balance);
    writeDb(db);
  } catch {
    /* read-only filesystem (Vercel) — Supabase is the source of truth */
  }
}

app.get('/api/wallet', async (req, res) => {
  try {
    const userId = req.query.userId || '';
    const userEmail = (req.query.userEmail || '').toLowerCase().trim();

    const [balanceFromDb, transactions] = await Promise.all([
      getWalletBalance(userEmail, userId),
      getWalletHistory(userEmail, userId, 50)
    ]);

    let balance = balanceFromDb;
    if (transactions.length === 0) {
      // Legacy local-only balance (from before Supabase), kept for compatibility.
      try {
        const kvBal = Number((readDb().kv || {})[`client_wallet_${userEmail}`]);
        if (!isNaN(kvBal) && kvBal > 0) balance = kvBal;
      } catch {}
    }

    res.json({ success: true, balance, transactions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

async function handleWalletWrite(req, res, type) {
  try {
    const { userId, userEmail, userRole, amount, description, relatedBookingId, relatedProjectReviewId } = req.body || {};
    const cleanEmail = (userEmail || '').toLowerCase().trim();
    const cleanId = userId || cleanEmail;
    const numAmount = Number(amount);
    if (!cleanEmail && !cleanId) return res.status(400).json({ success: false, error: 'userEmail or userId is required' });
    if (!Number.isFinite(numAmount) || numAmount <= 0) return res.status(400).json({ success: false, error: 'Amount must be > 0' });

    const txRecord = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: cleanId,
      user_email: cleanEmail,
      user_role: userRole || 'client',
      amount: numAmount,
      type,
      status: 'SUCCESS',
      description: description || (type === 'CREDIT' ? 'Wallet Top-up' : 'Consultation Booking Payment'),
      related_booking_id: relatedBookingId || null,
      related_project_review_id: relatedProjectReviewId || null
    };

    const result = await applyWalletTransaction(txRecord);
    mirrorWalletBalanceToDbJson(cleanEmail, result.balance);
    res.json({ success: true, balance: result.balance, transaction: result.transaction, duplicate: result.duplicate });
  } catch (err) {
    console.error(`[wallet] ${type} failed:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

app.post('/api/wallet/deposit', (req, res) => handleWalletWrite(req, res, 'CREDIT'));
app.post('/api/wallet/deduct', (req, res) => handleWalletWrite(req, res, 'DEBIT'));

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ Supabase connected`);
  console.log(`✅ API endpoints ready`);
});
