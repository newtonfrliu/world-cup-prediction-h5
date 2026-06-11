alter table public.player_cards
  add column if not exists price integer not null default 5000,
  add column if not exists star_level integer not null default 1;

update public.player_cards
set price = 5000,
    star_level = 1
where price is null
   or star_level is null
   or price < 5000
   or star_level < 1;

update public.player_cards
set player_name = 'C罗',
    player_name_en = 'Cristiano Ronaldo',
    position = '前锋',
    rarity = 'legend',
    star_level = 5,
    price = 70000
where team = 'Portugal' and shirt_number = 7;

update public.player_cards
set player_name = 'B费',
    player_name_en = 'Bruno Fernandes',
    position = '中场',
    rarity = 'epic',
    star_level = 4,
    price = 40000
where team = 'Portugal' and shirt_number = 8;

update public.player_cards
set player_name = '莱奥',
    player_name_en = 'Rafael Leao',
    position = '前锋',
    rarity = 'epic',
    star_level = 4,
    price = 40000
where team = 'Portugal' and shirt_number = 6;

update public.player_cards
set player_name = '鲁本迪亚斯',
    player_name_en = 'Ruben Dias',
    position = '后卫',
    rarity = 'epic',
    star_level = 4,
    price = 40000
where team = 'Portugal' and shirt_number = 3;

update public.player_cards
set player_name = '梅西',
    player_name_en = 'Lionel Messi',
    position = '前锋',
    rarity = 'legend',
    star_level = 5,
    price = 70000
where team = 'Argentina' and shirt_number = 8;

update public.player_cards
set player_name = '劳塔罗',
    player_name_en = 'Lautaro Martinez',
    position = '前锋',
    rarity = 'epic',
    star_level = 4,
    price = 40000
where team = 'Argentina' and shirt_number = 7;

update public.player_cards
set player_name = '阿尔瓦雷斯',
    player_name_en = 'Julian Alvarez',
    position = '前锋',
    rarity = 'epic',
    star_level = 4,
    price = 40000
where team = 'Argentina' and shirt_number = 6;

update public.player_cards
set player_name = '姆巴佩',
    player_name_en = 'Kylian Mbappe',
    position = '前锋',
    rarity = 'legend',
    star_level = 5,
    price = 70000
where team = 'France' and shirt_number = 7;

update public.player_cards
set player_name = '格列兹曼',
    player_name_en = 'Antoine Griezmann',
    position = '前锋',
    rarity = 'epic',
    star_level = 4,
    price = 40000
where team = 'France' and shirt_number = 8;

update public.player_cards
set player_name = '登贝莱',
    player_name_en = 'Ousmane Dembele',
    position = '前锋',
    rarity = 'epic',
    star_level = 4,
    price = 40000
where team = 'France' and shirt_number = 6;

update public.player_cards
set player_name = '维尼修斯',
    player_name_en = 'Vinicius Junior',
    position = '前锋',
    rarity = 'legend',
    star_level = 5,
    price = 70000
where team = 'Brazil' and shirt_number = 7;

update public.player_cards
set player_name = '罗德里戈',
    player_name_en = 'Rodrygo',
    position = '前锋',
    rarity = 'epic',
    star_level = 4,
    price = 40000
where team = 'Brazil' and shirt_number = 8;

update public.player_cards
set player_name = '贝林厄姆',
    player_name_en = 'Jude Bellingham',
    position = '中场',
    rarity = 'legend',
    star_level = 5,
    price = 70000
where team = 'England' and shirt_number = 8;

update public.player_cards
set player_name = '凯恩',
    player_name_en = 'Harry Kane',
    position = '前锋',
    rarity = 'legend',
    star_level = 5,
    price = 70000
where team = 'England' and shirt_number = 7;

update public.player_cards
set player_name = '福登',
    player_name_en = 'Phil Foden',
    position = '中场',
    rarity = 'epic',
    star_level = 4,
    price = 40000
where team = 'England' and shirt_number = 6;

update public.player_cards
set player_name = '穆西亚拉',
    player_name_en = 'Jamal Musiala',
    position = '中场',
    rarity = 'epic',
    star_level = 4,
    price = 40000
where team = 'Germany' and shirt_number = 7;

update public.player_cards
set player_name = '维尔茨',
    player_name_en = 'Florian Wirtz',
    position = '中场',
    rarity = 'epic',
    star_level = 4,
    price = 40000
where team = 'Germany' and shirt_number = 8;

update public.player_cards
set player_name = '亚马尔',
    player_name_en = 'Lamine Yamal',
    position = '前锋',
    rarity = 'legend',
    star_level = 5,
    price = 70000
where team = 'Spain' and shirt_number = 7;

update public.player_cards
set player_name = '罗德里',
    player_name_en = 'Rodri',
    position = '中场',
    rarity = 'legend',
    star_level = 5,
    price = 70000
where team = 'Spain' and shirt_number = 8;

update public.player_cards
set player_name = '范戴克',
    player_name_en = 'Virgil van Dijk',
    position = '后卫',
    rarity = 'legend',
    star_level = 5,
    price = 70000
where team = 'Netherlands' and shirt_number = 3;

update public.player_cards
set player_name = '德容',
    player_name_en = 'Frenkie de Jong',
    position = '中场',
    rarity = 'epic',
    star_level = 4,
    price = 40000
where team = 'Netherlands' and shirt_number = 8;
