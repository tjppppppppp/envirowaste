create table public.user_roles (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  role text not null default 'viewer' check (role in ('administrator','researcher','fs_staff','driver','viewer')),
  organization text check (char_length(organization) <= 120),
  created_at timestamptz not null default now()
);
select private.own_rows('public.user_roles','user_id','{select,insert,update}');
select private.admins_change('public.user_roles');
select private.only_columns('public.user_roles','{user_id,organization}','{organization}');

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  organization text check (char_length(organization) <= 120),
  filename text not null check (char_length(filename) <= 200),
  headers jsonb not null default '[]',
  mapping jsonb not null default '{}',
  summary jsonb not null default '{}',
  created_at timestamptz not null default now()
);
select private.own_rows('public.import_batches');

create table public.import_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  row_index int not null,
  original jsonb not null,
  record_date date,
  weight_kg numeric,
  building text,
  container text,
  stream text,
  is_duplicate boolean not null default false,
  missing jsonb not null default '[]',
  transformations jsonb not null default '[]',
  created_at timestamptz not null default now()
);
select private.own_rows('public.import_records');
create policy "batch is theirs" on public.import_records as restrictive for insert to authenticated
  with check (exists (select 1 from public.import_batches b where b.id = batch_id and b.user_id = (select auth.uid())));

create table public.audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  building text not null check (char_length(building) <= 160),
  location text check (char_length(location) <= 200),
  researchers text check (char_length(researchers) <= 300),
  audit_date date not null,
  status text not null default 'Planned' check (status in ('Planned','In Progress','Under Review','Completed')),
  sample_weight_kg numeric check (sample_weight_kg >= 0),
  method text not null default 'Physical measurement' check (method in ('Physical measurement','Image review','Estimate')),
  contamination_pct numeric check (contamination_pct between 0 and 100),
  measurements jsonb not null default '[]',
  notes text check (char_length(notes) <= 3000),
  created_at timestamptz not null default now()
);
select private.own_rows('public.audits','user_id','{select,insert,update,delete}');

create table public.insight_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  insight_key text not null check (char_length(insight_key) <= 80),
  status text not null check (status in ('Under Investigation','Validated','Rejected','Recommended for Action')),
  updated_at timestamptz not null default now(),
  unique (user_id, insight_key)
);
select private.own_rows('public.insight_reviews','user_id','{select,insert,update}');
