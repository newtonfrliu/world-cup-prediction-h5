-- Readable predictions view with joined player and match details.
-- This does not copy data and does not modify table structure.

do $$
declare
  has_match_home_team_zh boolean;
  has_match_away_team_zh boolean;
  has_prediction_updated_at boolean;
  sql text;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matches'
      and column_name = 'home_team_zh'
  ) into has_match_home_team_zh;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matches'
      and column_name = 'away_team_zh'
  ) into has_match_away_team_zh;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'predictions'
      and column_name = 'updated_at'
  ) into has_prediction_updated_at;

  sql := 'create or replace view public.predictions_with_matches as
select
  predictions.id as prediction_id,
  predictions.player_id,
  players.nickname as player_nickname,
  predictions.match_id,
  matches.home_team,
  matches.away_team';

  if has_match_home_team_zh then
    sql := sql || ',
  matches.home_team_zh';
  end if;

  if has_match_away_team_zh then
    sql := sql || ',
  matches.away_team_zh';
  end if;

  sql := sql || ',
  matches.start_time,
  predictions.prediction,
  predictions.odds_at_prediction,
  predictions.stake,
  predictions.payout,
  predictions.status,
  predictions.points,
  predictions.created_at';

  if has_prediction_updated_at then
    sql := sql || ',
  predictions.updated_at';
  end if;

  sql := sql || '
from public.predictions
join public.matches
  on predictions.match_id = matches.id
join public.players
  on predictions.player_id = players.id;';

  execute sql;
end $$;

comment on view public.predictions_with_matches is
  'Readable predictions view joined with players and matches for database inspection.';
