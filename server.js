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
app.use(express.json());

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
    const { data: experts, error } = await supabase
      .from('experts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
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
    const { data: expert, error } = await supabase
      .from('experts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
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

// Get Pending Verifications (for Admin Dashboard)
app.get('/api/admin/pending-verifications', async (req, res) => {
  try {
    const { status } = req.query;
    console.log('[ADMIN API] Fetching pending verifications, status filter:', status);

    // 1. Try querying expert_profiles directly
    try {
      let query = supabase
        .from('expert_profiles')
        .select('*')
        .neq('is_removed', true)
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      } else {
        query = query.in('status', ['pending_verification', 'submitted', 'under_review', 'changes_requested', 'rejected']);
      }

      const { data: experts, error } = await query;

      if (!error && Array.isArray(experts)) {
        // Fetch all documents for these experts
        const expertIds = experts.map(e => e.id);
        let docsMap = {};
        if (expertIds.length > 0) {
          try {
            const { data: docs } = await supabase
              .from('documents')
              .select('*')
              .in('expert_id', expertIds);
            if (Array.isArray(docs)) {
              docs.forEach(d => {
                if (!docsMap[d.expert_id]) docsMap[d.expert_id] = {};
                docsMap[d.expert_id][d.document_type] = d;
              });
            }
          } catch {}
        }

        // Fetch recent profile changes
        let changesMap = {};
        if (expertIds.length > 0) {
          try {
            const { data: changes } = await supabase
              .from('expert_profile_changes')
              .select('*')
              .in('expert_id', expertIds)
              .order('changed_at', { ascending: false })
              .limit(50);
            if (Array.isArray(changes)) {
              changes.forEach(c => {
                if (!changesMap[c.expert_id]) changesMap[c.expert_id] = [];
                changesMap[c.expert_id].push(c);
              });
            }
          } catch {}
        }

        const transformed = experts.map((exp) => {
          const expertDocs = docsMap[exp.id] || {};
          const docCount = Object.keys(expertDocs).length;
          const changes = changesMap[exp.id] || [];

          return {
            id: exp.id,
            expertId: exp.id,
            name: exp.full_name || 'Senior Professional',
            email: exp.email || '',
            phone: exp.phone || '',
            field: exp.field || 'Strategic Leadership',
            company: exp.company || 'Enterprise Firm',
            years: exp.years || 0,
            baseRate: exp.base_rate || 799,
            projectRate: exp.project_rate || 1000,
            bio: exp.bio || '',
            status: exp.status === 'pending_verification' && docCount === 0 ? 'Registered / Documents Pending' :
                   exp.status === 'pending_verification' ? 'Pending Audit' :
                   exp.status === 'submitted' ? 'Submitted' :
                   exp.status === 'under_review' ? 'Under Review' :
                   exp.status === 'changes_requested' ? 'Changes Requested' :
                   exp.status === 'rejected' ? 'Rejected' : 'Approved',
            verificationStatus: exp.status,
            rejectionReason: exp.rejection_reason,
            adminComments: exp.admin_comments,
            submittedAt: exp.created_at,
            reviewedAt: exp.reviewed_at,
            reviewedBy: exp.reviewed_by,
            is_removed: exp.is_removed || false,
            documents: expertDocs,
            recentChanges: changes
          };
        });

        console.log('[ADMIN API] Returning live Supabase expert_profiles:', transformed.length);
        return res.json(transformed);
      }
    } catch (sbErr) {
      console.warn('[ADMIN API] expert_profiles query note:', sbErr.message);
    }

    // Fallback: Read from local db.json
    const dbPath = path.resolve(__dirname, 'db.json');
    if (fs.existsSync(dbPath)) {
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const localExperts = (db.users || []).filter((u) => u.role === 'expert' && !u.is_removed);
      const transformed = localExperts.map((u) => ({
        id: u.id,
        expertId: u.id,
        name: u.full_name || u.name || 'Senior Professional',
        email: u.email || '',
        phone: u.phone || '',
        field: u.field || 'Strategic Leadership',
        company: u.company || 'Enterprise Firm',
        years: u.years || 0,
        baseRate: u.baseRate || 799,
        projectRate: u.projectRate || 1000,
        bio: u.bio || '',
        status: 'Pending Audit',
        verificationStatus: 'pending_verification',
        submittedAt: u.createdAt || new Date().toISOString(),
        documents: u.documents || {},
        recentChanges: []
      }));
      return res.json(transformed);
    }

    res.json([]);
  } catch (err) {
    console.error('Error fetching pending verifications:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Action: Approve Document (or all documents)
app.post('/api/admin/approve-document', async (req, res) => {
  try {
    const { expertId, documentType, adminId = 'admin' } = req.body;
    if (!expertId) return res.status(400).json({ success: false, error: 'expertId is required' });

    let docUpdate = null;
    if (documentType) {
      // Approve single document
      const { data, error } = await supabase
        .from('documents')
        .update({
          status: 'approved',
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: null
        })
        .match({ expert_id: expertId, document_type: documentType })
        .select();
      docUpdate = data;
    }

    // Check all documents for this expert
    const { data: allDocs } = await supabase
      .from('documents')
      .select('*')
      .eq('expert_id', expertId);

    const requiredTypes = ['expCert', 'offerLetter', 'resume'];
    const approvedTypes = (allDocs || [])
      .filter((d) => d.status === 'approved')
      .map((d) => d.document_type);

    const allApproved = requiredTypes.every(t => approvedTypes.includes(t)) || !documentType;

    let expertProfileUpdate = null;
    if (allApproved) {
      // Promote expert to approved
      const { data: epData } = await supabase
        .from('expert_profiles')
        .update({
          status: 'approved',
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: null
        })
        .eq('id', expertId)
        .select()
        .single();
      expertProfileUpdate = epData;

      // Also ensure experts table has verified = true
      try {
        await supabase
          .from('experts')
          .update({ verified: true })
          .or(`id.eq.${expertId},email.eq.${epData?.email}`);
      } catch {}
    }

    res.json({
      success: true,
      allApproved,
      document: docUpdate,
      expert: expertProfileUpdate
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Action: Reject Document (with mandatory reason)
app.post('/api/admin/reject-document', async (req, res) => {
  try {
    const { expertId, documentType, reason, adminId = 'admin' } = req.body;
    if (!expertId) return res.status(400).json({ success: false, error: 'expertId is required' });
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'Mandatory rejection reason is required' });
    }

    const cleanReason = reason.trim();

    // 1. Update document
    if (documentType) {
      await supabase
        .from('documents')
        .update({
          status: 'rejected',
          rejection_reason: cleanReason,
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString()
        })
        .match({ expert_id: expertId, document_type: documentType });
    }

    // 2. Update expert_profiles
    const { data: expert, error: epErr } = await supabase
      .from('expert_profiles')
      .update({
        status: 'changes_requested',
        rejection_reason: cleanReason,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', expertId)
      .select()
      .single();

    if (epErr) throw epErr;
    res.json({ success: true, expert, rejectionReason: cleanReason });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Action: Remove Expert (Soft Delete)
app.post('/api/admin/remove-expert', async (req, res) => {
  try {
    const { expertId, adminId = 'admin' } = req.body;
    if (!expertId) return res.status(400).json({ success: false, error: 'expertId is required' });

    // 1. Update expert_profiles with soft delete
    const { data: epData, error: epErr } = await supabase
      .from('expert_profiles')
      .update({
        is_removed: true,
        status: 'removed',
        removed_at: new Date().toISOString(),
        reviewed_by: adminId
      })
      .eq('id', expertId)
      .select()
      .single();

    // 2. Also soft-delete in local db.json if exists
    try {
      const dbPath = path.resolve(__dirname, 'db.json');
      if (fs.existsSync(dbPath)) {
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const uIdx = (db.users || []).findIndex((u) => u.id === expertId);
        if (uIdx >= 0) {
          db.users[uIdx].is_removed = true;
          db.users[uIdx].status = 'removed';
          fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
        }
      }
    } catch {}

    res.json({ success: true, message: 'Expert removed from queue (soft delete)', expert: epData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Document Upload to Supabase Storage Bucket
app.post('/api/documents/upload', async (req, res) => {
  try {
    const { expertId, documentType, fileName, fileData, fileSize } = req.body;
    if (!expertId || !documentType || !fileData) {
      return res.status(400).json({ success: false, error: 'expertId, documentType, and fileData are required' });
    }

    // Convert Base64 data URL to buffer
    let buffer;
    let contentType = 'application/pdf';
    if (fileData.startsWith('data:')) {
      const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches) {
        contentType = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(fileData, 'base64');
      }
    } else {
      buffer = Buffer.from(fileData, 'utf-8');
    }

    const cleanFileName = fileName || `${Date.now()}_${documentType}.pdf`;
    const filePath = `${expertId}/${documentType}/${cleanFileName}`;

    // Upload to Supabase Storage private bucket
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('expert-documents')
      .upload(filePath, buffer, { contentType, upsert: true });

    if (uploadErr) {
      console.warn('[STORAGE] Upload warning:', uploadErr.message);
    }

    // Generate signed URL for immediate preview
    const { data: signedData } = await supabase.storage
      .from('expert-documents')
      .createSignedUrl(filePath, 3600);

    // Upsert into documents table
    const docRecord = {
      expert_id: expertId,
      document_type: documentType,
      file_path: filePath,
      file_name: cleanFileName,
      file_size: fileSize || `${(buffer.length / (1024 * 1024)).toFixed(1)} MB`,
      status: 'pending',
      rejection_reason: null,
      uploaded_at: new Date().toISOString()
    };

    try {
      await supabase
        .from('documents')
        .upsert(docRecord, { onConflict: 'expert_id,document_type' });
    } catch (dbErr) {
      console.warn('[DOCUMENTS] DB upsert note:', dbErr.message);
    }

    // If expert was in changes_requested or rejected, reset to pending_verification
    try {
      await supabase
        .from('expert_profiles')
        .update({ status: 'pending_verification', rejection_reason: null })
        .eq('id', expertId);
    } catch {}

    res.json({
      success: true,
      filePath,
      signedUrl: signedData?.signedUrl || fileData,
      document: docRecord
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Generate Signed URL for Document Viewing
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

// Admin Action: Approve Expert
app.post('/api/admin/approve-expert', async (req, res) => {
  try {
    const { expertId, adminId, comments } = req.body;

    const { data, error } = await supabase
      .from('expert_profiles')
      .update({
        status: 'approved',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        admin_comments: comments,
        rejection_reason: null
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

// Admin Action: Request Changes
app.post('/api/admin/request-changes', async (req, res) => {
  try {
    const { expertId, adminId, comments } = req.body;

    const { data, error } = await supabase
      .from('expert_profiles')
      .update({
        status: 'changes_requested',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        admin_comments: comments,
        rejection_reason: null
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

// Admin Action: Reject Expert
app.post('/api/admin/reject-expert', async (req, res) => {
  try {
    const { expertId, adminId, reason } = req.body;

    const { data, error } = await supabase
      .from('expert_profiles')
      .update({
        status: 'rejected',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
        admin_comments: null
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
    let query = supabase.from('expert_availability').select('*');

    if (expertId) query = query.eq('expert_id', expertId);
    if (date) query = query.eq('availability_date', date);
    if (status) query = query.eq('status', status);

    const { data: availabilities, error } = await query;
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
    const { data: slot, error } = await supabase
      .from('expert_availability')
      .insert(slotData)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, availability: slot });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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

// ============================================================
// PROJECT REVIEWS ENDPOINTS
// ============================================================

// Get Project Reviews
app.get('/api/project-reviews', async (req, res) => {
  try {
    const { id, clientId, expertId, status } = req.query;
    let query = supabase.from('project_reviews').select('*');

    if (id) query = query.eq('project_review_id', id);
    if (clientId) query = query.eq('client_id', clientId);
    if (expertId) query = query.eq('expert_id', expertId);
    if (status) query = query.eq('status', status);

    query = query.order('updated_at', { ascending: false });

    const { data: reviews, error } = await query;
    if (error) throw error;

    if (id && reviews && reviews.length > 0) {
      return res.json({ success: true, projectReview: reviews[0] });
    }

    res.json({ success: true, projectReviews: reviews || [] });
  } catch (err) {
    try {
      const dbPath = path.resolve(__dirname, 'db.json');
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      let list = db.projectReviews || [];
      if (req.query.id) list = list.filter(r => r.id === req.query.id || r.project_review_id === req.query.id);
      if (req.query.clientId) list = list.filter(r => r.clientId === req.query.clientId || r.client_id === req.query.clientId);
      if (req.query.expertId) list = list.filter(r => r.expertId === req.query.expertId || r.expert_id === req.query.expertId);
      res.json({ success: true, projectReviews: list });
    } catch {
      res.status(500).json({ success: false, error: err.message });
    }
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
      .select('*');

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
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

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

// Get Bookings
app.get('/api/bookings', async (req, res) => {
  try {
    const { clientId, expertId } = req.query;
    let query = supabase.from('bookings').select('*');

    if (clientId) query = query.eq('client_id', clientId);
    if (expertId) query = query.eq('expert_id', expertId);

    query = query.order('created_at', { ascending: false });

    const { data: bookings, error } = await query;
    if (error) throw error;

    res.json({ success: true, bookings: bookings || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create Booking
app.post('/api/bookings', async (req, res) => {
  try {
    const bookingData = req.body;
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, booking });
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
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ Supabase connected`);
  console.log(`✅ API endpoints ready`);
});
