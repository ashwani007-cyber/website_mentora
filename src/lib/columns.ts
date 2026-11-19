/**
 * columns.ts — the exact columns each query is allowed to download (browser side).
 *
 * WHY: `select('*')` downloads EVERY column, including big JSON/text you don't show.
 * Listing columns here, in one place, keeps every query small and makes it easy to update
 * when a column is added to the database.
 *
 * These lists match the REAL tables in Supabase (checked against the backup of 19 Nov 2026).
 * The same lists exist for the server in server/egressHelpers.js (COLUMNS) — keep both in sync.
 *
 * ⚠️ If you later run supabase-portal-soft-delete-migration.sql (adds deleted_by_client,
 *    deleted_by_expert, deleted_by_admin to bookings), add those three names to BOOKING below
 *    AND in server/egressHelpers.js, otherwise soft-deletes will not be read.
 */
export const COLUMNS = {
  /** Expert list views — everything except the heavy `documents` JSON. */
  EXPERT_LIST:
    'id, user_id, name, field, domain_id, years_of_experience, base_rate, admin_markup, rate, project_rate, rating, total_sessions, verified, initials, title, phone, email, bio, skills, created_at, updated_at',
  /** One expert incl. documents (KYC status lives there). Use for single-row reads only. */
  EXPERT_WITH_DOCUMENTS:
    'id, user_id, name, field, domain_id, years_of_experience, base_rate, admin_markup, rate, project_rate, rating, total_sessions, verified, initials, title, phone, email, bio, skills, documents, created_at, updated_at',
  /** Bookings: every real column (each row is < 1 KB). */
  BOOKING:
    'id, client_id, client_name, client_email, expert_id, expert_name, expert_email, availability_id, booking_date, start_time, end_time, status, price, platform_fee, payment_status, meeting_link, meet_link, meeting_link_sent_at, notes, topic, scheduled_date, scheduled_time, scheduled_start, scheduled_end, duration_minutes, package_type, value, created_at, updated_at',
  NOTIFICATION: 'id, user_id, user_role, title, message, type, link, is_read, metadata, created_at',
  EXPERT_DOCUMENT: 'id, expert_id, doc_type, file_path, file_name, file_size, mime_type, status, admin_remark, uploaded_at, updated_at'
} as const;

/** Default page sizes for list queries. */
export const PAGE = {
  BOOKINGS: 200,
  NOTIFICATIONS: 50
} as const;
