alter table public.players
  add column if not exists bracket_locked boolean default false;
