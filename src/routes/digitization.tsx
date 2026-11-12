import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "../components/shell";
import { Button } from "../components/ui/button";
import { downloadCsv } from "../lib/csv";

export const Route = createFileRoute("/digitization")({
  head: () => ({ meta: [{ title: "Records Digitization — EnviroTrap Nexus" }, { name: "description", content: "Prototype of a document-to-structured-data workflow using synthetic sample tickets, preset mock extraction and human approval." }] }),
  component: Digitization,
});
const FIELDS = ["ticket_no", "date", "truck", "material", "gross_lb", "tare_lb", "net_lb", "disposal_site"] as const;
type F = (typeof FIELDS)[number];
type Ext = Record<F, { v: string; conf: number | null }>;
const mk = (o: Partial<Record<F, [string, number | null]>>): Ext => Object.fromEntries(FIELDS.map((k) => [k, { v: o[k]?.[0] ?? "", conf: o[k]?.[1] ?? null }])) as Ext;
type Doc = { id: string; type: string; title: string; layout: "weigh" | "manifest" | "handwritten"; ext: Ext };
const SAMPLES: Doc[] = [
  { id: "S1", type: "Scale ticket", title: "SYNTHETIC scale ticket A", layout: "weigh", ext: mk({ ticket_no: ["SYN-0001", 0.97], date: ["2024-03-04", 0.95], truck: ["SYN-TRUCK-1", 0.9], material: ["Landfill waste", 0.92], gross_lb: ["24800", 0.93], tare_lb: ["14200", 0.93], net_lb: ["10600", 0.96], disposal_site: ["SYN Landfill", 0.8] }) },
  { id: "S2", type: "Scale ticket", title: "SYNTHETIC scale ticket A (re-scan)", layout: "weigh", ext: mk({ ticket_no: ["SYN-0001", 0.88], date: ["2024-03-04", 0.9], truck: ["SYN-TRUCK-1", 0.85], material: ["Landfill waste", 0.9], gross_lb: ["24800", 0.9], tare_lb: ["14200", 0.9], net_lb: ["10600", 0.9], disposal_site: ["SYN Landfill", 0.75] }) },
  { id: "S3", type: "Disposal manifest", title: "SYNTHETIC manifest B", layout: "manifest", ext: mk({ ticket_no: ["SYN-0107", 0.9], date: ["03/09/2024", 0.7], truck: ["SYN-TRUCK-2", 0.82], material: ["Mixed recycling", 0.88], gross_lb: ["18950", 0.6], disposal_site: ["SYN Recycling Facility", 0.84] }) },
  { id: "S4", type: "Handwritten log sheet", title: "SYNTHETIC handwritten sheet C", layout: "handwritten", ext: mk({ ticket_no: ["SYN-H-22", 0.55], date: ["2024-03-1?", 0.4], truck: ["SYN-TRUCK-3", 0.5], material: ["Cardboard", 0.6], gross_lb: ["9300", 0.45], tare_lb: ["7100", 0.45], net_lb: ["2300", 0.3], disposal_site: ["", null] }) },
];
const TYPES = ["Scale ticket", "Disposal manifest", "Handwritten log sheet"];

