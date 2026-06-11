alter table public.players
  add column if not exists coins integer not null default 1000,
  add column if not exists last_login_reward_date date,
  add column if not exists avatar_id text not null default 'default-manager';

alter table public.predictions
  add column if not exists stake integer not null default 0,
  add column if not exists payout integer not null default 0;

update public.players
set coins = 1000
where coins is null;

update public.players
set avatar_id = 'default-manager'
where avatar_id is null or avatar_id = '';

update public.predictions
set stake = 0
where stake is null;

update public.predictions
set payout = 0
where payout is null;
