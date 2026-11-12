// Foundable's sign-in SDK: what a visitor wrote, kept through sign-in, which leaves the page for Google and comes back to it.
// Foundable writes this file and replaces it whole, so never edit it.

/** Where a kept value waits in this browser tab, beside the sign-in file's own. */
const slot = (name: string) => `foundable_kept:${name}`;

/**
 * Keeps `value` (anything JSON holds) under `name` in this browser tab until takeKept reads it. Call it in the Sign in with
 * Google control's click, just before signInWithGoogle(). A browser that keeps nothing loses the value, never the sign-in.
 */
export function keepThroughSignIn(name: string, value: unknown): void {
  try {
    sessionStorage.setItem(slot(name), JSON.stringify(value));
  } catch {
    // The visitor signs in without it.
  }
}

/**
 * What was kept under `name`, once, since reading it forgets it; null when nothing was. Call it in a useEffect after
 * finishGoogleSignIn answers, never while a page renders: the server's render has no browser storage.
 */
export function takeKept<T>(name: string): T | null {
  try {
    const kept = sessionStorage.getItem(slot(name));
    sessionStorage.removeItem(slot(name));
    return kept === null ? null : (JSON.parse(kept) as T);
  } catch {
    return null;
  }
}
