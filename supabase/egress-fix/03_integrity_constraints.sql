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
