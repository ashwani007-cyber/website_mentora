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
