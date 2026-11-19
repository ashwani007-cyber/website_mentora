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
  fetchExpertsListCached,
  EXPERTS_LIST_CACHE_HEADER,
  clearMemo,
  fetchExpertsSlim,
  fetchExpertByKeySlim,
  fetchUnverifiedExpertsSlim,
  uploadAvatarFromDataUrl
} from './server/egressHelpers.js';
import { handleApiMiddleware } from './server/authHandler.js';
import { handleDomainApiMiddleware } from './server/domainHandler.js';
import { handleProjectReview } from './server/projectReviewHandler.js';
import { handleConsultation } from './server/consultationHandler.js';
import { handleAvailability } from './server/availabilityHandler.js';
import { handleConsultationReview } from './server/consultationReviewHandler.js';
import { handleWallet } from './server/walletHandler.js';
import { handleNotifications } from './server/notificationHandler.js';
import { handleBlogs } from './server/blogHandler.js';
import { authorizeCredentialAccess, handleCredentialRead } from './server/documentAccess.js';
import { handleWorkflowDiagnostics } from './server/workflowDiagnostics.js';
import { isAuthorizedAdmin } from './server/session.js';

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
app.use(['/api/health', '/api/experts/markup'], handleWorkflowDiagnostics);

app.use('/api/auth', (req, res, next) => {
  req.url = `/api/auth${req.url === '/' ? '' : req.url}`;
  handleApiMiddleware(req, res, next);
});

app.use('/api/domains', (req, res, next) => {
  handleDomainApiMiddleware(req, res, next);
});

app.get('/api/db', (req, res) => {
  // SECURITY: this returns the WHOLE local db.json (emails, bookings, notifications…). It exists only
  // for local development. In production (Vercel) it must never be reachable.
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, error: 'Not available' });
  }
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

