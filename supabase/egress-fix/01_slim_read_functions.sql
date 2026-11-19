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
