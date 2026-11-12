// Foundable's Google sign-in for this website. Foundable writes this file and replaces it whole, so never edit it.
// signInWithGoogle() sends the visitor to Google through Foundable; finishGoogleSignIn() signs them in on the page Google
// returns them to, only where this browser started that sign-in.
import type { SupabaseClient } from "@supabase/supabase-js";

const googleStart = "https://foundable.com/api/app-sign-in/google/start";
const returnParameter = "return";
const nonceParameter = "nonce";
const fragment = {"token":"foundable_sign_in","nonce":"foundable_sign_in_nonce","error":"foundable_sign_in_error"};

/** What finishGoogleSignIn found: a visitor signed in, one who cancelled, a sign-in that did not complete, or one this browser never started. */
export type GoogleSignInResult = "signed-in" | "cancelled" | "failed" | "not-started";

/** Sends the whole page to Google through Foundable. Call it from the Sign in with Google control's click, never while a page renders. */
export function signInWithGoogle(): void {
  const nonce = crypto.randomUUID();
  sessionStorage.setItem(fragment.nonce, nonce);
  location.assign(`${googleStart}?${returnParameter}=${encodeURIComponent(location.href)}&${nonceParameter}=${encodeURIComponent(nonce)}`);
}

/**
 * Finishes a Google sign-in on the page Google returned to. Call it once as the page loads, in a useEffect, with the
 * website's backend client. It answers null when the page's address carries no Google sign-in; otherwise it takes the
 * sign-in out of the address and answers what happened, signing the visitor in only where this browser started it.
 */
export async function finishGoogleSignIn(client: SupabaseClient): Promise<GoogleSignInResult | null> {
  const values = new URLSearchParams(location.hash.slice(1));
  const token = values.get(fragment.token), error = values.get(fragment.error);
  if (!token && !error) return null;
  const nonce = values.get(fragment.nonce), started = sessionStorage.getItem(fragment.nonce);
  sessionStorage.removeItem(fragment.nonce);
  history.replaceState(history.state, "", location.pathname + location.search);
  if (error) return error === "cancelled" ? "cancelled" : "failed";
  if (!token || !nonce || !started || nonce !== started) return "not-started";
  const { error: refused } = await client.auth.verifyOtp({ token_hash: token, type: "email" });
  return refused ? "failed" : "signed-in";
}
