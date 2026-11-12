import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { backend } from "../lib/backend";
import { downloadCsv } from "../lib/csv";
import { useRole, useUser } from "../lib/store";
import { Image } from "../image";
import { Button } from "./ui/button";

export const TFIELDS = ["ticket_no", "date", "truck", "material", "gross_lb", "tare_lb", "net_lb", "disposal_site"] as const;
const TYPES = ["Scale ticket", "Disposal manifest", "Handwritten log sheet", "Other / unknown"];
const MAX = 2_500_000;
type Doc = { id: string; filename: string; doc_type: string; mime: string; size_bytes: number; sha256: string; fields: Record<string, string>; status: string; verified_at: string | null; created_at: string };
type Hist = { id: string; action: string; changes: any; created_at: string };

function sniff(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "application/pdf";
  return null;
}
const EXT: Record<string, RegExp> = { "image/png": /\.png$/i, "image/jpeg": /\.jpe?g$/i, "application/pdf": /\.pdf$/i };
function b64(bytes: Uint8Array) { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); }
async function sha(bytes: Uint8Array) { const h = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource)); return [...h].map((x) => x.toString(16).padStart(2, "0")).join(""); }

export function TicketUploads() {
  const { user } = useUser(); const { role } = useRole(user); const allowed = role === "administrator" || role === "researcher";
  const [docs, setDocs] = useState<Doc[]>([]); const [sel, setSel] = useState<string | null>(null); const [n, setN] = useState(0);
  const [type, setType] = useState(TYPES[0]); const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null); const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({}); const [url, setUrl] = useState<string | null>(null); const [hist, setHist] = useState<Hist[]>([]);
  useEffect(() => {
    if (!user) { setDocs([]); return; }
    backend.from("ticket_documents").select("id,filename,doc_type,mime,size_bytes,sha256,fields,status,verified_at,created_at").order("created_at", { ascending: false }).then(({ data }) => setDocs((data ?? []) as Doc[]));
  }, [user?.id, n]);
  const cur = docs.find((d) => d.id === sel) ?? null;
  useEffect(() => {
    setUrl(null); setHist([]); if (!cur) return; setDraft({ ...cur.fields });
    let u: string | null = null; let dead = false;
    backend.from("ticket_documents").select("file_b64").eq("id", cur.id).single().then(({ data }) => {
      if (dead || !data) return; const bin = atob(data.file_b64); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
      u = URL.createObjectURL(new Blob([a], { type: cur.mime })); setUrl(u);
    });
    backend.from("ticket_history").select("id,action,changes,created_at").eq("doc_id", cur.id).order("created_at", { ascending: false }).then(({ data }) => setHist((data ?? []) as Hist[]));
    return () => { dead = true; if (u) URL.revokeObjectURL(u); };
  }, [cur?.id, n]);
  const logH = (doc_id: string, action: string, changes: any) => backend.from("ticket_history").insert({ doc_id, action, changes });
  const upload = async (f: File | undefined) => {
    if (!f) return; setMsg(null);
    if (!user || !allowed) { setMsg({ t: "Uploading needs the researcher or administrator role.", err: true }); return; }
    if (f.size === 0 || f.size > MAX) { setMsg({ t: "Files must be between 1 byte and 2.5 MB.", err: true }); return; }
    setBusy(true);
    const bytes = new Uint8Array(await f.arrayBuffer()); const mime = sniff(bytes);
    if (!mime) { setBusy(false); setMsg({ t: "Not accepted: only PNG, JPEG and PDF files are supported (checked by file contents, not just the name). TIFF and other formats are not supported.", err: true }); return; }
    if (!EXT[mime].test(f.name)) { setBusy(false); setMsg({ t: "The file name extension does not match the file contents; rejected.", err: true }); return; }
    const h = await sha(bytes); const same = docs.find((d) => d.sha256 === h);
    const { data, error } = await backend.from("ticket_documents").insert({ filename: f.name.slice(0, 200), doc_type: type, mime, size_bytes: f.size, sha256: h, file_b64: b64(bytes), fields: {} }).select("id").single();
    setBusy(false);
    if (error || !data) { setMsg({ t: error?.code === "42501" ? "Your role cannot upload documents." : "Not saved: " + (error?.message ?? "unknown error"), err: true }); return; }
    await logH(data.id, "uploaded", { filename: f.name, doc_type: type, sha256: h });
    setMsg({ t: "Uploaded and stored privately." + (same ? ` This exact file was already uploaded as “${same.filename}” — flagged as a duplicate.` : "") }); setN((x) => x + 1); setSel(data.id);
  };
  const missing = (f: Record<string, string>) => TFIELDS.filter((k) => !(f[k] ?? "").trim());
  const dupOf = (d: Doc) => docs.filter((o) => o.id !== d.id && (o.sha256 === d.sha256 || (d.fields.ticket_no && o.fields.ticket_no === d.fields.ticket_no && o.fields.date === d.fields.date)));
  const dirty = !!cur && TFIELDS.some((k) => (draft[k] ?? "") !== (cur.fields[k] ?? ""));
  const saveFields = async () => {
    if (!cur) return; const ch = TFIELDS.filter((k) => (draft[k] ?? "") !== (cur.fields[k] ?? "")).map((k) => ({ field: k, from: cur.fields[k] ?? null, to: draft[k] || null }));
    const { error } = await backend.from("ticket_documents").update({ fields: draft, status: "needs_review", verified_at: null }).eq("id", cur.id);
    if (error) { setMsg({ t: "Not saved: " + error.message, err: true }); return; }
    await logH(cur.id, "fields edited", { changes: ch }); setMsg({ t: "Fields saved; the record needs verification." }); setN((x) => x + 1);
  };
  const setStatus = async (v: boolean) => {
    if (!cur) return;
    if (v && (!(cur.fields.ticket_no ?? "").trim() || !(cur.fields.date ?? "").trim())) { setMsg({ t: "Enter and save at least ticket_no and date before verifying.", err: true }); return; }
    const { error } = await backend.from("ticket_documents").update({ status: v ? "verified" : "needs_review", verified_at: v ? new Date().toISOString() : null }).eq("id", cur.id);
    if (error) { setMsg({ t: error.message, err: true }); return; }
    await logH(cur.id, v ? "verified by " + user?.email : "reopened for correction", {}); setMsg({ t: v ? "Marked verified by you." : "Reopened." }); setN((x) => x + 1);
  };
  const ver = docs.filter((d) => d.status === "verified");
  const exp = () => downloadCsv("verified-ticket-records.csv", [["file", "document_type", "data_set", "verified_at_utc", ...TFIELDS, "missing_fields", "possible_duplicates"],
    ...ver.map((d) => [d.filename, d.doc_type, "PROJECT (uploaded)", d.verified_at, ...TFIELDS.map((k) => d.fields[k] ?? ""), missing(d.fields).join("; "), dupOf(d).map((o) => o.filename).join("; ")])]);
  return (
    <div className="grid">
      <p className="msg warn" role="note">Private upload. Real tickets may be sensitive: files are stored in this project's own database, readable only by the person who uploaded them, and are not sent to any third-party or AI service. No OCR or AI extraction is implemented — you type the fields yourself, then verify. PNG, JPEG or PDF only, up to 2.5 MB. Prototype: not approved by UIUC for production use.</p>
      {!user && <p className="msg warn"><Link to="/sign-in" style={{ textDecoration: "underline" }}>Sign in</Link> to upload documents.</p>}
      {user && !allowed && <p className="msg warn">Your role is {role.replace("_", " ")}; uploading and reviewing documents needs the researcher or administrator role.</p>}
      {user && allowed && <div className="card"><h2>Upload a document</h2><div className="bar">
        <div className="fld"><label htmlFor="up-type">Document type</label><select id="up-type" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="fld"><label htmlFor="up-file">File</label><input id="up-file" type="file" accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf" disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} /></div></div></div>}
      {msg && <p className={"msg" + (msg.err ? " err" : "")} role="status">{msg.t}</p>}
      {user && <div className="grid row2">
        <div className="grid" style={{ alignContent: "start" }}>
          {cur ? <>
            <div className="card"><h2>Preview — {cur.filename}</h2>
              {!url ? <p style={{ fontSize: 13 }}>Loading…</p> : cur.mime === "application/pdf" ? <object data={url} type="application/pdf" aria-label={"PDF preview of " + cur.filename} style={{ width: "100%", height: 420 }}><p>PDF preview is not available in this browser.</p></object> : <Image src={url} alt={"Uploaded document " + cur.filename} width={640} height={460} style={{ maxWidth: "100%", maxHeight: 460, objectFit: "contain" }} />}
              <p style={{ fontSize: 12, marginTop: 6 }}>{cur.doc_type} · {cur.mime} · {Math.round(cur.size_bytes / 1024)} KB · SHA-256 {cur.sha256.slice(0, 12)}… · the original file is preserved unchanged.</p></div>
            <div className="card"><h2>Fields (typed by a person)</h2>
              <div className="form">{TFIELDS.map((k) => <div className="fld" key={k}><label htmlFor={"u-" + k}>{k}{!(draft[k] ?? "").trim() ? " · missing" : ""}</label><input id={"u-" + k} className="ctl" maxLength={200} style={{ borderColor: !(draft[k] ?? "").trim() ? "#c0392b" : undefined }} value={draft[k] ?? ""} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} /></div>)}</div>
              <div role="status" style={{ marginTop: 8, display: "grid", gap: 6 }}>
                {missing(draft).length > 0 && <p className="msg err">Missing: {missing(draft).join(", ")}. Left blank, never guessed.</p>}
                {dupOf(cur).length > 0 && <p className="msg warn">Possible duplicate of: {dupOf(cur).map((o) => o.filename).join(", ")} (identical file or same ticket number and date).</p>}</div>
              <div className="bar" style={{ marginTop: 8 }}><Button onClick={saveFields} disabled={!dirty}>Save fields</Button>
                {cur.status === "verified" ? <Button variant="outline" onClick={() => setStatus(false)}>Reopen for correction</Button> : <Button variant="outline" disabled={dirty} onClick={() => setStatus(true)}>Verify this record</Button>}
                <span style={{ fontSize: 13 }}>Status: <b>{cur.status === "verified" ? "verified" : "needs review"}</b></span></div></div>
            <div className="card"><h2>Review and correction history</h2>{hist.length === 0 ? <p style={{ fontSize: 13 }}>None.</p> : <ul style={{ fontSize: 12.5, paddingLeft: 16 }}>{hist.map((h) => <li key={h.id}>{new Date(h.created_at).toLocaleString()} · {h.action}{h.changes?.changes ? ": " + h.changes.changes.map((c: any) => `${c.field} “${c.from ?? ""}” → “${c.to ?? ""}”`).join("; ") : ""}</li>)}</ul>}</div>
          </> : <div className="card"><p style={{ fontSize: 13 }}>Select an uploaded document to preview and review it.</p></div>}
        </div>
        <div className="grid" style={{ alignContent: "start" }}>
          <div className="card"><h2>Your uploaded documents</h2>{docs.length === 0 ? <p style={{ fontSize: 13 }}>None yet.</p> : <div className="list">{docs.map((d) => <button key={d.id} aria-pressed={d.id === sel} onClick={() => setSel(d.id)}>{d.filename}<br /><small>{d.doc_type} · {d.status === "verified" ? "verified" : "needs review"}{missing(d.fields).length ? ` · ${missing(d.fields).length} missing` : ""}{dupOf(d).length ? " · duplicate?" : ""}</small></button>)}</div>}</div>
          <div className="card"><h2>Export</h2><p style={{ fontSize: 13 }}>{ver.length} of {docs.length} verified. Only human-verified records are exported, as Excel-compatible CSV.</p><Button style={{ marginTop: 8 }} disabled={ver.length === 0} onClick={exp}>Export verified CSV</Button></div>
        </div></div>}
    </div>
  );
}
