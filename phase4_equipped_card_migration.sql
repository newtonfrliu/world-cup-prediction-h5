alter table public.players
  add column if not exists equipped_card_id uuid;