function Preview({ d }: { d: Doc }) {
  const e = d.ext;
  return (
    <div role="img" aria-label={`Preview of ${d.title}`} style={{ background: "#fbf7ea", border: "1px dashed #8a7f66", padding: 14, fontFamily: "var(--font-heading)", fontSize: 13, lineHeight: 1.7, position: "relative" }}>
      <div style={{ position: "absolute", top: 6, right: 8, fontSize: 10, color: "#8a2a16", fontFamily: "var(--font-sans)" }}>SYNTHETIC SAMPLE — NOT A REAL DOCUMENT</div>
      {d.layout === "weigh" && <><b>SCALE TICKET</b><div>No. {e.ticket_no.v} &nbsp; Date {e.date.v}</div><div>Truck {e.truck.v}</div><div>Material: {e.material.v}</div><div>GROSS {e.gross_lb.v} lb</div><div>TARE {e.tare_lb.v} lb</div><div>NET {e.net_lb.v} lb</div><div>Site: {e.disposal_site.v}</div></>}
      {d.layout === "manifest" && <><b>DISPOSAL MANIFEST</b><div>Manifest # {e.ticket_no.v}</div><div>Hauler unit: {e.truck.v} · Shipped {e.date.v}</div><div>Commodity: {e.material.v}</div><div>Loaded weight: {e.gross_lb.v} lb (tare/net not on this form)</div><div>Receiving facility: {e.disposal_site.v}</div></>}
      {d.layout === "handwritten" && <><b>Daily haul sheet</b><div>Tkt {e.ticket_no.v} — {e.date.v}</div><div>Truck: {e.truck.v}</div><div>{e.material.v}: full {e.gross_lb.v} / empty {e.tare_lb.v} → {e.net_lb.v}</div><div>(drop-off location not written)</div></>}
    </div>
  );
}

function Digitization() {
  const [docs, setDocs] = useState<Doc[]>(SAMPLES); const [sel, setSel] = useState("S1"); const [status, setStatus] = useState<Record<string, "pending" | "approved">>({});
  const [hist, setHist] = useState<{ doc: string; field: string; from: string; to: string; at: string }[]>([]);
  const cur = docs.find((d) => d.id === sel) ?? docs[0];
  const dupOf = (d: Doc) => docs.find((o) => o.id !== d.id && d.ext.ticket_no.v && o.ext.ticket_no.v === d.ext.ticket_no.v && o.ext.date.v === d.ext.date.v);
  const missing = (d: Doc) => FIELDS.filter((k) => !d.ext[k].v.trim());
  const edit = (k: F, v: string) => { setDocs(docs.map((d) => d.id === cur.id ? { ...d, ext: { ...d.ext, [k]: { v, conf: d.ext[k].conf } } } : d)); setStatus({ ...status, [cur.id]: "pending" }); };
  const logEdit = (k: F, from: string, to: string) => { if (from !== to) setHist((h) => [...h, { doc: cur.id, field: k, from, to, at: new Date().toISOString() }]); };
  const setType = (t: string) => setDocs(docs.map((d) => d.id === cur.id ? { ...d, type: t } : d));
  const approved = docs.filter((d) => status[d.id] === "approved");
  const exp = () => downloadCsv("digitized-synthetic-tickets.csv", [["document", "document_type", "data_set", "review_status", ...FIELDS, "missing_fields", "possible_duplicate_of", "corrections"],
    ...approved.map((d) => [d.id, d.type, "SYNTHETIC SAMPLE", "human approved", ...FIELDS.map((k) => d.ext[k].v), missing(d).join("; "), dupOf(d)?.id ?? "", hist.filter((h) => h.doc === d.id).map((h) => `${h.field}: ${h.from} -> ${h.to}`).join("; ")])]);
  const dup = dupOf(cur); const miss = missing(cur);
  return (
    <AppShell title="Records Digitization" active="/digitization">
      <p className="msg warn" role="note">PROTOTYPE WITH SYNTHETIC SAMPLES ONLY. The extracted values below are preset mock results written for the demonstration. No OCR or AI extraction is implemented, none is claimed to be reliable, and no document is uploaded, stored or sent anywhere. Real historical tickets are not handled by this page; any future approved local processing would need F&S authorization and validation against representative documents first.</p>
      <div className="grid row2">
        <div className="grid" style={{ alignContent: "start" }}>
          <div className="card"><h2>Workflow</h2><p style={{ fontSize: 13 }}>Choose a sample document → confirm its type → review the preset extracted fields (confidence is part of the mock preset) → fix flagged fields → approve → export approved records.</p></div>
          <div className="card"><h2>Preview — {cur.title}</h2><Preview d={cur} />
            <div className="fld" style={{ marginTop: 8 }}><label htmlFor="dt">Document type</label><select id="dt" value={cur.type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div></div>
          <div className="card"><h2>Extracted fields (mock preset) — edit to correct</h2>
            <div className="form">{FIELDS.map((k) => { const c = cur.ext[k].conf; return (
              <div className="fld" key={k}><label htmlFor={"f-" + k}>{k}{c == null ? " · not found" : ` · mock confidence ${Math.round(c * 100)}%${c < 0.6 ? " (low)" : ""}`}</label>
                <input id={"f-" + k} className="ctl" style={{ borderColor: !cur.ext[k].v.trim() || (c != null && c < 0.6) ? "#c0392b" : undefined }} value={cur.ext[k].v} onFocus={(e) => (e.currentTarget.dataset.orig = cur.ext[k].v)} onChange={(e) => edit(k, e.target.value)} onBlur={(e) => logEdit(k, e.currentTarget.dataset.orig ?? "", e.currentTarget.value)} /></div>); })}</div>
            <div role="status" style={{ marginTop: 8, display: "grid", gap: 6 }}>
              {miss.length > 0 && <p className="msg err">Missing fields: {miss.join(", ")}. These stay blank — they are not guessed.</p>}
              {dup && <p className="msg warn">Possible duplicate of {dup.id} (same ticket number and date). Review both before approving.</p>}
              {miss.length === 0 && !dup && <p className="msg">No missing fields or duplicates flagged.</p>}
            </div>
            <div className="bar" style={{ marginTop: 8 }}><Button onClick={() => setStatus({ ...status, [cur.id]: "approved" })} disabled={status[cur.id] === "approved"}>{status[cur.id] === "approved" ? "Approved by reviewer" : "Approve this record"}</Button>
              {status[cur.id] === "approved" && <Button variant="outline" onClick={() => setStatus({ ...status, [cur.id]: "pending" })}>Withdraw approval</Button>}</div>
          </div>
        </div>
        <div className="grid" style={{ alignContent: "start" }}>
          <div className="card"><h2>Sample documents</h2><div className="list">{docs.map((d) => <button key={d.id} aria-pressed={d.id === cur.id} onClick={() => setSel(d.id)}>{d.title}<br /><small>{d.type} · {status[d.id] === "approved" ? "approved" : "needs review"}</small></button>)}</div></div>
          <div className="card"><h2>Export</h2><p style={{ fontSize: 13 }}>{approved.length} of {docs.length} approved. Only human-approved records are exported, as an Excel-compatible CSV.</p>
            <Button style={{ marginTop: 8 }} disabled={approved.length === 0} onClick={exp}>Export approved CSV</Button></div>
          <div className="card"><h2>Correction history (this session)</h2>{hist.length === 0 ? <p style={{ fontSize: 13 }}>No corrections yet.</p> : <ul style={{ fontSize: 12.5, paddingLeft: 16 }}>{hist.map((h, i) => <li key={i}>{h.doc} · {h.field}: “{h.from}” → “{h.to}”</li>)}</ul>}
            <p style={{ fontSize: 12, marginTop: 6 }}>Original mock values are the preset samples above; this prototype does not store documents or review history in a database.</p></div>
        </div>
      </div>
    </AppShell>
  );
}
