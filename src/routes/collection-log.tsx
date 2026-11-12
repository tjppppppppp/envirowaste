import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "../components/shell";
import { Button } from "../components/ui/button";
import { downloadCsv } from "../lib/csv";
import { backend } from "../lib/backend";
import { DEMO_TRUCKS as FALLBACK_TRUCKS, MATERIALS, trucksFromRows, type DemoTruck } from "../lib/driver-config";
import { BUILDINGS } from "../lib/demo";
import { fmt, useMode, useRecords, useRole, useUser } from "../lib/store";

export const Route = createFileRoute("/collection-log")({
  head: () => ({ meta: [{ title: "Collection Log — EnviroTrap Nexus" }, { name: "description", content: "Mobile driver collection form with contextual autofill and net-weight calculation, plus a browsable log of collection records; unknown values stay unknown." }] }),
  component: Log,
});
function Records() {
  const { mode, records } = useRecords(); const [q, setQ] = useState(""); const [page, setPage] = useState(0);
  const f = records.filter((r) => !q || [r.building, r.container, r.stream].join(" ").toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date));
  const exp = () => downloadCsv("collection-log.csv", [["date", "weight_t", "building", "container", "stream", "source"], ...f.map((r) => [r.date, r.weight, r.building, r.container, r.stream, r.source])]);
  
  return (
    <>
      <p className="nx-lead">Read-only log of imported collection records in the {mode === "demo" ? "demo" : "project"} dataset.</p>
      <div className="bar"><label className="sr-only" htmlFor="lq">Filter</label><input id="lq" className="ctl" placeholder="Filter by building, container, stream" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /><Button variant="outline" size="sm" onClick={exp}>Export CSV</Button><span>{fmt(f.length)} records</span></div>
      <div className="card scroll"><table className="t"><thead><tr><th>Date</th><th>Weight (t)</th><th>Building</th><th>Container</th><th>Stream</th><th>Source</th></tr></thead>
        <tbody>{f.slice(page * 25, page * 25 + 25).map((r, i) => <tr key={i}><td>{r.date || <em>unknown</em>}</td><td>{r.weight == null ? <em>unknown</em> : fmt(r.weight, 3)}</td><td>{r.building ?? <em>unknown</em>}</td><td>{r.container || <em>unknown</em>}</td><td>{r.stream}</td><td>{r.source}</td></tr>)}</tbody></table>
        {f.length === 0 && <p style={{ padding: 8, fontSize: 13 }}>No records.</p>}</div>
      <div className="bar"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={(page + 1) * 25 >= f.length} onClick={() => setPage(page + 1)}>Next</Button></div>
    </>
  );
}

type Entry = { id: string; building: string | null; container: string | null; entered_at: string; driver_email: string | null; is_demo: boolean; truck: string; route: string; material: string; work_order: string | null; work_order_status: string; disposal_location: string; unit: string; full_weight: number; empty_weight: number; net_weight: number; net_kg: number; notes: string | null; corrections: { field: string; from: string | null; to: string | null }[] };
const big: React.CSSProperties = { minHeight: 56, fontSize: 16, padding: "10px 14px", borderRadius: 8, textAlign: "left", width: "100%" };
const bigIn: React.CSSProperties = { minHeight: 56, fontSize: 18, width: "100%" };
const WO_LABEL: Record<string, string> = { demo_verified: "Demo-verified mapping (synthetic)", manual: "Entered by driver, unverified", unknown: "Unknown" };

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={on} onClick={onClick} style={{ ...big, border: "2px solid " + (on ? "#17808a" : "#cfc4a8"), background: on ? "#17808a" : "#fffdf8", color: on ? "#fff" : "#14233f" }}>{children}</button>;
}

