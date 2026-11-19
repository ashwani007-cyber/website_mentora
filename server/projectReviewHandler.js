import { readJsonBody, unwrap as json } from './workflowHttp.js';
import { randomUUID } from 'node:crypto';
import { supabase } from './supabaseClient.js';
import { normalizeEmail, readActor } from './session.js';
import { clampInt, COLUMNS, getWalletBalance, isMissingFunction, PROJECT_REVIEW_PAGE_SIZE, withCamelAliases } from './egressHelpers.js';

const prefix = '/api/project-reviews';
const activeStatuses = ['PendingExpertAcceptance', 'Accepted', 'ProjectSubmitted', 'InReview', 'MeetingRequested', 'MeetingScheduled'];
const terminalStatuses = ['Completed', 'ReviewCompleted', 'Declined', 'Cancelled'];
const expertFields = 'id, user_id, name, email, field, base_rate, rate, project_rate, verified, updated_at';
const reviewColumns = `${COLUMNS.PROJECT_REVIEW_FULL}, workflow_revision, refund_tx_id`;
const bucket = 'review-files';
const fileLimit = 3 * 1024 * 1024;
const text = (value) => typeof value === 'string' ? value.trim() : '';
const rows = (value) => Array.isArray(value) ? value : [];


function requireCondition(condition, status, message) {
  if (!condition) throw Object.assign(new Error(message), { status });
}

function requireRole(actor, ...roles) {
  requireCondition(actor && roles.includes(actor.role), actor ? 403 : 401, 'Sign in with an authorized account to continue');
}