// Expert list for all pages — cached 60 s on the server AND by the CDN (Vercel edge), so repeat
// visitors and bots don't trigger database queries. ?fresh=… (sent right after a save) skips both.
// Must stay ABOVE /api/experts/:id, otherwise Express would treat "list" as an expert id.
app.get('/api/experts/list', async (req, res) => {
  try {
    const fresh = Boolean(req.query.fresh);
    const experts = await fetchExpertsListCached({ force: fresh });
    res.setHeader('Cache-Control', fresh ? 'no-store' : EXPERTS_LIST_CACHE_HEADER);
    res.json(experts || []);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
    if (!await isAuthorizedAdmin(req)) {
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
    if (!await isAuthorizedAdmin(req)) {
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
    if (!await isAuthorizedAdmin(req)) {
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
    if (!await isAuthorizedAdmin(req)) {
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

    expertId = (await authorizeCredentialAccess(req, expertId)).id;
    if (buffer.subarray(0, 5).toString() !== '%PDF-' || buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'Upload a valid PDF of 10 MB or less' });
    }

    const typeMap = {
      expCert: 'work_experience_cert',
      offerLetter: 'offer_relieving_letter',
      resume: 'executive_cv',
      work_experience_cert: 'work_experience_cert',
      offer_relieving_letter: 'offer_relieving_letter',
      executive_cv: 'executive_cv'
    };
    const targetDocType = typeMap[docType];
    if (!targetDocType) return res.status(400).json({ success: false, error: 'Unknown credential type' });
    const version = crypto.randomUUID();
    const sanitizedName = (fileName || `${targetDocType}.pdf`)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.pdf$/i, '');
    const cleanFileName = `${sanitizedName}.pdf`;
    const filePath = `${expertId}/${targetDocType}/${version}_${cleanFileName}`;

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

    const { data: dbData, error: dbError } = await supabase.from('expert_documents')
      .upsert(docRecord, { onConflict: 'expert_id,doc_type' }).select().single();
    if (dbError) {
      if (/^[0-9]{2}[0-9A-Z]{3}$/.test(dbError.code || '')) await supabase.storage.from('expert-documents').remove([filePath]);
      throw dbError;
    }
    Object.assign(docRecord, dbData);

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
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// GET Expert Documents endpoint (with fallback to experts table)
app.get('/api/expert-documents', async (req, res) => {
  try {
    let { expertId } = req.query;
    if (!expertId) return res.status(400).json({ success: false, error: 'expertId is required' });

    expertId = (await authorizeCredentialAccess(req, expertId)).id;
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
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Delete Expert Document endpoint
app.post('/api/expert-documents/delete', async (req, res) => {
  try {
    const { expertId, docType } = req.body;
    const expert = await authorizeCredentialAccess(req, expertId);
    const { data: document, error } = await supabase.from('expert_documents').select('file_path')
      .eq('expert_id', expert.id).eq('doc_type', docType).maybeSingle();
    if (error) throw error;
    const filePath = document?.file_path;
    if (filePath) {
      await supabase.storage.from('expert-documents').remove([filePath]).catch(() => {});
    }
    try {
      await supabase.from('expert_documents').delete().match({ expert_id: expert.id, doc_type: docType });
    } catch {}
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Sync Document Record endpoint
app.post('/api/expert-documents/sync-record', async (req, res) => {
  try {
    const { expert_id, doc_type, file_path, file_name, file_size } = req.body || {};
    const expert = await authorizeCredentialAccess(req, expert_id);
    if (!['work_experience_cert', 'offer_relieving_letter', 'executive_cv'].includes(doc_type) ||
        typeof file_path !== 'string' || !file_path.startsWith(`${expert.id}/${doc_type}/`)) {
      return res.status(400).json({ success: false, error: 'Document reference does not match the credential slot' });
    }
    const record = { expert_id: expert.id, doc_type, file_path, file_name, file_size, mime_type: 'application/pdf', status: 'pending', admin_remark: null };
    const { data, error } = await supabase.from('expert_documents').upsert(record, { onConflict: 'expert_id,doc_type' }).select().single();
    if (error) throw error;
    res.json({ success: true, document: data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

app.post('/api/expert-documents/update-status', async (req, res) => {
  try {
    if (!await isAuthorizedAdmin(req)) return res.status(403).json({ success: false, error: 'Administrator access required' });
    const { docId, expertId, docType, status, adminRemark } = req.body || {};
    if ((!docId && (!expertId || !docType)) || !['pending', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Document and valid audit status are required' });
    }
    let write = supabase.from('expert_documents').update({ status, admin_remark: adminRemark || null, updated_at: new Date().toISOString() });
    write = docId ? write.eq('id', docId) : write.eq('expert_id', expertId).eq('doc_type', docType);
    const { data, error } = await write.select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Document not found' });
    res.json({ success: true, document: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use(handleCredentialRead);

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
    if (!await isAuthorizedAdmin(req)) return res.status(403).json({ success: false, error: 'Administrator access required' });
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
app.use('/api/availability', handleAvailability);

app.use('/api/reviews', handleConsultationReview);

app.use(['/api/project-reviews', '/api/platform-settings'], handleProjectReview);

app.use('/api/notifications', handleNotifications);
app.use(['/api/blogs', '/api/admin/blogs'], handleBlogs);

// ============================================================
// BOOKINGS ENDPOINTS
// ============================================================

// Helper to retrieve and filter bookings from db.json
app.use('/api/bookings', handleConsultation);

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
    // SECURITY: listing ALL keys exposes every user's local session data — dev only.
    if (!key && (process.env.VERCEL || process.env.NODE_ENV === 'production')) {
      return res.status(400).json({ success: false, error: 'key is required' });
    }
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

app.use('/api/wallet', handleWallet);

// ============================================================
// START SERVER
// ============================================================
// On Vercel the app runs as a serverless function (api/index.js imports it), so it must NOT
// open its own port there. Locally (`npm run server`) it listens as before.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`✅ Supabase connected`);
    console.log(`✅ API endpoints ready`);
  });
}

// Vercel entry point (api/index.js) imports this. Before, nothing was exported, so the deployed
// /api/... routes could not work and the site silently fell back to direct Supabase calls.
export default app;
