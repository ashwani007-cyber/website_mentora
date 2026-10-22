import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { supabase } from '../server/supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../db.json');

async function runMigration() {
  console.log('🚀 Starting Data Migration: db.json -> Supabase...');

  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ db.json not found at:', DB_PATH);
    process.exit(1);
  }

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const stats = {
    users: 0,
    experts: 0,
    availabilities: 0,
    projectReviews: 0,
    blogs: 0,
    notifications: 0
  };

  const defaultPasswordHash = await bcrypt.hash('password123', 10);
  const emailToUserId = new Map();

  // 1. MIGRATE USERS
  if (Array.isArray(db.users) && db.users.length > 0) {
    console.log(`\n⏳ Migrating ${db.users.length} Users...`);
    const userRows = [];

    for (const u of db.users) {
      const email = String(u.email || '').toLowerCase().trim();
      if (!email) continue;

      let passwordHash = u.password_hash;
      if (!passwordHash || !String(passwordHash).startsWith('$2')) {
        passwordHash = defaultPasswordHash;
      }

      const userId = crypto.randomUUID();
      emailToUserId.set(email, userId);

      userRows.push({
        id: userId,
        email,
        password_hash: passwordHash,
        full_name: u.full_name || u.name || 'Member',
        role: ['admin', 'expert', 'client'].includes(u.role) ? u.role : 'client',
        phone: u.phone || null,
        avatar_url: u.avatar || u.avatar_url || null,
        bio: u.bio || null,
        is_verified: u.is_verified ?? true,
        created_at: u.createdAt || new Date().toISOString(),
        updated_at: u.updatedAt || new Date().toISOString()
      });
    }

    // Insert in batches of 50
    for (let i = 0; i < userRows.length; i += 50) {
      const chunk = userRows.slice(i, i + 50);
      const { error } = await supabase.from('users').upsert(chunk, { onConflict: 'email' });
      if (error) {
        console.error(`⚠️ Users chunk ${i}-${i + chunk.length} error:`, error.message);
      } else {
        stats.users += chunk.length;
      }
    }
    console.log(`✅ Users Migrated: ${stats.users}/${db.users.length}`);
  }

  // Fetch actual user IDs from Supabase to correctly link foreign keys
  const { data: dbSupabaseUsers } = await supabase.from('users').select('id, email');
  if (dbSupabaseUsers) {
    for (const su of dbSupabaseUsers) {
      emailToUserId.set(su.email.toLowerCase(), su.id);
    }
  }

  // 2. MIGRATE EXPERTS
  const validExpertIds = new Set();
  if (Array.isArray(db.experts) && db.experts.length > 0) {
    console.log(`\n⏳ Migrating ${db.experts.length} Experts...`);
    const expertRows = [];

    for (const exp of db.experts) {
      const expertId = String(exp.id || '').trim();
      if (!expertId) continue;
      validExpertIds.add(expertId);

      const email = String(exp.email || '').toLowerCase().trim();
      const linkedUserId = emailToUserId.get(email) || null;

      expertRows.push({
        id: expertId,
        user_id: linkedUserId,
        name: exp.name || 'Expert Advisor',
        field: exp.field || exp.domain || 'General Advisory',
        years_of_experience: Number(exp.years) || 0,
        base_rate: Number(exp.baseRate) || 0,
        admin_markup: Number(exp.adminMarkup) || 0,
        rate: Number(exp.rate) || 0,
        project_rate: Number(exp.projectRate) || 0,
        rating: Number(exp.rating) || 5.0,
        total_sessions: Number(exp.sessions) || 0,
        verified: exp.verified ?? true,
        initials: exp.initials || '',
        title: exp.title || '',
        phone: exp.phone || null,
        email: exp.email || null,
        bio: exp.bio || '',
        skills: Array.isArray(exp.skills) ? exp.skills : [],
        documents: exp.documents || {},
        created_at: exp.createdAt || new Date().toISOString(),
        updated_at: exp.updatedAt || new Date().toISOString()
      });
    }

    const { error: expErr } = await supabase.from('experts').upsert(expertRows, { onConflict: 'id' });
    if (expErr) {
      console.error('⚠️ Experts insert error:', expErr.message);
    } else {
      stats.experts = expertRows.length;
      console.log(`✅ Experts Migrated: ${stats.experts}/${db.experts.length}`);
    }
  }

  // 3. MIGRATE AVAILABILITIES
  if (Array.isArray(db.availabilities) && db.availabilities.length > 0) {
    console.log(`\n⏳ Migrating ${db.availabilities.length} Availabilities...`);
    const availRows = [];

    for (const a of db.availabilities) {
      if (!validExpertIds.has(String(a.expertId))) {
        continue; // skip orphaned records to preserve foreign key integrity
      }

      availRows.push({
        id: a.id || `avail-${crypto.randomUUID()}`,
        expert_id: a.expertId,
        availability_date: a.availabilityDate,
        start_time: a.startTime,
        end_time: a.endTime,
        status: ['AVAILABLE', 'BOOKED', 'DISABLED'].includes(a.status) ? a.status : 'AVAILABLE',
        booking_id: a.bookingId || null,
        client_id: a.clientId || null,
        client_name: a.clientName || null,
        created_at: a.createdAt || new Date().toISOString(),
        updated_at: a.updatedAt || new Date().toISOString()
      });
    }

    if (availRows.length > 0) {
      const { error: avErr } = await supabase.from('expert_availability').upsert(availRows, { onConflict: 'id' });
      if (avErr) {
        console.error('⚠️ Availability insert error:', avErr.message);
      } else {
        stats.availabilities = availRows.length;
        console.log(`✅ Availabilities Migrated: ${stats.availabilities}`);
      }
    }
  }

  // 4. MIGRATE PROJECT REVIEWS
  if (Array.isArray(db.projectReviews) && db.projectReviews.length > 0) {
    console.log(`\n⏳ Migrating ${db.projectReviews.length} Project Reviews...`);
    const prRows = [];

    for (const pr of db.projectReviews) {
      prRows.push({
        project_review_id: pr.projectReviewId,
        client_id: pr.clientId || 'client-unknown',
        client_name: pr.clientName || 'Client',
        client_email: pr.clientEmail || 'client@example.com',
        expert_id: pr.expertId || 'expert-unknown',
        expert_name: pr.expertName || 'Expert',
        expert_email: pr.expertEmail || 'expert@example.com',
        package_id: pr.packageId || 'project_review',
        package_name: pr.packageName || 'Dedicated Project Review',
        price: Number(pr.price || pr.paidAmount || 0),
        expert_earning: Number(pr.expertEarning || pr.expertCharge || 0),
        platform_fee: Number(pr.platformFee || pr.platformCharge || 0),
        platform_charge_type: pr.platformChargeType || 'fixed',
        status: pr.status || 'PendingExpertAcceptance',
        payment_status: pr.paymentStatus || 'PaymentPending',
        expert_earning_status: pr.expertEarningStatus || 'EarningPending',
        request_notes: pr.requestNotes || '',
        expected_scope: pr.expectedScope || '',
        review_type: pr.reviewType || 'Project Consultation',
        submission: pr.submission || {},
        chat: Array.isArray(pr.chat) ? pr.chat : [],
        proposed_times: Array.isArray(pr.proposedTimes) ? pr.proposedTimes : [],
        meetings: Array.isArray(pr.meetings) ? pr.meetings : [],
        completed_meeting_count: Number(pr.completedMeetingCount) || 0,
        review_feedback: pr.reviewFeedback || null,
        client_wallet_tx_id: pr.clientWalletTxId || null,
        expert_wallet_tx_id: pr.expertWalletTxId || null,
        client_archived: Boolean(pr.clientArchived),
        expert_archived: Boolean(pr.expertArchived),
        activity_timeline: Array.isArray(pr.activityTimeline) ? pr.activityTimeline : [],
        created_at: pr.createdAt || new Date().toISOString(),
        updated_at: pr.updatedAt || new Date().toISOString()
      });
    }

    for (let i = 0; i < prRows.length; i += 25) {
      const chunk = prRows.slice(i, i + 25);
      const { error: prErr } = await supabase.from('project_reviews').upsert(chunk, { onConflict: 'project_review_id' });
      if (prErr) {
        console.error(`⚠️ Project reviews chunk ${i}-${i + chunk.length} error:`, prErr.message);
      } else {
        stats.projectReviews += chunk.length;
      }
    }
    console.log(`✅ Project Reviews Migrated: ${stats.projectReviews}/${db.projectReviews.length}`);
  }

  // 5. MIGRATE BLOGS
  if (Array.isArray(db.blogs) && db.blogs.length > 0) {
    console.log(`\n⏳ Migrating ${db.blogs.length} Blogs...`);
    const blogRows = [];

    for (const b of db.blogs) {
      let content = b.content;
      if (!content && Array.isArray(b.sections)) {
        content = b.sections.map(s => s.text || '').join('\n\n');
      }

      blogRows.push({
        id: crypto.randomUUID(),
        title: b.title || 'Untitled Post',
        slug: b.slug || `post-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        excerpt: b.excerpt || b.summary || '',
        content: content || 'Article content...',
        author_name: b.authorName || (b.author?.name) || 'Mentora Editorial',
        author_email: b.authorEmail || 'editorial@mentora.com',
        cover_image_url: b.coverImage || b.image || null,
        category: b.category || 'Mentorship',
        tags: Array.isArray(b.keywords) ? b.keywords : [],
        is_published: b.status === 'published' || true,
        views: Number(b.views) || 0,
        created_at: b.createdAt || new Date().toISOString(),
        updated_at: b.updatedAt || new Date().toISOString()
      });
    }

    const { error: blogErr } = await supabase.from('blogs').upsert(blogRows, { onConflict: 'slug' });
    if (blogErr) {
      console.error('⚠️ Blogs insert error:', blogErr.message);
    } else {
      stats.blogs = blogRows.length;
      console.log(`✅ Blogs Migrated: ${stats.blogs}/${db.blogs.length}`);
    }
  }

  // 6. MIGRATE NOTIFICATIONS
  if (Array.isArray(db.notifications) && db.notifications.length > 0) {
    console.log(`\n⏳ Migrating ${db.notifications.length} Notifications...`);
    const notifRows = [];

    for (const n of db.notifications) {
      notifRows.push({
        id: crypto.randomUUID(),
        user_id: n.recipientId || n.userId || 'admin',
        user_role: n.recipientType || n.audienceType || 'client',
        title: n.title || 'Notification',
        message: n.message || '',
        type: n.type || 'system',
        link: n.actionLink || null,
        is_read: Boolean(n.read),
        metadata: n.metadata || {},
        created_at: n.createdAt || new Date().toISOString()
      });
    }

    for (let i = 0; i < notifRows.length; i += 50) {
      const chunk = notifRows.slice(i, i + 50);
      const { error: notifErr } = await supabase.from('notifications').insert(chunk);
      if (notifErr) {
        console.error(`⚠️ Notifications chunk ${i}-${i + chunk.length} error:`, notifErr.message);
      } else {
        stats.notifications += chunk.length;
      }
    }
    console.log(`✅ Notifications Migrated: ${stats.notifications}/${db.notifications.length}`);
  }

  console.log('\n=======================================');
  console.log('🎉 DATA MIGRATION TO SUPABASE COMPLETE!');
  console.log('=======================================');
  console.table(stats);
}

runMigration().catch(err => {
  console.error('❌ Migration failed with error:', err);
  process.exit(1);
});
