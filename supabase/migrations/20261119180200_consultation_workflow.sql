begin;

alter table public.bookings
  add column if not exists availability_id varchar(255),
  add column if not exists platform_fee numeric(10, 2) default 0,
  add column if not exists payout_transferred boolean not null default false,
  add column if not exists workflow_managed boolean not null default false,
  add column if not exists decline_reason text,
  add column if not exists meeting_link_sent_at timestamptz,
  add column if not exists deleted_by_client boolean not null default false,
  add column if not exists deleted_by_expert boolean not null default false,
  add column if not exists deleted_by_admin boolean not null default false;

-- Keep previous consultation status spellings for historical rows. The RPC writes canonical values.
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check check (lower(status) in
  ('pending', 'accepted', 'rejected', 'completed', 'cancelled', 'live', 'confirmed', 'no_show',
   'pending expert acceptance', 'accepted — awaiting google meet link', 'accepted - awaiting google meet link',
   'confirmed — meet link sent', 'confirmed — meet link ready', 'confirmed - meet link ready',
   'declined by expert', 'completed — ready for review', 'live — call connected')) not valid;

-- All writes to the bookings table must go through the API. Portal caches no longer
-- write to the underlying table during an API outage.
revoke insert, update, delete on public.bookings from anon, authenticated;
revoke select on public.bookings from anon;
drop policy if exists mentora_booking_participants on public.bookings;
create policy mentora_booking_participants on public.bookings as restrictive for select to authenticated using (
  client_id = (select auth.uid())::text or expert_id = (select auth.uid())::text
  or lower(trim(client_email)) = lower((select auth.jwt())->>'email')
  or lower(trim(expert_email)) = lower((select auth.jwt())->>'email')
);