function Driver() {
  const mode = useMode(); const demo = mode === "demo"; const { user } = useUser(); const { role } = useRole(user);
  const allowed = role === "driver" || role === "administrator" || role === "researcher";
  const [ready, setReady] = useState(false); const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setReady(true); setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const [truckId, setTruckId] = useState(""); const [routeId, setRouteId] = useState("");
  const [truckTxt, setTruckTxt] = useState(""); const [routeTxt, setRouteTxt] = useState("");
  const [material, setMaterial] = useState(""); const [wo, setWo] = useState(""); const [disp, setDisp] = useState("");
  const [unit, setUnit] = useState<"lb" | "kg">("lb"); const [full, setFull] = useState(""); const [empty, setEmpty] = useState(""); const [notes, setNotes] = useState("");
  const [review, setReview] = useState(false); const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null); const [saving, setSaving] = useState(false);
  const [n, setN] = useState(0); const [entries, setEntries] = useState<Entry[]>([]); const [listErr, setListErr] = useState("");
  const [building, setBuilding] = useState(""); const [container, setContainer] = useState("");
  const [DEMO_TRUCKS, setTrucks] = useState<DemoTruck[]>(FALLBACK_TRUCKS);
  useEffect(() => { if (!user) return; backend.from("demo_mappings").select("*").eq("active", true).order("truck_id").order("route_id").then(({ data, error }) => { if (!error && data) setTrucks(trucksFromRows(data as any)); }); }, [user?.id]);
  const truck = DEMO_TRUCKS.find((t) => t.id === truckId); const route = truck?.routes.find((r) => r.id === routeId);
  const defaults = demo && route ? { material: route.material, workOrder: route.workOrder ?? "", disposal: route.disposal } : { material: "", workOrder: "", disposal: "" };
  const pickTruck = (id: string) => { setTruckId(id); setRouteId(""); setMaterial(""); setWo(""); setDisp(""); setReview(false); const t = DEMO_TRUCKS.find((x) => x.id === id); if (t?.routes.length === 1) pickRoute(t.routes[0].id, id); };
  const pickRoute = (id: string, tid = truckId) => { setRouteId(id); setReview(false); const r = DEMO_TRUCKS.find((t) => t.id === tid)?.routes.find((x) => x.id === id); if (r) { setMaterial(r.material); setWo(r.workOrder ?? ""); setDisp(r.disposal); } };
  useEffect(() => { setTruckId(""); setRouteId(""); setMaterial(""); setWo(""); setDisp(""); setReview(false); }, [demo]);
  useEffect(() => {
    if (!user) { setEntries([]); return; }
    backend.from("collection_entries").select("*").eq("is_demo", demo).order("entered_at", { ascending: false }).limit(200).then(({ data, error }) => { setListErr(error ? error.message : ""); setEntries((data ?? []).map((r: any) => ({ ...r, full_weight: Number(r.full_weight), empty_weight: Number(r.empty_weight), net_weight: Number(r.net_weight), net_kg: Number(r.net_kg) }))); });
  }, [user?.id, demo, n]);
  const fw = full === "" ? null : Number(full); const ew = empty === "" ? null : Number(empty);
  const errs: string[] = [];
  if (fw != null && (!isFinite(fw) || fw < 0)) errs.push("Full weight cannot be negative.");
  if (ew != null && (!isFinite(ew) || ew < 0)) errs.push("Empty weight cannot be negative.");
  if (fw != null && ew != null && fw >= 0 && ew >= 0 && fw < ew) errs.push("Full weight must be at least the empty weight.");
  const net = fw != null && ew != null && errs.length === 0 ? Math.round((fw - ew) * 1000) / 1000 : null;
  const tName = demo ? truck?.label ?? "" : truckTxt.trim(); const rName = demo ? route?.label ?? "" : routeTxt.trim();
  const woStatus = wo.trim() === "" ? "unknown" : demo && route?.workOrder && wo.trim() === route.workOrder ? "demo_verified" : "manual";
  const missing: string[] = []; if (!tName) missing.push("truck"); if (!rName) missing.push("route"); if (!material.trim()) missing.push("material"); if (!disp.trim()) missing.push("disposal location"); if (fw == null) missing.push("full weight"); if (ew == null) missing.push("empty weight");
  const changes = [["material", defaults.material, material.trim()], ["work_order", defaults.workOrder, wo.trim()], ["disposal_location", defaults.disposal, disp.trim()]].filter(([, a, b]) => a !== b).map(([field, from, to]) => ({ field, from: from || null, to: to || null }));
  const canReview = allowed && !!user && missing.length === 0 && errs.length === 0 && net != null;
  const save = async () => {
    if (!canReview || net == null) return; setSaving(true); setMsg(null);
    const { error } = await backend.from("collection_entries").insert({
      entered_local: (now ?? new Date()).toLocaleString() + " (" + Intl.DateTimeFormat().resolvedOptions().timeZone + ")", is_demo: demo, truck: tName, route: rName, material: material.trim(),
      material_source: !demo ? "manual" : changes.some((c) => c.field === "material") ? "corrected" : "demo_mapping",
      work_order: wo.trim() || null, work_order_status: woStatus, disposal_location: disp.trim(), unit, full_weight: fw, empty_weight: ew, notes: notes.trim() || null,
      original_input: { autofilled_defaults: defaults, source: demo ? "synthetic demonstration mapping" : "none (no authorized mapping configured)", as_entered: { truck: tName, route: rName, material: material.trim(), work_order: wo.trim(), disposal_location: disp.trim(), full_weight: full, empty_weight: empty, unit } },
      corrections: changes, building: building.trim() || null, building_source: building.trim() ? "recorded_by_driver" : null, container: container.trim() || null,
    });
    setSaving(false);
    if (error) { setMsg({ t: error.code === "42501" ? "Your role cannot record collections. Ask an administrator for the driver role." : "Not saved: " + error.message, err: true }); return; }
    setMsg({ t: `Collection saved: net ${fmt(net, 2)} ${unit}.` }); setReview(false); setFull(""); setEmpty(""); setNotes(""); setBuilding(""); setContainer(""); setN((x) => x + 1);
  };
  const exp = () => downloadCsv(`collection-entries-${demo ? "demo" : "project"}.csv`, [["entered_at_utc", "driver", "data_set", "truck", "route", "material", "work_order", "work_order_status", "building", "container", "disposal_location", "unit", "full_weight", "empty_weight", "net_weight", "net_weight_kg", "notes", "corrections"],
    ...entries.map((e) => [e.entered_at, e.driver_email, e.is_demo ? "SYNTHETIC DEMO" : "PROJECT", e.truck, e.route, e.material, e.work_order, e.work_order_status, e.building ?? "", e.container ?? "", e.disposal_location, e.unit, e.full_weight, e.empty_weight, e.net_weight, Math.round(e.net_kg * 1000) / 1000, e.notes, e.corrections.map((c) => `${c.field}: ${c.from ?? "(blank)"} -> ${c.to ?? "(blank)"}`).join("; ")])]);
  return (
    <div className="grid" style={{ maxWidth: 720 }}>
      <p className="nx-lead">{demo ? "Demonstration mode: trucks, routes, work orders and disposal locations below are SYNTHETIC examples, not actual UIUC assignments. Entries are saved as demo entries. An administrator can edit these synthetic mappings in Settings." : "Project mode: no authorized truck, route or work-order mappings are configured, so nothing is filled in for you and work orders stay unknown unless you type one. Nothing here is used from the demo mappings."} This is a proposed supplementary workflow, not connected to university trucks or LoadMan.</p>
      {!user && ready && <p className="msg warn"><Link to="/sign-in" style={{ textDecoration: "underline" }}>Sign in</Link> to record collections; your identity comes from your login.</p>}
      {user && !allowed && <p className="msg warn">Your role is {role.replace("_", " ")}; recording collections needs the driver role (or administrator/researcher). An administrator can grant it in Settings.</p>}
      <div className="card" style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 14 }}>
          <span><b>Driver:</b> {user?.email ?? "not signed in"}</span>
          <span><b>Date/time:</b> <span suppressHydrationWarning>{now ? now.toLocaleString() : "…"}</span> (automatic)</span>
        </div>
        {demo ? (<>
          <fieldset style={{ border: 0, padding: 0, display: "grid", gap: 8 }}><legend style={{ fontWeight: 600, marginBottom: 6 }}>1. Truck (synthetic)</legend>
            {DEMO_TRUCKS.map((t) => <Choice key={t.id} on={t.id === truckId} onClick={() => pickTruck(t.id)}>{t.label}</Choice>)}</fieldset>
          {truck && <fieldset style={{ border: 0, padding: 0, display: "grid", gap: 8 }}><legend style={{ fontWeight: 600, marginBottom: 6 }}>2. Route for this truck</legend>
            {truck.routes.map((r) => <Choice key={r.id} on={r.id === routeId} onClick={() => pickRoute(r.id)}>{r.label}</Choice>)}</fieldset>}
        </>) : (
          <div className="grid">
            <div className="fld"><label htmlFor="d-truck" style={{ fontSize: 14 }}>Truck</label><input id="d-truck" className="ctl" style={bigIn} maxLength={80} value={truckTxt} onChange={(e) => { setTruckTxt(e.target.value); setReview(false); }} /></div>
            <div className="fld"><label htmlFor="d-route" style={{ fontSize: 14 }}>Route</label><input id="d-route" className="ctl" style={bigIn} maxLength={120} value={routeTxt} onChange={(e) => { setRouteTxt(e.target.value); setReview(false); }} /></div>
          </div>)}
        {(route || !demo) && <div className="grid">
          <div className="fld"><label htmlFor="d-mat" style={{ fontSize: 14 }}>Material {demo ? "(from route, editable)" : ""}</label>
            <select id="d-mat" className="ctl" style={bigIn} value={material} onChange={(e) => { setMaterial(e.target.value); setReview(false); }}><option value="">Select material…</option>{MATERIALS.map((m) => <option key={m}>{m}</option>)}</select></div>
          <div className="fld"><label htmlFor="d-wo" style={{ fontSize: 14 }}>Work order</label>
            <input id="d-wo" className="ctl" style={bigIn} maxLength={80} value={wo} onChange={(e) => { setWo(e.target.value); setReview(false); }} placeholder="Unknown" />
            <small>{WO_LABEL[woStatus]}{demo && route && !route.workOrder ? " — this synthetic route has no mapped work order, so it stays unknown." : ""}</small></div>
          <div className="fld"><label htmlFor="d-disp" style={{ fontSize: 14 }}>Disposal location {demo ? "(default, editable)" : ""}</label>
            <input id="d-disp" className="ctl" style={bigIn} maxLength={160} value={disp} onChange={(e) => { setDisp(e.target.value); setReview(false); }} /></div>
          <div role="group" aria-label="Weight unit" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Choice on={unit === "lb"} onClick={() => setUnit("lb")}>Pounds (lb)</Choice><Choice on={unit === "kg"} onClick={() => setUnit("kg")}>Kilograms (kg)</Choice></div>
          <div className="fld"><label htmlFor="d-full" style={{ fontSize: 14 }}>Full weight ({unit})</label><input id="d-full" className="ctl" style={bigIn} type="number" inputMode="decimal" min="0" step="any" value={full} onChange={(e) => { setFull(e.target.value); setReview(false); }} /></div>
          <div className="fld"><label htmlFor="d-empty" style={{ fontSize: 14 }}>Empty weight ({unit})</label><input id="d-empty" className="ctl" style={bigIn} type="number" inputMode="decimal" min="0" step="any" value={empty} onChange={(e) => { setEmpty(e.target.value); setReview(false); }} /></div>
          <div className="card" style={{ background: "#e6f2f2" }} aria-live="polite"><b>Net weight:</b> <span id="d-net" style={{ fontSize: 22, fontWeight: 700 }}>{net == null ? "—" : `${fmt(net, 2)} ${unit}`}</span></div>
          {errs.map((e) => <p key={e} className="msg err" role="alert">{e}</p>)}
          <div className="fld"><label htmlFor="d-bld" style={{ fontSize: 14 }}>Building (optional — only if you know it; blank stays unknown)</label><input id="d-bld" className="ctl" style={bigIn} list="d-bld-list" maxLength={120} value={building} onChange={(e) => setBuilding(e.target.value)} /><datalist id="d-bld-list">{BUILDINGS.map((b) => <option key={b} value={b} />)}</datalist></div>
          <div className="fld"><label htmlFor="d-cont" style={{ fontSize: 14 }}>Container ID (optional)</label><input id="d-cont" className="ctl" style={bigIn} maxLength={80} value={container} onChange={(e) => setContainer(e.target.value)} /></div>
          <div className="fld"><label htmlFor="d-notes" style={{ fontSize: 14 }}>Notes (optional)</label><input id="d-notes" className="ctl" style={bigIn} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          {!review && <Button type="button" style={{ minHeight: 56, fontSize: 17 }} disabled={!ready || !canReview} onClick={() => { setReview(true); setMsg(null); }}>Review entry</Button>}
          {!canReview && user && allowed && missing.length > 0 && <small>Still needed: {missing.join(", ")}.</small>}
        </div>}
        {review && net != null && <div className="card" id="d-review" style={{ borderColor: "#17808a", borderWidth: 2 }}><h2>Review before saving</h2>
          <table className="t"><tbody>
            <tr><td>Driver</td><td>{user?.email}</td></tr><tr><td>Truck / route</td><td>{tName} / {rName}</td></tr><tr><td>Material</td><td>{material}</td></tr>
            <tr><td>Work order</td><td>{wo || "Unknown"} — {WO_LABEL[woStatus]}</td></tr><tr><td>Disposal</td><td>{disp}</td></tr><tr><td>Building</td><td>{building.trim() || "Unknown (not recorded)"}</td></tr>
            <tr><td>Weights</td><td>full {full} {unit} − empty {empty} {unit} = <b>{fmt(net, 2)} {unit}</b></td></tr></tbody></table>
          {changes.length > 0 ? <p style={{ fontSize: 13, margin: "8px 0" }}>Corrected from autofill: {changes.map((c) => `${c.field} (${c.from ?? "blank"} → ${c.to ?? "blank"})`).join("; ")}. The original autofilled values are kept with the record.</p> : <p style={{ fontSize: 13, margin: "8px 0" }}>No corrections to autofilled values.</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Button type="button" variant="outline" style={{ minHeight: 56 }} onClick={() => setReview(false)}>Edit</Button><Button type="button" style={{ minHeight: 56, fontSize: 17 }} disabled={saving} onClick={save}>{saving ? "Saving…" : "Confirm and save"}</Button></div></div>}
        {msg && <p className={"msg" + (msg.err ? " err" : "")} role="status">{msg.t}</p>}
      </div>
      <div className="card"><div className="bar" style={{ marginBottom: 8 }}><h2 style={{ margin: 0 }}>{demo ? "Demo entries" : "Project entries"} (yours)</h2><Button variant="outline" size="sm" disabled={entries.length === 0} onClick={exp}>Download Excel-compatible CSV</Button></div>
        {listErr && <p className="msg err">{listErr}</p>}
        <div className="scroll"><table className="t"><thead><tr><th>Saved</th><th>Truck</th><th>Route</th><th>Material</th><th>Work order</th><th>Building</th><th>Disposal</th><th>Net</th></tr></thead>
          <tbody>{entries.map((e) => <tr key={e.id}><td>{new Date(e.entered_at).toLocaleString()}</td><td>{e.truck}</td><td>{e.route}</td><td>{e.material}</td><td>{e.work_order ?? <em>unknown</em>}</td><td>{e.building ?? <em>unknown</em>}</td><td>{e.disposal_location}</td><td>{fmt(e.net_weight, 2)} {e.unit}</td></tr>)}</tbody></table></div>
        {entries.length === 0 && <p style={{ fontSize: 13, padding: 6 }}>{user ? "No entries saved yet." : "Sign in to see your entries."}</p>}
        <p style={{ fontSize: 12, marginTop: 6 }}>Only you (and administrators) can read your entries. Saved entries cannot be edited or deleted; original autofilled values and corrections stay with each record.</p></div>
    </div>
  );
}

function Log() {
  const [tab, setTab] = useState<"driver" | "records">("driver");
  return (
    <AppShell title="Collection Log" active="/collection-log">
      <div className="bar" role="group" aria-label="Collection log view"><Button variant={tab === "driver" ? "default" : "outline"} aria-pressed={tab === "driver"} onClick={() => setTab("driver")}>Driver entry</Button><Button variant={tab === "records" ? "default" : "outline"} aria-pressed={tab === "records"} onClick={() => setTab("records")}>Imported records</Button></div>
      {tab === "driver" ? <Driver /> : <Records />}
    </AppShell>
  );
}
