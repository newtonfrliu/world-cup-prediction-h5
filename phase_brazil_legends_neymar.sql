alter table public.player_cards
  add column if not exists card_art_url text,
  add column if not exists card_thumb_url text,
  add column if not exists card_theme text,
  add column if not exists card_number text,
  add column if not exists roster_source text default 'current_pool',
  add column if not exists roster_version text default 'pre_2026_world_cup_final_squad',
  add column if not exists price integer default 5000,
  add column if not exists star_level integer default 1;

update public.player_cards
set player_name = '内马尔',
    player_name_en = 'Neymar',
    position = '前锋',
    rarity = 'legend',
    price = 70000,
    star_level = 5,
    card_art_url = '/cards/brazil/neymar.png',
    card_thumb_url = '/cards/brazil/neymar.png',
    card_theme = 'Brazil Legends',
    card_number = '#010',
    roster_source = 'world_cup_legends',
    roster_version = 'world_cup_legends_series'
where team = 'Brazil'
  and player_name_en = 'Neymar';

insert into public.player_cards (
  team,
  player_name,
  player_name_en,
  position,
  shirt_number,
  rarity,
  price,
  star_level,
  card_art_url,
  card_thumb_url,
  card_theme,
  card_number,
  roster_source,
  roster_version
)
select
  'Brazil',
  '内马尔',
  'Neymar',
  '前锋',
  null,
  'legend',
  70000,
  5,
  '/cards/brazil/neymar.png',
  '/cards/brazil/neymar.png',
  'Brazil Legends',
  '#010',
  'world_cup_legends',
  'world_cup_legends_series'
where not exists (
  select 1
  from public.player_cards
  where team = 'Brazil'
    and player_name_en = 'Neymar'
);