create or replace function public.consultation_status(p_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(p_status) like 'pending%' then 'pending'
    when lower(p_status) like 'accept%' or lower(p_status) like 'confirm%' then 'accepted'
    when lower(p_status) like 'reject%' or lower(p_status) like 'declin%' then 'rejected'
    when lower(p_status) like 'complete%' then 'completed'
    when lower(p_status) like 'live%' then 'live'
    when lower(p_status) in ('cancelled', 'no_show') then 'cancelled'
    else null
  end;
$$;

create or replace function public.consultation_purchase(p_booking jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
<<purchase>>
declare
  booking public.bookings;
  slot public.expert_availability;
  expert public.experts;
  booking_id text := p_booking->>'id';
  client_id text := p_booking->>'client_id';
  email text := p_booking->>'client_email';
  start_at timestamptz;
  end_at timestamptz;
  price numeric;
  payment jsonb;
  package text := p_booking->>'package_type';
begin
  perform pg_advisory_xact_lock(hashtext('mentora-booking:' || booking_id));
  select * into booking from public.bookings b where b.id = booking_id;
  if found then
    if booking.client_email <> email or booking.availability_id is distinct from p_booking->>'availability_id' then
      raise sqlstate 'PT409' using message = 'Booking ID already in use';
    end if;
    return jsonb_build_object('booking', to_jsonb(booking), 'balance', public.wallet_balance(email, client_id), 'duplicate', true);
  end if;

  select * into slot from public.expert_availability where id = p_booking->>'availability_id' for update;
  if not found then raise no_data_found using message = 'Time slot not found'; end if;
  if slot.expert_id is distinct from p_booking->>'expert_id' or slot.availability_date::text is distinct from p_booking->>'scheduled_date' then
    raise sqlstate 'PT400' using message = 'Time slot does not match the expert or date';
  end if;
  if slot.status is distinct from 'AVAILABLE' and not (slot.status = 'BOOKED' and slot.booking_id = booking_id and slot.client_id = client_id) then
    raise sqlstate 'PT409' using message = 'This time slot is unavailable';
  end if;
  start_at := (slot.availability_date::date + slot.start_time::time) at time zone 'Asia/Kolkata';
  end_at := (slot.availability_date::date + slot.end_time::time) at time zone 'Asia/Kolkata';
  if start_at <= now() or end_at <= start_at then
    raise sqlstate 'PT400' using message = 'This time slot has passed or is invalid';
  end if;
  select * into expert from public.experts where id = slot.expert_id and verified is true for share;
  if not found or nullif(expert.email, '') is null then raise no_data_found using message = 'Verified expert not found'; end if;

  price := greatest(0, coalesce(expert.rate, expert.base_rate + coalesce(expert.admin_markup, 0), 0));
  if package = 'Project Advisory' then price := price * 3; end if;
  if p_booking ? 'price' and (p_booking->>'price')::numeric <> price then
    raise sqlstate 'PT409' using message = 'Consultation pricing changed. Refresh the booking form and try again';
  end if;

  update public.expert_availability a set status = 'BOOKED', booking_id = purchase.booking_id,
    client_id = purchase.client_id, client_name = p_booking->>'client_name', updated_at = now()
    where a.id = slot.id and (a.status = 'AVAILABLE' or (a.status = 'BOOKED' and a.booking_id = purchase.booking_id and a.client_id = purchase.client_id));
  if not found then raise sqlstate 'PT409' using message = 'This time slot is unavailable'; end if;

  insert into public.bookings (id, client_id, client_email, client_name, expert_id, expert_email, expert_name, availability_id,
    topic, notes, scheduled_date, scheduled_time, scheduled_start, scheduled_end, start_time, end_time, duration_minutes,
    package_type, value, price, platform_fee, status, payment_status, workflow_managed)
  values (booking_id, client_id, email, p_booking->>'client_name', expert.id, lower(trim(expert.email)), expert.name, slot.id,
    p_booking->>'topic', p_booking->>'topic', slot.availability_date::text, slot.start_time, start_at, end_at,
    slot.start_time, slot.end_time, extract(epoch from end_at - start_at)::int / 60,
    package, price, price, price - round(price * 0.85), 'pending', 'PAID', true)
  returning * into booking;

  payment := public.workflow_wallet_apply(jsonb_build_object(
    'id', 'booking-payment:' || booking_id, 'user_id', client_id, 'user_email', email, 'user_role', 'client',
    'amount', price, 'type', 'DEBIT', 'description', 'Consultation booking', 'related_booking_id', booking_id));
  return jsonb_build_object('booking', to_jsonb(booking), 'balance', payment->'balance', 'duplicate', false);
end;
$$;

create or replace function public.consultation_update(p_id text, p_actor jsonb, p_action text, p_input jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  booking public.bookings;
  actor_role text := p_actor->>'role';
  actor_id text := p_actor->>'id';
  actor_email text := p_actor->>'email';
  previous_status text;
  next_status text;
  supplied_link text := nullif(p_input->>'meet_link', '');
  consultation_cost numeric;
  transfer jsonb;
  has_debit boolean;
begin
  select * into booking from public.bookings where id = p_id for update;
  if not found then raise no_data_found using message = 'Consultation not found'; end if;
  if coalesce(not (actor_role = 'admin'
    or (actor_role = 'client' and (lower(trim(booking.client_email)) = actor_email or booking.client_id = actor_id))
    or (actor_role = 'expert' and (lower(trim(booking.expert_email)) = actor_email or booking.expert_id = actor_id))), true) then
    raise no_data_found using message = 'Consultation not found';
  end if;

  if p_action = 'hide' then
    update public.bookings set deleted_by_client = coalesce(deleted_by_client, false) or actor_role = 'client',
      deleted_by_expert = coalesce(deleted_by_expert, false) or actor_role = 'expert',
      deleted_by_admin = coalesce(deleted_by_admin, false) or actor_role = 'admin' where id = p_id returning * into booking;
    return jsonb_build_object('booking', to_jsonb(booking), 'duplicate', false);
  end if;

  previous_status := public.consultation_status(booking.status);
  consultation_cost := coalesce(booking.price, booking.value, 0);
  select exists (select 1 from public.wallet_transactions t where t.related_booking_id = p_id and t.type = 'DEBIT'
    and t.amount = consultation_cost and lower(trim(t.user_email)) = lower(trim(booking.client_email)) and upper(coalesce(t.status, 'SUCCESS')) = 'SUCCESS') into has_debit;

  if p_action = 'payout' then
    if actor_role <> 'admin' then raise sqlstate 'PT403' using message = 'Administrator access required'; end if;
    if booking.payout_transferred then return jsonb_build_object('booking', to_jsonb(booking), 'duplicate', true); end if;
    -- Before this migration the Meet-link action could already have credited a browser wallet.
    if not booking.workflow_managed then
      raise sqlstate 'PT409' using message = 'Reconcile this historical consultation payout before disbursing';
    end if;
    if previous_status is distinct from 'completed' or (consultation_cost > 0 and not has_debit) then
      raise sqlstate 'PT409' using message = 'A completed, paid consultation is required';
    end if;
    transfer := public.workflow_wallet_apply(jsonb_build_object(
      'id', 'booking-payout:' || p_id, 'user_id', booking.expert_id, 'user_email', booking.expert_email,
      'user_role', 'expert', 'amount', greatest(0, consultation_cost - coalesce(booking.platform_fee, 0)), 'type', 'CREDIT',
      'description', 'Consultation payout', 'related_booking_id', p_id));
    update public.bookings set payout_transferred = true where id = p_id returning * into booking;
    return jsonb_build_object('booking', to_jsonb(booking), 'balance', transfer->'balance', 'duplicate', false);
  end if;

  next_status := p_input->>'status';
  if actor_role not in ('expert', 'admin') then raise sqlstate 'PT403' using message = 'Expert or administrator access required'; end if;
  if previous_status = next_status and (supplied_link is null or supplied_link = coalesce(booking.meet_link, booking.meeting_link)) then
    return jsonb_build_object('booking', to_jsonb(booking), 'duplicate', true);
  end if;
  if not coalesce(
    (actor_role = 'expert' and previous_status = 'pending' and next_status in ('accepted', 'rejected') and supplied_link is null)
    or (actor_role = 'expert' and previous_status = next_status and next_status in ('accepted', 'live') and supplied_link is not null)
    or (previous_status in ('accepted', 'live') and next_status = 'completed' and supplied_link is null
      and (actor_role = 'admin' or nullif(coalesce(booking.meet_link, booking.meeting_link), '') is not null))
    or (actor_role = 'admin' and previous_status = 'accepted' and next_status = 'live'
      and coalesce(supplied_link, nullif(booking.meet_link, ''), nullif(booking.meeting_link, '')) is not null), false) then
    raise sqlstate 'PT409' using message = 'Consultation status cannot be changed from its current state';
  end if;

  if next_status = 'rejected' then
    if has_debit then
      transfer := public.workflow_wallet_apply(jsonb_build_object(
        'id', 'booking-refund:' || p_id, 'user_id', booking.client_id, 'user_email', booking.client_email,
        'user_role', 'client', 'amount', consultation_cost, 'type', 'CREDIT', 'description', 'Declined consultation refund', 'related_booking_id', p_id));
    end if;
    update public.expert_availability set status = 'AVAILABLE', booking_id = null, client_id = null, client_name = null, updated_at = now()
    where status = 'BOOKED' and booking_id = p_id;
  end if;
  update public.bookings set status = next_status, meet_link = coalesce(supplied_link, meet_link),
    meeting_link = coalesce(supplied_link, meeting_link),
    meeting_link_sent_at = case when supplied_link is not null then now() else meeting_link_sent_at end,
    decline_reason = case when next_status = 'rejected' then coalesce(nullif(p_input->>'decline_reason', ''), 'Declined by expert') else decline_reason end,
    payment_status = case when next_status = 'rejected' and (has_debit or consultation_cost = 0) then 'REFUNDED' else payment_status end
  where id = p_id returning * into booking;
  return jsonb_build_object('booking', to_jsonb(booking), 'duplicate', false);
end;
$$;

revoke all on function public.consultation_purchase(jsonb) from public, anon, authenticated;
revoke all on function public.consultation_update(text, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.consultation_purchase(jsonb) to service_role;
grant execute on function public.consultation_update(text, jsonb, text, jsonb) to service_role;

commit;
