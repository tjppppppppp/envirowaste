create table public.demo_route_schedules (
  id uuid primary key default gen_random_uuid(),
  truck_id text not null, route_id text not null,
  weekday int not null check (weekday between 0 and 6),
  start_time text not null check (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  end_time text not null check (end_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  active boolean not null default true,
  updated_by text, updated_at timestamptz not null default now(),
  constraint demo_sched_prefix check (truck_id like 'DEMO%' and route_id like 'DEMO%'),
  unique (truck_id, route_id, weekday)
);
alter table public.demo_route_schedules enable row level security;
create policy "signed-in read schedules" on public.demo_route_schedules for select to authenticated using (true);
create policy "admins add schedules" on public.demo_route_schedules for insert to authenticated with check (exists (select 1 from admins a where a.email = lower((select auth.jwt() ->> 'email'))) or exists (select 1 from user_roles r where r.user_id = (select auth.uid()) and r.role = 'administrator'));
create policy "admins change schedules" on public.demo_route_schedules for update to authenticated using (exists (select 1 from admins a where a.email = lower((select auth.jwt() ->> 'email'))) or exists (select 1 from user_roles r where r.user_id = (select auth.uid()) and r.role = 'administrator')) with check (exists (select 1 from admins a where a.email = lower((select auth.jwt() ->> 'email'))) or exists (select 1 from user_roles r where r.user_id = (select auth.uid()) and r.role = 'administrator'));
create policy "admins delete schedules" on public.demo_route_schedules for delete to authenticated using (exists (select 1 from admins a where a.email = lower((select auth.jwt() ->> 'email'))) or exists (select 1 from user_roles r where r.user_id = (select auth.uid()) and r.role = 'administrator'));
grant select, insert, update, delete on public.demo_route_schedules to service_role;
grant select, insert, update, delete on public.demo_route_schedules to authenticated;
insert into public.demo_route_schedules (truck_id, route_id, weekday, start_time, end_time, updated_by) values
('DEMO-T1','DEMO-R-A',1,'06:00','12:00','seed'),('DEMO-T1','DEMO-R-A',3,'06:00','12:00','seed'),
('DEMO-T1','DEMO-R-B',2,'06:00','12:00','seed'),('DEMO-T1','DEMO-R-B',4,'06:00','12:00','seed'),
('DEMO-T2','DEMO-R-C',1,'12:00','18:00','seed'),('DEMO-T2','DEMO-R-D',5,'06:00','12:00','seed');