function webUrl(value) {
  try {
    const url = new URL(text(value));
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function normalizedReview(row) {
  const review = withCamelAliases(row);
  review.chat = rows(review.chat).map(withCamelAliases);
  review.proposedTimes = rows(review.proposedTimes).map(withCamelAliases);
  review.meetings = rows(review.meetings).map(withCamelAliases);
  review.activityTimeline = rows(review.activityTimeline).map(withCamelAliases);
  review.submission = withCamelAliases(review.submission);
  review.reviewFeedback = withCamelAliases(review.reviewFeedback);
  return review;
}

function ownsReview(actor, review) {
  if (actor.role === 'admin') return true;
  const role = actor.role;
  return normalizeEmail(review[`${role}_email`]) === actor.email || review[`${role}_id`] === actor.id;
}

async function fetchReview(id) {
  return json(await supabase.from('project_reviews').select(reviewColumns).eq('project_review_id', id).maybeSingle());
}

async function presentReview(row) {
  const review = normalizedReview(row);
  const files = rows(review.submission?.files);
  const paths = [...new Set([
    ...files.map(file => file.storagePath), ...review.chat.map(message => message.attachmentPath)
  ].filter(path => typeof path === 'string' && path.startsWith(`${review.projectReviewId}/`)))];
  const urls = new Map();
  if (paths.length) {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, 900, { download: true });
    for (const file of data || []) if (file.signedUrl) urls.set(file.path, file.signedUrl);
  }
  if (review.submission) {
    review.submission = {
      ...review.submission,
      repositoryUrl: webUrl(review.submission.repositoryUrl)?.href || '',
      demoUrl: webUrl(review.submission.demoUrl)?.href || '',
      files: files.map(file => ({ ...file, url: urls.get(file.storagePath) || (!file.storagePath && webUrl(file.url)?.href) || '' }))
    };
  }
  review.chat = review.chat.map(message => ({
    ...message,
    attachmentUrl: urls.get(message.attachmentPath) || (!message.attachmentPath && webUrl(message.attachmentUrl)?.href) || ''
  }));
  return review;
}

function logEntry(id, actor, eventType, description, timestamp, statuses = {}) {
  return { activityId: randomUUID(), projectReviewId: id, userId: actor.id, userName: actor.name || actor.role,
    role: actor.role, eventType, description, timestamp, ...statuses };
}

const system = { id: 'system', role: 'system', name: 'System' };
function messageEntry(id, actor, content, timestamp, attachment = {}) {
  return { id: randomUUID(), projectReviewId: id, senderId: actor.id, senderRole: actor.role,
    senderName: actor.name || actor.role, content, timestamp, read: actor.role === 'system', ...attachment };
}

async function requestReview(actor, body) {
  requireRole(actor, 'client');
  const expertId = text(body.expertId);
  const requestId = text(body.requestId);
  requireCondition(expertId, 400, 'expertId is required');
  requireCondition(!requestId || /^[a-f0-9-]{36}$/i.test(requestId), 400, 'Invalid request ID');
  const id = `pr-${requestId || randomUUID()}`;
  const now = new Date().toISOString();
  const payment = logEntry(id, actor, 'payment_confirmed', 'Client Wallet payment held in escrow.', now, { newStatus: 'PaymentSuccessful' });
  const request = logEntry(id, actor, 'request_created', 'Client requested a Project Review.', now, { newStatus: 'PendingExpertAcceptance' });
  const payload = {
    project_review_id: id, client_id: actor.id, client_email: actor.email, client_name: actor.name || 'Client', expert_id: expertId,
    request_notes: text(body.requestNotes), expected_scope: text(body.expectedScope),
    review_type: text(body.reviewType) || 'Technical & Architecture Review',
    chat: [messageEntry(id, system, 'Project Review request received. Escrow payment confirmed. Awaiting expert decision.', now)],
    activity_timeline: [request, payment]
  };
  if (typeof body.expectedPrice === 'number' && Number.isFinite(body.expectedPrice)) payload.expected_price = body.expectedPrice;
  // Look up an existing key first so a retry still returns the original review after a price change.
  const replay = requestId ? await fetchReview(id) : null;
  if (replay) {
    requireCondition(ownsReview(actor, replay) && replay.expert_id === expertId, 409, 'Project Review request ID already used');
    return { status: 200, projectReview: await presentReview(replay), clientWalletBalance: await getWalletBalance(actor.email, actor.id), duplicate: true };
  }
  const result = await supabase.rpc('project_review_create', { p_review: payload });
  if (result.error?.code === '23505') {
    const existing = await fetchReview(id);
    if (existing && ownsReview(actor, existing) && existing.expert_id === expertId) {
      return { status: 200, projectReview: await presentReview(existing), clientWalletBalance: await getWalletBalance(actor.email, actor.id), duplicate: true };
    }
    requireCondition(false, 409, 'An active or pending Project Review already exists with this expert');
  }
  const value = json(result);
  return { status: 201, ...value, projectReview: await presentReview(value.projectReview) };
}

function transition(rawReview, actor, action, body) {
  const review = normalizedReview(rawReview);
  const id = review.projectReviewId;
  const now = new Date().toISOString();
  const patch = {};
  const log = (event, description) => {
    const transition = patch.status && patch.status !== review.status ? { previousStatus: review.status, newStatus: patch.status } : {};
    patch.activity_timeline = [...(patch.activity_timeline || review.activityTimeline), logEntry(id, actor, event, description, now, transition)];
  };
  const announce = (content) => { patch.chat = [...review.chat, messageEntry(id, system, content, now)]; };
  const canWork = () => requireCondition(activeStatuses.slice(1).includes(review.status) && review.paymentStatus === 'PaymentSuccessful',
    409, 'This Project Review workspace requires an accepted, paid request');
  const meetingIsActive = (meeting) => !['Cancelled', 'Completed'].includes(meeting.meetingStatus);
  const completedMeetings = Math.max(Number(review.completedMeetingCount) || 0, review.meetings.filter(m => m.meetingStatus === 'Completed').length);
  let walletEvent = null;

  switch (action) {
    case 'respond': {
      requireRole(actor, 'expert');
      const accept = body.action === 'accept';
      requireCondition(accept || body.action === 'decline', 400, 'Choose accept or decline');
      if (accept && (activeStatuses.slice(1).includes(review.status) || review.status === 'Completed')) break;
      if (!accept && review.status === 'Declined') break;
      requireCondition(review.status === 'PendingExpertAcceptance', 409, 'This request has already been decided');
      if (accept) {
        requireCondition(review.paymentStatus === 'PaymentSuccessful', 409, 'This Project Review has not been paid');
        patch.status = 'Accepted';
        log('request_accepted', 'Expert accepted the Project Review.');
        announce('Project Review accepted. The workspace is now open.');
      } else {
        const reason = text(body.reason);
        requireCondition(reason, 400, 'A decline reason is required');
        patch.status = 'Declined';
        patch.expert_earning_status = 'EarningCancelled';
        log('request_declined', `Expert declined the Project Review: ${reason}`);
        if (review.paymentStatus === 'PaymentSuccessful') {
          patch.payment_status = 'Refunded';
          walletEvent = 'refund';
          log('refund_processed', 'The full escrow payment was refunded to the client wallet.');
        }
        announce(`The expert declined the request: ${reason}.${walletEvent ? ' The escrow payment was refunded.' : ''}`);
      }
      break;
    }
    case 'pay': {
      requireRole(actor, 'client');
      if (review.paymentStatus === 'PaymentSuccessful') break;
      requireCondition(review.status === 'PendingExpertAcceptance' && ['PaymentPending', 'PaymentFailed'].includes(review.paymentStatus), 409, 'This request cannot be paid');
      requireCondition(!body.paymentMethod || body.paymentMethod === 'wallet', 400, 'Use the client wallet to pay into escrow');
      patch.payment_status = 'PaymentSuccessful';
      walletEvent = 'charge';
      log('payment_confirmed', 'Client Wallet payment held in escrow.');
      break;
    }
    case 'submit-project': {
      requireRole(actor, 'client');
      canWork();
      const version = Number(review.submission?.version || 0) + 1;
      patch.submission = {
        submissionId: randomUUID(), description: text(body.description), questions: text(body.questions),
        repositoryUrl: webUrl(body.repositoryUrl)?.href || '', demoUrl: webUrl(body.demoUrl)?.href || '',
        files: [...rows(review.submission?.files), ...rows(body.storedFiles)], version, submittedAt: now
      };
      patch.status = 'ProjectSubmitted';
      log('submission_received', `Client submitted project materials (v${version}).`);
      announce(`New project materials (v${version}) are ready for review.`);
      break;
    }
    case 'chat': {
      if (actor.role !== 'admin' && review.status !== 'Completed') canWork();
      const content = text(body.content);
      const file = body.storedFiles?.[0];
      const link = webUrl(body.attachmentUrl)?.href;
      requireCondition(content || file || link, 400, 'Message content or an attachment is required');
      const attachment = file ? { attachmentPath: file.storagePath, attachmentName: file.name }
        : (link ? { attachmentUrl: link, attachmentName: text(body.attachmentName) } : {});
      patch.chat = [...review.chat, messageEntry(id, actor, content, now, attachment)];
      log('chat_message_sent', 'A workspace message was sent.');
      break;
    }
    case 'propose-time': {
      requireRole(actor, 'client', 'expert');
      canWork();
      const { date, startTime, endTime } = body;
      const parsedDate = new Date(`${date}T00:00:00Z`);
      const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
      requireCondition(/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().startsWith(date) &&
        timePattern.test(startTime) && timePattern.test(endTime) && startTime < endTime, 400, 'Enter a valid date and an end time after the start time');
      requireCondition(completedMeetings < 2, 409, 'Maximum 2 completed meetings reached');
      patch.proposed_times = [...review.proposedTimes, { id: randomUUID(), date, startTime, endTime, reason: text(body.reason),
        proposedBy: actor.role, status: 'pending', createdAt: now }];
      patch.status = 'MeetingRequested';
      log('meeting_proposed', `Meeting proposed for ${date} (${startTime} - ${endTime}).`);
      announce(`Meeting proposed for ${date} at ${startTime}. Awaiting confirmation.`);
      break;
    }
    case 'respond-time': {
      requireRole(actor, 'client', 'expert');
      canWork();
      const proposal = review.proposedTimes.find(item => item.id === body.proposedTimeId);
      const accept = body.action === 'accept';
      requireCondition(accept || body.action === 'decline', 400, 'Choose accept or decline');
      requireCondition(proposal, 404, 'Proposed time slot not found');
      requireCondition(proposal.proposedBy !== actor.role, 403, 'The other party must respond to this proposal');
      const nextStatus = accept ? 'accepted' : 'declined';
      if (proposal.status === nextStatus) break;
      requireCondition(proposal.status === 'pending', 409, 'This proposal has already been decided');
      patch.proposed_times = review.proposedTimes.map(item => item === proposal ? { ...item, status: nextStatus } : item);
      if (!accept) {
        log('meeting_proposal_declined', `Proposed time for ${proposal.date} was declined.`);
        break;
      }
      const reserved = completedMeetings + review.meetings.filter(meetingIsActive).length;
      requireCondition(reserved < 2, 409, 'Two meetings have already been scheduled or completed');
      const { date, startTime, endTime } = proposal;
      const meeting = {
        meetingId: randomUUID(), projectReviewId: id, meetingNumber: reserved + 1, date, startTime, endTime,
        clientId: review.clientId, clientName: review.clientName, expertId: review.expertId, expertName: review.expertName,
        googleMeetLink: '', meetingStatus: 'Scheduled', createdAt: now
      };
      patch.meetings = [...review.meetings, meeting];
      patch.status = 'MeetingScheduled';
      log('meeting_scheduled', `Meeting #${meeting.meetingNumber} scheduled for ${date} at ${startTime}.`);
      announce(`Meeting #${meeting.meetingNumber} confirmed for ${date} at ${startTime}. Awaiting Google Meet link.`);
      break;
    }
    case 'send-meet-link':
    case 'complete-meeting': {
      const complete = action === 'complete-meeting';
      requireRole(actor, ...(complete ? ['expert', 'admin'] : ['expert']));
      const meeting = review.meetings.find(item => item.meetingId === body.meetingId);
      requireCondition(meeting, 404, 'Meeting not found');
      if (complete && meeting.meetingStatus === 'Completed') break;
      canWork();
      requireCondition(meetingIsActive(meeting), 409, 'This meeting is closed');
      let changed;
      if (complete) {
        requireCondition(completedMeetings < 2, 409, 'Maximum 2 completed meetings reached');
        patch.completed_meeting_count = completedMeetings + 1;
        changed = { completedAt: now, meetingStatus: 'Completed' };
        log('meeting_completed', `Meeting #${meeting.meetingNumber} completed.`);
        announce(`Meeting #${meeting.meetingNumber} marked completed (${patch.completed_meeting_count} of 2).`);
      } else {
        const link = webUrl(body.googleMeetLink || body.link);
        requireCondition(link?.origin === 'https://meet.google.com' && /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/i.test(link.pathname), 400, 'Enter a valid Google Meet URL');
        if (meeting.googleMeetLink === link.href) break;
        changed = { googleMeetLink: link.href, meetingStatus: 'Upcoming' };
        log('meet_link_sent', `Google Meet link sent for Meeting #${meeting.meetingNumber}.`);
        announce(`The Google Meet link for Meeting #${meeting.meetingNumber} is ready.`);
      }
      patch.meetings = review.meetings.map(item => item === meeting ? { ...item, ...changed } : item);
      break;
    }
    case 'complete-review': {
      requireRole(actor, 'expert');
      if (review.status === 'Completed' && review.expertEarningStatus === 'EarningReleased') break;
      canWork();
      const summary = text(body.summary);
      requireCondition(summary, 400, 'Please provide a summary of your review findings');
      patch.status = 'Completed';
      patch.expert_earning_status = 'EarningReleased';
      patch.review_feedback = { summary, recommendations: rows(body.recommendations).map(text).filter(Boolean),
        strengths: text(body.strengths), issues: text(body.issues), completedAt: now };
      walletEvent = 'release';
      log('review_completed', 'Expert submitted final findings and completed the Project Review.');
      announce('Project Review completed. The final findings are available.');
      break;
    }
    case 'archive': {
      requireRole(actor, 'client', 'expert');
      requireCondition(terminalStatuses.includes(review.status), 409, 'Only closed reviews can be archived');
      const flag = `${actor.role}_archived`;
      if (rawReview[flag]) break;
      patch[flag] = true;
      log('history_archived', `Project Review archived from ${actor.role} history.`);
      break;
    }
    default:
      requireCondition(false, 404, 'Unknown Project Review action');
  }
  return { patch, walletEvent };
}

async function storeReviewFiles(id, inputs, stored) {
  let total = 0;
  for (const file of inputs) {
    const encoded = text(file?.fileData).match(/^data:([^;,]+);base64,([a-z0-9+/]+={0,2})$/i);
    const name = text(file?.name).split(/[\\/]/).at(-1);
    requireCondition(encoded && name && name.length <= 255, 400, 'Invalid project attachment');
    const bytes = Buffer.from(encoded[2], 'base64');
    total += bytes.length;
    requireCondition(bytes.length && total <= fileLimit, 413, 'Attachments must total 3 MB or less per submission');
    const fileId = randomUUID();
    const storagePath = `${id}/${fileId}`;
    json(await supabase.storage.from(bucket).upload(storagePath, bytes, { contentType: 'application/octet-stream' }));
    stored.push({ id: fileId, name, storagePath, size: `${Math.ceil(bytes.length / 1024)} KB`, uploadedAt: new Date().toISOString() });
  }
}

async function changeReview(actor, id, action, body) {
  requireRole(actor, 'client', 'expert', 'admin');
  const files = action === 'submit-project' ? rows(body.files) : (action === 'chat' && body.attachment ? [body.attachment] : []);
  const uploaded = [];
  let safeToRemove = true;
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const review = await fetchReview(id);
      requireCondition(review && ownsReview(actor, review), 404, 'Project Review not found');
      const input = files.length && !uploaded.length && action === 'chat' ? { ...body, storedFiles: [{ name: files[0].name }] } : { ...body, storedFiles: uploaded };
      let { patch, walletEvent } = transition(review, actor, action, input);
      if (!Object.keys(patch).length) return { projectReview: await presentReview(review), duplicate: true };
      if (files.length && !uploaded.length) {
        await storeReviewFiles(id, files, uploaded);
        ({ patch, walletEvent } = transition(review, actor, action, { ...body, storedFiles: uploaded }));
      }
      safeToRemove = false;
      const saved = await supabase.rpc('project_review_commit', {
        p_id: id, p_revision: review.workflow_revision, p_patch: patch, p_wallet_event: walletEvent
      });
      if (saved.data?.conflict || saved.error?.code === '40001') {
        safeToRemove = true;
        continue;
      }
      if (saved.error && /^[0-9]{2}[0-9A-Z]{3}$|^P[0-9]{4}$|^PGRST202$/.test(saved.error.code || '')) safeToRemove = true;
      const value = json(saved);
      const presented = await presentReview(value);
      return { projectReview: presented, ...(body.meetingId && { meeting: presented.meetings.find(item => item.meetingId === body.meetingId) }) };
    }
    requireCondition(false, 409, 'The review changed while saving. Please try again');
  } catch (error) {
    if (safeToRemove && uploaded.length) {
      await supabase.storage.from(bucket).remove(uploaded.map(file => file.storagePath)).catch(() => {});
    }
    throw error;
  }
}

