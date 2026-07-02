-- Multi-market betting support.
-- Adds h2h_90 / advance / totals_90 without deleting or rebuilding old predictions.

alter table public.predictions
  add column if not exists market_key text default 'h2h_90',
  add column if not exists market_label text null,
  add column if not exists selection_key text null,
  add column if not exists selection_label text null,
  add column if not exists line numeric null;

update public.predictions
set
  market_key = coalesce(nullif(market_key, ''), 'h2h_90'),
  market_label = coalesce(market_label, '90分钟胜平负'),
  selection_key = coalesce(nullif(selection_key, ''), prediction),
  selection_label = coalesce(
    selection_label,
    case prediction
      when 'home_win' then '主胜'
      when 'draw' then '平'
      when 'away_win' then '客胜'
      else prediction
    end
  ),
  line = coalesce(line, 0)
where market_key is null
   or market_key = ''
   or selection_key is null
   or selection_key = ''
   or market_label is null
   or selection_label is null
   or line is null;

create table if not exists public.match_betting_markets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  market_key text not null,
  selection_key text not null,
  selection_label text not null,
  odds numeric not null,
  line numeric not null default 0,
  source text default 'manual',
  bookmaker text null,
  is_active boolean default true,
  updated_at timestamptz default now(),
  unique(match_id, market_key, selection_key, line)
);

do $$
declare
  constraint_name text;
begin
  select tc.constraint_name
    into constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
   and tc.table_name = kcu.table_name
  where tc.table_schema = 'public'
    and tc.table_name = 'predictions'
    and tc.constraint_type = 'UNIQUE'
  group by tc.constraint_name
  having array_agg(kcu.column_name order by kcu.ordinal_position) = array['player_id', 'match_id'];

  if constraint_name is not null then
    execute format('alter table public.predictions drop constraint %I', constraint_name);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'predictions_player_match_market_key'
      and conrelid = 'public.predictions'::regclass
  ) then
    alter table public.predictions
      add constraint predictions_player_match_market_key
      unique(player_id, match_id, market_key);
  end if;
end $$;

comment on column public.predictions.market_key is
  'Betting market key: h2h_90, advance, totals_90.';
comment on column public.predictions.selection_key is
  'Market selection key. Mirrors legacy prediction for h2h_90.';
comment on column public.predictions.line is
  'Market line at betting time. Use 0 for h2h_90 and advance.';
