alter table public.player_cards
  add column if not exists card_art_url text,
  add column if not exists card_thumb_url text,
  add column if not exists card_theme text,
  add column if not exists card_number text;
