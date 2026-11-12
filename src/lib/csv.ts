export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let f = ""; let q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); f = ""; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else f += c;
  }
  row.push(f); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
export function toCsv(rows: (string | number | null)[][]) {
  return rows.map((r) => r.map((c) => { const s = c == null ? "" : String(c); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
}
export const FIELDS = [
  { key: "date", label: "Date / time", re: /date|time|stamp|day|when/i },
  { key: "weight", label: "Weight", re: /weight|net|wt|tonn|lbs|kg|mass/i },
  { key: "unit", label: "Weight unit (optional)", re: /^unit|uom|measure/i },
  { key: "building", label: "Building", re: /build|facility|site|location|customer/i },
  { key: "container", label: "Container ID", re: /contain|bin|rfid|tag|dumpster|id$/i },
  { key: "stream", label: "Waste stream", re: /stream|type|material|waste|commodity/i },
] as const;
export function suggest(headers: string[]) {
  const m: Record<string, string> = {}; const used = new Set<string>();
  for (const f of FIELDS) { const h = headers.find((h) => !used.has(h) && f.re.test(h)); if (h) { m[f.key] = h; used.add(h); } }
  return m;
}
export function normDate(v: string): { iso: string | null; note?: string } {
  const s = (v ?? "").trim(); if (!s) return { iso: null };
  let y: number, mo: number, d: number; let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) { mo = +m[1]; d = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
  else return { iso: null };
  const dt = new Date(Date.UTC(y, mo - 1, d)); if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return { iso: null };
  const iso = dt.toISOString().slice(0, 10);
  return { iso, note: iso === s ? undefined : `date "${s}" → ${iso}` };
}
export function normWeight(v: string, unit: string): { kg: number | null; note?: string } {
  const n = parseFloat((v ?? "").replace(/,/g, "")); if (!isFinite(n) || n < 0) return { kg: null };
  const u = unit.toLowerCase();
  const f = /lb|pound/.test(u) ? 0.45359237 : /short|^ton$|^tons$|^t$/.test(u) ? 907.18474 : /tonne|metric|mt/.test(u) ? 1000 : 1;
  const kg = Math.round(n * f * 1000) / 1000;
  return { kg, note: f === 1 ? undefined : `weight ${v} ${unit} → ${kg} kg` };
}
