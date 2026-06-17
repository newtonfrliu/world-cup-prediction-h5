begin;

with asset_bindings(team, player_name_en, asset_url) as (
  values
    ('Argentina', 'ALVAREZ Julian', '/cards/argentina/alvarez.png'),
    ('Argentina', 'MARTINEZ Lautaro', '/cards/argentina/lautaro.png'),
    ('Argentina', 'MARTINEZ Lisandro', '/cards/argentina/martinez.png'),
    ('Brazil', 'ALISSON', '/cards/brazil/alison.png'),
    ('Brazil', 'CASEMIRO', '/cards/brazil/casemiro.png'),
    ('Brazil', 'NEYMAR JR', '/cards/brazil/neymar.png'),
    ('Brazil', 'VINICIUS JUNIOR', '/cards/brazil/vinicius.png'),
    ('England', 'BELLINGHAM Jude', '/cards/england/bellingham.png'),
    ('England', 'KANE Harry', '/cards/england/kane.png'),
    ('England', 'RICE Declan', '/cards/england/rice.png'),
    ('England', 'SAKA Bukayo', '/cards/england/saka.png'),
    ('Germany', 'HAVERTZ Kai', '/cards/germany/havertz.png'),
    ('Germany', 'KIMMICH Joshua', '/cards/germany/kimmich.png'),
    ('Germany', 'MUSIALA Jamal', '/cards/germany/musiala.png'),
    ('Germany', 'WIRTZ Florian', '/cards/germany/wirtz.png'),
    ('Netherlands', 'VAN DIJK Virgil', '/cards/netherlands/vandijk.png'),
    ('Portugal', 'BRUNO FERNANDES', '/cards/portugal/bruno.png'),
    ('Portugal', 'CRISTIANO RONALDO', '/cards/portugal/ronaldo.png'),
    ('Portugal', 'RAFAEL LEAO', '/cards/portugal/leao.png'),
    ('Portugal', 'RUBEN DIAS', '/cards/portugal/rubendias.png')
)
update public.player_cards card
set card_art_url = asset_bindings.asset_url,
    card_thumb_url = asset_bindings.asset_url
from asset_bindings
where card.roster_source = 'fifa_official_squad'
  and card.team = asset_bindings.team
  and card.player_name_en = asset_bindings.player_name_en;

-- Keep the official card pool clean: if an official card points to a local card
-- image that is not explicitly bound above, clear it so the frontend renders the
-- template card instead of another player's image.
with asset_bindings(team, player_name_en, asset_url) as (
  values
    ('Argentina', 'ALVAREZ Julian', '/cards/argentina/alvarez.png'),
    ('Argentina', 'MARTINEZ Lautaro', '/cards/argentina/lautaro.png'),
    ('Argentina', 'MARTINEZ Lisandro', '/cards/argentina/martinez.png'),
    ('Brazil', 'ALISSON', '/cards/brazil/alison.png'),
    ('Brazil', 'CASEMIRO', '/cards/brazil/casemiro.png'),
    ('Brazil', 'NEYMAR JR', '/cards/brazil/neymar.png'),
    ('Brazil', 'VINICIUS JUNIOR', '/cards/brazil/vinicius.png'),
    ('England', 'BELLINGHAM Jude', '/cards/england/bellingham.png'),
    ('England', 'KANE Harry', '/cards/england/kane.png'),
    ('England', 'RICE Declan', '/cards/england/rice.png'),
    ('England', 'SAKA Bukayo', '/cards/england/saka.png'),
    ('Germany', 'HAVERTZ Kai', '/cards/germany/havertz.png'),
    ('Germany', 'KIMMICH Joshua', '/cards/germany/kimmich.png'),
    ('Germany', 'MUSIALA Jamal', '/cards/germany/musiala.png'),
    ('Germany', 'WIRTZ Florian', '/cards/germany/wirtz.png'),
    ('Netherlands', 'VAN DIJK Virgil', '/cards/netherlands/vandijk.png'),
    ('Portugal', 'BRUNO FERNANDES', '/cards/portugal/bruno.png'),
    ('Portugal', 'CRISTIANO RONALDO', '/cards/portugal/ronaldo.png'),
    ('Portugal', 'RAFAEL LEAO', '/cards/portugal/leao.png'),
    ('Portugal', 'RUBEN DIAS', '/cards/portugal/rubendias.png')
)
update public.player_cards card
set card_art_url = null,
    card_thumb_url = null
where card.roster_source = 'fifa_official_squad'
  and card.card_art_url like '/cards/%'
  and not exists (
    select 1
    from asset_bindings
    where asset_bindings.asset_url = card.card_art_url
      and asset_bindings.team = card.team
      and asset_bindings.player_name_en = card.player_name_en
  );

commit;

with local_assets(asset_url) as (
  values
    ('/cards/argentina/alvarez.png'),
    ('/cards/argentina/lautaro.png'),
    ('/cards/argentina/martinez.png'),
    ('/cards/brazil/alison.png'),
    ('/cards/brazil/casemiro.png'),
    ('/cards/brazil/neymar.png'),
    ('/cards/brazil/rodrygo.png'),
    ('/cards/brazil/vinicius.png'),
    ('/cards/england/bellingham.png'),
    ('/cards/england/kane.png'),
    ('/cards/england/rice.png'),
    ('/cards/england/saka.png'),
    ('/cards/germany/havertz.png'),
    ('/cards/germany/kimmich.png'),
    ('/cards/germany/musiala.png'),
    ('/cards/germany/wirtz.png'),
    ('/cards/netherlands/simons.png'),
    ('/cards/netherlands/vandijk.png'),
    ('/cards/portugal/bruno.png'),
    ('/cards/portugal/leao.png'),
    ('/cards/portugal/ronaldo.png'),
    ('/cards/portugal/rubendias.png')
),
bound_assets as (
  select distinct card_art_url as asset_url
  from public.player_cards
  where roster_source = 'fifa_official_squad'
    and card_art_url is not null
)
select
  (select count(*) from local_assets) as "TotalImages",
  (select count(*) from local_assets join bound_assets using (asset_url)) as "BoundImages",
  (select count(*) from local_assets left join bound_assets using (asset_url) where bound_assets.asset_url is null) as "UnboundImages";

-- Expected remaining unbound assets:
-- /cards/brazil/rodrygo.png: Rodrygo is not in the current FIFA official Brazil squad.
-- /cards/netherlands/simons.png: Xavi Simons is not in the current FIFA official Netherlands squad.
