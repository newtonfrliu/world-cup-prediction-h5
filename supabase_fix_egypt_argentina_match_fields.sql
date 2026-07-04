begin;

-- Fix confirmed 90-minute / final / advancement fields only.
-- This file does not update predictions, players, coins, payout, points, or public.leaderboard.

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

commit;
