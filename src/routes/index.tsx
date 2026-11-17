import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { CalendarDays, Building2, CheckCircle2, AlertTriangle, Lightbulb, ArrowRight } from "lucide-react";
import { AppShell, Tag } from "../components/shell";
import { LineChart, StackBar, COMP_COLORS } from "../components/charts";
import { composition, stats, weekly, weekStart } from "../lib/analysis";
import { BUILDINGS, ROUTES, SOURCES, STREAMS } from "../lib/demo";
import { fmt, useAudits, useDriverEntries, useRecords } from "../lib/store";
import { Columns, HBars } from "../components/breakdown";
import { downloadCsv } from "../lib/csv";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Overview — EnviroWaste" }, { name: "description", content: "Collection trends, attribution completeness, measured composition and data quality for campus waste research." }] }),
  component: Overview,
});

export function Overview() {
  const { mode, records, signedIn } = useRecords();
  const { audits } = useAudits(mode);
  const [range, setRange] = useState("all"); const [b, setB] = useState(""); const [rt, setRt] = useState(""); const [ct, setCt] = useState(""); const [src, setSrc] = useState("");
  const [streams, setStreams] = useState<string[]>(["landfill", "recycling", "compost"]);
  const [grain, setGrain] = useState<"day" | "week" | "month">("week"); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [drill, setDrill] = useState<{ kind: "building" | "period" | "stream" | "source" | "unknown"; key: string } | null>(null);
  const toggle = (s: string) => setStreams((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));
  const filtered = useMemo(() => {
    const cut = range === "all" ? "" : (() => { const d = new Date(); d.setDate(d.getDate() - Number(range)); return d.toISOString().slice(0, 10); })();
    return records.filter((r) => (!cut || (r.date && r.date >= cut)) && (!b || r.building === b) && (!rt || r.route === rt) && (!ct || r.container === ct) && (!src || r.source === src) && (!from || (r.date && r.date >= from)) && (!to || (r.date && r.date <= to)) && (streams.includes(r.stream) || !STREAMS.includes(r.stream)));
  }, [records, range, b, rt, ct, src, streams, from, to]);
  const st = stats(filtered); const wk = weekly(filtered); const comp = composition(audits);
  const containers = [...new Set(records.map((r) => r.container).filter(Boolean))].sort();
  const buildings = [...new Set([...BUILDINGS, ...records.map((r) => r.building).filter(Boolean) as string[]])].sort();
  const pct = st.pctUnknown;
  const { entries: driver, signedIn: dSigned } = useDriverEntries(mode === "demo");
  const key = (d: string) => grain === "day" ? d : grain === "week" ? weekStart(d) : d.slice(0, 7);
  const cols = useMemo(() => { const m = new Map<string, { v: number; n: number }>(); for (const r of filtered) { if (!r.date || r.weight == null) continue; const k = key(r.date); const e = m.get(k) ?? { v: 0, n: 0 }; e.v += r.weight; e.n++; m.set(k, e); } return [...m.entries()].sort((a, c) => a[0].localeCompare(c[0])).map(([k, v]) => ({ key: k, label: grain === "week" ? "wk " + k : k, ...v })); }, [filtered, grain]);
  const byB = useMemo(() => { const m = new Map<string, { v: number; n: number; w: number }>(); for (const r of filtered) { if (!r.building) continue; const e = m.get(r.building) ?? { v: 0, n: 0, w: 0 }; e.n++; if (r.weight != null) { e.v += r.weight; e.w++; } m.set(r.building, e); } return [...m.entries()].sort((a, c) => c[1].v - a[1].v).map(([k, v]) => ({ key: k, label: k, value: v.w ? v.v : null, count: v.n, note: v.w < v.n ? `${v.n - v.w} without weight` : "" })); }, [filtered]);
  const bySrc = useMemo(() => { const m = new Map<string, { v: number; n: number; w: number }>(); for (const r of filtered) { const e = m.get(r.source) ?? { v: 0, n: 0, w: 0 }; e.n++; if (r.weight != null) { e.v += r.weight; e.w++; } m.set(r.source, e); } return [...m.entries()]; }, [filtered]);
  const withWeight = filtered.filter((r) => r.weight != null).length;
  const trend = (() => { if (grain !== "week" || cols.length < 8) return null; const a = cols.slice(-4).reduce((x, c) => x + c.v, 0), c0 = cols.slice(-8, -4).reduce((x, c) => x + c.v, 0); return c0 > 0 ? ((a - c0) / c0) * 100 : null; })();
  const drilled = useMemo(() => !drill ? [] : filtered.filter((r) => drill.kind === "building" ? (drill.key ? r.building === drill.key : !!r.building) : drill.kind === "period" ? !!r.date && key(r.date) === drill.key : drill.kind === "stream" ? r.stream === drill.key : drill.kind === "source" ? r.source === drill.key : !r.building), [drill, filtered, grain]);
  const dTot = driver.reduce((a, e) => a + e.net_kg, 0);
  const empty = records.length === 0;
  return (
    <AppShell title="Overview" active="/">
      {empty && <p className="msg warn">{signedIn ? "No project records yet. Import a CSV in Waste Explorer." : "Project mode shows your private uploads. Sign in and import a CSV, or switch to Demo."}</p>}
      {!empty && mode === "project" && bySrc.some(([k]) => k === "Imported CSV") && (
        <p className="msg warn" style={{ fontSize: 13 }}>
          <b>Data quality notice:</b> Imported records include LoadMan-derived data where building attribution was inferred from route or ticket data, not confirmed by F&amp;S staff.
          Building totals and attribution rates below reflect this uncertainty.
          <Tag k="HIST" /> = historical record with unverified building attribution.
          KPIs requiring verified weights (diversion rate, recycling rate, contamination rate) are not calculated from this data.
        </p>
      )}
      {!empty && mode === "demo" && (
        <p className="msg" style={{ fontSize: 13, borderColor: "#17808a" }}>
          <b>Demo data — not operational records.</b> KPI tiles show counts and totals from synthetic demonstration records only.
          No diversion rate, recycling rate or contamination rate is calculated because the required verified stream weights are unavailable.
        </p>
      )}
      <div className="bar" aria-label="Filters">
        <label className="ctl" style={{ display: "flex", gap: 6, alignItems: "center" }}><CalendarDays size={16} aria-hidden /><span className="sr-only">Date range</span>
          <select aria-label="Date range" value={range} onChange={(e) => setRange(e.target.value)} style={{ border: 0, background: "none" }}><option value="all">Full range</option><option value="30">Last 30 days</option><option value="60">Last 60 days</option></select></label>
        <label className="ctl" style={{ display: "flex", gap: 6, alignItems: "center" }}><Building2 size={16} aria-hidden />
          <select aria-label="Building" value={b} onChange={(e) => setB(e.target.value)} style={{ border: 0, background: "none" }}><option value="">All buildings</option>{buildings.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label style={{ fontSize: 13 }}>From <input type="date" className="ctl" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
        <label style={{ fontSize: 13 }}>To <input type="date" className="ctl" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        {(from || to || b || rt || ct || src || range !== "all") && <Button variant="outline" size="sm" onClick={() => { setFrom(""); setTo(""); setB(""); setRt(""); setCt(""); setSrc(""); setRange("all"); setDrill(null); }}>Reset filters</Button>}
        <span>Streams:</span>
        {STREAMS.map((s) => <button key={s} className="chip" aria-pressed={streams.includes(s)} onClick={() => toggle(s)}>{s}</button>)}
        <select aria-label="Route" value={rt} onChange={(e) => setRt(e.target.value)}><option value="">Route</option>{ROUTES.map((x) => <option key={x}>{x}</option>)}</select>
        <select aria-label="Container" value={ct} onChange={(e) => setCt(e.target.value)}><option value="">Container</option>{containers.map((x) => <option key={x}>{x}</option>)}</select>
        <select aria-label="Source" value={src} onChange={(e) => setSrc(e.target.value)}><option value="">Source</option>{[...SOURCES, "Imported CSV"].map((x) => <option key={x}>{x}</option>)}</select>
      </div>
      <section className="grid kpis kpis6" aria-label="Headline metrics">
        <div className="card kpi" style={{ gridColumn: "span 2" }}><Tag k="REC" />{mode === "project" && withWeight > 0 && <Tag k="HIST" />}<b style={{ fontSize: 34 }}>{withWeight === 0 ? "No data" : `${fmt(st.total, 1)} t`}</b><span className="l">Recorded total net weight</span><small style={{ display: "block" }}>{withWeight === 0 ? "No record in this selection has a weight." : `From ${fmt(withWeight)} of ${fmt(st.n)} records with a weight; records without one are not counted as zero.`}{mode === "project" && withWeight > 0 ? " Source: imported records — building attribution unverified." : ""}</small></div>
        <button type="button" className="card kpi" style={{ textAlign: "left" }} onClick={() => setDrill(null)}><Tag k="CALC" /><b>{empty ? "—" : fmt(st.n)}</b><span className="l">Collection records</span></button>
        <button type="button" className="card kpi" style={{ textAlign: "left" }} disabled={!st.attributed} onClick={() => setDrill({ kind: "building", key: "" })}><Tag k={mode === "project" ? "HIST" : "REC"} /><b>{empty ? "—" : fmt(st.attributed)}</b><span className="l">Attributed to a building{mode === "project" ? " (unverified)" : ""}</span></button>
        <button type="button" className="card kpi hatch" style={{ textAlign: "left" }} disabled={!st.unknown} onClick={() => setDrill({ kind: "unknown", key: "" })}><Tag k="UNK" /><b>{empty ? "—" : fmt(st.unknown)}</b><span className="l">Unknown building (show records)</span></button>
        <div className="card kpi"><Tag k="CALC" /><b>{audits.length}</b><span className="l">Audits</span></div>
      </section>
      <section className="grid kpis kpis3" aria-label="Rate metrics — require verified stream weights">
        <div className="card kpi kpi-gate"><b style={{ fontSize: 20, color: "#57606a" }}>—</b><span className="l">Diversion rate</span><small>Requires verified weights for recycling, compost, and landfill streams from the same period and scope. <a href="/audits" style={{ color: "inherit", textDecoration: "underline" }}>Add a waste audit</a> to begin.</small></div>
        <div className="card kpi kpi-gate"><b style={{ fontSize: 20, color: "#57606a" }}>—</b><span className="l">Recycling rate</span><small>Requires verified recycling and landfill stream weights for the same scope.</small></div>
        <div className="card kpi kpi-gate"><b style={{ fontSize: 20, color: "#57606a" }}>—</b><span className="l">Contamination rate</span><small>Requires a waste audit with per-item stream classification. Not inferred from imported records.</small></div>
      </section>
      <section className="grid row2">
        <div className="card">
          <div className="bar" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0 }}>Net weight by period <Tag k="REC" /></h2>
            <div role="group" aria-label="Chart period">{(["day", "week", "month"] as const).map((g) => <Button key={g} size="sm" variant={grain === g ? "default" : "outline"} aria-pressed={grain === g} onClick={() => { setGrain(g); setDrill(null); }}>{g === "day" ? "Daily" : g === "week" ? "Weekly" : "Monthly"}</Button>)}</div></div>
          <p style={{ fontSize: 12, margin: "4px 0" }}>Tonnes from the records matching the filters. Select a column to list its records.</p>
          <Columns cols={cols} unit="t" label={`Net weight per ${grain}`} active={drill?.kind === "period" ? drill.key : null} onPick={(k) => setDrill({ kind: "period", key: k })} />
          <p style={{ fontSize: 12, marginTop: 6 }}>{trend == null ? "Trend: not shown. It needs at least 8 weeks of weighed records on the weekly view." : `Trend: last 4 weeks ${trend >= 0 ? "up" : "down"} ${fmt(Math.abs(trend), 0)}% vs the 4 weeks before (recorded weights only; not a cause).`}</p>
        </div>
        <div className="card">
          <h2>Net weight by building <Tag k="REC" /></h2>
          <p style={{ fontSize: 12, marginBottom: 6 }}>Only records with a recorded building. Select a bar to list its records.{st.unknown ? ` ${fmt(st.unknown)} records have no building and are not included.` : ""}</p>
          <HBars bars={byB.slice(0, 12)} unit="t" label="Net weight by building" active={drill?.kind === "building" ? drill.key : null} onPick={(k) => setDrill({ kind: "building", key: k })} />
        </div>
      </section>
      {drill && <section className="card" id="drilldown" aria-live="polite">
        <div className="bar" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0 }}>Underlying records — {drill.kind === "unknown" ? "unknown building" : drill.key || "all attributed"} ({fmt(drilled.length)})</h2>
          <span><Button size="sm" variant="outline" onClick={() => downloadCsv("overview-drilldown.csv", [["date", "weight_t", "building", "stream", "container", "source"], ...drilled.map((r) => [r.date, r.weight, r.building, r.stream, r.container, r.source])])}>Export CSV</Button> <Button size="sm" variant="outline" onClick={() => setDrill(null)}>Close</Button></span></div>
        <div className="scroll" style={{ maxHeight: 320 }}><table className="t"><thead><tr><th>Date</th><th>Weight (t)</th><th>Building</th><th>Stream</th><th>Container</th><th>Source</th></tr></thead>
          <tbody>{drilled.slice(0, 100).map((r, i) => <tr key={i}><td>{r.date || <em>unknown</em>}</td><td>{r.weight == null ? <em>unknown</em> : fmt(r.weight, 3)}</td><td>{r.building ?? <em>unknown</em>}</td><td>{r.stream}</td><td>{r.container || <em>unknown</em>}</td><td>{r.source}</td></tr>)}</tbody></table></div>
        {drilled.length > 100 && <p style={{ fontSize: 12 }}>Showing the first 100 of {fmt(drilled.length)}; export for all.</p>}
      </section>}
      <section className="card">
        <h2>Sources and measurement types</h2>
        <p style={{ fontSize: 13 }}>Each source is counted on its own and never added to another: two sources can describe the same pickup, and no verified matching between them exists, so totals are not combined.</p>
        <div className="scroll"><table className="t"><thead><tr><th>Source</th><th>Records</th><th>With weight</th><th>Net weight</th><th>Measurement type</th><th /></tr></thead><tbody>
          {bySrc.map(([k, v]) => <tr key={k}><td>{k}</td><td>{fmt(v.n)}</td><td>{fmt(v.w)}</td><td>{v.w ? `${fmt(v.v, 1)} t` : <em>no data</em>}</td><td>{k === "Imported CSV" ? "Imported weigh-ticket/truck weight, normalized to tonnes" : k === "LoadMan export" ? "Truck weigh records (synthetic example)" : "Driver log (synthetic example)"}</td><td><Button size="sm" variant="outline" onClick={() => setDrill({ kind: "source", key: k })}>Records</Button></td></tr>)}
          <tr><td>Collection Log driver entries ({mode === "demo" ? "synthetic demo" : "project"})</td><td>{dSigned ? fmt(driver.length) : "—"}</td><td>{dSigned ? fmt(driver.length) : "—"}</td><td>{!dSigned ? <em>sign in to see</em> : driver.length ? `${fmt(dTot / 1000, 2)} t (${fmt(dTot, 0)} kg)` : <em>no data</em>}</td><td>Driver-entered full minus empty weight (net), converted to kg</td><td><Link to="/explorer" className="chip">Open</Link></td></tr>
        </tbody></table></div>
        {bySrc.length === 0 && <p style={{ fontSize: 13 }}>No imported records in this selection: unknown / no data, not zero.</p>}
      </section>
      <section className="grid row2">
        <div className="card">
          <h2>Attribution Completeness</h2>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: "8px 0 4px" }}>Attribution Completeness (Weekly)</h3>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="stack" style={{ flex: 1 }} role="img" aria-label={pct == null ? "Unknown share not available" : `${fmt(pct, 1)}% of records unknown`}>
              <div style={{ width: `${pct == null ? 0 : 100 - pct}%`, background: "#17808a" }} /><div className="hatch" style={{ flex: 1, border: "1px solid #14233f55" }} />
            </div>
            <b style={{ fontFamily: "var(--font-heading)", fontSize: 15 }}>{pct == null ? "—" : `${fmt(pct, 1)}% Unknown`}</b>
          </div>
        </div>
        <div className="card">
          <h2>Measured Composition (by Building)</h2>
          {comp.rows.length === 0 ? <p className="msg warn">No audit measurements yet. Unknown is not shown as zero; add an audit in Waste Audits.</p> :
            <div style={{ display: "grid", gap: 10 }}>{comp.rows.map((r) => <div key={r.building}><div style={{ fontSize: 12, fontFamily: "var(--font-heading)", marginBottom: 2 }}>{r.building} <Tag k="REC" /></div><StackBar pct={r.pct} unknown={r.unknown} /></div>)}</div>}
          <div className="legend" style={{ marginTop: 12 }}>
            {["Paper", "Plastic", "Organics", "Other"].map((c, i) => <Fragment key={c}><span key={c + "d"} className="dot" style={{ background: COMP_COLORS[i] }} /><span key={c}>{c}</span><span key={c + "v"}>{comp.rows.length ? `${fmt(comp.rows.reduce((a, r) => a + (r.pct[i] ?? 0), 0) / comp.rows.length, 1)}%` : "—"}</span></Fragment>)}
            <span className="dot hatch" style={{ border: "1px solid #14233f88" }} /><span>Unknown</span><span>{comp.rows.length ? `${fmt(comp.rows.reduce((a, r) => a + r.unknown, 0) / comp.rows.length, 1)}%` : "—"}</span>
          </div>
        </div>
      </section>
      <section className="grid row3">
        <div className="card">
          <h2>Data Quality Checklist</h2>
          <ul className="check">
            <li><CheckCircle2 size={20} color="#17808a" aria-hidden />Date range is valid<span className="s">{st.missingDate ? `${st.missingDate} missing` : "OK"}</span></li>
            <li><CheckCircle2 size={20} color="#17808a" aria-hidden />Building mappings found<span className="s">{st.attributed ? "OK" : "None"}</span></li>
            <li className={st.unknown ? "warn" : ""}><AlertTriangle size={20} color="#dba73a" aria-hidden />Unknown building records ({fmt(st.unknown)})<span className="s">Review</span></li>
            <li><CheckCircle2 size={20} color="#17808a" aria-hidden />Duplicate records ({st.dup})<span className="s">{st.dup ? "Review" : "OK"}</span></li>
            <li><CheckCircle2 size={20} color="#17808a" aria-hidden />Weight units normalized (tonnes)<span className="s">OK</span></li>
          </ul>
        </div>
        <div className="sugg">
          <div className="hd"><Lightbulb size={20} aria-hidden /> Suggestion · Under Investigation</div>
          <div className="bd">
            <p>{pct == null ? "Load records to see attribution findings." : `A substantial portion (${fmt(pct, 1)}%) of records remain unattributed to a specific building. Consider reviewing source data mappings or expanding building lookup rules.`}</p>
            <hr style={{ margin: "10px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
              <span>Related: {fmt(st.unknown)} unknown building records</span>
              <Link to="/insights" className="chip" style={{ borderRadius: 4, display: "inline-flex", gap: 6, alignItems: "center", borderColor: "#14233f" }}>View Details <ArrowRight size={14} aria-hidden /></Link>
            </div>
          </div>
        </div>
        <div className="stamp" aria-hidden><b>RESEARCH</b><small>ENVIROWASTE<br />UIUC · {new Date().getFullYear()}</small></div>
      </section>
    </AppShell>
  );
}
