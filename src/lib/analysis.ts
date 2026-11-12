import type { Rec } from "./demo";
import type { Audit } from "./store";
export function weekStart(d: string) { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() - x.getDay()); return x.toISOString().slice(0, 10); }
export function weekly(recs: Rec[]) {
  const m = new Map<string, { w: number; n: number; unk: number }>();
  for (const r of recs) { if (!r.date) continue; const k = weekStart(r.date); const e = m.get(k) ?? { w: 0, n: 0, unk: 0 }; e.w += r.weight ?? 0; e.n++; if (!r.building) e.unk++; m.set(k, e); }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ week: k, ...v }));
}
export function stats(recs: Rec[]) {
  const withW = recs.filter((r) => r.weight != null);
  const total = withW.reduce((s, r) => s + (r.weight ?? 0), 0);
  const attributed = recs.filter((r) => r.building).length;
  const seen = new Set<string>(); let dup = 0;
  for (const r of recs) { const k = [r.date, r.building, r.container, r.weight].join("|"); if (seen.has(k)) dup++; else seen.add(k); }
  return { total, n: recs.length, attributed, unknown: recs.length - attributed, missingWeight: recs.length - withW.length, dup, missingDate: recs.filter((r) => !r.date).length, pctUnknown: recs.length ? ((recs.length - attributed) / recs.length) * 100 : null };
}
export function composition(audits: Audit[]) {
  const cats = ["Paper", "Plastic", "Organics", "Other"]; const out: { building: string; pct: (number | null)[]; unknown: number }[] = [];
  const by = new Map<string, Audit[]>(); audits.forEach((a) => by.set(a.building, [...(by.get(a.building) ?? []), a]));
  for (const [b, list] of by) {
    let tot = 0; const kg = [0, 0, 0, 0]; let any = false;
    for (const a of list) { if (!a.sample_weight_kg) continue; tot += Number(a.sample_weight_kg);
      for (const m of a.measurements ?? []) { if (m.kg == null) continue; const n = m.name.toLowerCase(); const i = n.includes("paper") || n.includes("cardboard") ? 0 : n.includes("plastic") ? 1 : n.includes("food") || n.includes("organic") ? 2 : 3; kg[i] += Number(m.kg); any = true; } }
    if (!tot || !any) continue;
    const pct = kg.map((k) => (k / tot) * 100); out.push({ building: b, pct, unknown: Math.max(0, 100 - pct.reduce((a, c) => a + c, 0)) });
  }
  return { cats, rows: out };
}
export type Insight = { key: string; title: string; finding: string; evidence: string; uncertainty: string };
export function insights(recs: Rec[], audits: Audit[]): Insight[] {
  const s = stats(recs); const out: Insight[] = [];
  if (s.n) {
    out.push({ key: "attribution", title: "Many records are not attributed to a building", finding: `${s.unknown} of ${s.n} records (${s.pctUnknown?.toFixed(1)}%) have no building.`, evidence: `Counted from the building field of ${s.n} records in the selected dataset.`, uncertainty: "This shows a limit of attribution in these records, not that this share of waste is untracked. The cause is not established." });
    const noC = recs.filter((r) => !r.container).length;
    out.push({ key: "container", title: "Container identifiers are often absent", finding: `${noC} of ${s.n} records have no container ID.`, evidence: "Counted from the container field.", uncertainty: "Whether identification systems are operational is not known from these records." });
    if (s.missingWeight) out.push({ key: "weights", title: "Some records have no weight", finding: `${s.missingWeight} records have no usable weight; they are excluded from totals, not counted as zero.`, evidence: "Counted from the weight field.", uncertainty: "Missing weights may reflect scale or entry issues; unknown." });
    const withAudit = new Set(audits.map((a) => a.building)); const counts = new Map<string, number>();
    recs.forEach((r) => r.building && !withAudit.has(r.building) && counts.set(r.building, (counts.get(r.building) ?? 0) + 1));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (top.length) out.push({ key: "audit-gaps", title: "Buildings that may benefit from an audit", finding: `${top.map(([b, n]) => `${b} (${n} records)`).join(", ")} have collection records but no audit.`, evidence: "Buildings in the records compared with the audit list.", uncertainty: "Record counts do not indicate how much a building discards or how it sorts." });
  }
  const c = audits.filter((a) => a.contamination_pct != null).sort((a, b) => Number(b.contamination_pct) - Number(a.contamination_pct));
  if (c.length) out.push({ key: "contamination", title: "Highest observed contamination", finding: `${c[0].building} shows ${c[0].contamination_pct}% in "${c[0].title}".`, evidence: `${c.length} audit(s) with a contamination value; method: ${c[0].method}.`, uncertainty: "Single samples; differences between buildings may be chance." });
  return out;
}
