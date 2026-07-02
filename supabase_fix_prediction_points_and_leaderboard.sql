begin;

-- Repair prediction points only.
-- Does not touch coins, payout, stake, or settlement status.
update public.predictions
set points = round(coalesce(odds_at_prediction, 0) * 100)
where status = 'won'
  and coalesce(points, 0) <> round(coalesce(odds_at_prediction, 0) * 100);

update public.predictions
set points = 0
where status in ('lost', 'active', 'cancelled')
  and coalesce(points, 0) <> 0;

commit;

-- Note:
-- public.leaderboard is a view containing GROUP BY, not an updatable table.
-- Do not update public.leaderboard directly.
-- After predictions.points are repaired, leaderboard totals refresh automatically
-- because the view reads from public.predictions.

-- Verification: won predictions with wrong points. Expected 0 rows.
select
  p.id as prediction_id,
  pl.nickname,
  p.status,
  p.odds_at_prediction,
  p.points,
  round(coalesce(p.odds_at_prediction, 0) * 100) as expected_points
from public.predictions p
join public.players pl on pl.id = p.player_id
where p.status = 'won'
  and coalesce(p.points, 0) <> round(coalesce(p.odds_at_prediction, 0) * 100);

-- Verification: non-won predictions with polluted points. Expected 0 rows.
select
  p.id as prediction_id,
  pl.nickname,
  p.status,
  p.points
from public.predictions p
join public.players pl on pl.id = p.player_id
where p.status in ('lost', 'active', 'cancelled')
  and coalesce(p.points, 0) <> 0;

-- Verification: leaderboard view diff. Expected every diff = 0.
-- This is SELECT-only because public.leaderboard is a view.
select
  lb.nickname,
  lb.total_points as leaderboard_points,
  coalesce(calc.expected_points, 0) as expected_points,
  lb.total_points - coalesce(calc.expected_points, 0) as diff
from public.leaderboard lb
left join (
  select
    p.player_id,
    sum(
      case
        when p.status = 'won' then round(coalesce(p.odds_at_prediction, 0) * 100)
        else 0
      end
    ) as expected_points
  from public.predictions p
  group by p.player_id
) calc on calc.player_id = lb.id
order by diff desc;