async function listReviews(actor, query) {
  requireRole(actor, 'client', 'expert', 'admin');
  const limit = clampInt(query.get('limit'), PROJECT_REVIEW_PAGE_SIZE, 1, PROJECT_REVIEW_PAGE_SIZE);
  const offset = clampInt(query.get('offset'), 0, 0, 100000);
  const list = (columns) => {
    let request = supabase.from('project_reviews').select(columns);
    if (actor.role !== 'admin') {
      // The stored email matches the authenticated identity even when a migrated profile ID differs.
      const exact = actor.email.replace(/[\\%_]/g, '\\$&');
      request = request.ilike(`${actor.role}_email`, exact);
      if (query.get('includeArchived') !== 'true') request = request.eq(`${actor.role}_archived`, false);
    } else {
      if (query.get('clientId')) request = request.eq('client_id', query.get('clientId'));
      if (query.get('expertId')) request = request.eq('expert_id', query.get('expertId'));
    }
    if (query.get('status')) request = request.eq('status', query.get('status'));
    return request.order('updated_at', { ascending: false }).order('project_review_id').range(offset, offset + limit);
  };
  let result = await list(`${COLUMNS.PROJECT_REVIEW_SUMMARY}, chat_count`);
  if (result.error && /chat_count/i.test(result.error.message || '')) result = await list(COLUMNS.PROJECT_REVIEW_SUMMARY);
  const data = json(result) || [];
  const hasMore = data.length > limit;
  return { projectReviews: data.slice(0, limit).map(row => normalizedReview({ ...row, chatCount: row.chat_count || 0 })),
    hasMore, nextOffset: hasMore ? offset + limit : null };
}

