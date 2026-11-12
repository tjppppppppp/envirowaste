create table public.collection_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete restrict,
  driver_email text,
  entered_at timestamptz not null default now(),
  entered_local text check (char_length(entered_local) <= 80),
  is_demo boolean not null,
  truck text not null check (char_length(truck) between 1 and 80),
  route text not null check (char_length(route) between 1 and 120),
  material text not null check (char_length(material) between 1 and 120),
  material_source text not null default 'manual' check (material_source in ('demo_mapping','manual','corrected')),
  work_order text check (char_length(work_order) <= 80),
  work_order_status text not null default 'unknown' check (work_order_status in ('demo_verified','unknown','manual')),
  disposal_location text not null check (char_length(disposal_location) between 1 and 160),
  unit text not null check (unit in ('lb','kg')),
  full_weight numeric not null check (full_weight >= 0),
  empty_weight numeric not null check (empty_weight >= 0),
  net_weight numeric generated always as (full_weight - empty_weight) stored,
  net_kg numeric generated always as ((full_weight - empty_weight) * case when unit = 'lb' then 0.45359237 else 1 end) stored,
  notes text check (char_length(notes) <= 1000),
  original_input jsonb not null default '{}'::jsonb,
  corrections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint full_not_below_empty check (full_weight >= empty_weight)
);
create or replace function private.collection_stamp() returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon','authenticated') then
    new.entered_at := now();
    new.driver_email := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  end if;
  return new;
end $$;
create trigger collection_stamp before insert on public.collection_entries for each row execute function private.collection_stamp();
select private.own_rows('public.collection_entries', 'user_id', '{select,insert}');
select private.admins_change('public.collection_entries', '{select}');
create policy "drivers record collections" on public.collection_entries as restrictive for insert to authenticated
  with check (exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role in ('driver','administrator','researcher'))
   or exists (select 1 from public.admins a where a.email = lower((select auth.jwt() ->> 'email'))));
select private.only_columns('public.collection_entries', '{entered_local,is_demo,truck,route,material,material_source,work_order,work_order_status,disposal_location,unit,full_weight,empty_weight,notes,original_input,corrections}', '{}');
