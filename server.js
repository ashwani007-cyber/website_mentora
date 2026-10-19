// Express + Mongoose (MongoDB) Server Template for The Registry Platform
// Run with: node server.js

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { handleApiMiddleware } from './server/mongoHandler.js';

const app = express();
app.use(cors());
app.use(express.json());

// Forward /api/auth requests to MongoDB Authentication Handler
app.use(async (req, res, next) => {
  if (req.url && req.url.startsWith('/api/auth')) {
    return handleApiMiddleware(req, res, next);
  }
  next();
});

// MongoDB Connection URI (Replace with your Atlas connection URI)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://admin:password@cluster0.mongodb.net/silver_workforce?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Atlas Connected Successfully!'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// Schemas
const ExpertSchema = new mongoose.Schema({
  id: String,
  name: String,
  field: String,
  years: Number,
  baseRate: Number,
  adminMarkup: Number,
  rate: Number,
  rating: Number,
  sessions: Number,
  verified: Boolean,
  initials: String,
  title: String,
  phone: String,
  email: String,
  bio: String,
  skills: [String],
  documents: Object
});

const Expert = mongoose.model('Expert', ExpertSchema);

const ExpertAvailabilitySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  expertId: { type: String, required: true },
  availabilityDate: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  status: { type: String, enum: ['AVAILABLE', 'BOOKED', 'DISABLED'], default: 'AVAILABLE' },
  bookingId: { type: String, default: null },
  clientId: { type: String, default: null },
  clientName: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const ExpertAvailability = mongoose.model('ExpertAvailability', ExpertAvailabilitySchema);

// API Endpoints
app.get('/api/experts', async (req, res) => {
  const experts = await Expert.find();
  res.json(experts);
});

app.post('/api/experts/markup', async (req, res) => {
  const { id, baseRate, adminMarkup } = req.body;
  const updated = await Expert.findOneAndUpdate(
    { id },
    { baseRate, adminMarkup, rate: baseRate + adminMarkup },
    { new: true }
  );
  res.json(updated);
});

// Availability Endpoints
app.get('/api/availability', async (req, res) => {
  const { expertId, date, status } = req.query;
  const query = {};
  if (expertId) query.expertId = expertId;
  if (date) query.availabilityDate = date;
  if (status) query.status = status;
  const list = await ExpertAvailability.find(query);
  res.json({ success: true, availabilities: list });
});

app.post('/api/availability/book', async (req, res) => {
  const { slotId, bookingId, clientId, clientName } = req.body;
  const slot = await ExpertAvailability.findOneAndUpdate(
    { id: slotId, status: 'AVAILABLE' },
    { status: 'BOOKED', bookingId, clientId, clientName, updatedAt: new Date() },
    { new: true }
  );
  if (!slot) {
    return res.status(409).json({ success: false, error: 'Slot is not available or already booked' });
  }
  res.json({ success: true, availability: slot });
});

