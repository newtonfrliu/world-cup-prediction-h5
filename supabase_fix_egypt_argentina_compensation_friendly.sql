begin;

-- Friendly compensation for confirmed knockout settlement corrections.
-- Scope is limited to Australia vs Egypt and Argentina vs Cape Verde explicit prediction_id rows.
-- public.leaderboard is a view and must not be updated directly; it refreshes from predictions.points.

-- Australia vs Egypt
update public.matches
set
  status = 'finished',
  regular_home_score = 1,
  regular_away_score = 1,
  betting_result = 'draw',
  final_home_score = 1,
  final_away_score = 1,
  advancement_winner = 'away'
where id = '50867847-f0e7-44b0-918c-44014b87df9b'::uuid
  and home_team = 'Australia'
  and away_team = 'Egypt';

-- Argentina vs Cape Verde
update public.matches
set
  status = 'finished',
  regular_home_score = 1,
  regular_away_score = 1,
  betting_result = 'draw',
  final_home_score = 3,
  final_away_score = 2,
  advancement_winner = 'home'
where id = 'd7124c25-68b8-4677-ae84-fdac2ca0b974'::uuid
  and home_team = 'Argentina'
  and away_team = 'Cape Verde';

-- No affected predictions to update.

-- Friendly strategy: only top up positive coin_delta; do not deduct overpaid coins.
-- coin_transactions has no description column; use type + related_id for idempotency.
-- No positive coin compensation required.

commit;
