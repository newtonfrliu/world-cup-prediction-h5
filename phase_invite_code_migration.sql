alter table public.players
  add column if not exists invite_code text;

update public.players
set invite_code = nullif(upper(substr(regexp_replace(invite_code, '[^A-Za-z0-9]', '', 'g'), 1, 6)), '')
where invite_code is not null;

with duplicated_codes as (
  select
    id,
    row_number() over (
      partition by invite_code
      order by created_at nulls last, id
    ) as duplicate_index
  from public.players
  where invite_code is not null
)
update public.players as players
set invite_code = null
from duplicated_codes
where players.id = duplicated_codes.id
  and duplicated_codes.duplicate_index > 1;

do $$
declare
  player_record record;
  candidate text;
  attempt integer;
begin
  for player_record in
    select id
    from public.players
    where invite_code is null or invite_code = ''
    order by created_at nulls last, id
  loop
    attempt := 0;

    loop
      candidate := upper(substr(regexp_replace(md5(player_record.id::text || ':' || attempt::text), '[^A-Za-z0-9]', '', 'g'), 1, 6));

      exit when not exists (
        select 1
        from public.players
        where invite_code = candidate
          and id <> player_record.id
      );

      attempt := attempt + 1;
    end loop;

    update public.players
    set invite_code = candidate
    where id = player_record.id;
  end loop;
end $$;

create unique index if not exists players_invite_code_key
  on public.players(invite_code)
  where invite_code is not null;
