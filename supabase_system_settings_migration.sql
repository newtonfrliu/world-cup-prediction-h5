create table if not exists public.system_settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

create or replace function public.set_system_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_system_settings_updated_at on public.system_settings;

create trigger set_system_settings_updated_at
before update on public.system_settings
for each row
execute function public.set_system_settings_updated_at();

insert into public.system_settings (key, value, updated_at)
values ('last_odds_sync', null, now())
on conflict (key)
do update set
  value = public.system_settings.value,
  updated_at = public.system_settings.updated_at;
