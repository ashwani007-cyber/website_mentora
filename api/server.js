// Vercel Serverless Function for API
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from '../server/supabaseClient.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) throw error;
    res.json({ success: true, message: 'Server is healthy', database: 'connected' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return res.status(409).json({ success: false, error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

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

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

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

// Get Experts
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
    res.status(500).json({ success: false, error: err.message });
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
    res.status(500).json({ success: false, error: err.message });
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
    res.status(500).json({ success: false, error: err.message });
  }
});

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

// Get Reviews
app.get('/api/reviews', async (req, res) => {
  try {
    const { expertId, expertEmail } = req.query;
    let allReviews = [];
    try {
      let query = supabase.from('reviews').select('*');
      if (expertId) query = query.or(`expert_id.eq.${expertId},expert_email.ilike.${expertEmail || expertId}`);
      const { data } = await query;
      if (Array.isArray(data)) allReviews = data;
    } catch {}

    const { avgRating, reviewCount } = calculateReviewAggregate(allReviews);
    res.json({ success: true, reviews: allReviews, avgRating, reviewCount, completedConsultations: reviewCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Live Review Stats
app.get('/api/reviews/stats', async (req, res) => {
  try {
    const { expertId, expertEmail } = req.query;
    let allReviews = [];
    try {
      let query = supabase.from('reviews').select('*');
      if (expertId) query = query.or(`expert_id.eq.${expertId},expert_email.ilike.${expertEmail || expertId}`);
      const { data } = await query;
      if (Array.isArray(data)) allReviews = data;
    } catch {}

    const { avgRating, reviewCount } = calculateReviewAggregate(allReviews);
    res.json({ success: true, avgRating, reviewCount, completedConsultations: reviewCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Submit Review
app.post('/api/reviews', async (req, res) => {
  try {
    const { expertId, expertEmail, expertName, clientId, clientEmail, clientName, sessionId, rating, comment } = req.body;
    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be a number between 1 and 5' });
    }
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID is required' });
    }

    const newRev = {
      id: `rev-${Date.now()}`,
      expert_id: expertId || '',
      expert_email: expertEmail || '',
      expert_name: expertName || '',
      client_id: clientId || '',
      client_email: clientEmail || '',
      client_name: clientName || 'Corporate Client',
      session_id: String(sessionId).trim(),
      rating: Math.round(numRating),
      comment: (comment || '').trim(),
      created_at: new Date().toISOString()
    };

    try {
      await supabase.from('reviews').insert(newRev);
    } catch {}

    res.json({ success: true, review: newRev, avgRating: numRating, reviewCount: 1, completedConsultations: 1 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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

// Get Notifications
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

// Export for Vercel
export default app;
