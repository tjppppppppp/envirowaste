import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "../components/shell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { backend } from "../lib/backend";
import { stats } from "../lib/analysis";
import { downloadCsv } from "../lib/csv";
import { BUILDINGS } from "../lib/demo";
import { fmt, setMode, useAudits, useRecords, useRole, useUser } from "../lib/store";

export const Route = createFileRoute("/audits")({
  head: () => ({ meta: [{ title: "Waste Audits — EnviroWaste" }, { name: "description", content: "Plan and record physical waste composition audits and compare them with available collection data." }] }),
  component: Audits,
});
const STATUSES = ["Planned", "In Progress", "Under Review", "Completed"];
const DEFAULT_CATS = ["Paper", "Cardboard", "Plastics", "Metals", "Glass", "Food waste", "Paper towels", "Other landfill waste"];

function Audits() {
  const { user } = useUser(); const { canWrite, role } = useRole(user); const { mode, records } = useRecords(); const { audits, reload } = useAudits(mode);
  const [cats, setCats] = useState(DEFAULT_CATS); const [newCat, setNewCat] = useState(""); const [kg, setKg] = useState<Record<string, string>>({});
  const [f, setF] = useState({ title: "", building: BUILDINGS[0], location: "", researchers: "", date: new Date().toISOString().slice(0, 10), status: "Planned", sample: "", method: "Physical measurement", contam: "", notes: "" });
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null); const [ready, setReady] = useState(false); const [sel, setSel] = useState<string | null>(null);
  useEffect(() => setReady(true), []);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    const sample = f.sample === "" ? null : Number(f.sample); const contam = f.contam === "" ? null : Number(f.contam);
    const meas = cats.map((c) => ({ name: c, kg: kg[c] === undefined || kg[c] === "" ? null : Number(kg[c]) }));
    const sum = meas.reduce((a, m) => a + (m.kg ?? 0), 0);
    if (sample != null && sum > sample * 1.001) { setMsg({ t: `Material weights (${fmt(sum, 2)} kg) exceed the sample weight (${fmt(sample, 2)} kg).`, err: true }); return; }
    const { error } = await backend.from("audits").insert({ title: f.title, building: f.building, location: f.location || null, researchers: f.researchers || null, audit_date: f.date, status: f.status, sample_weight_kg: sample, method: f.method, contamination_pct: contam, measurements: meas, notes: f.notes || null });
    if (error) { setMsg({ t: error.code === "42501" ? "Your role cannot create audits. Ask an administrator for the researcher role." : error.message, err: true }); return; }
    setMsg({ t: "Audit saved to your project records." }); setMode("project"); reload();
  };
  const cur = audits.find((a) => a.id === sel) ?? audits[0];
  const bs = cur ? stats(records.filter((r) => r.building === cur.building)) : null;
  const exp = () => { if (!cur) return; downloadCsv("audit.csv", [["audit", "building", "date", "status", "method", "material", "kg"], ...cur.measurements.map((m) => [cur.title, cur.building, cur.audit_date, cur.status, cur.method, m.name, m.kg])]); };
  const setStatus = async (id: string, s: string) => { const r = await backend.from("audits").update({ status: s }).eq("id", id); if (r.error) setMsg({ t: "Could not change status: " + r.error.message, err: true }); else reload(); };
  return (
    <AppShell title="Waste Audits" active="/audits">
      <p className="nx-lead">Record physical composition audits. Material weights you leave blank are saved as unknown, not zero.</p>
      <div className="grid row2">
        <form className="card" onSubmit={save}>
          <h2>New audit</h2>
          {!user && ready && <p className="msg warn" style={{ marginBottom: 8 }}><Link to="/sign-in" style={{ textDecoration: "underline" }}>Sign in</Link> to save audits.</p>}
          {user && !canWrite && <p className="msg warn" style={{ marginBottom: 8 }}>Your role is {role}; creating audits needs researcher or administrator.</p>}
          <div className="form">
            <div className="fld"><label htmlFor="a-t">Title</label><Input id="a-t" required maxLength={160} value={f.title} onChange={(e) => set("title", e.target.value)} /></div>
            <div className="fld"><label htmlFor="a-b">Building</label><select id="a-b" value={f.building} onChange={(e) => set("building", e.target.value)}>{BUILDINGS.map((b) => <option key={b}>{b}</option>)}</select></div>
            <div className="fld"><label htmlFor="a-l">Collection location</label><Input id="a-l" maxLength={200} value={f.location} onChange={(e) => set("location", e.target.value)} /></div>
            <div className="fld"><label htmlFor="a-r">Researchers</label><Input id="a-r" maxLength={300} value={f.researchers} onChange={(e) => set("researchers", e.target.value)} /></div>
            <div className="fld"><label htmlFor="a-d">Audit date</label><Input id="a-d" type="date" required value={f.date} onChange={(e) => set("date", e.target.value)} /></div>
            <div className="fld"><label htmlFor="a-s">Status</label><select id="a-s" value={f.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="fld"><label htmlFor="a-w">Sample weight (kg)</label><Input id="a-w" type="number" min="0" step="0.01" value={f.sample} onChange={(e) => set("sample", e.target.value)} /></div>
            <div className="fld"><label htmlFor="a-m">Observation method</label><select id="a-m" value={f.method} onChange={(e) => set("method", e.target.value)}><option>Physical measurement</option><option>Image review</option><option>Estimate</option></select></div>
            <div className="fld"><label htmlFor="a-c">Contamination (%)</label><Input id="a-c" type="number" min="0" max="100" step="0.1" value={f.contam} onChange={(e) => set("contam", e.target.value)} /></div>
          </div>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: "12px 0 6px" }}>Material measurements (kg)</h3>
          <div className="form" style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}>
            {cats.map((c) => <div className="fld" key={c}><label htmlFor={"k-" + c}>{c}</label><Input id={"k-" + c} type="number" min="0" step="0.01" value={kg[c] ?? ""} onChange={(e) => setKg({ ...kg, [c]: e.target.value })} /></div>)}
          </div>
          <div className="bar" style={{ margin: "8px 0" }}><label htmlFor="nc">Custom category</label><Input id="nc" style={{ width: 180 }} maxLength={60} value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <Button type="button" variant="outline" size="sm" onClick={() => { const c = newCat.trim(); if (c && !cats.includes(c)) setCats([...cats, c]); setNewCat(""); }}>Add category</Button></div>
          <div className="fld"><label htmlFor="a-n">Research notes</label><Textarea id="a-n" maxLength={3000} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
          {msg && <p className={"msg" + (msg.err ? " err" : "")} role="status" style={{ marginTop: 8 }}>{msg.t}</p>}
          <Button type="submit" style={{ marginTop: 10 }} disabled={!ready || !user || !canWrite}>Save audit</Button>
        </form>
        <div className="grid" style={{ alignContent: "start" }}>
          <div className="card"><h2>Audits ({mode === "demo" ? "demo" : "yours"})</h2>
            <div className="list">{audits.map((a) => <button key={a.id} aria-pressed={a.id === cur?.id} onClick={() => setSel(a.id)}>{a.title}<br /><small>{a.building} · {a.audit_date} · {a.status}</small></button>)}{audits.length === 0 && <p style={{ fontSize: 13 }}>No audits yet.</p>}</div></div>
          {cur && <div className="card"><h2>{cur.title}</h2>
            <p style={{ fontSize: 12 }}>{cur.method} · sample {cur.sample_weight_kg == null ? "unknown" : fmt(Number(cur.sample_weight_kg), 1) + " kg"} · contamination {cur.contamination_pct == null ? "unknown" : cur.contamination_pct + "%"}</p>
            <table className="t"><tbody>{cur.measurements.map((m) => <tr key={m.name}><td>{m.name}</td><td>{m.kg == null ? <em>unknown</em> : fmt(m.kg, 2) + " kg"}</td></tr>)}</tbody></table>
            {mode === "project" && <div className="fld" style={{ marginTop: 8 }}><label htmlFor="st">Status</label><select id="st" value={cur.status} onChange={(e) => setStatus(cur.id, e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>}
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: "10px 0 4px" }}>Compared with collection data</h3>
            <p style={{ fontSize: 12.5 }}>{bs && bs.n ? `${cur.building} has ${bs.n} attributed or unattributed-by-name records in this dataset totalling ${fmt(bs.total, 1)} t (${bs.missingWeight} without weights). ` : `No collection records name ${cur.building} in this dataset. `}This audit is a single sample; it does not show that the sampled composition applies to every pickup counted here.</p>
            <Button variant="outline" size="sm" style={{ marginTop: 8 }} onClick={exp}>Export audit CSV</Button></div>}
        </div>
      </div>
    </AppShell>
  );
}
