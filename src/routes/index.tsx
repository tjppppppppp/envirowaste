import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, Building2, CheckCircle2, AlertTriangle, Lightbulb, ArrowRight } from "lucide-react";
import { AppShell, Tag } from "../components/shell";
import { LineChart, StackBar, COMP_COLORS } from "../components/charts";
import { composition, stats, weekly } from "../lib/analysis";
import { BUILDINGS, ROUTES, SOURCES, STREAMS } from "../lib/demo";
import { fmt, useAudits, useRecords } from "../lib/store";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Overview — EnviroWaste" }, { name: "description", content: "Collection trends, attribution completeness, measured composition and data quality for campus waste research." }] }),
  component: Overview,
});

export function Overview() {
  const { mode, records, signedIn } = useRecords();
  const { audits } = useAudits(mode);
  const [range, setRange] = useState("all"); const [b, setB] = useState(""); const [rt, setRt] = useState(""); const [ct, setCt] = useState(""); const [src, setSrc] = useState("");
  const [streams, setStreams] = useState<string[]>(["landfill", "recycling", "compost"]);
  const toggle = (s: string) => setStreams((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));
  const filtered = useMemo(() => {
    const cut = range === "all" ? "" : (() => { const d = new Date(); d.setDate(d.getDate() - Number(range)); return d.toISOString().slice(0, 10); })();
    return records.filter((r) => (!cut || (r.date && r.date >= cut)) && (!b || r.building === b) && (!rt || r.route === rt) && (!ct || r.container === ct) && (!src || r.source === src) && (streams.includes(r.stream) || !STREAMS.includes(r.stream)));
  }, [records, range, b, rt, ct, src, streams]);
  const st = stats(filtered); const wk = weekly(filtered); const comp = composition(audits);
  const containers = [...new Set(records.map((r) => r.container).filter(Boolean))].sort();
  const buildings = [...new Set([...BUILDINGS, ...records.map((r) => r.building).filter(Boolean) as string[]])].sort();
  const pct = st.pctUnknown;
  const empty = records.length === 0;
  return (
    <AppShell title="Overview" active="/">
      {empty && <p className="msg warn">{signedIn ? "No project records yet. Import a CSV in Waste Explorer." : "Project mode shows your private uploads. Sign in and import a CSV, or switch to Demo."}</p>}
      <div className="bar" aria-label="Filters">
        <label className="ctl" style={{ display: "flex", gap: 6, alignItems: "center" }}><CalendarDays size={16} aria-hidden /><span className="sr-only">Date range</span>
          <select aria-label="Date range" value={range} onChange={(e) => setRange(e.target.value)} style={{ border: 0, background: "none" }}><option value="all">Full range</option><option value="30">Last 30 days</option><option value="60">Last 60 days</option></select></label>
        <label className="ctl" style={{ display: "flex", gap: 6, alignItems: "center" }}><Building2 size={16} aria-hidden />
          <select aria-label="Building" value={b} onChange={(e) => setB(e.target.value)} style={{ border: 0, background: "none" }}><option value="">All buildings</option>{buildings.map((x) => <option key={x}>{x}</option>)}</select></label>
        <span>Streams:</span>
        {STREAMS.map((s) => <button key={s} className="chip" aria-pressed={streams.includes(s)} onClick={() => toggle(s)}>{s}</button>)}
        <select aria-label="Route" value={rt} onChange={(e) => setRt(e.target.value)}><option value="">Route</option>{ROUTES.map((x) => <option key={x}>{x}</option>)}</select>
        <select aria-label="Container" value={ct} onChange={(e) => setCt(e.target.value)}><option value="">Container</option>{containers.map((x) => <option key={x}>{x}</option>)}</select>
        <select aria-label="Source" value={src} onChange={(e) => setSrc(e.target.value)}><option value="">Source</option>{[...SOURCES, "Imported CSV"].map((x) => <option key={x}>{x}</option>)}</select>
      </div>
      <section className="grid kpis" aria-label="Key figures">
        <div className="card kpi"><Tag k="REC" /><b>{empty ? "—" : `${fmt(st.total, 1)} t`}</b><span className="l">Total Recorded</span></div>
        <div className="card kpi"><Tag k="CALC" /><b>{empty ? "—" : fmt(st.n)}</b><span className="l">Pickups</span></div>
        <div className="card kpi"><Tag k="REC" /><b>{empty ? "—" : fmt(st.attributed)}</b><span className="l">Attributed</span></div>
        <div className="card kpi hatch"><Tag k="UNK" /><b>{empty ? "—" : fmt(st.unknown)}</b><span className="l">Unknown Building</span></div>
        <div className="card kpi"><Tag k="CALC" /><b>{audits.length}</b><span className="l">Audits</span></div>
      </section>
      <section className="grid row2">
        <div className="card">
          <h2>Weekly Tonnage Trend <Tag k="REC" /></h2>
          <LineChart points={wk.map((w) => ({ label: w.week, v: w.w }))} />
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
            {["Paper", "Plastic", "Organics", "Other"].map((c, i) => <><span key={c + "d"} className="dot" style={{ background: COMP_COLORS[i] }} /><span key={c}>{c}</span><span key={c + "v"}>{comp.rows.length ? `${fmt(comp.rows.reduce((a, r) => a + (r.pct[i] ?? 0), 0) / comp.rows.length, 1)}%` : "—"}</span></>)}
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
