begin;

with candidates as (
  select
    p.id,
    p.player_id,
    p.prediction,
    coalesce(p.stake, 0) as stake,
    coalesce(p.odds_at_prediction, 0) as odds_at_prediction,
    m.result
  from public.predictions p
  join public.matches m on m.id = p.match_id
  where p.status = 'active'
    and m.status = 'finished'
    and m.result is not null
),
settled as (
  select
    id,
    player_id,
    case
      when
        case
          when prediction in ('home_win', 'home') then 'home'
          when prediction in ('away_win', 'away') then 'away'
          when prediction = 'draw' then 'draw'
          else prediction
        end
        =
        case
          when result in ('home_win', 'home') then 'home'
          when result in ('away_win', 'away') then 'away'
          when result = 'draw' then 'draw'
          else result
        end
      then 'won'
      else 'lost'
    end as next_status,
    case
      when
        case
          when prediction in ('home_win', 'home') then 'home'
          when prediction in ('away_win', 'away') then 'away'
          when prediction = 'draw' then 'draw'
          else prediction
        end
        =
        case
          when result in ('home_win', 'home') then 'home'
          when result in ('away_win', 'away') then 'away'
          when result = 'draw' then 'draw'
          else result
        end
      then round(odds_at_prediction * 100)::integer
      else 0
    end as next_points,
    case
      when
        case
          when prediction in ('home_win', 'home') then 'home'
          when prediction in ('away_win', 'away') then 'away'
          when prediction = 'draw' then 'draw'
          else prediction
        end
        =
        case
          when result in ('home_win', 'home') then 'home'
          when result in ('away_win', 'away') then 'away'
          when result = 'draw' then 'draw'
          else result
        end
      then round(stake * odds_at_prediction)::integer
      else 0
    end as next_payout
  from candidates
),
updated_predictions as (
  update public.predictions p
  set
    status = s.next_status,
    points = s.next_points,
    payout = s.next_payout,
    settled_at = now()
  from settled s
  where p.id = s.id
    and p.status = 'active'
  returning p.player_id, p.payout
),
player_payouts as (
  select player_id, sum(payout)::integer as total_payout
  from updated_predictions
  where payout > 0
  group by player_id
)
update public.players pl
set coins = coalesce(pl.coins, 1000) + pp.total_payout
from player_payouts pp
where pl.id = pp.player_id;

commit;
