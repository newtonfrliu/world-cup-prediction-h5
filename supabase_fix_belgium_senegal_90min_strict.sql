begin;

-- Belgium vs Senegal 90-minute settlement correction.
-- Only this match_id and explicit prediction_id rows are touched.
-- public.leaderboard is a view and must not be updated directly.

update public.matches
set
  regular_home_score = 2,
  regular_away_score = 2,
  betting_result = 'draw',
  final_home_score = 3,
  final_away_score = 2,
  advancement_winner = 'home'
where id = '9af2efa0-eb0b-46da-9943-53cb9a514fd1'::uuid
  and home_team = 'Belgium'
  and away_team = 'Senegal';

-- mr / draw / lost -> won
update public.predictions
set
  status = 'won',
  payout = 1650,
  points = 330,
  settled_at = now()
where id = '46ded187-bf18-4b02-bd87-b71e07831cb1'::uuid
  and match_id = '9af2efa0-eb0b-46da-9943-53cb9a514fd1'::uuid;

-- 盐田大益 / home_win / won -> lost
update public.predictions
set
  status = 'lost',
  payout = 0,
  points = 0,
  settled_at = now()
where id = '8425486b-e43f-4217-95bf-57f7e348dfc6'::uuid
  and match_id = '9af2efa0-eb0b-46da-9943-53cb9a514fd1'::uuid;

-- Newton / away_win / lost -> lost
update public.predictions
set
  status = 'lost',
  payout = 0,
  points = 0,
  settled_at = now()
where id = '5d21be4e-fca4-442f-a09c-947336b62ede'::uuid
  and match_id = '9af2efa0-eb0b-46da-9943-53cb9a514fd1'::uuid;

-- 卖教辅的 / draw / lost -> won
update public.predictions
set
  status = 'won',
  payout = 6800,
  points = 340,
  settled_at = now()
where id = '5f4f59ea-ba0d-4e60-82cb-552aba133e77'::uuid
  and match_id = '9af2efa0-eb0b-46da-9943-53cb9a514fd1'::uuid;

-- 华尔街只狼 / home_win / won -> lost
update public.predictions
set
  status = 'lost',
  payout = 0,
  points = 0,
  settled_at = now()
where id = '518be095-24bb-4a5c-8403-e39a1329a876'::uuid
  and match_id = '9af2efa0-eb0b-46da-9943-53cb9a514fd1'::uuid;

-- 桐人 / draw / lost -> won
update public.predictions
set
  status = 'won',
  payout = 3300,
  points = 330,
  settled_at = now()
where id = '6d25ca9d-288d-4386-a995-6ea2815104bf'::uuid
  and match_id = '9af2efa0-eb0b-46da-9943-53cb9a514fd1'::uuid;

-- 夏天 / home_win / won -> lost
update public.predictions
set
  status = 'lost',
  payout = 0,
  points = 0,
  settled_at = now()
where id = 'd56ad199-594e-4db4-8450-000e426f0a90'::uuid
  and match_id = '9af2efa0-eb0b-46da-9943-53cb9a514fd1'::uuid;

with compensation(player_id, prediction_id, amount) as (
  values
  ('69535203-2b0d-49bd-bc4e-da285793efbc'::uuid, '46ded187-bf18-4b02-bd87-b71e07831cb1'::uuid, 1650),
  ('441faf57-18c8-494e-957f-8bb5a7adfd71'::uuid, '8425486b-e43f-4217-95bf-57f7e348dfc6'::uuid, -10750),
  ('0e7caa36-5ac4-426e-b0d4-1967edb41d9c'::uuid, '5f4f59ea-ba0d-4e60-82cb-552aba133e77'::uuid, 6800),
  ('9ef17228-064c-4585-9f89-1df84ed94130'::uuid, '518be095-24bb-4a5c-8403-e39a1329a876'::uuid, -4300),
  ('d8747bea-2e58-46f7-872c-64c6a14d5785'::uuid, '6d25ca9d-288d-4386-a995-6ea2815104bf'::uuid, 3300),
  ('f18d7084-198c-49b2-9a09-62b7cdc17f4c'::uuid, 'd56ad199-594e-4db4-8450-000e426f0a90'::uuid, -108)
), inserted_transactions as (
  insert into public.coin_transactions (player_id, amount, type, related_id, related_player_id)
  select
    c.player_id,
    c.amount,
    'belgium_senegal_90min_strict_adjustment',
    c.prediction_id,
    null
  from compensation c
  where not exists (
    select 1
    from public.coin_transactions existing
    where existing.type = 'belgium_senegal_90min_strict_adjustment'
      and existing.related_id = c.prediction_id
  )
  returning player_id, amount
), totals as (
  select player_id, sum(amount) as amount
  from inserted_transactions
  group by player_id
)
update public.players p
set coins = p.coins + totals.amount
from totals
where p.id = totals.player_id;

commit;
