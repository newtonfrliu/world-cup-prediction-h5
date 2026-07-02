-- Split 1X2 betting settlement from knockout advancement.
-- Betting settlement must use 90-minute regular-time result only.
-- Existing home_score / away_score / result are kept for backward compatibility.

alter table public.matches
  add column if not exists regular_home_score integer null,
  add column if not exists regular_away_score integer null,
  add column if not exists betting_result text null,
  add column if not exists final_home_score integer null,
  add column if not exists final_away_score integer null,
  add column if not exists advancement_winner text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_betting_result_check'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
      add constraint matches_betting_result_check
      check (betting_result is null or betting_result in ('home', 'draw', 'away'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_advancement_winner_check'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
      add constraint matches_advancement_winner_check
      check (advancement_winner is null or advancement_winner in ('home', 'away'));
  end if;
end $$;

comment on column public.matches.regular_home_score is
  '90-minute regular-time home score used for 1X2 betting settlement.';
comment on column public.matches.regular_away_score is
  '90-minute regular-time away score used for 1X2 betting settlement.';
comment on column public.matches.betting_result is
  '1X2 betting result from regular time only: home, draw, or away.';
comment on column public.matches.final_home_score is
  'Official final home score after extra time when applicable.';
comment on column public.matches.final_away_score is
  'Official final away score after extra time when applicable.';
comment on column public.matches.advancement_winner is
  'Knockout advancement winner after extra time / penalties: home or away.';
