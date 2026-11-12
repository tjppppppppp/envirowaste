// Foundable sends this website's own emails (a welcome, a booking or order confirmation, a notification) under the
// website's name, with an unsubscribe link, so the website needs no mail account or key. Call sendEmail only from server
// functions and server routes, never while a page renders.

export interface Email {
  to: string;
  subject: string;
  /** The email's words as plain text; html, where given, is what mail apps show. */
  text: string;
  html?: string;
  /** Where replies go, such as the business's own address. */
  replyTo?: string;
  /** Use the same key for the same email (welcome-<user id>) so retries reuse its queued receipt. */
  idempotencyKey?: string;
}

export type SentEmail =
  | { status: "queued" | "suppressed" }
  | { status: "captured"; id: string }
  | { status: "not_available" | "refused"; message: string };

/**
 * Sends one email through Foundable. "suppressed" means its reader unsubscribed from this website's emails;
 * "not_available" means it runs where Foundable sends no email (the live preview while a build works on the website). In
 * the live preview it reaches the owner's own address alone. It never throws: a failed direct email must never fail what
 * the visitor did. capture:true stores a no-send test receipt using a separate endpoint; it never falls back to sending.
 * Neither "queued" nor "captured" proves delivery.
 */
export async function sendEmail(email: Email, options: { capture?: boolean } = {}): Promise<SentEmail> {
  const url = options.capture ? process.env.FOUNDABLE_EMAIL_CAPTURE_URL ?? process.env.FOUNDABLE_EMAIL_PREVIEW_CAPTURE_URL : process.env.FOUNDABLE_EMAIL_URL ?? process.env.FOUNDABLE_EMAIL_PREVIEW_URL;
  if (!url) return { status: "not_available", message: "Foundable sends this website no email where it runs now." };
  const token = process.env.FOUNDABLE_EMAIL_PREVIEW_TOKEN;
  const body = JSON.stringify({ ...email, idempotencyKey: email.idempotencyKey ?? crypto.randomUUID() });
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body,
        signal: AbortSignal.timeout(30000) });
      const answer = (await response.json().catch(() => ({}))) as { status?: string; error?: { code?: string; message?: string } };
      if (response.ok) {
        if (options.capture && answer.status === "captured" && "id" in answer && typeof answer.id === "string")
          return { status: "captured", id: answer.id };
        if (!options.capture && (answer.status === "queued" || answer.status === "suppressed")) return { status: answer.status };
        return { status: "refused", message: "Foundable returned an unexpected email receipt." };
      }
      if (answer.error?.code === "not_available") return { status: "not_available", message: answer.error.message ?? "Foundable sends this website no email where it runs now." };
      if (response.status < 500 || attempt === 2) return { status: "refused", message: answer.error?.message ?? `The email was refused (${response.status}).` };
    } catch {
      if (attempt === 2) return { status: "refused", message: "Foundable could not be reached to send the email." };
    }
  }
}

/**
 * The address an email links one of this website's own pages by (a path, with its query): where its owner opens the page in
 * Foundable while the website runs as a preview, else its live address. Never build one on the request's own origin, which
 * in a preview is an address no browser reaches or a link that lapses. It throws where it has neither, so an email that
 * must carry the link is not sent without it.
 */
export function pageLink(path: string): string {
  const preview = process.env.FOUNDABLE_PREVIEW_PAGES_URL, live = process.env.FOUNDABLE_SITE_URL;
  if (!preview && !live) throw new Error("This website has no address to link a page by where it runs now.");
  const page = new URL(path, live ?? preview);
  return preview ? `${preview}&${new URLSearchParams({ page: `${page.pathname}${page.search}${page.hash}` })}` : page.href;
}

/**
 * After installing Foundable's email-intents SQL, await this before the transaction that saves both the business change
 * and its email intent. Failure throws so no business action silently commits without a registered recovery source.
 * Registration is safe to repeat. This call neither saves nor sends an email.
 * Foundable's recovery, outside this website, visits it as soon as a row is queued (the database pings Foundable as
 * its transaction commits) and at least every 60 minutes besides, and takes its pending rows one at a time, each held
 * 2 minutes (claim_until). A refusal that can change (an hourly or monthly limit, a pause, a plan) or a failed
 * hand-off adds 1 to attempts, sets last_error and makes the row due again in 30 seconds, doubling up to 15 minutes;
 * where the website's database cannot be reached, the hold just expires. A replay keeps idempotency_key and answers
 * the receipt of an email Foundable already took, so a lost answer never makes a second email. A refusal 6 hours or
 * more after created_at ends the row failed with its reason, as an invalid message does at once, while a failed
 * hand-off keeps the row pending until Foundable answers. queued means accepted for sending, not delivered (Foundable
 * then hands it to its mail provider at most once); captured is a no-send receipt; suppressed means the address
 * unsubscribed, bounced or reported spam; receipt_id names the receipt. Nothing a website calls can force a failed
 * hand-off: Foundable's own tests prove this recovery.
 */
export async function prepareEmailQueue(): Promise<void> {
  const url = process.env.FOUNDABLE_EMAIL_INTENTS_ENABLE_URL;
  if (!url) throw new Error("Email queue registration requires the published website or a saved preview link, not the active build preview.");
  for (let attempt = 1; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}",
        signal: AbortSignal.timeout(30000) });
    } catch {
      if (attempt === 2) throw new Error("Foundable could not be reached to register the email queue.");
      continue;
    }
    const answer = (await response.json().catch(() => ({}))) as { status?: string; error?: { message?: string } };
    if (response.ok && answer.status === "enabled") return;
    if (response.status < 500 || attempt === 2)
      throw new Error(answer.error?.message ?? "Foundable could not register the email queue.");
  }
}
