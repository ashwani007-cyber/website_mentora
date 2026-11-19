begin;

create or replace function public.expert_wallet_summary(p_email text, p_id text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with receipts as (
    select amount, created_at from public.wallet_transactions
    where user_role = 'expert' and type = 'CREDIT' and upper(coalesce(status, 'SUCCESS')) = 'SUCCESS'
      and (lower(trim(user_email)) = p_email or user_id = p_id)
  ), weeks as (
    select n, date_trunc('week', now() at time zone 'Asia/Kolkata') - (4 - n) * interval '1 week' as starts
    from generate_series(1, 4) as n
  )
  select jsonb_build_object(
    'earnings', coalesce((select sum(amount) from receipts), 0),
    'trend', (select jsonb_agg(jsonb_build_object('week', 'W' || weeks.n, 'amount',
      coalesce((select sum(receipts.amount) from receipts
        where receipts.created_at >= weeks.starts at time zone 'Asia/Kolkata'
          and receipts.created_at < (weeks.starts + interval '1 week') at time zone 'Asia/Kolkata'), 0)) order by weeks.n)
      from weeks)
  );
$$;

revoke all on function public.expert_wallet_summary(text, text) from public, anon, authenticated;
grant execute on function public.expert_wallet_summary(text, text) to service_role;

commit;
