alter table public.players
  add column if not exists referred_by uuid;

alter table public.predictions
  add column if not exists status text not null default 'active',
  add column if not exists settled_at timestamptz;

create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  amount integer not null,
  type text not null,
  related_player_id uuid,
  created_at timestamptz default now()
);

update public.players
set coins = 1000
where coins is null;

update public.predictions
set stake = 0
where stake is null;

update public.predictions
set payout = 0
where payout is null;

update public.predictions
set status = 'active'
where status is null or status = '';
