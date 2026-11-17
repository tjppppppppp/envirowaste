// Data-quality gate: a metric is calculated and shown only when its required reliable inputs exist.
// Unavailable is never zero. Basis says what kind of data stands behind a shown value.
export type Basis = "recorded" | "historical" | "inferred" | "demo";
export type Gate = { ok: true; basis: Basis; note: string } | { ok: false; reason: string };
export type GateInput = { n: number; withWeight: number; withDate: number; attributed: number; demo: boolean; historical: number; weeks?: number };
export const MIN_COVERAGE = 0.8;
export const HISTORICAL_DAYS = 90;
export function isHistorical(date: string | null | undefined, today = new Date()) {
  if (!date) return false; const d = new Date(date + "T12:00:00"); return (today.getTime() - d.getTime()) / 864e5 > HISTORICAL_DAYS;
}
function base(i: GateInput): Basis { return i.demo ? "demo" : i.n > 0 && i.historical / i.n >= 0.9 ? "historical" : "recorded"; }
export function gateTotalWeight(i: GateInput): Gate {
  if (i.n === 0) return { ok: false, reason: "No records in this selection." };
  if (i.withWeight / i.n < MIN_COVERAGE) return { ok: false, reason: `Only ${i.withWeight} of ${i.n} records have a weight (needs at least ${MIN_COVERAGE * 100}%).` };
  if (i.withDate / i.n < MIN_COVERAGE) return { ok: false, reason: `Only ${i.withDate} of ${i.n} records have a date (needs at least ${MIN_COVERAGE * 100}%).` };
  return { ok: true, basis: base(i), note: `${i.withWeight} of ${i.n} records weighed.` };
}
export function gateCount(i: GateInput): Gate {
  return i.n === 0 ? { ok: false, reason: "No records in this selection." } : { ok: true, basis: base(i), note: "Counted from the records." };
}
// Building attribution of imported/project records comes from column mapping, not a verified source: inferred.
export function gateAttribution(i: GateInput): Gate {
  if (i.n === 0) return { ok: false, reason: "No records in this selection." };
  return { ok: true, basis: i.demo ? "demo" : "inferred", note: i.demo ? "Synthetic demo data." : "Building comes from column mapping, not verified." };
}
export function gateTrend(i: GateInput): Gate {
  const g = gateTotalWeight(i); if (!g.ok) return g;
  if ((i.weeks ?? 0) < 8) return { ok: false, reason: "Needs at least 8 weeks of weighed records." };
  return { ok: true, basis: g.basis === "recorded" ? "recorded" : g.basis, note: "Recorded weights only; not a cause." };
}
export const BASIS_LABEL: Record<Basis, string> = { recorded: "Recorded", historical: "Historical", inferred: "Estimated / inferred", demo: "Demo (synthetic)" };
