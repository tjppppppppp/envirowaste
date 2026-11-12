-- Foundable's data SDK, the database half of src/lib/data.ts, which tells how to use it. Foundable applied it to this
-- website's database before the website was first built; apply it first to a database of your own. Change nothing in it.
-- Its functions live in schema private, which visitors never reach.
create schema if not exists private;
create extension if not exists btree_gist with schema extensions;

-- Access presets: call each once in the change that makes its table, only_columns last. own_rows and admins_change take
-- the commands they allow, of select, insert, update and delete.
create or replace function private.service_rows(target regclass) returns void language plpgsql set search_path = '' as $$
begin
  execute format('alter table %s enable row level security', target);
  execute format('grant select, insert, update, delete on %s to service_role', target);
end $$;
create or replace function private.own_rows(target regclass, owner_column text default 'user_id',
  commands text[] default '{select,insert,update}') returns void language plpgsql set search_path = '' as $$
declare own text := format('%I = (select auth.uid())', owner_column);
begin
  if cardinality(commands) = 0 or not commands <@ array['select', 'insert', 'update', 'delete'] then
    raise exception 'own_rows takes some of select, insert, update and delete, not %', commands;
  end if;
  perform private.service_rows(target);
  execute format('grant %s on %s to authenticated', array_to_string(commands, ', '), target);
  if 'select' = any(commands) then
    execute format('create policy "people read their own rows" on %s for select to authenticated using (%s)', target, own);
  end if;
  if 'insert' = any(commands) then
    execute format('create policy "people add their own rows" on %s for insert to authenticated with check (%s)', target, own);
  end if;
  if 'update' = any(commands) then
    execute format('create policy "people change their own rows" on %s for update to authenticated using (%s) with check (%s)', target, own, own);
  end if;
  if 'delete' = any(commands) then
    execute format('create policy "people delete their own rows" on %s for delete to authenticated using (%s)', target, own);
  end if;
end $$;
create or replace function private.everyone_reads(target regclass) returns void language plpgsql set search_path = '' as $$
begin
  perform private.service_rows(target);
  execute format('grant select on %s to anon, authenticated', target);
  execute format('create policy "everyone reads it" on %s for select to anon, authenticated using (true)', target);
end $$;
create or replace function private.anyone_adds(target regclass) returns void language plpgsql set search_path = '' as $$
begin
  perform private.service_rows(target);
  execute format('grant insert on %s to anon, authenticated', target);
  execute format('create policy "anyone adds a row" on %s for insert to anon, authenticated with check (true)', target);
