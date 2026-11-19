-- =============================================================================
-- 02_indexes.sql  —  RUN SECOND
-- -----------------------------------------------------------------------------
-- WHY: indexes let Postgres jump straight to the rows a query asks for instead of
-- scanning the whole table. Your tables are small today, so the speed gain is modest,
-- but these keep every filter/order the app uses fast as data grows.
--
-- SAFE: indexes never change data. Each statement is skipped (with a NOTICE) if a
-- table/column doesn't exist in your database, so the script never stops half-way.
-- UNDO: run the "02" section of 99_rollback.sql.
-- =============================================================================

-- Small helper: run one statement, print a notice instead of failing if the
-- table/column is missing. Dropped again at the end of this file.
create or replace function pg_temp.try_exec(stmt text) returns void language plpgsql as $$
begin
  execute stmt;
exception when undefined_table or undefined_column or undefined_object then
  raise notice 'skipped (missing table/column): %', stmt;
end $$;

-- experts: looked up by email (login, status), by user_id, by domain; listed by created_at
select pg_temp.try_exec('create index if not exists idx_experts_email_lower on public.experts (lower(email))');
select pg_temp.try_exec('create index if not exists idx_experts_user_id on public.experts (user_id)');
select pg_temp.try_exec('create index if not exists idx_experts_domain_id on public.experts (domain_id)');
select pg_temp.try_exec('create index if not exists idx_experts_created_at on public.experts (created_at desc)');
-- partial index: the admin KYC desk only reads unverified experts
select pg_temp.try_exec('create index if not exists idx_experts_unverified on public.experts (created_at desc) where coalesce(verified, false) = false');

-- users: login by email (case-insensitive)
select pg_temp.try_exec('create index if not exists idx_users_email_lower on public.users (lower(email))');

-- bookings: client/expert dashboards filter by id or email and sort by date
select pg_temp.try_exec('create index if not exists idx_bookings_client_email_lower on public.bookings (lower(client_email))');
select pg_temp.try_exec('create index if not exists idx_bookings_expert_email_lower on public.bookings (lower(expert_email))');
select pg_temp.try_exec('create index if not exists idx_bookings_client_created on public.bookings (client_id, created_at desc)');
select pg_temp.try_exec('create index if not exists idx_bookings_expert_created on public.bookings (expert_id, created_at desc)');

-- wallet_transactions: balance + history by user email, newest first
select pg_temp.try_exec('create index if not exists idx_wallet_tx_email_created on public.wallet_transactions (lower(user_email), created_at desc)');
select pg_temp.try_exec('create index if not exists idx_wallet_tx_booking on public.wallet_transactions (related_booking_id) where related_booking_id is not null');
select pg_temp.try_exec('create index if not exists idx_wallet_tx_review on public.wallet_transactions (related_project_review_id) where related_project_review_id is not null');

-- expert_availability: calendar = one expert, one date range
select pg_temp.try_exec('create index if not exists idx_availability_expert_date on public.expert_availability (expert_id, availability_date)');

-- notifications: "my unread notifications, newest first"
select pg_temp.try_exec('create index if not exists idx_notifications_user_created on public.notifications (user_id, created_at desc)');
select pg_temp.try_exec('create index if not exists idx_notifications_user_unread on public.notifications (user_id) where is_read = false');

-- project_reviews: client/expert lists by email, newest first
select pg_temp.try_exec('create index if not exists idx_project_reviews_client_email on public.project_reviews (lower(client_email), created_at desc)');
select pg_temp.try_exec('create index if not exists idx_project_reviews_expert_email on public.project_reviews (lower(expert_email), created_at desc)');

-- expert_documents: per expert (unique (expert_id, doc_type) already exists)
select pg_temp.try_exec('create index if not exists idx_expert_documents_expert on public.expert_documents (expert_id)');

-- domains: ordered list
select pg_temp.try_exec('create index if not exists idx_domains_sort on public.domains (sort_order)');

-- Refresh planner statistics so the new indexes are used right away.
analyze;
