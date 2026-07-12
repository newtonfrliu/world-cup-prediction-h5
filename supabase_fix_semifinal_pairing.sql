-- Fix semifinal pairing after correcting the 8-team bracket mapping.
-- Scope: update only public.matches.home_team / away_team for the two semifinal rows.
-- M101 is inferred as the earlier semifinal by start_time because match_number is nullable in this dataset.
-- M102 is inferred as the later semifinal by start_time because match_number is nullable in this dataset.
-- Do not modify predictions, players, odds, points, coins, settlement, status, or start_time.
begin;

update public.matches
set home_team = 'France',
    away_team = 'Spain'
where id = '2474044a-5167-4eca-bc01-b1e094e22903'
  and stage in ('semi_final', 'semi_finals')
  and start_time = '2026-07-14T19:00:00+00:00';

update public.matches
set home_team = 'England',
    away_team = 'Argentina'
where id = 'dba3ab85-fd75-4cd4-90f7-935dbe6bddf7'
  and stage in ('semi_final', 'semi_finals')
  and start_time = '2026-07-15T19:00:00+00:00';

commit;

-- Verification:
-- select id, match_number, stage, home_team, away_team, status, start_time
-- from public.matches
-- where stage in ('semi_final', 'semi_finals')
-- order by start_time;
