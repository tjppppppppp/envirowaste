create table public.waste_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  is_demo boolean not null,
  building text,
  building_source text not null default 'source_mapper_directory',
  photo_filename text,
  photo_sha256 text,
  classifier text not null,
  classifier_service text not null,
  suggested_category text not null,
  suggestion_scores jsonb not null,
  reviewed_category text not null,
  human_verified boolean not null,
  reviewed_by text not null,
  reviewed_at timestamptz not null default now(),
  notes text,
  review_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (human_verified = true),
  check (reviewed_category in ('plastic','glass','unknown / mixed','metal','paper','cardboard','organic'))
);
alter table public.waste_observations enable row level security;
revoke all on public.waste_observations from anon, authenticated;
grant select, insert, update, delete on public.waste_observations to service_role;
grant select on public.waste_observations to authenticated;
grant insert (is_demo,building,building_source,photo_filename,photo_sha256,classifier,classifier_service,suggested_category,suggestion_scores,reviewed_category,human_verified,reviewed_by,notes,review_history) on public.waste_observations to authenticated;
grant update (reviewed_category,human_verified,reviewed_by,reviewed_at,notes,review_history) on public.waste_observations to authenticated;
create policy "read own observations" on public.waste_observations for select to authenticated using (user_id = (select auth.uid()));
create policy "admins read observations" on public.waste_observations for select to authenticated using (exists (select 1 from admins a where a.email = lower((select auth.jwt()->>'email'))));
create policy "researchers add observations" on public.waste_observations for insert to authenticated with check (user_id = (select auth.uid()) and reviewed_by = lower((select auth.jwt()->>'email')) and ((exists (select 1 from user_roles r where r.user_id=(select auth.uid()) and r.role in ('administrator','researcher'))) or (exists (select 1 from admins a where a.email = lower((select auth.jwt()->>'email'))))));
create policy "researchers re-review own" on public.waste_observations for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and ((exists (select 1 from user_roles r where r.user_id=(select auth.uid()) and r.role in ('administrator','researcher'))) or (exists (select 1 from admins a where a.email = lower((select auth.jwt()->>'email'))))));
create index on public.waste_observations (user_id, is_demo, created_at desc);