end $$;
create or replace function private.read_by_link(target regclass, token_column text default 'share_token') returns void
language plpgsql set search_path = '' as $$
begin
  perform private.service_rows(target);
  execute format('grant select on %s to anon, authenticated', target);
  execute format('create policy "the link''s holder reads it" on %s for select to anon, authenticated using '
    || '(%I::text = (nullif(current_setting(''request.headers'', true), '''')::json ->> ''x-share-token''))', target, token_column);
end $$;
create or replace function private.only_columns(target regclass, add_columns text[], change_columns text[] default '{}',
  roles text[] default '{authenticated}') returns void language plpgsql set search_path = '' as $$
declare who text := (select string_agg(format('%I', r), ', ') from unnest(roles) r);
begin
  execute format('revoke insert, update on %s from %s', target, who);
  if cardinality(add_columns) > 0 then
    execute format('grant insert (%s) on %s to %s', (select string_agg(format('%I', c), ', ') from unnest(add_columns) c), target, who);
  end if;
  if cardinality(change_columns) > 0 then
    execute format('grant update (%s) on %s to %s', (select string_agg(format('%I', c), ', ') from unnest(change_columns) c), target, who);
  end if;
end $$;
create or replace function private.admins_change(target regclass, commands text[] default '{select,insert,update,delete}')
returns void language plpgsql set search_path = '' as $$
declare admin text := 'exists (select 1 from public.admins a where a.email = lower((select auth.jwt()) ->> ''email''))';
begin
  if cardinality(commands) = 0 or not commands <@ array['select', 'insert', 'update', 'delete'] then
    raise exception 'admins_change takes some of select, insert, update and delete, not %', commands;
  end if;
  perform private.service_rows(target);
  execute format('grant %s on %s to authenticated', array_to_string(commands, ', '), target);
  if 'select' = any(commands) then
    execute format('create policy "admins read every row" on %s for select to authenticated using (%s)', target, admin);
  end if;
  if 'insert' = any(commands) then
    execute format('create policy "admins add rows" on %s for insert to authenticated with check (%s)', target, admin);
  end if;
  if 'update' = any(commands) then
    execute format('create policy "admins change every row" on %s for update to authenticated using (%s)', target, admin);
  end if;
  if 'delete' = any(commands) then
    execute format('create policy "admins delete rows" on %s for delete to authenticated using (%s)', target, admin);
  end if;
end $$;
-- The owner and admins by their sign-in address, as the sign-in skill keys the owner's area, so an address added before its
-- first sign-in is an admin from that sign-in.
create table if not exists public.admins (email text primary key check (email = lower(email)));
select private.service_rows('public.admins');
grant select on public.admins to authenticated;
drop policy if exists "each reads their own admin row" on public.admins;
create policy "each reads their own admin row" on public.admins for select to authenticated
  using (email = lower((select auth.jwt()) ->> 'email'));

-- The owner hears of every row: email_owner(table, subject) queues one email to the website's owner for each row added to
-- the table, as the row's transaction commits, in Foundable's email queue (public.foundable_email_intents, App email's),
-- which Foundable sends, trying again until it goes, whatever adds the row. It reads the row as it stands then (a total its
-- lines keep included; none for a row the transaction deleted). Its subject is the one given, in the website's words; its
-- text each filled column by name, at most 9,000 characters (half App email's 20,000-unit text bound, whatever the
-- characters); its reply-to a column named email or ending _email holding a plain address. Where the database holds no
-- email queue the row saves and no email goes; nor does one the queue refuses, which the database's log keeps as a warning,
-- since the row the visitor sent must save whatever its email meets. Call it in the change that makes the table; again, it
-- changes the subject. The email arrives as Foundable's plain note unless email_owner is given the email's own markup too
-- (the website's HTML, for an owner who asks for a look of their own): each {{column}} in it is the row's value of that
-- column, escaped, a line break in it a <br>. email_owner refuses markup that names no column or one the table lacks, and
-- an entry whose filled markup passes 30,000 characters (half App email's 60,000-unit html bound) arrives as the plain note.
create or replace function private.queue_owner_email() returns trigger language plpgsql security definer set search_path = '' as $$
declare entry jsonb := to_jsonb(new); field record; words text := ''; value text; reply text;
  subject text := btrim(left(regexp_replace(tg_argv[0], '[[:space:]]+', ' ', 'g'), 100)); markup text := tg_argv[1];
begin
  if to_regclass('public.foundable_email_intents') is null then return null; end if;
  if entry ? 'id' then
    execute format('select to_jsonb(t.*) from %s t where t.id = %L', tg_relid::regclass, entry ->> 'id') into entry;
    if entry is null then return null; end if;
  end if;
  for field in select a.attname::text as name from pg_catalog.pg_attribute a
    where a.attrelid = tg_relid and a.attnum > 0 and not a.attisdropped order by a.attnum loop
    value := case jsonb_typeof(entry -> field.name) when 'string' then entry ->> field.name when 'null' then null else (entry -> field.name)::text end;
    -- A brace a visitor wrote is escaped too, so no answer spells another column's place.
    markup := replace(markup, '{{' || field.name || '}}', replace(replace(replace(replace(replace(replace(replace(coalesce(value, ''),
      '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;'), '{', '&#123;'), chr(10), '<br>'));
    continue when field.name in ('id', 'created_at', 'updated_at') or right(field.name, 3) = '_id';
    continue when coalesce(btrim(value), '') = '';
    words := words || case when words = '' then '' else chr(10) end
      || upper(left(replace(field.name, '_', ' '), 1)) || substr(replace(field.name, '_', ' '), 2) || ': ' || value;
    if reply is null and (field.name = 'email' or right(field.name, 6) = '_email')
      and lower(btrim(value)) ~ '^[a-z0-9._%+-]+@[a-z0-9-]+([.][a-z0-9-]+)*[.][a-z]{2,}$' then reply := lower(btrim(value)); end if;
  end loop;
  begin
    -- A row a site check's test person made reaches no one (storage copies of Backends' `testPlayerMarkKey`, which only its admin
    -- key writes into the session's claims, and of its setup row's setting); nor one naming the check's own address (App email's).
    if current_setting('foundable.test_person', true) = 'on'
      or nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'foundable_test_player' = 'true' then return null; end if;
    insert into public.foundable_email_intents (idempotency_key, message)
    values (tg_table_name || '-' || coalesce(entry ->> 'id', 'row') || '-' || txid_current(),
      jsonb_build_object('to', 'owner', 'subject', subject, 'text', left(coalesce(nullif(words, ''), subject), 9000))
        || case when reply is null then '{}'::jsonb else jsonb_build_object('replyTo', reply) end
        || case when char_length(markup) <= 30000 then jsonb_build_object('html', markup) else '{}'::jsonb end)
    on conflict (idempotency_key) do nothing;
  exception when others then
    raise warning 'The owner''s email of a new % row was not queued: %', tg_table_name, sqlerrm;
  end;
  return null;
end $$;
drop function if exists private.email_owner(regclass, text);
create or replace function private.email_owner(target regclass, subject text, markup text default null) returns void language plpgsql set search_path = '' as $$
declare named text;
begin
  if coalesce(btrim(subject), '') = '' then
    raise exception 'email_owner takes the subject of the emails it sends, in the website''s words';
  end if;
  if markup is not null then
    select place[1] into named from regexp_matches(markup, '[{][{]([^{}]*)[}][}]', 'g') place where not exists (select from pg_catalog.pg_attribute a
      where a.attrelid = target and a.attnum > 0 and not a.attisdropped and a.attname = place[1]) limit 1;
    if named is not null then raise exception 'email_owner''s markup names {{%}}, and % has no such column', named, target; end if;
    if markup !~ '[{][{][^{}]+[}][}]' then
      raise exception 'email_owner''s markup shows nothing of the row: write a column''s value as {{column}}';
    end if;
  end if;
  execute format('drop trigger if exists %I on %s', (select relname from pg_catalog.pg_class where oid = target) || '_email_owner', target);
  execute format('create constraint trigger %I after insert on %s deferrable initially deferred for each row '
    || 'execute function private.queue_owner_email(' || case when markup is null then '%L' else '%L, %L' end || ')',
    (select relname from pg_catalog.pg_class where oid = target) || '_email_owner', target, subject, markup);
end $$;

-- Times one resource holds never overlap: a booking refused with 23P01 where it would.
create or replace function private.no_overlap(target regclass, resource_column text, starts_column text default 'starts_at',
  ends_column text default 'ends_at', status_column text default 'status', cancelled text default 'cancelled')
returns void language plpgsql set search_path = '' as $$
begin
  execute format('alter table %s add constraint %I exclude using gist (%I with =, tstzrange(%I, %I, ''[)'') with &&) where (%I <> %L)',
    target, (select relname from pg_class where oid = target) || '_no_overlap', resource_column, starts_column, ends_column, status_column, cancelled);
end $$;

-- Triggers that write what visitors may not. Arguments are column and table names in schema public.
-- keep_total(parent, total, key[, status, uncounted]): after insert, update or delete on the rows counted.
create or replace function private.keep_total() returns trigger language plpgsql security definer set search_path = '' as $$
declare parent text := tg_argv[0]; total text := tg_argv[1]; fk text := tg_argv[2]; status text := tg_argv[3]; off text := tg_argv[4];
  counts boolean;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    counts := status is null or (to_jsonb(new) ->> status) is distinct from off;
    if counts then execute format('update public.%I set %I = %I + 1 where id = %L', parent, total, total, to_jsonb(new) ->> fk); end if;
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    counts := status is null or (to_jsonb(old) ->> status) is distinct from off;
    if counts then execute format('update public.%I set %I = %I - 1 where id = %L', parent, total, total, to_jsonb(old) ->> fk); end if;
  end if;
  return null;
end $$;
-- take_place(parent, places, key[, status, uncounted]): before insert or update, refuses a row past the parent's places.
create or replace function private.take_place() returns trigger language plpgsql security definer set search_path = '' as $$
declare parent text := tg_argv[0]; places text := tg_argv[1]; fk text := tg_argv[2]; status text := tg_argv[3]; off text := tg_argv[4];
  most int; taken int;
begin
  if status is not null and (to_jsonb(new) ->> status) is not distinct from off then return new; end if;
  if tg_op = 'UPDATE' and (status is null or (to_jsonb(old) ->> status) is distinct from off)
     and (to_jsonb(old) ->> fk) is not distinct from (to_jsonb(new) ->> fk) then return new; end if;
  execute format('select %I from public.%I where id = %L for update', places, parent, to_jsonb(new) ->> fk) into most;
  execute format('select count(*) from public.%I where %I = %L%s', tg_table_name, fk, to_jsonb(new) ->> fk,
    case when status is null then '' else format(' and %I is distinct from %L', status, off) end) into taken;
  if taken >= most then raise exception 'No places are left' using errcode = 'P0001'; end if;
  return new;
end $$;
-- close_on_threshold(parent, key, needed, closed_at): before insert on the votes, refuses a vote on a closed thing and
-- closes it with the vote that reaches what it needs.
create or replace function private.close_on_threshold() returns trigger language plpgsql security definer set search_path = '' as $$
declare parent text := tg_argv[0]; fk text := tg_argv[1]; needed text := tg_argv[2]; closed text := tg_argv[3];
  thing jsonb; votes int;
begin
  execute format('select to_jsonb(p) from public.%I p where id = %L for update', parent, to_jsonb(new) ->> fk) into thing;
  if thing ->> closed is not null then raise exception 'This vote is closed' using errcode = 'P0001'; end if;
  execute format('select count(*) from public.%I where %I = %L', tg_table_name, fk, to_jsonb(new) ->> fk) into votes;
  if votes + 1 >= (thing ->> needed)::int then
    execute format('update public.%I set %I = now() where id = %L', parent, closed, to_jsonb(new) ->> fk);
  end if;
  return new;
end $$;
-- freeze_when_voted(votes, key, column...): before update on the thing, refuses a change to those columns once it has a vote.
create or replace function private.freeze_when_voted() returns trigger language plpgsql security definer set search_path = '' as $$
declare voted boolean; i int;
begin
  execute format('select exists (select 1 from public.%I where %I = %L)', tg_argv[0], tg_argv[1], to_jsonb(old) ->> 'id') into voted;
  if voted then
    for i in 2 .. tg_nargs - 1 loop
      if (to_jsonb(new) -> tg_argv[i]) is distinct from (to_jsonb(old) -> tg_argv[i]) then
        raise exception 'People voted on this, so % stays as they saw it', tg_argv[i] using errcode = 'P0001';
      end if;
    end loop;
  end if;
  return new;
end $$;
revoke execute on function private.service_rows(regclass), private.own_rows(regclass, text, text[]), private.everyone_reads(regclass),
  private.anyone_adds(regclass), private.read_by_link(regclass, text), private.only_columns(regclass, text[], text[], text[]),
  private.admins_change(regclass, text[]), private.no_overlap(regclass, text, text, text, text, text), private.keep_total(),
  private.take_place(), private.close_on_threshold(), private.freeze_when_voted(), private.queue_owner_email(),
  private.email_owner(regclass, text, text) from public, anon, authenticated;

-- A record and its parts in one database call (saveWithParts in src/lib/data.ts), as its caller: either all of it is saved
-- or none of it, each row under the caller's own rules.
create or replace function public.save_with_parts(record_table text, record jsonb, parts_table text default null,
  parts jsonb default '[]', parts_key text default null) returns jsonb language plpgsql set search_path = '' as $$
declare saved jsonb; part jsonb; columns text;
begin
  select string_agg(format('%I', key), ', ') into columns from jsonb_object_keys(record) key;
  if columns is null then
    execute format('insert into public.%I default values returning to_jsonb(%I.*)', record_table, record_table) into saved;
  else
    execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) returning to_jsonb(%I.*)',
      record_table, columns, columns, record_table, record_table) using record into saved;
  end if;
  for part in select value from jsonb_array_elements(coalesce(parts, '[]')) loop
    part := part || jsonb_build_object(parts_key, saved -> 'id');
    select string_agg(format('%I', key), ', ') into columns from jsonb_object_keys(part) key;
    execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)',
      parts_table, columns, columns, parts_table) using part;
  end loop;
  return saved;
end $$;
grant execute on function public.save_with_parts(text, jsonb, text, jsonb, text) to anon, authenticated;