// Project Review Schema (WORKFLOW B)
const ProjectReviewSchema = new mongoose.Schema({
  projectReviewId: { type: String, required: true, unique: true },
  clientId: { type: String, required: true },
  clientName: { type: String, default: 'Client' },
  clientEmail: { type: String, required: true },
  expertId: { type: String, required: true },
  expertName: { type: String, default: 'Expert' },
  expertEmail: { type: String, required: true },
  packageId: { type: String, default: 'project_review' },
  packageName: { type: String, default: 'Dedicated Project Review' },
  price: { type: Number, required: true },
  expertEarning: { type: Number, required: true },
  platformFee: { type: Number, default: 0 },
  status: { type: String, default: 'PendingExpertAcceptance' },
  paymentStatus: { type: String, default: 'PaymentPending' },
  expertEarningStatus: { type: String, default: 'EarningPending' },
  requestNotes: { type: String, default: '' },
  expectedScope: { type: String, default: '' },
  reviewType: { type: String, default: '' },
  submission: { type: Object, default: null },
  chat: { type: Array, default: [] },
  proposedTimes: { type: Array, default: [] },
  meetings: { type: Array, default: [] },
  completedMeetingCount: { type: Number, default: 0 },
  reviewFeedback: { type: Object, default: null },
  clientWalletTxId: { type: String, default: null },
  expertWalletTxId: { type: String, default: null },
  clientArchived: { type: Boolean, default: false },
  expertArchived: { type: Boolean, default: false },
  activityTimeline: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const ProjectReview = mongoose.model('ProjectReview', ProjectReviewSchema);

// Project Review Endpoints

// Project Review Pricing & Platform Fee Endpoints
app.get('/api/project-reviews/pricing', async (req, res) => {
  try {
    const { expertId, all, role } = req.query;
    const dbPath = path.resolve(__dirname, 'db.json');
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const feeConfig = db.platformCharge || db.projectReviewConfig || { feeType: 'fixed', feeValue: 200, currency: 'INR' };

    if (expertId) {
      const exp = (db.experts || []).find(e =>
        e.id === expertId ||
        (e.email && e.email.toLowerCase() === expertId.toLowerCase()) ||
        (e.name && e.name.toLowerCase() === expertId.toLowerCase())
      );
      if (!exp) return res.status(404).json({ success: false, error: 'Expert not found' });
      const activePrice = typeof exp.projectRate === 'number'
        ? Math.min(2000, Math.max(0, exp.projectRate))
        : Math.min(2000, Math.max(0, exp.rate ? exp.rate * 3 : 1000));
      let platformFee = 0;
      if (feeConfig.feeType === 'fixed') {
        platformFee = Math.max(0, Number(feeConfig.feeValue) ?? 200);
      } else {
        platformFee = Math.round(activePrice * ((Number(feeConfig.feeValue) || 15) / 100));
      }
      const clientPrice = activePrice + platformFee;
      return res.json({
        success: true,
        expertId: exp.id,
        expertName: exp.name,
        projectRate: activePrice,
        platformFee,
        platformCharge: platformFee,
        platformFeeConfig: feeConfig,
        platformChargeConfig: feeConfig,
        clientPrice,
        minPrice: 0,
        maxPrice: 2000
      });
    }

    if (all === 'true' || role === 'admin') {
      const expertsList = (db.experts || []).map(e => {
        const pRate = typeof e.projectRate === 'number'
          ? Math.min(2000, Math.max(0, e.projectRate))
          : Math.min(2000, Math.max(0, e.rate ? e.rate * 3 : 1000));
        let pFee = 0;
        if (feeConfig.feeType === 'fixed') {
          pFee = Math.max(0, Number(feeConfig.feeValue) ?? 200);
        } else {
          pFee = Math.round(pRate * ((Number(feeConfig.feeValue) || 15) / 100));
        }
        return {
          id: e.id,
          name: e.name,
          field: e.field,
          rate: e.rate,
          baseRate: e.baseRate,
          projectRate: pRate,
          platformFee: pFee,
          platformCharge: pFee,
          clientPrice: pRate + pFee,
          updatedAt: e.projectRateUpdatedAt || e.updatedAt || '2026-09-30T00:00:00.000Z'
        };
      });
      return res.json({
        success: true,
        experts: expertsList,
        platformFeeConfig: feeConfig,
        platformCharge: feeConfig,
        minPrice: 0,
        maxPrice: 2000
      });
    }

    res.status(400).json({ success: false, error: 'expertId or all=true query parameter is required' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/project-reviews/pricing', async (req, res) => {
  try {
    const { expertId, projectRate, price: altPrice, role, userId, userEmail } = req.body;
    const targetPrice = projectRate !== undefined ? projectRate : altPrice;

    if (role === 'client') {
      return res.status(403).json({ success: false, error: 'Unauthorized: Clients cannot modify Project Review prices' });
    }

    if (targetPrice === undefined || targetPrice === null || typeof targetPrice !== 'number' || isNaN(targetPrice) || !isFinite(targetPrice)) {
      return res.status(400).json({ success: false, error: 'Project Review price must be a valid number' });
    }

    if (targetPrice < 0 || targetPrice > 2000) {
      return res.status(400).json({ success: false, error: 'Project Review price must be between ₹0 and ₹2,000.' });
    }

    if (!expertId) {
      return res.status(400).json({ success: false, error: 'expertId is required' });
    }

    if (role === 'expert') {
      if (userId && expertId && userId !== expertId) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Experts can only modify their own Project Review price' });
      }
    } else if (role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized role' });
    }

    const dbPath = path.resolve(__dirname, 'db.json');
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const targetExp = (db.experts || []).find(e =>
      e.id === expertId ||
      (e.email && e.email.toLowerCase() === expertId.toLowerCase()) ||
      (e.name && e.name.toLowerCase() === expertId.toLowerCase())
    );

    if (!targetExp) {
      return res.status(404).json({ success: false, error: 'Expert not found' });
    }

    if (role === 'expert') {
      if (userId && userId !== targetExp.id && userId !== expertId) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Experts can only modify their own Project Review price' });
      }
      if (userEmail && targetExp.email && userEmail.toLowerCase().trim() !== targetExp.email.toLowerCase().trim()) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Experts can only modify their own Project Review price' });
      }
    }

    const previousRate = typeof targetExp.projectRate === 'number'
      ? targetExp.projectRate
      : (targetExp.rate ? Math.min(2000, targetExp.rate * 3) : 1000);

    targetExp.projectRate = Math.round(targetPrice);
    targetExp.projectRateUpdatedAt = new Date().toISOString();

    if (!Array.isArray(db.pricingAuditLogs)) db.pricingAuditLogs = [];
    db.pricingAuditLogs.unshift({
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      changeType: 'expert_price',
      targetExpertId: targetExp.id,
      targetExpertName: targetExp.name,
      previousValue: previousRate,
      newValue: targetExp.projectRate,
      changedByRole: role,
      changedById: userId || (role === 'admin' ? 'admin' : targetExp.id),
      context: 'project_review',
      timestamp: new Date().toISOString()
    });

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

    const feeConfig = db.platformCharge || db.projectReviewConfig || { feeType: 'fixed', feeValue: 200, currency: 'INR' };
    let platformFee = 0;
    if (feeConfig.feeType === 'fixed') {
      platformFee = Math.max(0, Number(feeConfig.feeValue) ?? 200);
    } else {
      platformFee = Math.round(targetExp.projectRate * ((Number(feeConfig.feeValue) || 15) / 100));
    }
    const clientPrice = targetExp.projectRate + platformFee;

    res.json({
      success: true,
      expertId: targetExp.id,
      expertName: targetExp.name,
      projectRate: targetExp.projectRate,
      platformFee,
      clientPrice,
      message: 'Project Review price updated successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/platform-settings', (req, res) => {
  const dbPath = path.resolve(__dirname, 'db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const cfg = db.platformCharge || db.projectReviewConfig || { feeType: 'fixed', feeValue: 200, currency: 'INR' };
  res.json({ success: true, config: cfg, platformCharge: cfg });
});

app.get('/api/project-reviews/platform-fee', (req, res) => {
  const { role } = req.query;
  if (role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required for platform fee configuration' });
  }
  const dbPath = path.resolve(__dirname, 'db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const cfg = db.platformCharge || db.projectReviewConfig || { feeType: 'fixed', feeValue: 200, currency: 'INR' };
  res.json({ success: true, config: cfg, platformCharge: cfg });
});

const handleUpdatePlatformFee = (req, res) => {
  const { feeType, feeValue, role, userId } = req.body;
  if (role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required for platform fee configuration' });
  }

  if (!feeType || (feeType !== 'percentage' && feeType !== 'fixed')) {
    return res.status(400).json({ success: false, error: 'feeType must be percentage or fixed' });
  }

  if (typeof feeValue !== 'number' || isNaN(feeValue) || !isFinite(feeValue) || feeValue < 0) {
    return res.status(400).json({ success: false, error: 'feeValue must be a non-negative number' });
  }

  if (feeType === 'percentage' && feeValue > 100) {
    return res.status(400).json({ success: false, error: 'Percentage fee cannot exceed 100%' });
  }

  const dbPath = path.resolve(__dirname, 'db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const previousConfig = { ...(db.platformCharge || db.projectReviewConfig || { feeType: 'fixed', feeValue: 200, currency: 'INR' }) };
  const nowIso = new Date().toISOString();

  const updatedConfig = {
    feeType,
    feeValue: Number(feeValue),
    currency: 'INR',
    updatedAt: nowIso,
    updatedBy: userId || 'admin-governance'
  };
  db.platformCharge = updatedConfig;
  db.projectReviewConfig = updatedConfig;

  if (!Array.isArray(db.pricingAuditLogs)) db.pricingAuditLogs = [];
  db.pricingAuditLogs.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    changeType: 'platform_fee',
    category: 'platform_charge',
    previousValue: previousConfig,
    newValue: updatedConfig,
    oldValue: previousConfig.feeValue,
    newValueNum: Number(feeValue),
    changedBy: userId || 'admin-governance',
    changedByRole: 'admin',
    changedById: userId || 'admin-governance',
    changedAt: nowIso,
    context: 'project_review',
    timestamp: nowIso
  });

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

  res.json({
    success: true,
    message: '✓ Platform charge updated successfully',
    config: db.platformCharge,
    platformCharge: db.platformCharge
  });
};

app.post('/api/project-reviews/platform-fee', handleUpdatePlatformFee);
app.put('/api/project-reviews/platform-fee', handleUpdatePlatformFee);
app.post('/api/platform-settings', handleUpdatePlatformFee);
app.put('/api/platform-settings', handleUpdatePlatformFee);

app.get('/api/project-reviews', async (req, res) => {
  const { id, clientId, clientEmail, clientName, expertId, expertEmail, expertName, status } = req.query;
  const conditions = [];

  if (id) conditions.push({ projectReviewId: id });

  if (clientId || clientEmail || clientName) {
    const clientConds = [];
    if (clientId) clientConds.push({ clientId });
    if (clientEmail) clientConds.push({ clientEmail: clientEmail.toLowerCase().trim() });
    if (clientName) clientConds.push({ clientName: new RegExp(`^${clientName.trim()}$`, 'i') });
    conditions.push({ $or: clientConds });
  }

  if (expertId || expertEmail || expertName) {
    const expertConds = [];
    if (expertId) expertConds.push({ expertId });
    if (expertEmail) expertConds.push({ expertEmail: expertEmail.toLowerCase().trim() });
    if (expertName) expertConds.push({ expertName: new RegExp(`^${expertName.trim()}$`, 'i') });
    conditions.push({ $or: expertConds });
  }

  if (status) conditions.push({ status });

  const query = conditions.length > 0 ? { $and: conditions } : {};
  const list = await ProjectReview.find(query).sort({ updatedAt: -1 });
  if (id && list.length > 0) {
    return res.json({ success: true, projectReview: list[0] });
  }
  res.json({ success: true, projectReviews: list });
});

app.post('/api/project-reviews/request', async (req, res) => {
  const payload = req.body;
  const dbPath = path.resolve(__dirname, 'db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  const targetExp = (db.experts || []).find(e =>
    (payload.expertId && e.id === payload.expertId) ||
    (payload.expertEmail && e.email && e.email.toLowerCase() === payload.expertEmail.toLowerCase().trim()) ||
    (payload.expertName && e.name && e.name.toLowerCase() === payload.expertName.toLowerCase().trim())
  );
  const rawPrice = typeof targetExp?.projectRate === 'number'
    ? targetExp.projectRate
    : (targetExp ? Math.min(2000, targetExp.rate * 3) : 1000);
  const expertCharge = Math.min(2000, Math.max(0, Math.round(rawPrice)));

  const feeConfig = db.platformCharge || db.projectReviewConfig || { feeType: 'fixed', feeValue: 200, currency: 'INR' };
  let platformFee = 0;
  if (feeConfig.feeType === 'fixed') {
    platformFee = Math.max(0, Number(feeConfig.feeValue) ?? 200);
  } else {
    platformFee = Math.round(expertCharge * ((Number(feeConfig.feeValue) || 15) / 100));
  }
  const price = expertCharge + platformFee;
  const expertEarning = expertCharge;

  const projectReviewId = `pr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const clientWalletTxId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();

  const review = new ProjectReview({
    ...payload,
    projectReviewId,
    price,
    paidAmount: price,
    expertCharge,
    platformFee,
    platformCharge: platformFee,
    platformChargeType: feeConfig.feeType,
    expertEarning,
    paymentMethod: 'wallet',
    clientWalletTxId,
    status: 'PendingExpertAcceptance',
    paymentStatus: 'PaymentSuccessful',
    expertEarningStatus: 'EarningPending',
    createdAt: new Date(),
    updatedAt: new Date(),
    chat: [
      {
        id: `msg-${Date.now()}-sys`,
        projectReviewId,
        senderId: 'system',
        senderRole: 'system',
        senderName: 'System',
        content: `Project Review request initiated for ₹${price.toLocaleString('en-IN')}. Escrow payment confirmed (Tx: ${clientWalletTxId}). Awaiting Expert decision.`,
        timestamp: nowIso,
        read: true
      }
    ],
    activityTimeline: [
      {
        activityId: `act-${Date.now()}`,
        projectReviewId,
        userId: payload.clientId,
        userName: payload.clientName || 'Client',
        role: 'client',
        eventType: 'request_created',
        description: `Client requested Project Review (₹${price.toLocaleString('en-IN')})`,
        newStatus: 'PendingExpertAcceptance',
        timestamp: nowIso
      },
      {
        activityId: `act-${Date.now()}-pay`,
        projectReviewId,
        userId: payload.clientId,
        userName: payload.clientName || 'Client',
        role: 'client',
        eventType: 'payment_confirmed',
        description: `Payment of ₹${price.toLocaleString('en-IN')} held in escrow (Tx: ${clientWalletTxId}).`,
        newStatus: 'PaymentSuccessful',
        timestamp: nowIso
      }
    ]
  });
  await review.save();
  res.json({ success: true, projectReview: review });
});

app.post('/api/project-reviews/:id/respond', async (req, res) => {
  const { id } = req.params;
  const { action, reason, responderId, responderRole } = req.body;
  const review = await ProjectReview.findOne({ projectReviewId: id });
  if (!review) return res.status(404).json({ success: false, error: 'Project Review not found' });

  const nowIso = new Date().toISOString();

  // Defensive initialization — records migrated from BookingModal may lack these arrays
  if (!Array.isArray(review.activityTimeline)) review.activityTimeline = [];
  if (!Array.isArray(review.chat)) review.chat = [];

  if (action === 'decline') {
    review.status = 'Declined';
    review.paymentStatus = 'Refunded';
    review.refundTxId = `ref-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    review.activityTimeline.push({
      activityId: `act-${Date.now()}`,
      projectReviewId: review.projectReviewId,
      userId: responderId || review.expertId,
      userName: review.expertName,
      role: responderRole || 'expert',
      eventType: 'request_declined',
      description: `Expert declined the request${reason ? ': ' + reason : ''}. Escrow refunded.`,
      previousStatus: 'PendingExpertAcceptance',
      newStatus: 'Declined',
      timestamp: nowIso
    });
  } else if (action === 'accept') {
    review.status = 'Accepted';
    review.activityTimeline.push({
      activityId: `act-${Date.now()}`,
      projectReviewId: review.projectReviewId,
      userId: responderId || review.expertId,
      userName: review.expertName,
      role: responderRole || 'expert',
      eventType: 'request_accepted',
      description: 'Expert accepted the Project Review request. Workspace activated.',
      previousStatus: 'PendingExpertAcceptance',
      newStatus: 'Accepted',
      timestamp: nowIso
    });
  }
  review.updatedAt = new Date();
  await review.save();
  res.json({ success: true, projectReview: review });
});

// Notification Schema & Endpoints (Notification Management System)
const NotificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  senderId: { type: String, default: 'admin' },
  target: { type: String, enum: ['all', 'client', 'expert', 'landing', 'admin'], default: 'all' },
  audienceType: { type: String, default: 'all' },
  recipientId: { type: String, default: null },
  recipientName: { type: String, default: null },
  recipientType: { type: String, default: 'all' },
  type: { type: String, default: 'announcement' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: String, default: 'Just now' },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
  status: { type: String, default: 'delivered' },
  actionLink: { type: String, default: null },
  channel: { type: String, default: 'in_app' },
  channels: { type: Array, default: ['in_app', 'email', 'push'] },
  eventId: { type: String, default: null },
  eventName: { type: String, default: 'platform_broadcast' },
  relatedEntityId: { type: String, default: null },
  metadata: { type: Object, default: {} }
});

const Notification = mongoose.model('Notification', NotificationSchema);

app.get('/api/notifications', async (req, res) => {
  const { role, recipientId, unreadOnly } = req.query;
  const normRole = (role || '').toLowerCase().trim();
  const normRec = (recipientId || '').toLowerCase().trim();

  let query = {};
  const broadcastRecipients = [null, '', 'all'];
  if (normRole === 'landing' || (!normRole && !normRec)) {
    query = { target: { $in: ['landing', 'all'] }, recipientId: { $in: broadcastRecipients } };
  } else if (normRole === 'expert') {
    query = {
      $or: [
        { target: 'all', recipientId: { $in: broadcastRecipients } },
        { target: 'expert', recipientId: { $in: [...broadcastRecipients, 'expert', 'expert-user'] } },
        ...(normRec ? [{ recipientId: new RegExp(normRec, 'i') }] : [])
      ]
    };
  } else if (normRole === 'client') {
    query = {
      $or: [
        { target: 'all', recipientId: { $in: broadcastRecipients } },
        { target: 'client', recipientId: { $in: [...broadcastRecipients, 'client', 'client-user'] } },
        ...(normRec ? [{ recipientId: new RegExp(normRec, 'i') }] : [])
      ]
    };
  }

  if (unreadOnly === 'true') {
    query.read = false;
  }

  const list = await Notification.find(query).sort({ createdAt: -1 });
  res.json({ success: true, notifications: list, count: list.length });
});

app.post('/api/notifications', async (req, res) => {
  const payload = req.body;
  if (!payload.title || !payload.title.trim() || !payload.message || !payload.message.trim()) {
    return res.status(400).json({ success: false, error: 'Both Title and Message are required for notification dispatch.' });
  }

  const notifId = payload.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const target = payload.target || 'all';
  const defaultActionLink = target === 'client' ? 'client' : target === 'expert' ? 'expert' : target === 'admin' ? 'owner' : 'landing';

  const notif = new Notification({
    id: notifId,
    senderId: payload.senderId || 'admin',
    target,
    audienceType: payload.audienceType || target,
    recipientId: payload.recipientId || null,
    recipientName: payload.recipientName || null,
    recipientType: target,
    type: payload.type || 'announcement',
    title: payload.title.trim(),
    message: payload.message.trim(),
    timestamp: 'Just now',
    createdAt: new Date(),
    read: false,
    status: 'delivered',
    actionLink: payload.actionLink || defaultActionLink,
    channel: payload.channel || 'in_app',
    channels: payload.channels || ['in_app', 'email', 'push'],
    eventId: payload.eventId || `evt-${Date.now()}`,
    eventName: payload.eventName || 'platform_broadcast',
    relatedEntityId: payload.relatedEntityId || null,
    metadata: payload.metadata || {}
  });

  await notif.save();
  res.json({ success: true, notification: notif });
});

app.post('/api/notifications/mark-read', async (req, res) => {
  const { id } = req.body;
  await Notification.findOneAndUpdate({ id }, { read: true, readAt: new Date(), status: 'read' });
  res.json({ success: true, id, read: true });
});

app.post('/api/notifications/mark-all-read', async (req, res) => {
  const { role, recipientId } = req.body;
  const result = await Notification.updateMany({ read: false }, { read: true, readAt: new Date(), status: 'read' });
  res.json({ success: true, updatedCount: result.modifiedCount });
});

app.post('/api/notifications/clear', async (req, res) => {
  const { role, recipientId } = req.body;
  const result = await Notification.deleteMany({});
  res.json({ success: true, removedCount: result.deletedCount });
});

// ==============================================================
// BLOGS & ARTICLES CMS SCHEMAS & ENDPOINTS
// ==============================================================
const BlogCategorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: String,
  articleCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const BlogCategory = mongoose.model('BlogCategory', BlogCategorySchema);

const BlogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  type: { type: String, enum: ['blog', 'article'], default: 'article' },
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  excerpt: String,
  summary: String,
  content: String,
  sections: Array,
  category: { type: String, required: true },
  author: Object,
  authorName: String,
  authorRole: String,
  coverImage: String,
  image: String,
  readTime: { type: String, default: '5 min read' },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  featured: { type: Boolean, default: false },
  displayOrder: Number,
  publishedAt: Date,
  date: String,
  keywords: [String],
  keyTakeaways: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const Blog = mongoose.model('Blog', BlogSchema);

// Public Blogs Endpoints
app.get('/api/blogs/categories', async (req, res) => {
  try {
    const list = await BlogCategory.find();
    if (list.length > 0) return res.json({ success: true, categories: list });
  } catch {}
  const dbPath = path.resolve(__dirname, 'db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  res.json({ success: true, categories: db.blogCategories || [] });
});

app.get('/api/blogs', async (req, res) => {
  const { category, search, type, limit } = req.query;
  const dbPath = path.resolve(__dirname, 'db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  let published = (db.blogs || []).filter(a => a.status === 'published');

  if (category && category.toLowerCase() !== 'all') {
    published = published.filter(a => (a.category || '').toLowerCase() === category.toLowerCase());
  }
  if (type) {
    published = published.filter(a => (a.type || 'article') === type);
  }
  if (search) {
    const q = search.toLowerCase().trim();
    published = published.filter(a =>
      (a.title || '').toLowerCase().includes(q) ||
      (a.excerpt || a.summary || '').toLowerCase().includes(q) ||
      (a.slug || '').toLowerCase().includes(q)
    );
  }

  published.sort((x, y) => {
    if (x.featured && !y.featured) return -1;
    if (!x.featured && y.featured) return 1;
    if (typeof x.displayOrder === 'number' && typeof y.displayOrder === 'number') {
      if (x.displayOrder !== y.displayOrder) return x.displayOrder - y.displayOrder;
    }
    return new Date(y.publishedAt || y.createdAt || 0).getTime() - new Date(x.publishedAt || x.createdAt || 0).getTime();
  });

  const parsedLimit = parseInt(limit, 10);
  const results = parsedLimit > 0 ? published.slice(0, parsedLimit) : published;
  res.json({ success: true, articles: results, total: published.length, categories: db.blogCategories || [] });
});

app.get('/api/blogs/:slug', async (req, res) => {
  const { slug } = req.params;
  const dbPath = path.resolve(__dirname, 'db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const article = (db.blogs || []).find(a => (a.slug || '').toLowerCase().trim() === slug.toLowerCase().trim());

  if (!article || article.status !== 'published') {
    return res.status(404).json({ success: false, error: 'Article not found' });
  }

  const others = (db.blogs || []).filter(a => a.status === 'published' && a.id !== article.id);
  const sameCat = others.filter(a => (a.category || '').toLowerCase() === (article.category || '').toLowerCase());
  const related = [...sameCat, ...others.filter(a => (a.category || '').toLowerCase() !== (article.category || '').toLowerCase())].slice(0, 3);

  res.json({ success: true, article, relatedArticles: related });
});

// Admin Blogs Endpoints
app.get('/api/admin/blogs', async (req, res) => {
  const role = req.headers['x-admin-role'] || req.query.role;
  if (role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required' });
  }

  const dbPath = path.resolve(__dirname, 'db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const articles = db.blogs || [];
  const categories = db.blogCategories || [];

  const stats = {
    total: articles.length,
    published: articles.filter(b => b.status === 'published').length,
    drafts: articles.filter(b => b.status === 'draft').length,
    featured: articles.filter(b => b.featured).length,
    categories: categories.length
  };

  res.json({ success: true, articles, stats, categories });
});

app.post('/api/admin/blogs', async (req, res) => {
  const role = req.headers['x-admin-role'] || req.body.role;
  if (role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required' });
  }

  const payload = req.body;
  if (!payload.title || !payload.title.trim()) {
    return res.status(400).json({ success: false, error: 'Title is required.' });
  }

  const dbPath = path.resolve(__dirname, 'db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  if (!Array.isArray(db.blogs)) db.blogs = [];

  const slug = (payload.slug || payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).trim();
  if (db.blogs.some(b => (b.slug || '').toLowerCase() === slug.toLowerCase())) {
    return res.status(400).json({ success: false, error: 'Slug already exists. Please choose a unique slug.' });
  }

  if (payload.featured) {
    db.blogs.forEach(b => { b.featured = false; });
  }

  const nowIso = new Date().toISOString();
  const newArticle = {
    ...payload,
    id: payload.id || `blog-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    slug,
    status: payload.status === 'published' ? 'published' : 'draft',
    createdAt: nowIso,
    updatedAt: nowIso
  };

  db.blogs.unshift(newArticle);
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

  res.status(201).json({
    success: true,
    article: newArticle,
    message: newArticle.status === 'published' ? 'Article published successfully.' : 'Draft saved successfully.'
  });
});

app.put('/api/admin/blogs/:id', async (req, res) => {
  const role = req.headers['x-admin-role'] || req.body.role;
  if (role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required' });
  }

  const { id } = req.params;
  const dbPath = path.resolve(__dirname, 'db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const idx = (db.blogs || []).findIndex(b => b.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Article not found' });

  if (req.body.featured) {
    db.blogs.forEach(b => { b.featured = false; });
  }

  const updated = {
    ...db.blogs[idx],
    ...req.body,
    id: db.blogs[idx].id,
    updatedAt: new Date().toISOString()
  };

  db.blogs[idx] = updated;
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

  res.json({ success: true, article: updated, message: 'Article updated successfully.' });
});

app.delete('/api/admin/blogs/:id', async (req, res) => {
  const role = req.headers['x-admin-role'] || req.query.role;
  if (role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required' });
  }

  const { id } = req.params;
  const dbPath = path.resolve(__dirname, 'db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  db.blogs = (db.blogs || []).filter(b => b.id !== id);
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

  res.json({ success: true, message: 'Article deleted successfully.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