async function readActivity(actor, query) {
  requireRole(actor, 'admin');
  const limit = clampInt(query.get('limit'), 100, 1, 200);
  const result = await supabase.rpc('get_project_review_activity', { p_limit: limit }, { get: true });
  const activity = isMissingFunction(result.error) ? [] : json(result);
  const pricing = json(await supabase.from('pricing_audit_logs').select('id, actor_email, expert_id, previous_value, new_value, created_at')
    .order('created_at', { ascending: false }).limit(limit));
  const events = [...(activity || []).map(withCamelAliases), ...pricing.map(row => ({
    activityId: row.id, userId: row.actor_email, userName: row.actor_email, role: 'admin', eventType: 'pricing_updated',
    description: row.expert_id ? `Project Review price for ${row.expert_id} set to ₹${row.new_value}.` : 'Project Review platform fee updated.',
    timestamp: row.created_at
  }))].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, limit);
  return { events };
}

async function getFee() {
  const setting = json(await supabase.from('platform_settings').select('value').eq('key', 'platform_charge').maybeSingle());
  return setting?.value || { feeType: 'fixed', feeValue: 200, currency: 'INR' };
}

function quote(expert, config) {
  const projectRate = Math.min(2000, Math.max(0, Number(expert.project_rate ?? 1500)));
  const platformFee = config.feeType === 'percentage' ? Math.round(projectRate * Number(config.feeValue ?? 15) / 100) : Number(config.feeValue ?? 200);
  return { ...withCamelAliases(expert), projectRate, platformFee, clientPrice: Math.round((projectRate + platformFee) * 100) / 100 };
}

