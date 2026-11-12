// Foundable's data SDK: this website's database client for code that runs in the browser, which Foundable writes for the
// website's own database. Import `backend` from "@/lib/backend" wherever a page reads or saves; change nothing here.
import { createClient } from "@supabase/supabase-js";

export const backend = createClient("https://xwgdpwykggfndvkfvnim.supabase.co", "sb_publishable_GrsfrO09c1iso1gwbytNKQ_S4f9rT-Z");
