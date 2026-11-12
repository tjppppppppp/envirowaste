import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/shell";
import { Button } from "../components/ui/button";
import { backend } from "../lib/backend";
import { FIELDS, normDate, normWeight, parseCsv, suggest, downloadCsv } from "../lib/csv";
import { fmt, useAudits, useMode, useRole, useUser } from "../lib/store";

export const Route = createFileRoute("/explorer")({
  head: () => ({ meta: [{ title: "Waste Explorer — EnviroWaste" }, { name: "description", content: "Import a LoadMan-style CSV or Excel (.xlsx) file, map columns, validate, flag duplicates and save normalized records privately." }] }),
  component: Explorer,
});

type Prep = { row: number; original: Record<string, string>; date: string | null; kg: number | null; building: string | null; container: string | null; stream: string | null; dup: boolean; missing: string[]; notes: string[] };
const SAMPLE = `Ticket Date,Net Weight,Unit,Facility,Bin ID,Material
3/4/2026,2410,lb,Grainger Library,C-10,landfill
3/4/2026,2410,lb,Grainger Library,C-10,landfill
03/05/2026,1.1,tons,Illini Union,C-21,recycling
2026-03-06,860,kg,,,landfill
2026-03-07,,kg,Siebel Center,C-31,compost
13/45/2026,500,kg,ARC,,landfill
`;

