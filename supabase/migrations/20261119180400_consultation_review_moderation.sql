begin;

create table if not exists public.reviews (
  id varchar(255) primary key,
  expert_id varchar(255) not null,
  client_id varchar(255) not null,
  session_id varchar(255) not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  client_name varchar(255),
  client_email varchar(255),
  expert_name varchar(255),
  expert_email varchar(255),
  created_at timestamptz default now()
);

-- Existing reviews were already public. Newly submitted reviews require moderation.
alter table public.reviews
  add column if not exists status text not null default 'approved',
  add column if not exists visible_to_expert boolean not null default true,
  add column if not exists featured_on_landing boolean not null default false;
alter table public.reviews alter column status set default 'pending', alter column visible_to_expert set default false;
alter table public.reviews enable row level security;
revoke all on public.reviews from public, anon, authenticated;
grant select, insert, update, delete on public.reviews to service_role;
create unique index if not exists reviews_one_per_consultation on public.reviews (session_id);
create index if not exists reviews_moderated_expert on public.reviews (expert_id) where visible_to_expert;

alter table public.bookings add column if not exists reviewed boolean not null default false;
update public.bookings b set reviewed = true where not b.reviewed and exists (select 1 from public.reviews r where r.session_id = b.id);

create or replace function public.consultation_submit_review(p_session text, p_client_id text, p_client_email text, p_rating integer, p_comment text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  booking public.bookings;
  review public.reviews;
begin
  select * into booking from public.bookings where id = p_session for update;
  if not found or (booking.client_id <> p_client_id and lower(trim(booking.client_email)) <> p_client_email) then
    raise no_data_found using message = 'Consultation not found';
  end if;
  if public.consultation_status(booking.status) is distinct from 'completed' then
    raise sqlstate 'PT409' using message = 'Only completed consultations can be reviewed';
  end if;
  if p_rating is null or p_rating not between 1 and 5 or nullif(trim(p_comment), '') is null then
    raise sqlstate 'PT400' using message = 'A rating from 1 to 5 and a comment are required';
  end if;
  if booking.reviewed then
    select * into review from public.reviews where session_id = p_session;
    if found then return jsonb_build_object('review', to_jsonb(review), 'duplicate', true); end if;
    raise sqlstate 'PT409' using message = 'This consultation has already been reviewed';
  end if;
  insert into public.reviews (id, expert_id, client_id, session_id, rating, comment, client_name, client_email, expert_name, expert_email, status, visible_to_expert)
  values (gen_random_uuid()::text, booking.expert_id, booking.client_id, booking.id, p_rating, trim(p_comment), booking.client_name,
    booking.client_email, booking.expert_name, booking.expert_email, 'pending', false) returning * into review;
  update public.bookings set reviewed = true where id = booking.id;
  return jsonb_build_object('review', to_jsonb(review), 'duplicate', false);
end;
$$;

create or replace function public.consultation_review_moderate(p_id text, p_action text, p_value boolean default false)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  review public.reviews;
begin
  select * into review from public.reviews where id = p_id for update;
  if not found then raise no_data_found using message = 'Review not found'; end if;
  perform pg_advisory_xact_lock(hashtext('mentora-ratings:' || review.expert_id));
  if p_action = 'delete' then
    delete from public.reviews where id = p_id;
  elsif p_action = 'feature' then
    update public.reviews set featured_on_landing = p_value where id = p_id returning * into review;
  elsif p_action = 'visibility' then
    update public.reviews set visible_to_expert = p_value, status = case when p_value then 'approved' else 'pending' end
    where id = p_id returning * into review;
  else
    raise sqlstate 'PT400' using message = 'Unknown moderation action';
  end if;
  update public.experts set rating = (select coalesce(round(avg(rating), 1), 0) from public.reviews
    where expert_id = review.expert_id and status = 'approved' and visible_to_expert)
    where id = review.expert_id;
  return to_jsonb(review);
end;
$$;

create or replace function public.consultation_review_stats(p_expert_id text, p_expert_email text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('avgRating', coalesce(round(avg(rating), 1), 0), 'reviewCount', count(*),
    'completedConsultations', (select count(*) from public.bookings b where public.consultation_status(b.status) = 'completed'
      and (b.expert_id = p_expert_id or lower(trim(b.expert_email)) = p_expert_email)))
  from public.reviews r where r.status = 'approved' and r.visible_to_expert
    and (r.expert_id = p_expert_id or lower(trim(r.expert_email)) = p_expert_email);
$$;

revoke all on function public.consultation_submit_review(text, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.consultation_review_moderate(text, text, boolean) from public, anon, authenticated;
revoke all on function public.consultation_review_stats(text, text) from public, anon, authenticated;
grant execute on function public.consultation_submit_review(text, text, text, integer, text) to service_role;
grant execute on function public.consultation_review_moderate(text, text, boolean) to service_role;
grant execute on function public.consultation_review_stats(text, text) to service_role;

commit;
