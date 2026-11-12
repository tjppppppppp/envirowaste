import { fmt } from "../lib/store";
export function LineChart({ points }: { points: { label: string; v: number }[] }) {
  const W = 640, H = 260, L = 38, B = 28, T = 10, R = 12;
  if (!points.length) return <p className="msg warn">No dated records match these filters.</p>;
  const max = Math.max(10, ...points.map((p) => p.v)); const top = Math.ceil(max / 50) * 50 || 50;
  const x = (i: number) => L + (points.length === 1 ? 0 : (i / (points.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.v)}`).join(" ");
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const lbl = [0, Math.floor(points.length / 4), Math.floor(points.length / 2), Math.floor((points.length * 3) / 4), points.length - 1];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Weekly tonnage from ${points[0].label} to ${points[points.length - 1].label}`}>
      {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#ddd2b8" /><text x={L - 6} y={y(t) + 4} textAnchor="end">{fmt(t)}</text></g>)}
      <path d={`${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)}Z`} fill="#17808a" opacity=".12" />
      <path d={line} fill="none" stroke="#17808a" strokeWidth="2.2" />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r="3" fill="#17808a"><title>{`${p.label}: ${fmt(p.v, 1)} t`}</title></circle>)}
      {[...new Set(lbl)].map((i) => <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}>{points[i].label.slice(5)}</text>)}
    </svg>
  );
}
export const COMP_COLORS = ["#17808a", "#6fb7b8", "#dba73a", "#9a9a9a"];
export function StackBar({ pct, unknown }: { pct: (number | null)[]; unknown: number }) {
  return (
    <div className="stack" role="img" aria-label={`Paper ${fmt(pct[0] ?? 0, 1)}%, plastic ${fmt(pct[1] ?? 0, 1)}%, organics ${fmt(pct[2] ?? 0, 1)}%, other ${fmt(pct[3] ?? 0, 1)}%, unknown ${fmt(unknown, 1)}%`}>
      {pct.map((p, i) => <div key={i} style={{ width: `${p ?? 0}%`, background: COMP_COLORS[i] }} />)}
      <div className="hatch" style={{ width: `${unknown}%`, border: "1px solid #14233f55" }} />
    </div>
  );
}