async function pricing(actor, query, body) {
  const expertId = text(body?.expertId || query.get('expertId'));
  if (body) {
    requireRole(actor, 'expert', 'admin');
    const projectRate = Number(body.projectRate ?? body.price);
    requireCondition(expertId && Number.isFinite(projectRate) && projectRate >= 0 && projectRate <= 2000, 400, 'Project Review price must be between ₹0 and ₹2,000');
    const expert = json(await supabase.from('experts').select(expertFields).eq('id', expertId).maybeSingle());
    requireCondition(expert, 404, 'Expert not found');
    requireCondition(actor.role === 'admin' || normalizeEmail(expert.email) === actor.email, 403, 'You may only edit your own price');
    const updated = json(await supabase.rpc('project_review_set_pricing', { p_actor: actor.email, p_expert_id: expertId, p_value: Math.round(projectRate * 100) / 100 }));
    const config = await getFee();
    return { ...quote({ ...expert, project_rate: updated }, config), platformFeeConfig: config };
  }
  if (expertId) {
    const expert = json(await supabase.from('experts').select(expertFields).eq('id', expertId).maybeSingle());
    requireCondition(expert && (expert.verified || actor?.role === 'admin' || actor?.email === normalizeEmail(expert.email)), 404, 'Expert not found');
    const config = await getFee();
    const { projectRate, platformFee, clientPrice } = quote(expert, config);
    return { expertId, expertName: expert.name, projectRate, platformFee, clientPrice, platformFeeConfig: config };
  }
  requireRole(actor, 'admin');
  const experts = json(await supabase.from('experts').select(expertFields).order('name'));
  const config = await getFee();
  return { experts: experts.map(expert => quote(expert, config)), platformFeeConfig: config };
}

