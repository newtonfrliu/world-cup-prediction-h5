create table if not exists public.system_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.system_settings to anon;
grant select, insert, update on public.system_settings to authenticated;
