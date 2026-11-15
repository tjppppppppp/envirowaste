// Foundable's rows helper: a table or list whose rows are edited in place and saved one by one (an inventory, prices, a
// schedule). It holds what the person typed into each row apart from the rows read from the database, so reading them
// again, or saving, adding or removing another row, never puts saved values back over what they typed. Pages use it through
// useRows (use-rows.tsx). Change nothing here.

/** Why the database refused, as supabase-js answers it; data.ts's `refusal` names its kind for the page to say. */
export type Problem = { code: string; message: string };

/** What a supabase-js query answers: its rows (or row), or why the database refused. */
export type Answer<T> = PromiseLike<{ data: T | null; error: Problem | null }>;

/** A row of a table, by its `id` column. */
export type Keyed = { id: string | number };

/** The rows as the page shows them: each as read, with what was typed into it over it; `problem` is why the last read failed. */
export type Shown<Row> = { rows: Row[]; loading: boolean; problem: Problem | null };

/** A write the database answered without an error but changed no row by: no rule lets this visitor change it, or it is gone. */
const unchanged: Problem = { code: "42501", message: "The database changed no row: no rule lets this visitor change it, or it is gone." };

const key = (id: string | number) => String(id);

/** The one row a write answered: `.select().single()` answers it, `.select()` a list of it. */
const one = <Row>(data: Row | Row[] | null): Row | undefined => Array.isArray(data) ? data.length === 1 ? data[0] : undefined : data ?? undefined;

export class RowEdits<Row extends Keyed> {
  /** The read of every row, the latest a page gave (`useRows` keeps it current). */
  read: () => Answer<Row[]>;
  #rows: Row[] = [];
  readonly #edits = new Map<string, Partial<Row>>();
  #shown: Shown<Row> = { rows: [], loading: true, problem: null };
  readonly #listeners = new Set<() => void>();
  #reading = 0;
  #loaded = false;
  #writes = 0;

  constructor(read: () => Answer<Row[]>) {
    this.read = read;
  }

  /** The rows as the page shows them now. */
  shown = (): Shown<Row> => this.#shown;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  };

  /** What the person typed into a row, kept until that row is saved or the edit discarded, whatever is read or written meanwhile. */
  edit = (id: Row["id"], changes: Partial<Row>): void => {
    this.#edits.set(key(id), { ...this.#edits.get(key(id)), ...changes });
    this.#show();
  };

  /** A row's unsaved edit, none once it is saved. */
  edited = (id: Row["id"]): Partial<Row> | undefined => this.#edits.get(key(id));

  /** Drops a row's unsaved edit, showing it as saved again. */
  discard = (id: Row["id"]): void => {
    if (this.#edits.delete(key(id))) this.#show();
  };

  /**
   * Reads every row again. Each unsaved edit stays over its row; a read a later one overtook is dropped, and one a write
   * landed during is asked again, so it never puts back a row as it was before that write.
   */
  reload = async (): Promise<void> => {
    const reading = ++this.#reading, writes = this.#writes;
    const { data, error } = await this.read();
    if (reading !== this.#reading) return;
    if (writes !== this.#writes) return this.reload();
    if (!error) this.#rows = data ?? [];
    this.#loaded = true;
    this.#show(error);
  };

  /**
   * Saves a row's unsaved edit: `write` is handed it and answers the row as the database saved it (`.select().single()`),
   * which takes its place. Answers why the database refused, the edit kept and the row still shown unsaved, as it is where the
   * database changed no row; nothing where the row has no edit. Anything typed into the row while it saved stays unsaved.
   */
  save = async (id: Row["id"], write: (changes: Partial<Row>) => Answer<Row | Row[]>): Promise<Problem | null> => {
    const sent = this.#edits.get(key(id));
    if (!sent) return null;
    const { data, error } = await write(sent);
    const saved = one(data);
    if (error || !saved) return error ?? unchanged;
    this.#writes++;
    this.#put(saved);
    const typed = Object.entries(this.#edits.get(key(id)) ?? {})
      .filter(([field, value]) => !Object.hasOwn(sent, field) || !Object.is(value, (sent as Record<string, unknown>)[field]));
    if (typed.length) this.#edits.set(key(id), Object.fromEntries(typed) as Partial<Row>);
    else this.#edits.delete(key(id));
    this.#show();
    return null;
  };

  /** Adds a row: `write` inserts it and answers it as the database saved it (`.select().single()`). Answers why it was refused. */
  add = async (write: () => Answer<Row | Row[]>): Promise<Problem | null> => {
    const { data, error } = await write();
    const added = one(data);
    if (error || !added) return error ?? unchanged;
    this.#writes++;
    this.#put(added);
    this.#show();
    return null;
  };

  /**
   * Removes a row: `write` deletes it. Answers why it was refused, the row still shown; where `write` answers the rows it
   * deleted (`.select()`), none means none was removed.
   */
  remove = async (id: Row["id"], write: () => Answer<unknown>): Promise<Problem | null> => {
    const { data, error } = await write();
    if (error || (Array.isArray(data) && !data.length)) return error ?? unchanged;
    this.#writes++;
    this.#rows = this.#rows.filter(row => key(row.id) !== key(id));
    this.#edits.delete(key(id));
    this.#show();
    return null;
  };

  #put(row: Row): void {
    const at = this.#rows.findIndex(held => key(held.id) === key(row.id));
    this.#rows = at < 0 ? [...this.#rows, row] : this.#rows.map((held, index) => index === at ? row : held);
  }

  #show(problem: Problem | null = this.#shown.problem): void {
    const rows = this.#rows.map(row => {
      const edit = this.#edits.get(key(row.id));
      return edit ? { ...row, ...edit } : row;
    });
    this.#shown = { rows, loading: !this.#loaded, problem };
    for (const listener of this.#listeners) listener();
  }
}
