// Foundable's data SDK: the database client for server functions and server routes alone, on the website's server key,
// which Foundable sets and which skips every row level security rule, so check who is asking and what they may do before
// you use it. Import it only from server code (a dynamic import inside a handler where its file also reaches the browser);
// change nothing here.
import { createClient } from "@supabase/supabase-js";

export function serverBackend() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("The website's server key is not set up yet.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
