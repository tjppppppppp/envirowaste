import { useEffect, useState } from "react";
import { backend } from "../lib/backend";
import { MATERIALS, type MappingRow } from "../lib/driver-config";
import { Button } from "./ui/button";

type Row = MappingRow & { id: string; active: boolean; updated_by: string | null; updated_at: string };
const blank = { truck_id: "DEMO-T1", truck_label: "DEMO Truck 1 (synthetic)", route_id: "", route_label: "DEMO Route ", material: MATERIALS[0], work_order: "", disposal: "DEMO " };

export function MappingAdmin({ email }: { email: string }) {
  const [rows, setRows] = useState<Row[]>([]); const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null); const [n, setN] = useState(0);
  const [log, setLog] = useState<any[]>([]); const [nw, setNw] = useState(blank);
  useEffect(() => {
    backend.from("demo_mappings").select("*").order("truck_id").order("route_id").then(({ data }) => setRows((data ?? []) as Row[]));
    backend.from("mapping_changes").select("*").order("created_at", { ascending: false }).limit(15).then(({ data }) => setLog(data ?? []));
  }, [n]);
  const edit = (id: string, k: string, v: any) => setRows(rows.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
  const bad = (r: { truck_label: string; route_label: string; disposal: string; work_order: string | null; truck_id: string; route_id: string }) =>
    !/^DEMO/.test(r.truck_id) || !/^DEMO/.test(r.route_id) || !/^DEMO/.test(r.truck_label) || !/^DEMO/.test(r.route_label) || !/^DEMO/.test(r.disposal) || (r.work_order ? !/^DEMO/.test(r.work_order) : false);
  const save = async (r: Row) => {
    if (bad(r)) { setMsg({ t: "Every synthetic id, label, work order and disposal location must start with DEMO so it cannot be mistaken for a real UIUC assignment.", err: true }); return; }
    const { data: before } = await backend.from("demo_mappings").select("*").eq("id", r.id).single();
    const after = { truck_label: r.truck_label, route_label: r.route_label, material: r.material, work_order: r.work_order || null, disposal: r.disposal, active: r.active };
    const { error } = await backend.from("demo_mappings").update({ ...after, updated_by: email, updated_at: new Date().toISOString() }).eq("id", r.id);
    if (error) { setMsg({ t: error.code === "42501" ? "Only administrators can change mappings." : error.message, err: true }); return; }
    await backend.from("mapping_changes").insert({ admin_email: email, mapping_key: r.truck_id + " / " + r.route_id, action: "update", before: before ? { truck_label: before.truck_label, route_label: before.route_label, material: before.material, work_order: before.work_order, disposal: before.disposal, active: before.active } : null, after });
    setMsg({ t: "Mapping saved and the change recorded." }); setN((x) => x + 1);
  };
  const add = async () => {
    const r = { ...nw, work_order: nw.work_order.trim() || null };
    if (bad(r) || !r.route_id.trim()) { setMsg({ t: "Truck id, route id, labels, work order and disposal must start with DEMO; route id is required.", err: true }); return; }
    const { error } = await backend.from("demo_mappings").insert({ ...r, updated_by: email });
    if (error) { setMsg({ t: error.code === "42501" ? "Only administrators can add mappings." : error.code === "23505" ? "That truck and route already exist." : error.message, err: true }); return; }
    await backend.from("mapping_changes").insert({ admin_email: email, mapping_key: r.truck_id + " / " + r.route_id, action: "add", before: null, after: r });
    setMsg({ t: "Mapping added and recorded." }); setNw(blank); setN((x) => x + 1);
  };
  return (
    <div className="card" id="mappings"><h2>Synthetic driver mappings (administrators only)</h2>
      <p style={{ fontSize: 13 }}>These truck, route, work-order and disposal mappings are SYNTHETIC demonstration values used only in Demo mode of the driver form. They are not actual UIUC assignments, and every value must start with “DEMO”. Real mappings need F&amp;S authorization. Each change is recorded below.</p>
      {msg && <p className={"msg" + (msg.err ? " err" : "")} role="status">{msg.t}</p>}
      <div className="scroll"><table className="t"><thead><tr><th>Truck / route id</th><th>Truck label</th><th>Route label</th><th>Material</th><th>Work order</th><th>Disposal</th><th>Active</th><th /></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><td>{r.truck_id}<br />{r.route_id}</td>
          <td><input aria-label={"Truck label " + r.route_id} value={r.truck_label} maxLength={80} onChange={(e) => edit(r.id, "truck_label", e.target.value)} /></td>
          <td><input aria-label={"Route label " + r.route_id} value={r.route_label} maxLength={120} onChange={(e) => edit(r.id, "route_label", e.target.value)} /></td>
          <td><select aria-label={"Material " + r.route_id} value={r.material} onChange={(e) => edit(r.id, "material", e.target.value)}>{MATERIALS.map((m) => <option key={m}>{m}</option>)}</select></td>
          <td><input aria-label={"Work order " + r.route_id} value={r.work_order ?? ""} placeholder="none (unknown)" maxLength={60} onChange={(e) => edit(r.id, "work_order", e.target.value)} /></td>
          <td><input aria-label={"Disposal " + r.route_id} value={r.disposal} maxLength={160} onChange={(e) => edit(r.id, "disposal", e.target.value)} /></td>
          <td><input type="checkbox" aria-label={"Active " + r.route_id} checked={r.active} onChange={(e) => edit(r.id, "active", e.target.checked)} /></td>
          <td><Button size="sm" variant="outline" onClick={() => save(r)}>Save</Button></td></tr>)}</tbody></table></div>
      <h3 style={{ marginTop: 12 }}>Add a synthetic mapping</h3>
      <div className="form">
        {(["truck_id", "truck_label", "route_id", "route_label", "work_order", "disposal"] as const).map((k) => <div className="fld" key={k}><label htmlFor={"nm-" + k}>{k.replace("_", " ")}</label><input id={"nm-" + k} value={nw[k]} onChange={(e) => setNw({ ...nw, [k]: e.target.value })} /></div>)}
        <div className="fld"><label htmlFor="nm-mat">material</label><select id="nm-mat" value={nw.material} onChange={(e) => setNw({ ...nw, material: e.target.value })}>{MATERIALS.map((m) => <option key={m}>{m}</option>)}</select></div>
      </div>
      <Button style={{ marginTop: 8 }} onClick={add}>Add mapping</Button>
      <h3 style={{ marginTop: 12 }}>Change history</h3>
      {log.length === 0 ? <p style={{ fontSize: 13 }}>No changes recorded yet.</p> : <ul style={{ fontSize: 12.5, paddingLeft: 16 }}>{log.map((l) => <li key={l.id}>{new Date(l.created_at).toLocaleString()} · {l.admin_email} · {l.action} {l.mapping_key}: {l.before ? JSON.stringify(l.before) + " → " : ""}{JSON.stringify(l.after)}</li>)}</ul>}
    </div>
  );
}
