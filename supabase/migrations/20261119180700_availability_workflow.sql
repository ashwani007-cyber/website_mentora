begin;

alter table public.expert_availability add column if not exists cancellation_reason text;
alter table public.bookings drop constraint if exists bookings_availability_id_fkey;
alter table public.bookings add constraint bookings_availability_id_fkey foreign key (availability_id)
  references public.expert_availability(id) on delete set null not valid;
revoke insert, update, delete on public.expert_availability from anon, authenticated;

create or replace function public.mentora_slot_time(p_value text)
returns time
language plpgsql
immutable
set search_path = ''
as $$
begin
  return trim(p_value)::time;
exception when invalid_datetime_format or datetime_field_overflow then return null;
end;
$$;

create or replace function public.mentora_availability_change(p_action text, p_slot jsonb, p_actor jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  slot public.expert_availability;
  expert public.experts;
  slot_id text := p_slot->>'id';
  actor_role text := p_actor->>'role';
  actor_id text := p_actor->>'id';
  member_email text := p_actor->>'email';
  expert_key text;
  slot_date date;
  starts text;
  ends text;
  slot_status text;
  requested_booking_id text := p_slot->>'bookingId';
begin
  if p_action <> 'add' then
    select * into slot from public.expert_availability where id = slot_id for update;
    if not found then raise no_data_found using message = 'Availability slot not found'; end if;
  end if;
  expert_key := coalesce(slot.expert_id, p_slot->>'expertId');
  select * into expert from public.experts where id = expert_key;
  if not found then raise no_data_found using message = 'Expert not found'; end if;

  if p_action in ('book', 'release') then
    if actor_role <> 'client' then raise sqlstate 'PT403' using message = 'Client session required'; end if;
    if nullif(requested_booking_id, '') is null then raise sqlstate 'PT400' using message = 'Booking ID is required'; end if;
    if p_action = 'book' then
      if expert.verified is distinct from true or (nullif(p_slot->>'expertId', '') is not null and expert_key <> p_slot->>'expertId')
        or (nullif(p_slot->>'date', '') is not null and slot.availability_date::text <> p_slot->>'date') then
        raise sqlstate 'PT400' using message = 'Availability does not match the selected expert or date';
      end if;
      if slot.status = 'BOOKED' and slot.booking_id = requested_booking_id and slot.client_id = actor_id then return to_jsonb(slot); end if;
      if slot.status <> 'AVAILABLE' then raise sqlstate 'PT409' using message = 'Time slot is unavailable'; end if;
      if public.mentora_slot_time(slot.start_time) is null or ((slot.availability_date + public.mentora_slot_time(slot.start_time)) at time zone 'Asia/Kolkata') <= now() then
        raise sqlstate 'PT400' using message = 'This time slot has passed or is invalid';
      end if;
      update public.expert_availability set status = 'BOOKED', booking_id = requested_booking_id, client_id = actor_id,
        client_name = p_actor->>'name', updated_at = now(), cancellation_reason = null
        where id = slot_id and status = 'AVAILABLE' returning * into slot;
    else
      if slot.booking_id is distinct from requested_booking_id or slot.client_id is distinct from actor_id
        or exists (select 1 from public.bookings where id = requested_booking_id) then
        raise sqlstate 'PT409' using message = 'Only your provisional slot claim can be released';
      end if;
      update public.expert_availability set status = 'AVAILABLE', booking_id = null, client_id = null, client_name = null,
        updated_at = now(), cancellation_reason = coalesce(nullif(p_slot->>'reason', ''), 'Cancelled by user')
        where id = slot_id returning * into slot;
    end if;
    return to_jsonb(slot);
  end if;

  if actor_role <> 'admin' and not coalesce(actor_role = 'expert' and (expert.user_id::text = actor_id or lower(trim(expert.email)) = member_email), false) then
    raise sqlstate 'PT403' using message = 'You may only manage your own availability';
  end if;
  if slot.status = 'BOOKED' then raise sqlstate 'PT409' using message = 'Booked slots cannot be changed or deleted'; end if;
  if p_action = 'delete' then
    delete from public.expert_availability where id = slot_id;
    return to_jsonb(slot);
  end if;

  slot_date := coalesce((p_slot->>'availabilityDate')::date, slot.availability_date);
  starts := coalesce(p_slot->>'startTime', slot.start_time);
  ends := coalesce(p_slot->>'endTime', slot.end_time);
  slot_status := coalesce(p_slot->>'status', slot.status, 'AVAILABLE');
  if slot_date is null or public.mentora_slot_time(starts) is null or public.mentora_slot_time(ends) is null
    or public.mentora_slot_time(starts) >= public.mentora_slot_time(ends) or slot_status not in ('AVAILABLE', 'DISABLED') then
    raise sqlstate 'PT400' using message = 'Enter an availability date and a valid end time after the start time';
  end if;
  if (p_action = 'add' or slot.availability_date is distinct from slot_date or slot.start_time is distinct from starts
      or slot.end_time is distinct from ends or slot_status = 'AVAILABLE')
      and ((slot_date + public.mentora_slot_time(starts)) at time zone 'Asia/Kolkata') <= now() then
    raise sqlstate 'PT400' using message = 'Past dates or elapsed times cannot be selected';
  end if;
  perform pg_advisory_xact_lock(hashtext('mentora-slot:' || expert_key || ':' || slot_date::text));
  if exists (select 1 from public.expert_availability a where a.expert_id = expert_key and a.availability_date = slot_date and a.id <> slot_id
    and public.mentora_slot_time(a.start_time) < public.mentora_slot_time(ends)
    and public.mentora_slot_time(a.end_time) > public.mentora_slot_time(starts)) then
    raise sqlstate 'PT409' using message = 'Duplicate or overlapping time slot already exists';
  end if;
  if p_action = 'add' then
    insert into public.expert_availability (id, expert_id, availability_date, start_time, end_time, status)
    values (slot_id, expert_key, slot_date, starts, ends, slot_status) returning * into slot;
  else
    update public.expert_availability set availability_date = slot_date, start_time = starts, end_time = ends, status = slot_status,
      updated_at = now() where id = slot_id returning * into slot;
  end if;
  return to_jsonb(slot);
end;
$$;

revoke all on function public.mentora_availability_change(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.mentora_availability_change(text, jsonb, jsonb) to service_role;

commit;
