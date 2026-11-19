-- =============================================================================
-- ALL_01_to_05.sql — files 01, 02, 03, 04 and 05 combined, in the right order.
-- Paste the WHOLE file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once. Changes no data. Undo: 99_rollback.sql (+ the 05 undo lines).
-- Generated from the individual files — edit those, not this one.
-- =============================================================================

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 01_slim_read_functions.sql >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- =============================================================================
-- 01_slim_read_functions.sql  —  RUN FIRST
-- -----------------------------------------------------------------------------
-- WHY: the app used `select('*')` on `experts`, which also downloads the
-- `documents` JSON column. That column contained whole PDFs/images as base64
-- text (one row was ~280 KB). These functions return the SAME expert data the
-- UI needs, but with the heavy base64 parts removed, so each request is tiny.
--
-- SAFE: these only CREATE FUNCTIONS. No table or data is changed.
-- UNDO: run the "01" section of 99_rollback.sql.
-- The app code falls back to the old query if these functions don't exist yet,
-- so you can run this before or after deploying the new code.
-- =============================================================================

-- Removes inline file blobs from ONE document object:
--   drops "fileData"/"file_data"/"base64" keys, and any "url"/"data" value that is a
--   `data:...;base64,` string. File names, paths, status, dates are all kept.
create or replace function public._strip_file_blob(obj jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when obj is null then null
    when jsonb_typeof(obj) = 'object' then
      (obj - 'fileData' - 'file_data' - 'base64')
      - (case when left(coalesce(obj->>'url',  ''), 5) = 'data:' then 'url'  else '' end)
      - (case when left(coalesce(obj->>'data', ''), 5) = 'data:' then 'data' else '' end)
    when jsonb_typeof(obj) = 'string' and left(obj #>> '{}', 5) = 'data:' then 'null'::jsonb
    else obj
  end
$$;

-- Applies _strip_file_blob to every entry of experts.documents, including the
-- nested "items" object/array. Returns a small "metadata only" copy.
create or replace function public.slim_expert_documents(docs jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb := '{}'::jsonb;
  k text;
  v jsonb;
  ik text;
  iv jsonb;
  inner_obj jsonb;
begin
  if docs is null or jsonb_typeof(docs) <> 'object' then
    return docs;
  end if;

  for k, v in select * from jsonb_each(docs) loop
    if k = 'items' and jsonb_typeof(v) = 'object' then
      inner_obj := '{}'::jsonb;
      for ik, iv in select * from jsonb_each(v) loop
        inner_obj := inner_obj || jsonb_build_object(ik, public._strip_file_blob(iv));
      end loop;
      result := result || jsonb_build_object(k, inner_obj);
    elsif k = 'items' and jsonb_typeof(v) = 'array' then
      result := result || jsonb_build_object(
        k, coalesce((select jsonb_agg(public._strip_file_blob(el)) from jsonb_array_elements(v) el), '[]'::jsonb)
      );
    else
      result := result || jsonb_build_object(k, public._strip_file_blob(v));
    end if;
  end loop;
  return result;
end
$$;

-- One expert row as JSON, with slim documents. Uses to_jsonb(e) so it works no matter
-- which optional columns (img, company, hero_spotlight, …) exist in your table.
create or replace function public._expert_slim_json(e public.experts)
returns jsonb
language sql
stable
as $$
  select (to_jsonb(e) - 'documents')
         || jsonb_build_object('documents', public.slim_expert_documents(e.documents))
$$;

-- LIST: all experts, newest first, without base64 blobs.
-- Called by the browser as supabase.rpc('get_experts_list').
create or replace function public.get_experts_list()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public._expert_slim_json(e)
  from public.experts e
  order by e.created_at desc nulls last, e.id
$$;

-- ONE expert by id OR email (case-insensitive). Replaces select('*').or(id.eq…,email.ilike…).
create or replace function public.get_expert_by_key(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public._expert_slim_json(e)
  from public.experts e
  where e.id = trim(p_key)
     or lower(e.email) = lower(trim(p_key))
     or (e.user_id is not null and e.user_id::text = trim(p_key))
  order by (e.id = trim(p_key)) desc
  limit 1
$$;

-- Experts NOT yet verified (for the admin KYC desk). Returns slim documents.
create or replace function public.get_unverified_experts()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public._expert_slim_json(e)
  from public.experts e
  where coalesce(e.verified, false) = false
  order by e.created_at desc nulls last, e.id
$$;

-- Wallet balance computed INSIDE the database: returns one number instead of
-- downloading every transaction row.
create or replace function public.wallet_balance(p_email text, p_user_id text default null)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, coalesce(sum(
           case when upper(coalesce(t.status, 'SUCCESS')) <> 'SUCCESS' then 0
                when t.type = 'CREDIT' then t.amount
                when t.type = 'DEBIT'  then -t.amount
                else 0 end), 0))
  from public.wallet_transactions t
  where (p_email is not null and p_email <> '' and lower(t.user_email) = lower(trim(p_email)))
     or (p_user_id is not null and p_user_id <> '' and t.user_id = p_user_id)
$$;

-- ATOMIC wallet write: inserts the transaction AND returns the new balance in ONE
-- database transaction. A per-user lock stops two clicks at the same moment from
-- interleaving. If the same debit for the same booking/project review was already
-- recorded (double click, retry, refresh), it is NOT inserted again — the existing
-- row is returned with "duplicate": true (idempotent).
create or replace function public.wallet_apply_transaction(p_tx jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_email   text := lower(trim(coalesce(p_tx->>'user_email', '')));
  v_user_id text := coalesce(nullif(p_tx->>'user_id', ''), v_email);
  v_type    text := upper(coalesce(p_tx->>'type', ''));
  v_amount  numeric := coalesce((p_tx->>'amount')::numeric, 0);
  v_booking text := nullif(p_tx->>'related_booking_id', '');
  v_review  text := nullif(p_tx->>'related_project_review_id', '');
  v_row     public.wallet_transactions;
  v_dup     boolean := false;
begin
  if v_email = '' and v_user_id = '' then
    raise exception 'wallet_apply_transaction: user_email or user_id is required' using errcode = '22023';
  end if;
  if v_type not in ('CREDIT', 'DEBIT') then
    raise exception 'wallet_apply_transaction: type must be CREDIT or DEBIT' using errcode = '22023';
  end if;
  if v_amount <= 0 then
    raise exception 'wallet_apply_transaction: amount must be greater than 0' using errcode = '22023';
  end if;

  -- Serialise writes for this one user (released automatically at commit).
  perform pg_advisory_xact_lock(hashtext('wallet:' || coalesce(nullif(v_email, ''), v_user_id)));

  -- Idempotency: same user + same type + same booking/project review = same payment.
  if v_booking is not null or v_review is not null then
    select * into v_row
    from public.wallet_transactions t
    where lower(t.user_email) = v_email
      and t.type = v_type
      and ((v_booking is not null and t.related_booking_id = v_booking)
        or (v_review  is not null and t.related_project_review_id = v_review))
    limit 1;
    v_dup := found;
  end if;

  if not v_dup then
    insert into public.wallet_transactions
      (id, user_id, user_email, user_role, amount, type, status, description,
       related_booking_id, related_project_review_id)
    values
      (coalesce(nullif(p_tx->>'id', ''), 'tx-' || replace(gen_random_uuid()::text, '-', '')),
       v_user_id, v_email, coalesce(nullif(p_tx->>'user_role', ''), 'client'),
       v_amount, v_type, coalesce(nullif(p_tx->>'status', ''), 'SUCCESS'),
       p_tx->>'description', v_booking, v_review)
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'transaction', to_jsonb(v_row),
    'balance', public.wallet_balance(v_email, v_user_id),
    'duplicate', v_dup
  );
end
$$;

-- Permissions: read functions may be called from the browser (anon key);
-- wallet writes may ONLY be called by your server (service_role).
revoke all on function public.get_experts_list() from public;
revoke all on function public.get_expert_by_key(text) from public;
revoke all on function public.get_unverified_experts() from public;
revoke all on function public.wallet_balance(text, text) from public;
revoke all on function public.wallet_apply_transaction(jsonb) from public;

grant execute on function public.get_experts_list() to anon, authenticated, service_role;
grant execute on function public.get_expert_by_key(text) to anon, authenticated, service_role;
grant execute on function public.get_unverified_experts() to service_role;
grant execute on function public.wallet_balance(text, text) to service_role;
grant execute on function public.wallet_apply_transaction(jsonb) to service_role;

-- Tell PostgREST to see the new functions immediately.
notify pgrst, 'reload schema';

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 02_indexes.sql >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 03_integrity_constraints.sql >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- =============================================================================
-- 03_integrity_constraints.sql  —  RUN THIRD
-- -----------------------------------------------------------------------------
-- WHY: rules enforced BY THE DATABASE can't be skipped by a bug, a double click
-- or a retry. This file adds only rules that are safe for your existing data:
--
--   * CHECK constraints are added as NOT VALID  → they apply to every NEW/UPDATED
--     row, but don't fail because of old rows. (You can VALIDATE later, see bottom.)
--   * UNIQUE indexes are added ONLY if no duplicates exist yet; otherwise a NOTICE
--     lists what to clean up and the rest of the script continues.
--   * `updated_at` is set automatically on every UPDATE.
--
-- No rows are changed or deleted.  UNDO: "03" section of 99_rollback.sql.
-- =============================================================================

create or replace function pg_temp.try_exec(stmt text) returns void language plpgsql as $$
begin
  execute stmt;
exception
  when undefined_table or undefined_column or undefined_object then
    raise notice 'skipped (missing table/column): %', stmt;
  when duplicate_object then
    raise notice 'already exists: %', stmt;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Money must be positive / non-negative
-- ---------------------------------------------------------------------------
select pg_temp.try_exec('alter table public.wallet_transactions add constraint wallet_tx_amount_positive check (amount > 0) not valid');
select pg_temp.try_exec('alter table public.bookings add constraint bookings_price_non_negative check (price >= 0) not valid');
select pg_temp.try_exec('alter table public.experts add constraint experts_rates_non_negative check (coalesce(base_rate,0) >= 0 and coalesce(rate,0) >= 0 and coalesce(project_rate,0) >= 0) not valid');
select pg_temp.try_exec('alter table public.experts add constraint experts_rating_range check (rating is null or (rating >= 0 and rating <= 5)) not valid');

-- ---------------------------------------------------------------------------
-- 2. No double charges: one DEBIT per user per booking / per project review
--    (the app's wallet function also checks this; the index is the hard guarantee)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.wallet_transactions
    where related_booking_id is not null
    group by lower(user_email), type, related_booking_id having count(*) > 1
  ) then
    raise notice 'NOT added uq_wallet_tx_booking: duplicate wallet rows exist for the same booking. Check: select lower(user_email), type, related_booking_id, count(*) from wallet_transactions where related_booking_id is not null group by 1,2,3 having count(*) > 1;';
  else
    create unique index if not exists uq_wallet_tx_booking
      on public.wallet_transactions (lower(user_email), type, related_booking_id)
      where related_booking_id is not null;
  end if;

  if exists (
    select 1 from public.wallet_transactions
    where related_project_review_id is not null
    group by lower(user_email), type, related_project_review_id having count(*) > 1
  ) then
    raise notice 'NOT added uq_wallet_tx_review: duplicate wallet rows exist for the same project review.';
  else
    create unique index if not exists uq_wallet_tx_review
      on public.wallet_transactions (lower(user_email), type, related_project_review_id)
      where related_project_review_id is not null;
  end if;
exception when undefined_table or undefined_column then
  raise notice 'skipped wallet unique indexes (table/column missing)';
end $$;

-- ---------------------------------------------------------------------------
-- 3. One expert profile per email (case-insensitive) — stops duplicate sign-ups
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.experts where email is not null and email <> ''
    group by lower(email) having count(*) > 1
  ) then
    raise notice 'NOT added uq_experts_email: duplicate expert emails exist. Check: select lower(email), count(*) from experts group by 1 having count(*) > 1;';
  else
    create unique index if not exists uq_experts_email
      on public.experts (lower(email))
      where email is not null and email <> '';
  end if;
exception when undefined_table or undefined_column then
  raise notice 'skipped experts email unique index';
end $$;

-- ---------------------------------------------------------------------------
-- 4. Every row records when it was created; updated_at is maintained automatically
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array['experts', 'bookings', 'expert_availability', 'project_reviews', 'users', 'expert_documents', 'domains']
  loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = t and column_name = 'updated_at') then
      execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$I', t);
      execute format('create trigger trg_%1$s_updated_at before update on public.%1$I for each row execute function public.set_updated_at()', t);
    else
      raise notice 'no updated_at column on %, trigger skipped', t;
    end if;

    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = t and column_name = 'created_at') then
      execute format('alter table public.%I alter column created_at set default now()', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- LATER (optional): once you've cleaned old rows, make the CHECKs cover them too:
--   alter table public.wallet_transactions validate constraint wallet_tx_amount_positive;
--   alter table public.bookings            validate constraint bookings_price_non_negative;
--   alter table public.experts             validate constraint experts_rates_non_negative;
--   alter table public.experts             validate constraint experts_rating_range;
-- ---------------------------------------------------------------------------

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 04_rls_fast_policies.sql >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- =============================================================================
-- 04_rls_fast_policies.sql  —  RUN FOURTH
-- -----------------------------------------------------------------------------
-- WHY: a policy written as `auth.uid() = user_id` calls auth.uid() once PER ROW.
-- Written as `(select auth.uid()) = user_id`, Postgres calls it ONCE per query and
-- caches it. Same security, much faster on bigger tables (Supabase's own advice).
--
-- This script finds every existing policy in the public schema that calls
-- auth.uid() / auth.role() / auth.jwt() unwrapped, and rewrites it in place with
-- ALTER POLICY. The meaning of each policy does NOT change.
--
-- It prints each policy it changes (NOTICE) and the original text, so you can undo
-- by hand if ever needed (see 99_rollback.sql, section 04).
--
-- IMPORTANT (read EGRESS_FIX_GUIDE.md → "Security follow-up"): your app logs users in
-- with its own users/password table, not Supabase Auth, so auth.uid() is always NULL
-- for browser requests. Truly per-user RLS needs Supabase Auth (or all private
-- reads/writes going through your server). That is a separate, larger change.
-- =============================================================================

do $$
declare
  p record;
  new_qual text;
  new_check text;
  stmt text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ 'auth\.(uid|role|jwt)\(\)' or coalesce(with_check, '') ~ 'auth\.(uid|role|jwt)\(\)')
  loop
    -- skip policies that are already wrapped
    if coalesce(p.qual, '') ilike '%SELECT auth.%' or coalesce(p.with_check, '') ilike '%SELECT auth.%' then
      continue;
    end if;

    new_qual  := regexp_replace(p.qual,       'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g');
    new_check := regexp_replace(p.with_check, 'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g');

    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if new_qual is not null then
      stmt := stmt || format(' using (%s)', new_qual);
    end if;
    if new_check is not null then
      stmt := stmt || format(' with check (%s)', new_check);
    end if;

    raise notice 'policy % on %: USING (%) WITH CHECK (%)  →  %', p.policyname, p.tablename, p.qual, p.with_check, stmt;
    execute stmt;
  end loop;
end $$;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 05_project_review_summaries.sql >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- =============================================================================
-- 05_project_review_summaries.sql  —  RUN FIFTH (after 01–04)
-- -----------------------------------------------------------------------------
-- WHY: project_reviews rows carry big JSON arrays (chat ≈ 2 KB, activity_timeline
-- ≈ 3 KB per row). A full list was 437 KB. List screens only need a message COUNT
-- and the admin "audit log" only needs the latest events, so the database now
-- computes those small answers itself.
--
-- SAFE: only creates functions. No table or data changes.
-- UNDO: see the "05" section at the bottom of this file.
-- The app falls back to working without these (message counts show 0 and the
-- admin audit tab is empty) if they are not installed.
-- =============================================================================

-- "Computed column": lets the API select chat_count like a normal column,
-- e.g.  /project_reviews?select=project_review_id,chat_count
create or replace function public.chat_count(r public.project_reviews)
returns integer
language sql
stable
as $$
  select case when jsonb_typeof(r.chat) = 'array' then jsonb_array_length(r.chat) else 0 end
$$;

-- Latest N activity events across ALL project reviews, newest first, already
-- flattened (one small JSON object per event) — for the admin audit tab.
create or replace function public.get_project_review_activity(p_limit integer default 100)
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select ev || jsonb_build_object(
           'reviewId',   pr.project_review_id,
           'clientName', pr.client_name,
           'expertName', pr.expert_name)
  from public.project_reviews pr
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(pr.activity_timeline) = 'array' then pr.activity_timeline else '[]'::jsonb end
  ) as ev
  order by coalesce(ev->>'timestamp', '') desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
$$;

-- Only the server (service_role) may read the admin activity feed.
revoke all on function public.get_project_review_activity(integer) from public;
grant execute on function public.get_project_review_activity(integer) to service_role;
grant execute on function public.chat_count(public.project_reviews) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- ---- UNDO (05) ----------------------------------------------------------------
-- drop function if exists public.get_project_review_activity(integer);
-- drop function if exists public.chat_count(public.project_reviews);
-- notify pgrst, 'reload schema';
