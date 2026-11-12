// Foundable reads public web pages for this website's server code: readPublicPage asks Foundable's reader for one page by its
// address, and Foundable's servers read it over https, as browsers now read an http address, checking every address and
// redirect before they ask it, refusing any that is not a public website, checking its certificate and sending nothing of this
// website's. Foundable writes this file, so never
// edit it; import it only from server routes and server functions, with a dynamic import inside the handler where the file
// importing it also reaches the browser.

/** A redirect the read followed: the address that redirected and the status it answered. */
export type PublicPageRedirect = { url: string; status: number };

/**
 * Why a read gave no page: `blocked`, an address Foundable never reads (not a public web address, another port, a user name
 * or password in it), asked or redirected to; `unreachable`, no such site or nothing answered; `tls`, its https certificate is
 * not valid for it; `timeout`; `too_many_redirects`; `not_text`, an image, PDF or other file, not a page; `bad_answer`, an
 * answer broken or cut short; `invalid_address`, no http or https address at all; `rate_limited` or `busy`, try again after
 * `retryAfterSeconds`; `not_available`, Foundable's reader cannot be reached from here.
 */
export type PublicPageError = "blocked" | "unreachable" | "tls" | "timeout" | "too_many_redirects" | "not_text" | "bad_answer"
  | "invalid_address" | "rate_limited" | "busy" | "not_available";

/**
 * A page as its own server sent it: where it was read after any redirects (`url`), its status whatever it was (a 404 page is
 * still a page), its headers (`getSetCookie()` lists each cookie it set), its text decoded (its HTML, or whatever text it
 * is), `truncated` where it ran past what Foundable reads and was cut there, the redirects followed, and the read's id.
 */
export type PublicPage = { ok: true; url: string; status: number; headers: Headers; text: string; truncated: boolean;
  redirects: PublicPageRedirect[]; readId: string };

/** No page, and why; `detail` says more where it can (a certificate's problem, the file's type). */
export type PublicPageFailure = { ok: false; error: PublicPageError; detail?: string; redirects: PublicPageRedirect[]; readId?: string;
  retryAfterSeconds?: number };

/**
 * Reads one public web page at `address` (an absolute http or https address), following its redirects. Never throws for the
 * page's own failure: every way it can give no page is an answer with `ok: false`. `signal` stops the read when this website no
 * longer needs it.
 */
export async function readPublicPage(address: string, init: { signal?: AbortSignal } = {}): Promise<PublicPage | PublicPageFailure> {
  const url = process.env.FOUNDABLE_CONNECT_URL, key = process.env.FOUNDABLE_CONNECT_KEY;
  if (!url) return { ok: false, error: "not_available", redirects: [] };
  let response: Response;
  try {
    response = await fetch(`${url}/read`, { method: "POST", body: JSON.stringify({ url: address }), signal: init.signal,
      headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) } });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    return { ok: false, error: "not_available", redirects: [] };
  }
  const answer: Record<string, any> = await response.json().catch(() => ({}));
  const redirects: PublicPageRedirect[] = Array.isArray(answer.redirects) ? answer.redirects : [];
  if (response.status === 200 && answer.state === "ok") {
    const headers = new Headers();
    for (const [name, value] of Array.isArray(answer.headers) ? answer.headers : []) {
      try { headers.append(name, value); } catch { /* A header no Headers can hold. */ }
    }
    return { ok: true, url: answer.url, status: answer.status, headers, text: answer.body, truncated: answer.truncated === true, redirects,
      readId: answer.readId };
  }
  if (response.status === 200 && answer.state === "failed")
    return { ok: false, error: answer.error, ...(answer.detail ? { detail: answer.detail } : {}), redirects, readId: answer.readId };
  if (response.status === 400) return { ok: false, error: "invalid_address", redirects };
  if (response.status === 429) return { ok: false, error: answer.error === "busy" ? "busy" : "rate_limited", redirects,
    retryAfterSeconds: Number(response.headers.get("retry-after")) || 1 };
  return { ok: false, error: "not_available", redirects };
}
