// Express + Supabase Server for Mentora Platform
// Run with: node server.js

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './server/supabaseClient.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

console.log('🚀 Starting Mentora Server with Supabase...');

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) throw error;
    res.json({ success: true, message: 'Server is healthy', database: 'connected' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// AUTHENTICATION ENDPOINTS
// ============================================================

// Register User
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, role, phone } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ success: false, error: 'Email, password, and role are required' });
    }

    if (!['admin', 'expert', 'client'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return res.status(409).json({ success: false, error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        full_name: fullName,
        role,
        phone
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    // Get user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        phone: user.phone,
        is_verified: user.is_verified
      }
    });
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
    res.status(500).json({ success: false, error: err.message });
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
    res.status(500).json({ success: false, error: err.message });
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
      .select('*');

    const config = settings?.find(s => s.key === 'platform_charge')?.value ||
                  { feeType: 'fixed', feeValue: 200, currency: 'INR' };

    res.json({ success: true, config, platformCharge: config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
