// Foundable's data SDK: what the website's pages call to save and to say why the database refused, beside the database
// half Foundable applied before the build began (src/lib/data.sql). Change nothing here.
//
// In the database, each in the backend.apply_sql change that makes its table, only_columns last:
//   select private.own_rows('public.requests'[, 'user_id'[, '{select,insert,update,delete}']]);
//                                                                       -- people read, add and change their own, or as named
//   select private.everyone_reads('public.posts');                     -- every visitor reads every row
//   select private.anyone_adds('public.messages');                     -- anyone adds a row, a form entry; visitors read none
//   select private.email_owner('public.messages', 'New message');      -- the owner gets each row added by email, from its save
//   select private.read_by_link('public.lists'[, 'share_token']);      -- read only with its link's token, sent as x-share-token
//   select private.only_columns('public.profiles', '{user_id,name}', '{name}'[, '{anon,authenticated}']);
//                                                                       -- visitors add and change those columns alone
//   select private.admins_change('public.requests'[, '{select,update}']);
//                                                                       -- the admins (public.admins) use every row, or as named
//   insert into public.admins (email) values ('<the owner's sign-in address, in lowercase>');
//   select private.no_overlap('public.bookings', 'teacher_id');        -- one resource's live bookings never overlap (23P01)
// Triggers that write what visitors may not, by the names of public tables and their columns:
//   create trigger signups_total after insert or update or delete on public.signups for each row
//     execute function private.keep_total('events', 'seats_taken', 'event_id'[, 'status', 'cancelled']);  -- a total from its rows
//   create trigger signups_place before insert or update on public.signups for each row
//     execute function private.take_place('events', 'places', 'event_id'[, 'status', 'cancelled']); -- never past the places
//   create trigger votes_close before insert on public.votes for each row
//     execute function private.close_on_threshold('polls', 'poll_id', 'needed', 'closed_at');    -- closes once, takes no more
//   create trigger polls_frozen before update on public.polls for each row
//     execute function private.freeze_when_voted('votes', 'poll_id', 'question', 'options');     -- unchanged once voted on
// Each table's id column is `id`.
import type { PostgrestError } from "@supabase/supabase-js";
import { backend } from "./backend";

/**
 * Why the database refused a save, for the page to say in its own words: `taken` (a time someone holds), `twice` (one
 * already there, such as a second vote), `in_use` (a record still pointing at it), `not_allowed` (no rule lets this
 * visitor), `refused` (a rule's own words, in `message`) or `failed` (anything else, worth trying again).
 */
export type Refusal = { kind: "taken" | "twice" | "in_use" | "not_allowed" | "refused" | "failed"; message: string };

export function refusal(error: Pick<PostgrestError, "code" | "message"> | null | undefined): Refusal | null {
  if (!error) return null;
  const kinds: Record<string, Refusal["kind"]> = { "23P01": "taken", "23505": "twice", "23503": "in_use", "42501": "not_allowed", P0001: "refused" };
  return { kind: kinds[error.code] ?? "failed", message: error.message };
}

/**
 * Saves a record with its parts in one database call (an order and its lines), as the signed-in visitor, under every rule
 * their rows have: all of it is saved, or none of it. `parts.key` is the parts' column naming the record.
 */
export async function saveWithParts<Saved = Record<string, unknown>>(table: string, record: Record<string, unknown>,
  parts?: { table: string; key: string; rows: Record<string, unknown>[] }): Promise<{ saved: Saved | null; refused: Refusal | null }> {
  const { data, error } = await backend.rpc("save_with_parts", { record_table: table, record, parts_table: parts?.table ?? null,
    parts: parts?.rows ?? [], parts_key: parts?.key ?? null });
  return { saved: error ? null : data as Saved, refused: refusal(error) };
}
