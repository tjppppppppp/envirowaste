import { createFileRoute } from "@tanstack/react-router";

const SERVICE = "https://tjpppppppppp-envirotrap-ai-backend.hf.space/api/classify";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Sends the waste photo alone (no building, notes or user data) to the original EnviroTrap CLIP ViT-B/32 service.
async function classify(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in to use the scanner." }, 401);
  const { serverBackend } = await import("../../lib/backend.server");
  const db = serverBackend();
  const { data: u } = await db.auth.getUser(token);
  const user = u?.user;
  if (!user) return json({ error: "Sign in to use the scanner." }, 401);
  const email = (user.email ?? "").toLowerCase();
  const [r, a] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    db.from("admins").select("email").eq("email", email).maybeSingle(),
  ]);
  if (!a.data && !["administrator", "researcher"].includes(r.data?.role ?? "")) return json({ error: "Only researchers and administrators can use the scanner." }, 403);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !["image/jpeg", "image/png"].includes(file.type)) return json({ error: "Attach a JPG or PNG photo of waste." }, 400);
  if (file.size > 8 * 1024 * 1024) return json({ error: "The photo is over 8 MB." }, 400);
  const out = new FormData(); out.append("file", file, "photo");
  try {
    const res = await fetch(SERVICE, { method: "POST", body: out, signal: AbortSignal.timeout(60000) });
    if (!res.ok) { console.error("CLIP service answered", res.status); return json({ error: `The CLIP scanner service answered ${res.status}.` }, 502); }
    const body = (await res.json()) as { top_material?: string; results?: { material: string; score: number }[] };
    if (!body.top_material || !Array.isArray(body.results)) return json({ error: "The CLIP scanner service sent an unexpected answer." }, 502);
    return json({ top_material: body.top_material, results: body.results.map((x) => ({ material: x.material, score: x.score })) });
  } catch (e) {
    console.error("CLIP service failed", e);
    return json({ error: "The CLIP scanner service could not be reached. Try again shortly." }, 502);
  }
}

export const Route = createFileRoute("/api/clip-classify")({ server: { handlers: { POST: ({ request }) => classify(request) } } });
