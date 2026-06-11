create extension if not exists pgcrypto;

create table if not exists public.player_cards (
  id uuid primary key default gen_random_uuid(),
  team text not null,
  player_name text not null,
  player_name_en text,
  position text,
  shirt_number integer,
  rarity text not null default 'common',
  card_image text,
  created_at timestamptz default now()
);

create table if not exists public.user_cards (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  card_id uuid not null references public.player_cards(id) on delete cascade,
  acquired_at timestamptz default now(),
  unique(player_id, card_id)
);

create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  amount integer not null,
  type text not null,
  related_id text,
  created_at timestamptz default now()
);

alter table public.coin_transactions
  add column if not exists related_id text;

create unique index if not exists player_cards_team_number_key
  on public.player_cards(team, shirt_number);

insert into public.player_cards
  (team, player_name, player_name_en, position, shirt_number, rarity)
values
  ('Argentina', '阿根廷 01', 'Argentina 01', '门将', 1, 'rare'),
  ('Argentina', '阿根廷 02', 'Argentina 02', '后卫', 2, 'common'),
  ('Argentina', '阿根廷 03', 'Argentina 03', '后卫', 3, 'common'),
  ('Argentina', '阿根廷 04', 'Argentina 04', '中场', 4, 'common'),
  ('Argentina', '阿根廷 05', 'Argentina 05', '中场', 5, 'rare'),
  ('Argentina', '阿根廷 06', 'Argentina 06', '前锋', 6, 'common'),
  ('Argentina', '阿根廷 07', 'Argentina 07', '前锋', 7, 'epic'),
  ('Argentina', '阿根廷 08', 'Argentina 08', '队长', 8, 'legend'),
  ('France', '法国 01', 'France 01', '门将', 1, 'rare'),
  ('France', '法国 02', 'France 02', '后卫', 2, 'common'),
  ('France', '法国 03', 'France 03', '后卫', 3, 'common'),
  ('France', '法国 04', 'France 04', '中场', 4, 'common'),
  ('France', '法国 05', 'France 05', '中场', 5, 'rare'),
  ('France', '法国 06', 'France 06', '前锋', 6, 'common'),
  ('France', '法国 07', 'France 07', '前锋', 7, 'epic'),
  ('France', '法国 08', 'France 08', '队长', 8, 'legend'),
  ('Brazil', '巴西 01', 'Brazil 01', '门将', 1, 'rare'),
  ('Brazil', '巴西 02', 'Brazil 02', '后卫', 2, 'common'),
  ('Brazil', '巴西 03', 'Brazil 03', '后卫', 3, 'common'),
  ('Brazil', '巴西 04', 'Brazil 04', '中场', 4, 'common'),
  ('Brazil', '巴西 05', 'Brazil 05', '中场', 5, 'rare'),
  ('Brazil', '巴西 06', 'Brazil 06', '前锋', 6, 'common'),
  ('Brazil', '巴西 07', 'Brazil 07', '前锋', 7, 'epic'),
  ('Brazil', '巴西 08', 'Brazil 08', '队长', 8, 'legend'),
  ('Portugal', '葡萄牙 01', 'Portugal 01', '门将', 1, 'rare'),
  ('Portugal', '葡萄牙 02', 'Portugal 02', '后卫', 2, 'common'),
  ('Portugal', '葡萄牙 03', 'Portugal 03', '后卫', 3, 'common'),
  ('Portugal', '葡萄牙 04', 'Portugal 04', '中场', 4, 'common'),
  ('Portugal', '葡萄牙 05', 'Portugal 05', '中场', 5, 'rare'),
  ('Portugal', '葡萄牙 06', 'Portugal 06', '前锋', 6, 'common'),
  ('Portugal', '葡萄牙 07', 'Portugal 07', '前锋', 7, 'epic'),
  ('Portugal', '葡萄牙 08', 'Portugal 08', '队长', 8, 'legend'),
  ('England', '英格兰 01', 'England 01', '门将', 1, 'rare'),
  ('England', '英格兰 02', 'England 02', '后卫', 2, 'common'),
  ('England', '英格兰 03', 'England 03', '后卫', 3, 'common'),
  ('England', '英格兰 04', 'England 04', '中场', 4, 'common'),
  ('England', '英格兰 05', 'England 05', '中场', 5, 'rare'),
  ('England', '英格兰 06', 'England 06', '前锋', 6, 'common'),
  ('England', '英格兰 07', 'England 07', '前锋', 7, 'epic'),
  ('England', '英格兰 08', 'England 08', '队长', 8, 'legend'),
  ('Germany', '德国 01', 'Germany 01', '门将', 1, 'rare'),
  ('Germany', '德国 02', 'Germany 02', '后卫', 2, 'common'),
  ('Germany', '德国 03', 'Germany 03', '后卫', 3, 'common'),
  ('Germany', '德国 04', 'Germany 04', '中场', 4, 'common'),
  ('Germany', '德国 05', 'Germany 05', '中场', 5, 'rare'),
  ('Germany', '德国 06', 'Germany 06', '前锋', 6, 'common'),
  ('Germany', '德国 07', 'Germany 07', '前锋', 7, 'epic'),
  ('Germany', '德国 08', 'Germany 08', '队长', 8, 'legend'),
  ('Spain', '西班牙 01', 'Spain 01', '门将', 1, 'rare'),
  ('Spain', '西班牙 02', 'Spain 02', '后卫', 2, 'common'),
  ('Spain', '西班牙 03', 'Spain 03', '后卫', 3, 'common'),
  ('Spain', '西班牙 04', 'Spain 04', '中场', 4, 'common'),
  ('Spain', '西班牙 05', 'Spain 05', '中场', 5, 'rare'),
  ('Spain', '西班牙 06', 'Spain 06', '前锋', 6, 'common'),
  ('Spain', '西班牙 07', 'Spain 07', '前锋', 7, 'epic'),
  ('Spain', '西班牙 08', 'Spain 08', '队长', 8, 'legend'),
  ('Netherlands', '荷兰 01', 'Netherlands 01', '门将', 1, 'rare'),
  ('Netherlands', '荷兰 02', 'Netherlands 02', '后卫', 2, 'common'),
  ('Netherlands', '荷兰 03', 'Netherlands 03', '后卫', 3, 'common'),
  ('Netherlands', '荷兰 04', 'Netherlands 04', '中场', 4, 'common'),
  ('Netherlands', '荷兰 05', 'Netherlands 05', '中场', 5, 'rare'),
  ('Netherlands', '荷兰 06', 'Netherlands 06', '前锋', 6, 'common'),
  ('Netherlands', '荷兰 07', 'Netherlands 07', '前锋', 7, 'epic'),
  ('Netherlands', '荷兰 08', 'Netherlands 08', '队长', 8, 'legend')
on conflict (team, shirt_number) do update
set
  player_name = excluded.player_name,
  player_name_en = excluded.player_name_en,
  position = excluded.position,
  rarity = excluded.rarity;
