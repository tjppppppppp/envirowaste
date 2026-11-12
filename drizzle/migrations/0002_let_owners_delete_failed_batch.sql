grant delete on public.import_batches to authenticated;
create policy "delete own batch" on public.import_batches for delete to authenticated using (user_id = (select auth.uid()));