function Explorer() {
  const { user } = useUser(); const { role, org, setOrg, canWrite } = useRole(user);
  const [name, setName] = useState(""); const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<string, string>>({}); const [defUnit, setDefUnit] = useState("kg");
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null); const [saving, setSaving] = useState(false);
  const [batches, setBatches] = useState<any[]>([]); const [n, setN] = useState(0); const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  useEffect(() => { if (user) backend.from("import_batches").select("id,filename,created_at,summary").order("created_at", { ascending: false }).then(({ data }) => setBatches(data ?? [])); }, [user?.id, n]);
  const headers = rows[0] ?? [];
  const load = (text: string, fname: string) => {
    const r = parseCsv(text); if (r.length < 2) { setMsg({ t: "That file has no data rows.", err: true }); return; }
    setRows(r); setName(fname); setMap(suggest(r[0])); setMsg(null);
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return; if (f.size > 5_000_000) { setMsg({ t: "Files over 5 MB are not accepted.", err: true }); return; }
    if (/\.xlsx$/i.test(f.name)) {
      try {
        const buf = new Uint8Array(await f.slice(0, 4).arrayBuffer());
        if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error("not a zip");
        const { readSheet } = await import("read-excel-file/browser");
        const sheet = await readSheet(f);
        const cell = (c: any) => c == null ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : String(c);
        const r = sheet.map((row: any[]) => row.map(cell)).filter((row: string[]) => row.some((x) => x.trim()));
        if (r.length < 2) { setMsg({ t: "The first sheet has no data rows.", err: true }); return; }
        setRows(r); setName(f.name); setMap(suggest(r[0])); setMsg({ t: "Read the first sheet of " + f.name + ". Check the column mapping below." });
      } catch { setMsg({ t: "That file could not be read as a valid .xlsx workbook. Save it as .xlsx or CSV and try again.", err: true }); }
      return;
    }
    if (!/\.csv$/i.test(f.name)) { setMsg({ t: "Supported files: .xlsx and .csv (legacy .xls is not supported; save it as .xlsx or CSV).", err: true }); return; }
    load(await f.text(), f.name);
  };
  const prep: Prep[] = useMemo(() => {
    if (rows.length < 2) return [];
    const idx = (k: string) => headers.indexOf(map[k] ?? "\u0000"); const seen = new Set<string>();
    return rows.slice(1, 5001).map((r, i) => {
      const original: Record<string, string> = {}; headers.forEach((h, j) => (original[h] = r[j] ?? ""));
      const g = (k: string) => (idx(k) >= 0 ? (r[idx(k)] ?? "").trim() : "");
      const notes: string[] = []; const missing: string[] = [];
      const d = normDate(g("date")); if (d.note) notes.push(d.note); if (!d.iso) missing.push(g("date") ? "date unreadable" : "date");
      const w = normWeight(g("weight"), g("unit") || defUnit); if (w.note) notes.push(w.note); if (w.kg == null) missing.push("weight");
      const building = g("building") || null, container = g("container") || null, stream = (g("stream") || "").toLowerCase() || null;
      if (!building) missing.push("building"); if (!container) missing.push("container"); if (!stream) missing.push("stream");
      const key = [d.iso, w.kg, building, container, stream].join("|"); const dup = seen.has(key); seen.add(key);
      return { row: i + 2, original, date: d.iso, kg: w.kg, building, container, stream, dup, missing, notes };
    });
  }, [rows, map, defUnit]);
  const q = {
    total: prep.length, valid: prep.filter((p) => p.date && p.kg != null).length, ts: prep.filter((p) => p.date).length,
    cont: prep.filter((p) => p.container).length, bld: prep.filter((p) => p.building).length, dup: prep.filter((p) => p.dup).length,
    inv: prep.filter((p) => !p.date || p.kg == null || p.dup).length,
  };
  const save = async () => {
    if (!user) return; setSaving(true); setMsg(null);
    const summary = { ...q, defaultUnit: defUnit };
    const b = await backend.from("import_batches").insert({ filename: name, headers, mapping: map, summary, organization: org || null }).select("id").single();
    if (b.error) { setSaving(false); setMsg({ t: b.error.code === "42501" ? "Your role cannot import records. Ask an administrator for the researcher role." : "Could not save: " + b.error.message, err: true }); return; }
    for (let i = 0; i < prep.length; i += 400) {
      const chunk = prep.slice(i, i + 400).map((p) => ({ batch_id: b.data.id, row_index: p.row, original: p.original, record_date: p.date, weight_kg: p.kg, building: p.building, container: p.container, stream: p.stream, is_duplicate: p.dup, missing: p.missing, transformations: p.notes }));
      const r = await backend.from("import_records").insert(chunk);
      if (r.error) { await backend.from("import_batches").delete().eq("id", b.data.id); setSaving(false); setMsg({ t: "Could not save records: " + r.error.message, err: true }); return; }
    }
    setSaving(false); setMsg({ t: `Saved ${prep.length} records from ${name}. Originals are preserved with each transformation recorded. Switch to Project mode to explore them.` }); setRows([]); setN(n + 1);
  };
  const exportCsv = () => {
    const out = [["row", "date", "weight_kg", "building", "container", "stream", "duplicate", "missing", "transformations"], ...prep.map((p) => [p.row, p.date, p.kg, p.building, p.container, p.stream, p.dup ? "yes" : "no", p.missing.join("; "), p.notes.join("; ")])];
    downloadCsv("normalized-" + (name || "records.csv"), out);
  };
  return (
    <AppShell title="Waste Explorer" active="/explorer">
      <p className="nx-lead">Import a LoadMan-style CSV or Excel (.xlsx) file, confirm the column mapping, review validation, then save. Originals are kept untouched; every change is recorded. Missing values stay missing, never zero.</p>
      {!user && ready && <p className="msg warn">You can parse and preview without an account. <Link to="/sign-in" style={{ textDecoration: "underline" }}>Sign in</Link> to save records privately.</p>}
      {user && !canWrite && <p className="msg warn">Your role is {role}. Importing needs the researcher or administrator role, set by an administrator in Settings.</p>}
      <div className="card">
        <h2>1. Upload</h2>
        <div className="bar">
          <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="CSV or Excel file" data-ready={ready} onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => load(SAMPLE, "sample-loadman.csv")}>Load a small example file</Button>
        </div>
        {msg && <p className={"msg" + (msg.err ? " err" : "")} role="status" style={{ marginTop: 8 }}>{msg.t}</p>}
      </div>
      {rows.length > 1 && (<>
        <div className="card">
          <h2>2. Map columns <span style={{ fontSize: 12, fontWeight: 400 }}>— {name}, {rows.length - 1} rows (suggested automatically)</span></h2>
          <div className="form" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
            {FIELDS.map((f) => <div className="fld" key={f.key}><label htmlFor={"m-" + f.key}>{f.label}</label>
              <select id={"m-" + f.key} value={map[f.key] ?? ""} onChange={(e) => setMap({ ...map, [f.key]: e.target.value })}><option value="">Not in file</option>{headers.map((h) => <option key={h}>{h}</option>)}</select></div>)}
            <div className="fld"><label htmlFor="du">Weight unit when no unit column</label>
              <select id="du" value={defUnit} onChange={(e) => setDefUnit(e.target.value)}><option value="kg">kilograms</option><option value="lb">pounds</option><option value="short ton">short tons</option><option value="tonne">metric tonnes</option></select></div>
          </div>
        </div>
        <div className="card">
          <h2>3. Validate</h2>
          <div className="grid kpis" style={{ marginBottom: 10 }}>
            {[["Total records", q.total], ["Valid records", q.valid], ["Usable timestamps", q.ts], ["Container IDs", q.cont], ["With buildings", q.bld], ["Duplicates", q.dup], ["Need investigation", q.inv]].map(([l, v]) => <div key={l as string} className="card kpi"><b style={{ fontSize: 22 }}>{v}</b><span className="l">{l}</span></div>)}
          </div>
          <div className="scroll"><table className="t"><thead><tr><th>Row</th><th>Date</th><th>kg</th><th>Building</th><th>Container</th><th>Stream</th><th>Flags</th><th>Transformations</th></tr></thead>
            <tbody>{prep.slice(0, 25).map((p) => <tr key={p.row}><td>{p.row}</td><td>{p.date ?? <em>unknown</em>}</td><td>{p.kg ?? <em>unknown</em>}</td><td>{p.building ?? <em>unknown</em>}</td><td>{p.container ?? <em>unknown</em>}</td><td>{p.stream ?? <em>unknown</em>}</td><td>{[p.dup && "duplicate", ...p.missing.map((m) => "missing " + m)].filter(Boolean).join(", ")}</td><td>{p.notes.join("; ")}</td></tr>)}</tbody></table></div>
          {prep.length > 25 && <p style={{ fontSize: 12, marginTop: 6 }}>Showing first 25 of {prep.length}. Files over 5,000 rows are cut to the first 5,000.</p>}
          <div className="bar" style={{ marginTop: 10 }}>
            <Button onClick={save} disabled={!ready || saving || !user || !canWrite || q.total === 0}>{saving ? "Saving…" : "Save to my records"}</Button>
            <Button variant="outline" onClick={exportCsv}>Export normalized CSV</Button>
            <label>Organization <input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="optional" maxLength={120} /></label>
          </div>
        </div>
      </>)}
      <DriverEntries />
      {user && <div className="card"><h2>Your saved imports</h2>
        {batches.length === 0 ? <p style={{ fontSize: 13 }}>None yet.</p> : <div className="scroll"><table className="t"><thead><tr><th>File</th><th>Saved</th><th>Records</th><th>Duplicates</th><th>Need investigation</th></tr></thead><tbody>{batches.map((b) => <tr key={b.id}><td>{b.filename}</td><td>{new Date(b.created_at).toLocaleDateString()}</td><td>{fmt(b.summary?.total ?? 0)}</td><td>{b.summary?.dup ?? 0}</td><td>{b.summary?.inv ?? 0}</td></tr>)}</tbody></table></div>}
      </div>}
    </AppShell>
  );
}

