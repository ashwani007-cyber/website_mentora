// Script: Clean up all hardcoded fake ratings (4.9, 128, etc.) from db.json and Supabase
// and recalculate dynamic stats based on real reviews in app_platform_reviews.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../server/supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../db.json');

async function cleanUp() {
  console.log('🔄 Cleaning up hardcoded fake ratings and mock consultation counts...');

  if (!fs.existsSync(dbPath)) {
    console.error('db.json not found');
    return;
  }

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  // Get all real reviews from kv.app_platform_reviews
  const platformReviews = Array.isArray(db.kv?.app_platform_reviews) ? db.kv.app_platform_reviews : [];
  console.log(`Found ${platformReviews.length} real client reviews.`);

  // Function to compute real stats for an expert
  function getRealStats(expert) {
    const expName = (expert.name || expert.full_name || '').toLowerCase().trim();
    const expEmail = (expert.email || '').toLowerCase().trim();
    const expId = (expert.id || '').toLowerCase().trim();

    const matched = platformReviews.filter(r => {
      if (!r) return false;
      const rName = (r.expertName || r.expert_name || '').toLowerCase().trim();
      const rEmail = (r.expertEmail || r.expert_email || '').toLowerCase().trim();
      const rId = (r.expertId || r.expert_id || '').toLowerCase().trim();

      if (expId && rId && expId === rId) return true;
      if (expEmail && rEmail && expEmail === rEmail) return true;
      if (expName && rName && (expName === rName || expName.includes(rName) || rName.includes(expName))) return true;
      return false;
    });

    const validRatings = matched
      .map(r => Number(r.rating))
      .filter(r => !isNaN(r) && r >= 1 && r <= 5);

    if (validRatings.length === 0) {
      return { rating: 0, sessions: 0, reviewCount: 0 };
    }

    const sum = validRatings.reduce((a, b) => a + b, 0);
    const avg = Math.round((sum / validRatings.length) * 10) / 10;
    return {
      rating: avg,
      sessions: matched.length,
      reviewCount: validRatings.length
    };
  }

  // 1. Clean db.experts
  if (Array.isArray(db.experts)) {
    console.log(`Processing ${db.experts.length} experts in db.json...`);
    db.experts.forEach(exp => {
      const stats = getRealStats(exp);
      const oldRating = exp.rating;
      const oldSessions = exp.sessions;

      exp.rating = stats.rating;
      exp.sessions = stats.sessions;
      exp.total_sessions = stats.sessions;

      console.log(`  - ${exp.name}: rating ${oldRating} -> ${stats.rating}, sessions ${oldSessions} -> ${stats.sessions} (${stats.reviewCount} reviews)`);
    });
  }

  // Ensure reviews array exists in db.json
  if (!Array.isArray(db.reviews)) {
    db.reviews = platformReviews.map(r => ({
      id: r.id,
      expert_id: r.expertId || '',
      expert_email: r.expertEmail || '',
      expert_name: r.expertName || '',
      client_name: r.clientName || 'Corporate Client',
      client_email: r.clientEmail || '',
      session_id: r.sessionId || r.id,
      rating: r.rating || 5,
      comment: r.comment || '',
      created_at: r.date || new Date().toISOString()
    }));
  }

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log('✅ db.json updated successfully!');

  // 2. Clean Supabase experts table
  try {
    const { data: sbExperts, error } = await supabase.from('experts').select('*');
    if (!error && Array.isArray(sbExperts)) {
      console.log(`Processing ${sbExperts.length} experts in Supabase...`);
      for (const sbExp of sbExperts) {
        const stats = getRealStats(sbExp);
        await supabase
          .from('experts')
          .update({
            rating: stats.rating,
            total_sessions: stats.sessions
          })
          .eq('id', sbExp.id);
        console.log(`  - Supabase ${sbExp.name}: rating -> ${stats.rating}, total_sessions -> ${stats.sessions}`);
      }
      console.log('✅ Supabase experts updated successfully!');
    }
  } catch (err) {
    console.warn('Supabase update note:', err.message);
  }
}

cleanUp().then(() => {
  console.log('🎉 Mock ratings cleanup complete!');
  process.exit(0);
});
