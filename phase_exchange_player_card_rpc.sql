create unique index if not exists user_cards_player_card_unique
  on public.user_cards(player_id, card_id);

create or replace function public.exchange_player_card(
  player_id uuid,
  card_id uuid
)
returns table (
  success boolean,
  message text,
  coins integer,
  card_id uuid,
  already_owned boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  input_player_id alias for $1;
  input_card_id alias for $2;
  current_player public.players%rowtype;
  target_card public.player_cards%rowtype;
  current_coins integer;
  next_coins integer;
begin
  select *
  into current_player
  from public.players
  where id = input_player_id
  for update;

  if not found then
    return query
    select
      false,
      '玩家不存在'::text,
      0,
      input_card_id,
      false;
    return;
  end if;

  select *
  into target_card
  from public.player_cards
  where id = input_card_id;

  if not found then
    return query
    select
      false,
      '球星卡不存在'::text,
      coalesce(current_player.coins, 1000),
      input_card_id,
      false;
    return;
  end if;

  current_coins := coalesce(current_player.coins, 1000);

  if exists (
    select 1
    from public.user_cards
    where user_cards.player_id = input_player_id
      and user_cards.card_id = input_card_id
  ) then
    return query
    select
      true,
      '你已拥有这张球星卡'::text,
      current_coins,
      input_card_id,
      true;
    return;
  end if;

  if current_coins < coalesce(target_card.price, 5000) then
    return query
    select
      false,
      format('金币不足，还差 %s 金币', coalesce(target_card.price, 5000) - current_coins),
      current_coins,
      input_card_id,
      false;
    return;
  end if;

  insert into public.user_cards (player_id, card_id)
  values (input_player_id, input_card_id)
  on conflict (player_id, card_id) do nothing;

  if not found then
    return query
    select
      true,
      '你已拥有这张球星卡'::text,
      current_coins,
      input_card_id,
      true;
    return;
  end if;

  next_coins := current_coins - coalesce(target_card.price, 5000);

  update public.players
  set coins = next_coins
  where id = input_player_id;

  insert into public.coin_transactions (
    player_id,
    amount,
    type,
    related_id
  )
  values (
    input_player_id,
    -coalesce(target_card.price, 5000),
    'card_exchange',
    input_card_id::text
  );

  return query
  select
    true,
    format('成功兑换 %s 球星卡', target_card.player_name),
    next_coins,
    input_card_id,
    false;
end;
$$;

grant execute on function public.exchange_player_card(uuid, uuid) to anon;
grant execute on function public.exchange_player_card(uuid, uuid) to authenticated;
