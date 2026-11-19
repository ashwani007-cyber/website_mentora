begin;

alter table public.notifications add column if not exists event_id text;
create unique index if not exists notifications_event_id on public.notifications (event_id);
create table if not exists public.notification_receipts (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  account text not null,
  is_read boolean not null default false,
  hidden boolean not null default false,
  primary key (notification_id, account)
);
alter table public.notification_receipts enable row level security;
revoke all on public.notification_receipts from public, anon, authenticated;
grant select, insert, update on public.notification_receipts to service_role;

create or replace function public.notification_inbox(p_role text, p_identifiers text[])
returns setof public.notifications
language sql
stable
set search_path = ''
as $$
  select n.* from public.notifications n
  where p_role = 'admin'
    or (n.user_role in ('landing', 'all') and n.user_id in ('*', 'all', ''))
    or (p_role in ('client', 'expert') and n.user_role in (p_role, 'custom')
      and (lower(trim(n.user_id)) = any(p_identifiers) or n.user_id in ('*', p_role || '-user')));
$$;

create or replace function public.notification_record_receipts(p_role text, p_identifiers text[], p_account text, p_event text, p_hide boolean)
returns void
language sql
set search_path = ''
as $$
  insert into public.notification_receipts (notification_id, account, is_read, hidden)
  select n.id, p_account, true, p_hide from public.notification_inbox(p_role, p_identifiers) n
  where p_event is null or n.id::text = p_event or n.event_id = p_event
  on conflict (notification_id, account) do update set is_read = true, hidden = notification_receipts.hidden or excluded.hidden;
$$;

revoke all on function public.notification_inbox(text, text[]) from public, anon, authenticated;
revoke all on function public.notification_record_receipts(text, text[], text, text, boolean) from public, anon, authenticated;
grant execute on function public.notification_inbox(text, text[]) to service_role;
grant execute on function public.notification_record_receipts(text, text[], text, text, boolean) to service_role;

commit;
