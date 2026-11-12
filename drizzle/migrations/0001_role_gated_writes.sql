create policy "researchers import" on public.import_batches as restrictive for insert to authenticated
 with check (exists (select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role in ('administrator','researcher'))
  or exists (select 1 from public.admins a where a.email = lower((select auth.jwt()) ->> 'email')));
create policy "researchers import rows" on public.import_records as restrictive for insert to authenticated
 with check (exists (select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role in ('administrator','researcher'))
  or exists (select 1 from public.admins a where a.email = lower((select auth.jwt()) ->> 'email')));
create policy "researchers audit" on public.audits as restrictive for insert to authenticated
 with check (exists (select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role in ('administrator','researcher'))
  or exists (select 1 from public.admins a where a.email = lower((select auth.jwt()) ->> 'email')));
create policy "researchers edit audit" on public.audits as restrictive for update to authenticated
 with check (exists (select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role in ('administrator','researcher'))
  or exists (select 1 from public.admins a where a.email = lower((select auth.jwt()) ->> 'email')));
create policy "researchers review" on public.insight_reviews as restrictive for insert to authenticated
 with check (exists (select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role in ('administrator','researcher','fs_staff'))
  or exists (select 1 from public.admins a where a.email = lower((select auth.jwt()) ->> 'email')));
