// Foundable keeps this website's connections to the owner's outside accounts: only the owner can connect one, and Foundable
// holds the tokens for this website's server code alone, one refresh at a time. connectionFetch calls the apps the owner
// connected in Foundable itself, whose credentials Foundable adds. Each signed-in person may also connect their own account
// at one of those apps (myConnectionsRoute), which myConnectionFetch calls as them alone, by their session, and have each new
// email there posted to this website while they are away (connectionEventRoute), which it then calls as them by the event.
// Foundable writes this file, so never edit it; import it only from server routes and server functions, with a dynamic
// import inside the handler where the file importing it also reaches the browser.
import { deleteCookie } from "@tanstack/react-start/server";

/**
 * A provider's tokens from a code trade or a refresh: expiresAt is Date.now() + expires_in * 1000, and extra holds what later
 * calls to the provider need (QuickBooks' realmId).
 */
export type ConnectionTokens =
  { accessToken: string; refreshToken?: string; expiresAt?: number; tokenType?: string; scope?: string; extra?: Record<string, string> };
export type ConnectionAccess = Pick<ConnectionTokens, "accessToken" | "expiresAt" | "tokenType" | "extra">;
/**
 * A finished start's code, traded at the provider with codeVerifier (where the start used PKCE) and redirectUri, beside every
 * parameter the provider sent; or "not_started" (this browser did not start it from Foundable in the last ten minutes),
 * "denied" (the owner declined) or "failed".
 */
export type FinishedConnection =
  | { ok: true; code: string; codeVerifier?: string; redirectUri: string; params: Record<string, string> }
  | { ok: false; error: "not_started" | "denied" | "failed" };
type Answer = { status: number; body: Record<string, any> };

const cookie = (name: string) => `__Host-connect-${name}`;

/**
 * Answers GET /api/connect/<name>/start. With the owner's ticket, which Build's preview and Build › Tools hand the tab, it sends
 * the owner to the sign-in address authorize builds, which carries redirect_uri, state and, unless pkce is false,
 * code_challenge with code_challenge_method=S256; with none, or where Foundable refuses it, a short page says why.
 */
export async function startConnection(request: Request, { name, authorize, pkce = true }: { name: string; pkce?: boolean;
  authorize(start: { redirectUri: string; state: string; codeChallenge?: string }): string | URL | Promise<string | URL> }): Promise<Response> {
  const ticket = new URL(request.url).searchParams.get("ticket");
  if (!ticket) return page(403, "This connection starts from Build › Tools in Foundable.");
  const nonce = randomText(), verifier = pkce ? randomText() : "";
  const started = await door("start", { ticket, nonce }).catch((): Answer => ({ status: 502, body: { error: "unreachable" } }));
  if (started?.status !== 200) return page(started?.status ?? 503, `Foundable could not start this connection (${started?.body.error
    ?? started?.status ?? "not_available"}). Start it again from Build › Tools in Foundable.`);
  const { state, redirectUri } = started.body;
  const codeChallenge = pkce ? base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))) : undefined;
  const location = await authorize({ redirectUri, state, ...(codeChallenge ? { codeChallenge } : {}) });
  return new Response(null, { status: 302, headers: { location: String(location), "referrer-policy": "no-referrer", "set-cookie":
    `${cookie(name)}=${nonce}.${verifier}.${base64url(new TextEncoder().encode(redirectUri))}; Max-Age=600; Path=/; Secure; HttpOnly; SameSite=Lax` } });
}

/**
 * Reads GET /api/connect/<name>/callback, where Foundable returns the owner: the code, only in the browser that started it and
 * once Foundable confirms the state is the one it signed for this start, whose start it clears.
 */
