import { useEffect, useState, useSyncExternalStore } from "react";
import { backend } from "./backend";
import { demoRecords, type Rec } from "./demo";

let mode: "demo" | "project" = "demo";
// Cause of the "saved audit not visible after reload" bug: the mode lived only in memory, so every reload reset to Demo and showed demo audits.
// The choice is now remembered per browser (never mixes the two datasets; it only remembers which one you were viewing).
if (typeof window !== "undefined") { try { if (window.localStorage.getItem("nx-mode") === "project") mode = "project"; } catch {} }
const subs = new Set<() => void>();
export function setMode(m: "demo" | "project") { mode = m; try { window.localStorage.setItem("nx-mode", m); } catch {} subs.forEach((f) => f()); }
export function useMode() { return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => mode, () => "demo" as const); }

export type User = { id: string; email: string } | null;
export function useUser() {
  const [user, setUser] = useState<User>(null); const [ready, setReady] = useState(false);
  useEffect(() => {
    backend.auth.getSession().then(({ data }) => { const u = data.session?.user; setUser(u ? { id: u.id, email: u.email ?? "" } : null); setReady(true); });
    const { data } = backend.auth.onAuthStateChange((_e, s) => { setUser(s?.user ? { id: s.user.id, email: s.user.email ?? "" } : null); });
    return () => data.subscription.unsubscribe();
  }, []);
  return { user, ready };
}
export type Role = "administrator" | "researcher" | "fs_staff" | "driver" | "viewer";
export function useRole(user: User) {
  const [role, setRole] = useState<Role>("viewer"); const [org, setOrg] = useState("");
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await backend.from("user_roles").select("role,organization").eq("user_id", user.id).maybeSingle();
      if (data) { setRole(data.role as Role); setOrg(data.organization ?? ""); }
      else await backend.from("user_roles").insert({ user_id: user.id });
      const a = await backend.from("admins").select("email").eq("email", user.email.toLowerCase()).maybeSingle();
      if (a.data) setRole("administrator");
    })();
  }, [user?.id]);
  return { role, org, setOrg, canWrite: role === "administrator" || role === "researcher" };
}
export type Audit = { id: string; title: string; building: string; location: string | null; researchers: string | null; audit_date: string; status: string; sample_weight_kg: number | null; method: string; contamination_pct: number | null; measurements: { name: string; kg: number | null }[]; notes: string | null };

export const DEMO_AUDITS_PLACEHOLDER = 0;
const demoCache = { v: null as Rec[] | null };
export function useRecords() {
  const m = useMode(); const { user } = useUser();
  const demo = (demoCache.v ??= demoRecords()); const [proj, setProj] = useState<Rec[]>([]); const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!user) { setProj([]); setLoaded(true); return; }
    backend.from("import_records").select("record_date,weight_kg,building,stream,container").eq("is_duplicate", false).limit(5000).then(({ data }) => {
      setProj((data ?? []).map((r: any) => ({ date: r.record_date ?? "", weight: r.weight_kg == null ? null : Number(r.weight_kg) / 1000, building: r.building, stream: r.stream ?? "unknown", route: "unknown", container: r.container ?? "", source: "Imported CSV" })));
      setLoaded(true);
    });
  }, [user?.id]);
  return { mode: m, records: m === "demo" ? demo : proj, signedIn: !!user, loaded };
}
export function useAudits(mode: "demo" | "project") {
  const { user } = useUser(); const [a, setA] = useState<Audit[]>([]); const [n, setN] = useState(0);
  useEffect(() => {
    if (mode === "demo" || !user) { setA([]); return; }
    backend.from("audits").select("*").order("audit_date", { ascending: false }).then(({ data }) => setA((data ?? []) as Audit[]));
  }, [mode, user?.id, n]);
  return { audits: mode === "demo" ? DEMO_AUDITS : a, reload: () => setN((x) => x + 1) };
}
export const DEMO_AUDITS: Audit[] = ["Grainger Library", "Illini Union", "Siebel Center"].map((b, i) => {
  const d = new Date(); d.setDate(d.getDate() - 20 - i * 14);
  return { id: "demo" + i, title: `${b} landfill audit`, building: b, location: "Main lobby bins", researchers: "M. Okafor", audit_date: d.toISOString().slice(0, 10), status: i === 0 ? "Under Review" : "Completed", sample_weight_kg: 42 + i * 9, method: "Physical measurement", contamination_pct: [21, 33, 15][i], measurements: [{ name: "Paper", kg: 16 + i }, { name: "Plastic", kg: 11 }, { name: "Organics", kg: 6 + i }, { name: "Other", kg: 2 }], notes: "Synthetic audit." };
});
export function fmt(n: number, d = 0) { return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }

export type DriverEntry = { id: string; entered_at: string; truck: string; route: string; material: string; building: string | null; container: string | null; net_kg: number; disposal_location: string; work_order_status: string };
// Driver-log entries are a separate source from imported records; they are never merged into import totals.
export function useDriverEntries(demo: boolean) {
  const { user } = useUser(); const [es, setEs] = useState<DriverEntry[]>([]); const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!user) { setEs([]); setLoaded(true); return; }
    backend.from("collection_entries").select("id,entered_at,truck,route,material,building,container,net_kg,disposal_location,work_order_status").eq("is_demo", demo).order("entered_at", { ascending: false }).limit(2000)
      .then(({ data }) => { setEs((data ?? []).map((r: any) => ({ ...r, net_kg: r.net_kg == null ? NaN : Number(r.net_kg) })).filter((r: DriverEntry) => isFinite(r.net_kg))); setLoaded(true); });
  }, [user?.id, demo]);
  return { entries: es, signedIn: !!user, loaded };
}
