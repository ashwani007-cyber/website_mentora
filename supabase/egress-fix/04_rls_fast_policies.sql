-- =============================================================================
-- 04_rls_fast_policies.sql  —  RUN FOURTH
-- -----------------------------------------------------------------------------
-- WHY: a policy written as `auth.uid() = user_id` calls auth.uid() once PER ROW.
-- Written as `(select auth.uid()) = user_id`, Postgres calls it ONCE per query and
-- caches it. Same security, much faster on bigger tables (Supabase's own advice).
--
-- This script finds every existing policy in the public schema that calls
-- auth.uid() / auth.role() / auth.jwt() unwrapped, and rewrites it in place with
-- ALTER POLICY. The meaning of each policy does NOT change.
--
-- It prints each policy it changes (NOTICE) and the original text, so you can undo
-- by hand if ever needed (see 99_rollback.sql, section 04).
--
-- IMPORTANT (read EGRESS_FIX_GUIDE.md → "Security follow-up"): your app logs users in
-- with its own users/password table, not Supabase Auth, so auth.uid() is always NULL
-- for browser requests. Truly per-user RLS needs Supabase Auth (or all private
-- reads/writes going through your server). That is a separate, larger change.
-- =============================================================================

do $$
declare
  p record;
  new_qual text;
  new_check text;
  stmt text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ 'auth\.(uid|role|jwt)\(\)' or coalesce(with_check, '') ~ 'auth\.(uid|role|jwt)\(\)')
  loop
    -- skip policies that are already wrapped
    if coalesce(p.qual, '') ilike '%SELECT auth.%' or coalesce(p.with_check, '') ilike '%SELECT auth.%' then
      continue;
    end if;

    new_qual  := regexp_replace(p.qual,       'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g');
    new_check := regexp_replace(p.with_check, 'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g');

    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if new_qual is not null then
      stmt := stmt || format(' using (%s)', new_qual);
    end if;
    if new_check is not null then
      stmt := stmt || format(' with check (%s)', new_check);
    end if;

    raise notice 'policy % on %: USING (%) WITH CHECK (%)  →  %', p.policyname, p.tablename, p.qual, p.with_check, stmt;
    execute stmt;
  end loop;
end $$;
