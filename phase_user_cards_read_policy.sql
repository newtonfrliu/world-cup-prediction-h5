alter table public.user_cards enable row level security;

drop policy if exists "user_cards_select_public" on public.user_cards;
create policy "user_cards_select_public"
  on public.user_cards
  for select
  to anon, authenticated
  using (true);

drop policy if exists "user_cards_insert_via_rpc_only" on public.user_cards;
create policy "user_cards_insert_via_rpc_only"
  on public.user_cards
  for insert
  to anon, authenticated
  with check (false);

alter table public.coin_transactions enable row level security;

drop policy if exists "coin_transactions_select_public" on public.coin_transactions;
create policy "coin_transactions_select_public"
  on public.coin_transactions
  for select
  to anon, authenticated
  using (true);
