-- =============================================================================
-- 99_rollback.sql — UNDO for the egress-fix SQL files. Run only the section you need.
-- Nothing in 01–04 deletes data, so undoing is always safe.
-- NOTE: if you undo section 01, the app keeps working (it falls back to the old,
-- heavier queries automatically).
-- =============================================================================

-- ---- 01: slim read functions + wallet functions ---------------------------
drop function if exists public.get_experts_list();
drop function if exists public.get_expert_by_key(text);
drop function if exists public.get_unverified_experts();
drop function if exists public.wallet_apply_transaction(jsonb);
drop function if exists public.wallet_balance(text, text);
drop function if exists public._expert_slim_json(public.experts);
drop function if exists public.slim_expert_documents(jsonb);
drop function if exists public._strip_file_blob(jsonb);
notify pgrst, 'reload schema';

-- ---- 02: indexes ------------------------------------------------------------
drop index if exists public.idx_experts_email_lower;
drop index if exists public.idx_experts_user_id;
drop index if exists public.idx_experts_domain_id;
drop index if exists public.idx_experts_created_at;
drop index if exists public.idx_experts_unverified;
drop index if exists public.idx_users_email_lower;
drop index if exists public.idx_bookings_client_email_lower;
drop index if exists public.idx_bookings_expert_email_lower;
drop index if exists public.idx_bookings_client_created;
drop index if exists public.idx_bookings_expert_created;
drop index if exists public.idx_wallet_tx_email_created;
drop index if exists public.idx_wallet_tx_booking;
drop index if exists public.idx_wallet_tx_review;
drop index if exists public.idx_availability_expert_date;
drop index if exists public.idx_notifications_user_created;
drop index if exists public.idx_notifications_user_unread;
drop index if exists public.idx_project_reviews_client_email;
drop index if exists public.idx_project_reviews_expert_email;
drop index if exists public.idx_expert_documents_expert;
drop index if exists public.idx_domains_sort;

-- ---- 03: constraints + triggers --------------------------------------------
alter table if exists public.wallet_transactions drop constraint if exists wallet_tx_amount_positive;
alter table if exists public.bookings drop constraint if exists bookings_price_non_negative;
alter table if exists public.experts drop constraint if exists experts_rates_non_negative;
alter table if exists public.experts drop constraint if exists experts_rating_range;
drop index if exists public.uq_wallet_tx_booking;
drop index if exists public.uq_wallet_tx_review;
drop index if exists public.uq_experts_email;
do $$
declare t text;
begin
  foreach t in array array['experts', 'bookings', 'expert_availability', 'project_reviews', 'users', 'expert_documents', 'domains']
  loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$I', t);
  end loop;
exception when undefined_table then null;
end $$;
-- (public.set_updated_at() is left in place; it is harmless. Drop it with:
--  drop function if exists public.set_updated_at();)

-- ---- 04: policies -----------------------------------------------------------
-- 04 only wrapped auth.uid()/auth.role() in (select …); the meaning is identical, so
-- there is normally nothing to undo. If you must, copy the original expression from
-- the NOTICE output of 04 and run:
--   alter policy "<name>" on public.<table> using (<original expression>);
