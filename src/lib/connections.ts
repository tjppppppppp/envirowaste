// Foundable connects this website to its owner's outside accounts (StockX, Shopify, QuickBooks, any OAuth 2.0 provider), and
// each signed-in person to their own account at the apps the owner connects in Foundable (gmail, hubspot, the rest), whose
// new emails it can post to this website while they are away (watchMyAccount).
// Foundable writes this file and replaces it whole, so never edit it; connections.server.ts holds the server routes' half.

/**
 * Opens the connection's start, /api/connect/<name>/start, in a tab of its own, where the owner signs in to the provider. Call it
 * from the owner's Connect control's click, never while a page renders: Build's preview and Build › Tools hand that tab the
 * owner's ticket, and a tab opened without one says to connect from Build › Tools.
 */
export function openConnection(name: string): void {
  window.open(`/api/connect/${name}/start`, "_blank", "noopener");
}

/**
 * One of a signed-in person's own connections: the app (its id), the account it is connected as, since when (ISO) and the
 * kinds of event posted to this website from it (watchMyAccount).
 */
export type MyConnection = { app: string; account: string | null; connectedAt: string; watching: string[] };

const asked = (body: object) => fetch("/api/my-connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  .then(async (answer) => ({ ok: answer.ok, body: await answer.json().catch(() => ({})) }))
  .catch(() => ({ ok: false, body: {} as Record<string, any> }));

/**
 * Opens the signed-in person's own connect to an app (its id: gmail), in a tab of its own where they sign in to it, and
 * brings that tab back to this page once done, where finishMyConnect finishes it. Call it from their click, never while a
 * page renders, with their session's access token. Answers false where Foundable could not start it (signed out, or the
 * website has no connections), its tab closed.
 */
export async function connectMyAccount(app: string, session: string): Promise<boolean> {
  const tab = window.open("", "_blank");
  const back = new URL(location.href);
  back.hash = "";
  back.searchParams.delete("foundable_connect");
  const started = await asked({ action: "start", app, session, returnTo: back.href });
  if (!started.ok || typeof started.body.url !== "string") {
    tab?.close();
    return false;
  }
  if (tab) tab.location.href = started.body.url;
  else location.assign(started.body.url);
  return true;
}

/** The signed-in person's own connections, or null where they are signed out or Foundable cannot be reached. */
export async function listMyConnections(session: string): Promise<MyConnection[] | null> {
  const listed = await asked({ action: "list", session });
  return listed.ok && Array.isArray(listed.body.connections) ? listed.body.connections as MyConnection[] : null;
}

/**
 * Has Foundable post each new event of a kind at the signed-in person's own account to this website's /api/connection-events, which
 * connectionEventRoute answers, while they are away: email at gmail or outlook, channel_message or direct_message at slack,
 * calendar_event at google_calendar. Call it from their click on the option they turn on, with their session's access token.
 * Answers true once it is watched; false where they have not connected the app, the app has no such event, the owner's plan
 * does not include it (Pro and Max do), or Foundable could not now.
 */
export async function watchMyAccount(app: string, event: string, session: string): Promise<boolean> {
  const watched = await asked({ action: "watch", app, event, session });
  return watched.ok && typeof watched.body.watching === "object" && watched.body.watching !== null;
}

/** Stops posting the signed-in person's events of that kind at that app; answers whether Foundable took it. */
export async function stopWatchingMyAccount(app: string, event: string, session: string): Promise<boolean> {
  return (await asked({ action: "unwatch", app, event, session })).ok;
}

/** Ends the signed-in person's own connection to an app; answers whether Foundable took it. */
export async function disconnectMyAccount(app: string, session: string): Promise<boolean> {
  return (await asked({ action: "disconnect", app, session })).ok;
}

/**
 * Finishes the signed-in person's connect their browser came back to this page from, once, as them alone: call it as the page
 * loads, with their session's access token, and say how it ended. Answers "connected", or "failed" (declined at the app,
 * expired, or started by someone else, which connects no one), taking the return off the address; null where the page came
 * back from none.
 */
export async function finishMyConnect(session: string): Promise<"connected" | "failed" | null> {
  const here = new URL(location.href), code = here.searchParams.get("foundable_connect");
  if (!code) return null;
  here.searchParams.delete("foundable_connect");
  history.replaceState(history.state, "", here.href);
  const finished = await asked({ action: "finish", code, session });
  return finished.ok && finished.body.result === "connected" ? "connected" : "failed";
}
