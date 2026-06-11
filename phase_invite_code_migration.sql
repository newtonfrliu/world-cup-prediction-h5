alter table public.players
  add column if not exists invite_code text;

create unique index if not exists players_invite_code_key
  on public.players(invite_code)
  where invite_code is not null;

with generated_codes as (
  select
    id,
    upper(substr(regexp_replace(md5(id::text), '[^a-z0-9]', '', 'g'), 1, 6)) as base_code,
    row_number() over (
      partition by upper(substr(regexp_replace(md5(id::text), '[^a-z0-9]', '', 'g'), 1, 6))
      order by created_at nulls last, id
    ) as duplicate_index
  from public.players
  where invite_code is null or invite_code = ''
)
update public.players as players
set invite_code =
  case
    when generated_codes.duplicate_index = 1 then generated_codes.base_code
    else upper(substr(regexp_replace(md5(players.id::text || generated_codes.duplicate_index::text), '[^a-z0-9]', '', 'g'), 1, 6))
  end
from generated_codes
where players.id = generated_codes.id;