async function platformSettings(actor, body) {
  if (!body) {
    const config = await getFee();
    return { config, platformCharge: config };
  }
  requireRole(actor, 'admin');
  const feeType = body.feeType;
  const feeValue = Number(body.feeValue);
  requireCondition(['fixed', 'percentage'].includes(feeType) && body.feeValue !== '' && Number.isFinite(feeValue) && feeValue >= 0 && (feeType !== 'percentage' || feeValue <= 100),
    400, 'Enter a valid fixed fee or percentage');
  const config = json(await supabase.rpc('project_review_set_pricing', { p_actor: actor.email, p_expert_id: null,
    p_value: { feeType, feeValue: Math.round(feeValue * 100) / 100, currency: 'INR', updatedAt: new Date().toISOString() } }));
  return { config, platformCharge: config };
}

export async function handleProjectReview(req, res, next) {
  const url = new URL(req.originalUrl || req.url || '/', 'http://localhost');
  const pathname = url.pathname.replace(/\/$/, '');
  if (pathname !== '/api/platform-settings' && pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return next();
  let status = 200;
  let result;
  try {
    const actor = await readActor(req);
    const get = req.method === 'GET';
    requireCondition(get || ['POST', 'PUT'].includes(req.method), 405, 'Method not allowed');
    const body = get ? null : await readJsonBody(req, 4.4 * 1024 * 1024);
    const path = pathname.slice(prefix.length + 1).split('/').map(decodeURIComponent);
    if (pathname === '/api/platform-settings' || path[0] === 'platform-fee') {
      if (path[0] === 'platform-fee') requireRole(actor, 'admin');
      result = await platformSettings(actor, body);
    } else if (path[0] === 'pricing') result = await pricing(actor, url.searchParams, body);
    else if (get && path[0] === 'activity') result = await readActivity(actor, url.searchParams);
    else if (!get && path[0] === 'request') ({ status, ...result } = await requestReview(actor, body));
    else if (get && !path[0] && !url.searchParams.get('id')) result = await listReviews(actor, url.searchParams);
    else if (get) {
      requireRole(actor, 'client', 'expert', 'admin');
      const review = await fetchReview(path[0] || url.searchParams.get('id'));
      requireCondition(review && ownsReview(actor, review), 404, 'Project Review not found');
      result = { projectReview: await presentReview(review) };
    } else {
      const [id, route, parameter, subAction] = path;
      const aliases = { materials: 'submit-project', times: 'propose-time', 'meet-link': 'send-meet-link', complete: 'complete-review' };
      let action = aliases[route] || route;
      if (route === 'times' && subAction === 'respond') { action = 'respond-time'; body.proposedTimeId = parameter; }
      if (route === 'meetings' && subAction === 'complete') { action = 'complete-meeting'; body.meetingId = parameter; }
      result = await changeReview(actor, id, action, body);
    }
    result = { success: true, ...result };
  } catch (error) {
    const mapped = { P0001: 400, P0002: /pricing changed/.test(error.message) ? 409 : 404, P0003: 409, '23505': 409 };
    status = error.status || mapped[error.code] || (error instanceof URIError ? 400 : 503);
    if (status >= 500) console.error('[project-reviews]', error.code || error.name);
    result = { success: false, error: status >= 500 ? 'Project Review service unavailable. Please try again.' : error.message };
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(result));
}
