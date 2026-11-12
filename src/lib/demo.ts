// Synthetic records for demonstration mode, generated from today's date.
export type Rec = { date: string; weight: number | null; building: string | null; stream: string; route: string; container: string; source: string };
export const BUILDINGS = ["Grainger Library", "Illini Union", "Siebel Center", "Foellinger Auditorium", "Memorial Stadium", "ARC", "Noyes Lab", "Lincoln Hall"];
export const STREAMS = ["landfill", "recycling", "compost"];
export const ROUTES = ["Route A", "Route B", "Route C"];
export const SOURCES = ["LoadMan export", "Driver log"];
function rng(seed: number) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296); }
export function iso(d: Date) { return d.toISOString().slice(0, 10); }
export function demoRange() { const end = new Date(); end.setHours(12, 0, 0, 0); const start = new Date(end); start.setDate(end.getDate() - 108); return { start: iso(start), end: iso(end) }; }
export function demoRecords(): Rec[] {
  const r = rng(79533); const out: Rec[] = []; const end = new Date(); end.setHours(12, 0, 0, 0);
  for (let i = 0; i < 1500; i++) {
    const d = new Date(end); d.setDate(end.getDate() - Math.floor(r() * 109));
    const attributed = r() > 0.35;
    const b = attributed ? BUILDINGS[Math.floor(r() * BUILDINGS.length)] : null;
    const s = r() < 0.6 ? "landfill" : r() < 0.7 ? "recycling" : "compost";
    out.push({ date: iso(d), weight: Math.round((0.15 + r() * 0.9 + (b ? 0.2 : 0)) * 1000) / 1000, building: b, stream: s, route: ROUTES[Math.floor(r() * 3)], container: b ? `C-${(BUILDINGS.indexOf(b) + 1) * 10 + Math.floor(r() * 3)}` : "", source: r() < 0.7 ? SOURCES[0] : SOURCES[1] });
  }
  return out;
}
// Demo composition by building: paper, plastic, organics, other (percent of measured sample, remainder unknown)
export const DEMO_COMP: Record<string, number[]> = { "Grainger Library": [38, 27, 14, 5], "Illini Union": [26, 28, 18, 7], "Siebel Center": [34, 24, 9, 4] };
