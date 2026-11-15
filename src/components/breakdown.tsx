import { fmt } from "../lib/store";

export type Bar = { key: string; label: string; value: number | null; count: number; note?: string };
const PAL = ["#17808a", "#6fb7b8", "#dba73a", "#14233f", "#9a6fb0", "#c0665a"];

// Accessible horizontal bars: each row is a button (drill-down), and a table alternative sits under the chart.
export function HBars({ bars, unit, onPick, active, label, digits = 1 }: { bars: Bar[]; unit: string; onPick?: (k: string) => void; active?: string | null; label: string; digits?: number }) {
  const max = Math.max(0, ...bars.map((b) => b.value ?? 0));
  if (!bars.length) return <p className="msg warn">No data for this view. Nothing is shown as zero.</p>;
  return (
    <div>
      <div role="group" aria-label={label} style={{ display: "grid", gap: 6 }}>
        {bars.map((b, i) => {
          const unknown = b.value == null;
          return (
            <button key={b.key} type="button" onClick={() => onPick?.(b.key)} aria-pressed={active === b.key} title={`Show the ${b.count} underlying records`}
              style={{ display: "grid", gridTemplateColumns: "minmax(90px,170px) 1fr minmax(70px,auto)", gap: 8, alignItems: "center", textAlign: "left", padding: "4px 6px", border: "1px solid " + (active === b.key ? "#14233f" : "transparent"), borderRadius: 6, background: active === b.key ? "#f3ecd9" : "transparent", fontSize: 13, minHeight: 36 }}>
              <span style={{ overflowWrap: "anywhere" }}>{b.label}</span>
              <span style={{ background: "#efe7d2", borderRadius: 3, height: 16, display: "block" }} aria-hidden>
                {unknown ? <span className="hatch" style={{ display: "block", height: "100%", width: "100%", border: "1px solid #14233f55", borderRadius: 3 }} /> :
                  <span style={{ display: "block", height: "100%", width: `${max ? Math.max(2, ((b.value ?? 0) / max) * 100) : 0}%`, background: PAL[i % PAL.length], borderRadius: 3 }} />}
              </span>
              <b style={{ fontFamily: "var(--font-heading)", fontSize: 12 }}>{unknown ? "no weight" : `${fmt(b.value!, digits)} ${unit}`}</b>
            </button>
          );
        })}
      </div>
      <details style={{ marginTop: 8 }}><summary style={{ cursor: "pointer", fontSize: 13 }}>Table alternative</summary>
        <div className="scroll"><table className="t"><caption className="sr-only">{label}</caption><thead><tr><th>Category</th><th>Records</th><th>Total ({unit})</th><th>Note</th></tr></thead>
          <tbody>{bars.map((b) => <tr key={b.key}><td>{b.label}</td><td>{fmt(b.count)}</td><td>{b.value == null ? <em>unknown</em> : fmt(b.value, digits)}</td><td>{b.note ?? ""}</td></tr>)}</tbody></table></div>
      </details>
    </div>
  );
}

// Daily/weekly/monthly columns; every column is a button that drills into that period.
export function Columns({ cols, unit, onPick, active, label }: { cols: { key: string; label: string; v: number; n: number }[]; unit: string; onPick?: (k: string) => void; active?: string | null; label: string }) {
  if (!cols.length) return <p className="msg warn">No dated records match these filters.</p>;
  const shown = cols.slice(-60); const max = Math.max(...shown.map((c) => c.v), 0.0001);
  return (
    <div>
      <div role="group" aria-label={label} style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 170, overflowX: "auto", borderBottom: "1px solid #ddd2b8", paddingTop: 6 }}>
        {shown.map((c) => (
          <button key={c.key} type="button" onClick={() => onPick?.(c.key)} aria-pressed={active === c.key} title={`${c.label}: ${fmt(c.v, 2)} ${unit}, ${c.n} records`} aria-label={`${c.label}: ${fmt(c.v, 2)} ${unit}, ${c.n} records`}
            style={{ flex: "1 0 10px", minWidth: 10, maxWidth: 40, height: `${Math.max(3, (c.v / max) * 100)}%`, background: active === c.key ? "#14233f" : "#17808a", border: 0, borderRadius: "2px 2px 0 0", padding: 0 }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555" }}><span>{shown[0].label}</span><span>peak {fmt(max, 2)} {unit}</span><span>{shown[shown.length - 1].label}</span></div>
      <details style={{ marginTop: 6 }}><summary style={{ cursor: "pointer", fontSize: 13 }}>Table alternative ({shown.length} periods)</summary>
        <div className="scroll" style={{ maxHeight: 240 }}><table className="t"><thead><tr><th>Period</th><th>Records</th><th>Net weight ({unit})</th></tr></thead><tbody>{[...shown].reverse().map((c) => <tr key={c.key}><td>{c.label}</td><td>{c.n}</td><td>{fmt(c.v, 2)}</td></tr>)}</tbody></table></div>
      </details>
    </div>
  );
}