type DE = { id: string; entered_at: string; is_demo: boolean; truck: string; route: string; material: string; building: string | null; container: string | null; net_kg: number; work_order_status: string };
function DriverEntries() {
  const mode = useMode(); const demo = mode === "demo"; const { user } = useUser(); const { role } = useRole(user); const { audits } = useAudits(mode);
  const [es, setEs] = useState<DE[]>([]); const [err, setErr] = useState("");
  useEffect(() => {
    if (!user) { setEs([]); return; }
    backend.from("collection_entries").select("id,entered_at,is_demo,truck,route,material,building,container,net_kg,work_order_status").eq("is_demo", demo).order("entered_at", { ascending: false }).limit(2000)
      .then(({ data, error }) => { setErr(error ? error.message : ""); setEs((data ?? []).map((r: any) => ({ ...r, net_kg: Number(r.net_kg) }))); });
  }, [user?.id, demo]);
  const tot = es.reduce((a, e) => a + (isFinite(e.net_kg) ? e.net_kg : 0), 0);
  const withB = es.filter((e) => e.building); const noB = es.length - withB.length;
  const by = new Map<string, { n: number; kg: number; mats: Set<string> }>();
  for (const e of withB) { const x = by.get(e.building!) ?? { n: 0, kg: 0, mats: new Set<string>() }; x.n++; x.kg += e.net_kg; x.mats.add(e.material); by.set(e.building!, x); }
  const rowsB = [...by.entries()].sort((a, b) => b[1].kg - a[1].kg).map(([b, x]) => { const a = audits.filter((u) => u.building === b).sort((p, q) => q.audit_date.localeCompare(p.audit_date))[0]; return { b, ...x, a }; });
  const exp = () => downloadCsv(`driver-entries-attribution-${demo ? "demo" : "project"}.csv`, [["data_set", "building", "building_provenance", "entries", "net_kg", "materials", "latest_audit_date", "latest_audit_contamination_pct"],
    ...rowsB.map((r) => [demo ? "SYNTHETIC DEMO" : "PROJECT", r.b, "recorded by driver", r.n, Math.round(r.kg * 100) / 100, [...r.mats].join("; "), r.a?.audit_date ?? "", r.a?.contamination_pct ?? ""]),
    [demo ? "SYNTHETIC DEMO" : "PROJECT", "(unknown)", "no building recorded", noB, Math.round(es.filter((e) => !e.building).reduce((a, e) => a + e.net_kg, 0) * 100) / 100, "", "", ""]]);
  return (
    <div className="card" id="driver-entries"><h2>Driver collection entries — {demo ? "SYNTHETIC DEMO data set" : "project data set"}</h2>
      <p style={{ fontSize: 13 }}>Source: the Collection Log driver form (a proposed supplementary workflow, not LoadMan). Demo and project entries are never combined. An entry is attributed to a building only when the driver recorded one; otherwise the building is unknown. Entries are not matched to individual LoadMan pickups, and the audit comparison shows side-by-side figures only, not cause or effect.{" "}
        {role === "driver" || role === "viewer" ? "You see only your own entries." : "Your role can read all drivers' entries."}</p>
      {!user && <p className="msg warn"><Link to="/sign-in" style={{ textDecoration: "underline" }}>Sign in</Link> to see driver entries.</p>}
      {err && <p className="msg err">{err}</p>}
      {user && <>
        <div className="grid kpis" style={{ margin: "8px 0" }}>
          {[["Entries", fmt(es.length)], ["Net weight recorded (kg)", fmt(tot, 1)], ["Building recorded by driver", fmt(withB.length)], ["Building unknown", fmt(noB)]].map(([l, v]) => <div key={l} className="card kpi"><b style={{ fontSize: 22 }}>{v}</b><span className="l">{l}</span></div>)}
        </div>
        {es.length === 0 ? <p style={{ fontSize: 13 }}>No {demo ? "demo" : "project"} driver entries visible to you yet.</p> :
          <div className="scroll"><table className="t"><thead><tr><th>Building (recorded)</th><th>Entries</th><th>Net kg</th><th>Materials</th><th>Latest audit contamination</th></tr></thead><tbody>
            {rowsB.map((r) => <tr key={r.b}><td>{r.b}</td><td>{r.n}</td><td>{fmt(r.kg, 1)}</td><td>{[...r.mats].join(", ")}</td><td>{r.a ? (r.a.contamination_pct == null ? <em>unknown</em> : r.a.contamination_pct + "%") + " (" + r.a.audit_date + ", " + r.a.method + ")" : <em>no audit</em>}</td></tr>)}
            <tr><td><em>Unknown building</em></td><td>{noB}</td><td>{fmt(es.filter((e) => !e.building).reduce((a, e) => a + e.net_kg, 0), 1)}</td><td colSpan={2}>Not attributed — building was not recorded.</td></tr></tbody></table></div>}
        <div className="bar" style={{ marginTop: 8 }}><Button variant="outline" size="sm" disabled={es.length === 0} onClick={exp}>Export attribution CSV</Button></div></>}
    </div>
  );
}
