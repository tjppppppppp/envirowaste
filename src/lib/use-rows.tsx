// Foundable's rows helper for pages: useRows reads a table's rows and holds what the person types into each apart from them
// (rows.ts). Any page imports it. Change nothing here.
import { useEffect, useState, useSyncExternalStore } from "react";
import { RowEdits, type Answer, type Keyed, type Shown } from "./rows";

export type Rows<Row extends Keyed> = Shown<Row> & Pick<RowEdits<Row>, "edit" | "edited" | "discard" | "save" | "add" | "remove" | "reload">;

/**
 * A table's rows for a page that edits them in place, read as the page opens with `read` (a supabase-js select): `rows` as
 * the page shows them, each with what was typed into it over it, and each row's save, add and remove putting only its own row
 * in place, so no read or write ever puts saved values back over another row's unsaved edit.
 */
export function useRows<Row extends Keyed>(read: () => Answer<Row[]>): Rows<Row> {
  const [rows] = useState(() => new RowEdits(read));
  const shown = useSyncExternalStore(rows.subscribe, rows.shown, rows.shown);
  useEffect(() => { rows.read = read; });
  useEffect(() => { void rows.reload(); }, [rows]);
  return { ...shown, edit: rows.edit, edited: rows.edited, discard: rows.discard, save: rows.save, add: rows.add, remove: rows.remove, reload: rows.reload };
}