export async function finishConnection(request: Request, name: string): Promise<FinishedConnection> {
  const query = new URL(request.url).searchParams, states = query.getAll("state"), codes = query.getAll("code"), error = query.get("error");
  const held = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${cookie(name)}=`));
  deleteCookie(cookie(name), { path: "/", secure: true, httpOnly: true, sameSite: "lax" });
  if (states.length > 1 || codes.length > 1) return { ok: false, error: "failed" };
  const [nonce, verifier, callback, ...rest] = held?.slice(cookie(name).length + 1).split(".") ?? [];
  let started: { n?: unknown; k?: unknown } | undefined, redirectUri: string | undefined;
  try {
    started = JSON.parse(fromBase64url(states[0]!.split(".")[0]!));
    redirectUri = fromBase64url(callback!);
  } catch { /* An address or a cookie that no start in this browser made. */ }
  if (!nonce || rest.length || !redirectUri || started?.n !== name || started.k !== nonce) return { ok: false, error: "not_started" };
  if (error || codes.length !== 1) return { ok: false, error: error === "access_denied" ? "denied" : "failed" };
  // Only Foundable can check the state's signature, so a state made up here, with a cookie to match, hands back no code.
  const checked = await door("finish", { name, state: states[0] }).catch(() => undefined);
  if (checked?.status !== 200) return { ok: false, error: checked && checked.status < 500 ? "not_started" : "failed" };
  return { ok: true, code: codes[0]!, ...(verifier ? { codeVerifier: verifier } : {}), redirectUri, params: Object.fromEntries(query) };
}

/**
 * Saves a connection's tokens with Foundable, never in the website's database: after a code trade, with the account's name as
 * the owner should read it, they replace whatever the connection held. It sends again once on a lost answer or a 5xx, and
 * answers what came of it without throwing.
 */
export async function saveConnection(name: string, tokens: ConnectionTokens | undefined,
  { account, lease, lapsed }: { account?: string; lease?: string; lapsed?: true } = {}): Promise<{ saved: true } | { saved: false; error: string }> {
  for (let attempt = 1; ; attempt++) {
    try {
      const saved = await door("save", { name, tokens, account, lease, lapsed });
      if (!saved) return { saved: false, error: "not_available" };
      if (saved.status === 200) return { saved: true };
      if (saved.status < 500 || attempt === 2) return { saved: false, error: String(saved.body.error ?? saved.status) };
    } catch {
      if (attempt === 2) return { saved: false, error: "unreachable" };
    }
  }
}

/**
 * The connection's token for a call to the provider, or null where it is not connected, lapsed (the owner connects it again)
 * or Foundable cannot be reached. Near its expiry one call at a time refreshes it with refresh(refreshToken), which makes the
 * provider's refresh call and answers the new tokens, or throws the provider's own Response where it refuses: a 4xx alone
 * marks the connection lapsed. The new tokens are saved before they are used.
 */
export async function connectionToken(name: string, refresh: (refreshToken: string) => Promise<ConnectionTokens>): Promise<ConnectionAccess | null> {
  for (let ask = 1; ; ask++) {
    const answered = await door("token", { name }).catch(() => undefined);
    const answer = answered?.status === 200 ? answered.body : {};
    if (answer.state === "connected") return access(answer as ConnectionAccess);
    if (answer.state === "refresh") return refreshed(name, answer, refresh);
    if (answer.state !== "wait" || ask === 5) return null;
    await new Promise(resolve => setTimeout(resolve, answer.retryAfterMs));
  }
}

async function refreshed(name: string, held: Record<string, any>, refresh: (refreshToken: string) => Promise<ConnectionTokens>) {
  let tokens: ConnectionTokens;
  try {
    tokens = await refresh(held.refreshToken);
  } catch (error) {
    if (!(error instanceof Response && error.status >= 400 && error.status < 500)) return held.accessToken ? access(held as ConnectionAccess) : null;
    await saveConnection(name, undefined, { lease: held.lease, lapsed: true });
    return null;
  }
  // A refresh that answers no new refresh token, or no value kept beside the token, keeps the ones held.
  const extra = { ...held.extra, ...tokens.extra };
  const kept = { ...tokens, refreshToken: tokens.refreshToken ?? held.refreshToken, ...(Object.keys(extra).length ? { extra } : {}) };
  await saveConnection(name, kept, { lease: held.lease });
  return access(kept);
}

const access = ({ accessToken, expiresAt, tokenType, extra }: ConnectionAccess): ConnectionAccess => ({ accessToken, expiresAt, tokenType, extra });

type QueryValue = string | number | boolean;
/**
 * An app's answer to a call. repeated is set only on a call naming an actionKey already used: "done" where the first call
 * with that key got the app's answer (its status here, nothing else), "unknown" where its answer was lost, so the change may
 * or may not have been made; either way this call changed nothing.
 */
export type ConnectionAnswer = { ok: boolean; status: number; headers: Record<string, string>; repeated?: "done" | "unknown";
  json(): Promise<any>; text(): Promise<string> };

/**
 * Calls an app the owner connected in Foundable's Integrations (by its id: google_sheets) as the owner's account, Foundable
 * adding its credentials: address is the app API's full https address, init its method (GET unless given), query and JSON
 * body. Answers the app's own answer, or null where the owner has not connected the app or Foundable cannot be reached; a call
 * Foundable refuses as sent (an address off the app's API, too much to send or to answer) throws.
 */
export async function connectionFetch(provider: string, address: string,
  init: { method?: string; query?: Record<string, QueryValue | QueryValue[]>; body?: unknown } = {}): Promise<ConnectionAnswer | null> {
  const answered = await door("fetch", { provider, method: init.method ?? "GET", path: address, query: init.query, body: init.body })
    .catch(() => undefined);
  return answerOf(provider, answered);
}

/**
 * A call's answer as the app gave it, a repeated action key's as its first call went, null for none, and a throw for one
 * Foundable refused as sent or whose action key another call is still using. A strict call (one made for an event) throws
 * too where Foundable could not answer now, so its event is posted again later, and is null only where the person holds no
 * connection to the app or the event is no longer theirs to act on.
 */
function answerOf(provider: string, answered: Answer | undefined, strict = false): ConnectionAnswer | null {
  if (answered?.status === 400 || answered?.status === 413) throw new Error(`Foundable refused this call to ${provider} (${answered.body.error}).`);
  const refusal = answered?.status === 200 ? null : String(answered?.body.error ?? "unreachable");
  if (refusal === "action_running" || strict && refusal !== null && refusal !== "delivery_invalid" && refusal !== "website_gone")
    throw new Error(`Foundable could not make this call to ${provider} now (${refusal}); try again later.`);
  if (answered?.status === 200 && answered.body.state === "repeated") {
    const outcome = answered.body.outcome ?? {}, status = outcome.state === "done" && typeof outcome.status === "number" ? outcome.status : 0;
    return { ok: status >= 200 && status < 300, status, headers: {}, repeated: outcome.state === "done" ? "done" : "unknown",
      json: async () => null, text: async () => "" };
  }
  if (answered?.status !== 200 || answered.body.state !== "ok") return null;
  const { status, headers, body } = answered.body as { status: number; headers: Record<string, string>; body: unknown };
  // An app's JSON comes parsed, any other answer as its text.
  const json = typeof body !== "string" || /\bjson\b/iu.test(headers["content-type"] ?? "");
  return { ok: status >= 200 && status < 300, status, headers, json: async () => json ? body : JSON.parse(body as string),
    text: async () => typeof body === "string" ? body : JSON.stringify(body) };
}

/**
 * One of a signed-in person's own connections: the app (its id), the account it is connected as, since when (ISO) and the
 * kinds of event posted to this website from it (watchMyAccount).
 */
export type MyConnection = { app: string; account: string | null; connectedAt: string; watching: string[] };

/**
 * One new event at an account a signed-in person watches (their new email), as connectionEventRoute hands it once Foundable
 * confirms it: id, the same on every post of it, by which the website takes it once; app (gmail); event (email); user, the
 * person's sign-in id; receivedAt (ISO); and delivery, which a call on it carries in place of their session while Foundable
 * handles it (myConnectionFetch, stopWatching). It names no message: read the app for what came.
 */
export type ConnectionEvent = { id: string; app: string; event: string; user: string; receivedAt: string; delivery: string };

/**
 * Answers POST /api/my-connections, a signed-in person's own accounts at the apps the owner connects in Foundable (gmail, hubspot,
 * the rest), which the browser half calls with their session's access token: { action: "start", app, session, returnTo }
 * answers { url } for their browser to open, { action: "finish", code, session } { result } once they come back,
 * { action: "list", session } { connections }, { action: "disconnect", app, session } { disconnected }, and
 * { action: "watch" or "unwatch", app, event, session } { watching } or { unwatched }. Foundable checks the session with this
 * website's own sign-in, so a person starts, finishes, sees, watches and ends their own alone; a session it refuses answers
 * 403, and the route checks nothing more.
 */
export async function myConnectionsRoute(request: Request): Promise<Response> {
  let asked: Record<string, unknown>;
  try { asked = await request.json(); } catch { return Response.json({ error: "invalid_request" }, { status: 400 }); }
  const { action, session, app, returnTo, code, event } = asked ?? {};
  const call = action === "start" ? "user_start" : action === "finish" ? "user_finish" : action === "list" ? "user_list"
    : action === "disconnect" ? "user_disconnect" : action === "watch" ? "user_watch" : action === "unwatch" ? "user_unwatch" : null;
  if (!call) return Response.json({ error: "invalid_request" }, { status: 400 });
  const answered = await door(call, call === "user_start" ? { app, session, returnTo } : call === "user_finish" ? { code, session }
    : call === "user_list" ? { session } : call === "user_watch" || call === "user_unwatch" ? { app, event, session } : { app, session })
    .catch((): Answer => ({ status: 502, body: { error: "unreachable" } }));
  if (!answered) return Response.json({ error: "not_available" }, { status: 503 });
  return Response.json(answered.body, { status: answered.status });
}

/**
 * Calls an app as a signed-in person's own account, which they connected through this website: person is their sign-in's
 * access token as the page hands it to the server function, or one of their events as connectionEventRoute handed it; app
 * the app's id; the rest as connectionFetch takes them. A change that must happen once (a reply sent, a record written) names
 * an actionKey this website derives from what it acts on (reply:<message id>), up to 200 characters with no spaces: the first
 * call with it makes the change, and any later one changes nothing and answers how the first went (repeated). Answers the
 * app's own answer, or null where they have not connected the app or Foundable refuses their session or event; a call
 * Foundable refuses as sent throws, and so does one for an event Foundable could not answer now, so the event comes again.
 */
export async function myConnectionFetch(person: string | ConnectionEvent, app: string, address: string,
  init: { method?: string; query?: Record<string, QueryValue | QueryValue[]>; body?: unknown; actionKey?: string } = {}): Promise<ConnectionAnswer | null> {
  const answered = await door("user_fetch", { ...whom(person), provider: app, method: init.method ?? "GET", path: address, query: init.query,
    body: init.body, actionKey: init.actionKey }).catch(() => undefined);
  return answerOf(app, answered, typeof person !== "string");
}

/**
 * Answers POST /api/connection-events, where Foundable posts each new event at an account a signed-in person watches (watchMyAccount
 * in the browser half). It asks Foundable whether the post is one it sent and hands onEvent the event Foundable confirms,
 * never a field of the post alone, then answers once onEvent ends: 200 where it ended, 500 where it threw, so Foundable posts
 * it again later with the same id, and 200 for a post Foundable did not send or no longer acts on (the person disconnected).
 * Give onEvent less than a minute, and take each event id once.
 */
export async function connectionEventRoute(request: Request, onEvent: (event: ConnectionEvent) => Promise<void>): Promise<Response> {
  let posted: Record<string, unknown>;
  try { posted = await request.json(); } catch { return Response.json({ error: "invalid_request" }, { status: 400 }); }
  const delivery = posted?.delivery;
  if (typeof delivery !== "string" || !delivery) return Response.json({ error: "invalid_request" }, { status: 400 });
  const checked = await door("user_event", { delivery }).catch((): Answer => ({ status: 502, body: { error: "unreachable" } }));
  if (!checked) return Response.json({ error: "not_available" }, { status: 503 });
  if (checked.status === 403 && (checked.body.error === "delivery_invalid" || checked.body.error === "website_gone")) return Response.json({ ignored: true });
  const event = checked.body.event;
  if (checked.status !== 200 || typeof event?.id !== "string") return Response.json({ error: String(checked.body.error ?? "unavailable") }, { status: 503 });
  try {
    await onEvent({ id: event.id, app: event.app, event: event.event, user: event.user, receivedAt: event.receivedAt, delivery });
  } catch (error) {
    console.error("A connection event's handler failed; Foundable posts it again later.", error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
  return Response.json({ taken: true });
}

/**
 * Stops posting the kind of event this one is at its app, for a person the website no longer serves; their connection stays.
 * Answers whether Foundable took it.
 */
export async function stopWatching(event: ConnectionEvent): Promise<boolean> {
  const answered = await door("user_unwatch", { app: event.app, event: event.event, delivery: event.delivery }).catch(() => undefined);
  return answered?.status === 200;
}

const whom = (person: string | ConnectionEvent) => typeof person === "string" ? { session: person } : { delivery: person.delivery };

/** The signed-in person's own connections, or null where Foundable refuses their session or cannot be reached. */
export async function myConnections(session: string): Promise<MyConnection[] | null> {
  const answered = await door("user_list", { session }).catch(() => undefined);
  return answered?.status === 200 && Array.isArray(answered.body.connections) ? answered.body.connections as MyConnection[] : null;
}

/** One call to Foundable's door for this website's connections, or undefined where the website runs without one. */
async function door(call: "start" | "finish" | "save" | "token" | "fetch" | "user_start" | "user_finish" | "user_fetch" | "user_list" | "user_disconnect"
  | "user_watch" | "user_unwatch" | "user_event", body: object): Promise<Answer | undefined> {
  const url = process.env.FOUNDABLE_CONNECT_URL, key = process.env.FOUNDABLE_CONNECT_KEY;
  if (!url) return undefined;
  const response = await fetch(`${url}/${call}`, { method: "POST", body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) } });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

const page = (status: number, text: string) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport"
  content="width=device-width, initial-scale=1"><title>Connect</title><p>${text}</p>`, { status, headers: { "content-type": "text/html; charset=utf-8" } });
const randomText = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
const base64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
const fromBase64url = (text: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), character => character.charCodeAt(0)));
