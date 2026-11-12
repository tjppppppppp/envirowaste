
alter table collection_entries add column if not exists building text, add column if not exists building_source text, add column if not exists container text;
grant insert (building, building_source, container) on collection_entries to authenticated;
create policy "staff read collection entries" on collection_entries for select to authenticated using (exists (select 1 from user_roles r where r.user_id = (select auth.uid()) and r.role in ('administrator','researcher','fs_staff')));

create table demo_mappings (
  id uuid primary key default gen_random_uuid(),
  truck_id text not null check (truck_id like 'DEMO%'),
  truck_label text not null check (truck_label like 'DEMO%' and length(truck_label)<=80),
  route_id text not null check (route_id like 'DEMO%'),
  route_label text not null check (route_label like 'DEMO%' and length(route_label)<=120),
  material text not null,
  work_order text check (work_order is null or work_order like 'DEMO%'),
  disposal text not null check (disposal like 'DEMO%' and length(disposal)<=160),
  active boolean not null default true,
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (truck_id, route_id)
);
alter table demo_mappings enable row level security;
create policy "signed-in read mappings" on demo_mappings for select to authenticated using (true);
create policy "admins add mappings" on demo_mappings for insert to authenticated with check (exists (select 1 from admins a where a.email = lower((select auth.jwt()->>'email'))) or exists (select 1 from user_roles r where r.user_id=(select auth.uid()) and r.role='administrator'));
create policy "admins change mappings" on demo_mappings for update to authenticated using (exists (select 1 from admins a where a.email = lower((select auth.jwt()->>'email'))) or exists (select 1 from user_roles r where r.user_id=(select auth.uid()) and r.role='administrator')) with check (true);
grant select on demo_mappings to authenticated;
grant insert (truck_id,truck_label,route_id,route_label,material,work_order,disposal,active,updated_by) on demo_mappings to authenticated;
grant update (truck_label,route_label,material,work_order,disposal,active,updated_by,updated_at) on demo_mappings to authenticated;

create table mapping_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  admin_email text,
  mapping_key text not null,
  action text not null,
  before jsonb, after jsonb,
  created_at timestamptz not null default now()
);
alter table mapping_changes enable row level security;
create policy "admins log changes" on mapping_changes for insert to authenticated with check (user_id=(select auth.uid()) and (exists (select 1 from admins a where a.email = lower((select auth.jwt()->>'email'))) or exists (select 1 from user_roles r where r.user_id=(select auth.uid()) and r.role='administrator')));
create policy "admins read changes" on mapping_changes for select to authenticated using (exists (select 1 from admins a where a.email = lower((select auth.jwt()->>'email'))) or exists (select 1 from user_roles r where r.user_id=(select auth.uid()) and r.role='administrator'));
grant select on mapping_changes to authenticated;
grant insert (admin_email,mapping_key,action,before,after) on mapping_changes to authenticated;

insert into demo_mappings (truck_id,truck_label,route_id,route_label,material,work_order,disposal,updated_by) values
('DEMO-T1','DEMO Truck 1 (synthetic)','DEMO-R-A','DEMO Route A — Alpha cluster','Mixed recycling','DEMO-WO-1001','DEMO Recycling Facility (synthetic)','seed'),
('DEMO-T1','DEMO Truck 1 (synthetic)','DEMO-R-B','DEMO Route B — Bravo cluster','Cardboard','DEMO-WO-1002','DEMO Recycling Facility (synthetic)','seed'),
('DEMO-T2','DEMO Truck 2 (synthetic)','DEMO-R-C','DEMO Route C — Charlie cluster','Landfill waste','DEMO-WO-2001','DEMO Landfill (synthetic)','seed'),
('DEMO-T2','DEMO Truck 2 (synthetic)','DEMO-R-D','DEMO Route D — Delta cluster','Food waste / compost',null,'DEMO Compost Site (synthetic)','seed'),
('DEMO-T3','DEMO Truck 3 (synthetic)','DEMO-R-E','DEMO Route E — Echo cluster','Landfill waste',null,'DEMO Landfill (synthetic)','seed');

create table ticket_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  filename text not null check (length(filename) between 1 and 200),
  doc_type text not null check (doc_type in ('Scale ticket','Disposal manifest','Handwritten log sheet','Other / unknown')),
  mime text not null check (mime in ('image/png','image/jpeg','application/pdf')),
  size_bytes integer not null check (size_bytes between 1 and 2500000),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  file_b64 text not null check (length(file_b64) <= 3400000 and ((mime='image/png' and file_b64 like 'iVBORw0KGgo%') or (mime='image/jpeg' and file_b64 like '/9j/%') or (mime='application/pdf' and file_b64 like 'JVBERi0%'))),
  fields jsonb not null default '{}',
  status text not null default 'needs_review' check (status in ('needs_review','verified')),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
alter table ticket_documents enable row level security;
create policy "own docs read" on ticket_documents for select to authenticated using (user_id=(select auth.uid()));
create policy "researchers upload docs" on ticket_documents for insert to authenticated with check (user_id=(select auth.uid()) and (exists (select 1 from user_roles r where r.user_id=(select auth.uid()) and r.role in ('administrator','researcher')) or exists (select 1 from admins a where a.email = lower((select auth.jwt()->>'email')))));
create policy "researchers edit docs" on ticket_documents for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
grant select on ticket_documents to authenticated;
grant insert (filename,doc_type,mime,size_bytes,sha256,file_b64,fields) on ticket_documents to authenticated;
grant update (doc_type,fields,status,verified_at) on ticket_documents to authenticated;

create table ticket_history (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references ticket_documents(id),
  user_id uuid not null default auth.uid(),
  action text not null,
  changes jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table ticket_history enable row level security;
create policy "own history read" on ticket_history for select to authenticated using (user_id=(select auth.uid()));
create policy "own history add" on ticket_history for insert to authenticated with check (user_id=(select auth.uid()) and exists (select 1 from ticket_documents d where d.id=doc_id and d.user_id=(select auth.uid())));
grant select on ticket_history to authenticated;
grant insert (doc_id,action,changes) on ticket_history to authenticated;
grant select, insert, update, delete on demo_mappings, mapping_changes, ticket_documents, ticket_history to service_role;
