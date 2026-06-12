update public.player_cards
set card_art_url = '/cards/portugal/ronaldo.png'
where team = 'Portugal'
  and (
    player_name = 'C罗'
    or player_name_en = 'Cristiano Ronaldo'
  );

update public.player_cards
set card_art_url = '/cards/portugal/bruno.png'
where team = 'Portugal'
  and (
    player_name = 'B费'
    or player_name_en = 'Bruno Fernandes'
  );

update public.player_cards
set card_art_url = '/cards/portugal/leao.png'
where team = 'Portugal'
  and (
    player_name in ('莱奥', '拉斐尔·莱奥')
    or player_name_en = 'Rafael Leao'
  );

update public.player_cards
set card_art_url = '/cards/portugal/rubendias.png'
where team = 'Portugal'
  and (
    player_name in ('鲁本迪亚斯', '鲁本·迪亚斯')
    or player_name_en = 'Ruben Dias'
  );
