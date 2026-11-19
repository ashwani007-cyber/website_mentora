begin;

alter table public.project_reviews
  add column if not exists workflow_revision bigint not null default 0,
  add column if not exists refund_tx_id text;

-- Legacy duplicate active pairs must be reconciled before this index can be installed.
create unique index if not exists project_reviews_active_pair
  on public.project_reviews (lower(trim(client_email)), lower(trim(expert_email)))
  where status in ('PendingExpertAcceptance', 'Accepted', 'ProjectSubmitted', 'InReview', 'MeetingRequested', 'MeetingScheduled');

create table if not exists public.pricing_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  expert_id text,
  previous_value jsonb,
  new_value jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.pricing_audit_logs enable row level security;
revoke all on public.pricing_audit_logs from public, anon, authenticated;
grant select, insert on public.pricing_audit_logs to service_role;

insert into storage.buckets (id, name, public)
values ('review-files', 'review-files', false)
on conflict (id) do update set public = false;

-- Uses the same lock as the existing ledger RPC so that an hourly purchase and
-- a review request cannot spend the same funds concurrently.
create or replace function public.workflow_wallet_apply(p_tx jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  email text := lower(trim(p_tx->>'user_email'));
  account_id text := p_tx->>'user_id';
  amount numeric := (p_tx->>'amount')::numeric;
  existing public.wallet_transactions;
  balance numeric;
begin
  perform pg_advisory_xact_lock(hashtext('wallet:' || coalesce(nullif(email, ''), account_id)));
  select * into existing from public.wallet_transactions where id = p_tx->>'id';
  if found then
    if existing.user_email <> email or existing.type <> p_tx->>'type' or existing.amount <> amount then
      raise data_exception using message = 'Conflicting wallet transaction';
    end if;
    return jsonb_build_object('transaction', to_jsonb(existing), 'balance', public.wallet_balance(email, account_id), 'duplicate', true);
  end if;
  balance := public.wallet_balance(email, account_id);
  if p_tx->>'type' = 'DEBIT' and balance < amount then
    raise sqlstate 'P0001' using message = 'Insufficient wallet balance';
  end if;
  if amount = 0 then
    return jsonb_build_object('balance', balance, 'duplicate', false);
  end if;
  return public.wallet_apply_transaction(p_tx);
end;
$$;

create or replace function public.project_review_create(p_review jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  review public.project_reviews;
  expert public.experts;
  fee_config jsonb;
  charge numeric;
  fee numeric;
  fee_type text;
  payment jsonb;
begin
  select * into expert from public.experts where id = p_review->>'expert_id' and verified is true for share;
  if not found or nullif(expert.email, '') is null then
    raise no_data_found using message = 'Verified expert not found';
  end if;
  select value into fee_config from public.platform_settings where key = 'platform_charge' for share;
  charge := least(2000, greatest(0, coalesce(expert.project_rate, 1500)));
  fee_type := case when fee_config->>'feeType' = 'percentage' then 'percentage' else 'fixed' end;
  fee := case
    when fee_type = 'percentage' then round(charge * coalesce((fee_config->>'feeValue')::numeric, 15) / 100)
    else coalesce((fee_config->>'feeValue')::numeric, 200)
  end;
  fee := round(greatest(0, fee), 2);
  if p_review ? 'expected_price' and (p_review->>'expected_price')::numeric <> charge + fee then
    raise sqlstate 'P0002' using message = 'Project Review pricing changed. Refresh the quote and try again.';
  end if;

  insert into public.project_reviews (project_review_id, client_id, client_name, client_email, expert_id,
    expert_name, expert_email, price, expert_earning, platform_fee, platform_charge_type, status,
    payment_status, expert_earning_status, review_type, request_notes, expected_scope, chat, activity_timeline)
  values (p_review->>'project_review_id', p_review->>'client_id', p_review->>'client_name', lower(trim(p_review->>'client_email')),
    expert.id, expert.name, lower(trim(expert.email)), charge + fee, charge, fee, fee_type, 'PendingExpertAcceptance',
    'PaymentSuccessful', 'EarningPending', p_review->>'review_type', p_review->>'request_notes', p_review->>'expected_scope',
    p_review->'chat', p_review->'activity_timeline') returning * into review;

  payment := public.workflow_wallet_apply(jsonb_build_object(
    'id', 'pr-payment:' || review.project_review_id, 'user_id', review.client_id, 'user_email', review.client_email,
    'user_role', 'client', 'amount', review.price, 'type', 'DEBIT', 'description', 'Project Review escrow',
    'related_project_review_id', review.project_review_id));
  update public.project_reviews set client_wallet_tx_id = payment->'transaction'->>'id'
  where project_review_id = review.project_review_id returning * into review;
  return jsonb_build_object('projectReview', to_jsonb(review), 'clientWalletBalance', payment->'balance');
end;
$$;

create or replace function public.project_review_commit(p_id text, p_revision bigint, p_patch jsonb, p_wallet_event text default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  review public.project_reviews;
  next_review public.project_reviews;
  transfer jsonb;
begin
  select * into review from public.project_reviews where project_review_id = p_id for update;
  if not found then raise no_data_found using message = 'Project Review not found'; end if;
  if review.workflow_revision <> p_revision then
    return jsonb_build_object('conflict', true);
  end if;
  next_review := jsonb_populate_record(review, p_patch);

  if p_wallet_event = 'charge' then
    transfer := public.workflow_wallet_apply(jsonb_build_object(
      'id', 'pr-payment:' || p_id, 'user_id', review.client_id, 'user_email', review.client_email,
      'user_role', 'client', 'amount', review.price, 'type', 'DEBIT', 'description', 'Project Review escrow',
      'related_project_review_id', p_id));
    next_review.client_wallet_tx_id := transfer->'transaction'->>'id';
  elsif p_wallet_event in ('refund', 'release') then
    if review.payment_status <> 'PaymentSuccessful' or (review.price > 0 and not exists (
      select 1 from public.wallet_transactions t
      where t.type = 'DEBIT' and upper(coalesce(t.status, 'SUCCESS')) = 'SUCCESS'
        and (t.related_project_review_id = p_id or t.id = review.client_wallet_tx_id)
        and lower(trim(t.user_email)) = lower(trim(review.client_email)) and t.amount = review.price
    )) then
      raise sqlstate 'P0003' using message = 'Review escrow could not be verified. Reconcile the payment before proceeding.';
    end if;

    if p_wallet_event = 'refund' then
      transfer := public.workflow_wallet_apply(jsonb_build_object(
        'id', 'pr-refund:' || p_id, 'user_id', review.client_id, 'user_email', review.client_email,
        'user_role', 'client', 'amount', review.price, 'type', 'CREDIT', 'description', 'Project Review escrow refund',
        'related_project_review_id', p_id));
      next_review.refund_tx_id := transfer->'transaction'->>'id';
    else
      transfer := public.workflow_wallet_apply(jsonb_build_object(
        'id', 'pr-earning:' || p_id, 'user_id', review.expert_id, 'user_email', review.expert_email,
        'user_role', 'expert', 'amount', review.expert_earning, 'type', 'CREDIT', 'description', 'Project Review earnings',
        'related_project_review_id', p_id));
      next_review.expert_wallet_tx_id := transfer->'transaction'->>'id';
    end if;
  end if;

  update public.project_reviews set
    status = next_review.status, payment_status = next_review.payment_status, expert_earning_status = next_review.expert_earning_status,
    submission = next_review.submission, chat = next_review.chat, proposed_times = next_review.proposed_times, meetings = next_review.meetings,
    completed_meeting_count = next_review.completed_meeting_count, review_feedback = next_review.review_feedback,
    client_wallet_tx_id = next_review.client_wallet_tx_id, expert_wallet_tx_id = next_review.expert_wallet_tx_id,
    refund_tx_id = next_review.refund_tx_id, client_archived = next_review.client_archived, expert_archived = next_review.expert_archived,
    activity_timeline = next_review.activity_timeline, updated_at = now(), workflow_revision = review.workflow_revision + 1
  where project_review_id = p_id returning * into review;
  return to_jsonb(review);
end;
$$;

create or replace function public.project_review_set_pricing(p_actor text, p_expert_id text, p_value jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  old_value jsonb;
  updated jsonb;
  expert public.experts;
begin
  if p_expert_id is null then
    perform pg_advisory_xact_lock(hashtext('mentora-platform-charge'));
    select value into old_value from public.platform_settings where key = 'platform_charge';
    insert into public.platform_settings (key, value, updated_at) values ('platform_charge', p_value, now())
    on conflict (key) do update set value = excluded.value, updated_at = now() returning value into updated;
  else
    select * into expert from public.experts where id = p_expert_id for update;
    if not found then raise no_data_found using message = 'Expert not found'; end if;
    old_value := to_jsonb(expert.project_rate);
    update public.experts set project_rate = (p_value #>> '{}')::numeric where id = p_expert_id;
    updated := p_value;
  end if;
  insert into public.pricing_audit_logs (actor_email, expert_id, previous_value, new_value)
  values (p_actor, p_expert_id, old_value, updated);
  return updated;
end;
$$;

revoke all on function public.workflow_wallet_apply(jsonb) from public, anon, authenticated;
revoke all on function public.project_review_create(jsonb) from public, anon, authenticated;
revoke all on function public.project_review_commit(text, bigint, jsonb, text) from public, anon, authenticated;
revoke all on function public.project_review_set_pricing(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.workflow_wallet_apply(jsonb) to service_role;
grant execute on function public.project_review_create(jsonb) to service_role;
grant execute on function public.project_review_commit(text, bigint, jsonb, text) to service_role;
grant execute on function public.project_review_set_pricing(text, text, jsonb) to service_role;

-- The server authorizes and signs review file reads. These policies also prevent
-- broader policies on storage.objects from exposing this bucket to browser roles.
drop policy if exists mentora_review_files_private on storage.objects;
create policy mentora_review_files_private on storage.objects as restrictive
  for all to anon, authenticated using (bucket_id <> 'review-files') with check (bucket_id <> 'review-files');

-- The admin-only activity API uses service_role and checks the session.
do $$ begin
  if to_regprocedure('public.get_project_review_activity(integer)') is not null then
    revoke execute on function public.get_project_review_activity(integer) from public, anon, authenticated;
  end if;
end $$;

commit;
