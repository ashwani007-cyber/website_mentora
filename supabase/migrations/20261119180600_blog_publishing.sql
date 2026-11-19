begin;

alter table public.blogs
  add column if not exists featured boolean not null default false,
  add column if not exists display_order integer not null default 1,
  add column if not exists published_at timestamptz,
  add column if not exists editor_metadata jsonb not null default '{}'::jsonb;
update public.blogs set published_at = coalesce(updated_at, created_at) where is_published and published_at is null;

create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);
alter table public.blog_categories enable row level security;
revoke all on public.blog_categories from public, anon, authenticated;
grant select, insert, update, delete on public.blog_categories to service_role;

alter table public.blogs enable row level security;
drop policy if exists mentora_published_blogs_only on public.blogs;
create policy mentora_published_blogs_only on public.blogs as restrictive
  for select to anon, authenticated using (is_published is true);
revoke insert, update, delete on public.blogs from anon, authenticated;

insert into storage.buckets (id, name, public) values ('site-media', 'site-media', false)
on conflict (id) do update set public = false;
drop policy if exists mentora_site_media_private on storage.objects;
create policy mentora_site_media_private on storage.objects as restrictive
  for all to anon, authenticated using (bucket_id <> 'site-media') with check (bucket_id <> 'site-media');

create or replace function public.mentora_delete_blog_category(p_id uuid, p_force boolean)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  category public.blog_categories;
begin
  select * into category from public.blog_categories where id = p_id for update;
  if not found then raise no_data_found using message = 'Category not found'; end if;
  if not p_force and exists (select 1 from public.blogs where lower(trim(blogs.category)) = lower(trim(category.name))) then
    raise sqlstate 'PT409' using message = 'Articles still use this category. Confirm force delete to remove the category label.';
  end if;
  delete from public.blog_categories where id = p_id;
  return true;
end;
$$;

create or replace function public.mentora_reorder_blogs(p_ids uuid[])
returns void
language sql
set search_path = ''
as $$
  update public.blogs set display_order = positions.ordinality, updated_at = now()
  from unnest(p_ids) with ordinality as positions(id, ordinality) where blogs.id = positions.id;
$$;

revoke all on function public.mentora_delete_blog_category(uuid, boolean) from public, anon, authenticated;
revoke all on function public.mentora_reorder_blogs(uuid[]) from public, anon, authenticated;
grant execute on function public.mentora_delete_blog_category(uuid, boolean) to service_role;
grant execute on function public.mentora_reorder_blogs(uuid[]) to service_role;

commit;
