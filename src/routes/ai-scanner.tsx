import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { UIMessage } from "ai";
import { Image } from "../image";
import { AppShell } from "../components/shell";
import { Button } from "../components/ui/button";
import { backend } from "../lib/backend";
import { downloadCsv } from "../lib/csv";
import { createAiChatStore, useAiChat, useAiFiles } from "../lib/ai/chat";
import { answer, MATERIALS, type Answer } from "../ai/waste-photo-scanner/answer";
import { useMode, useRecords, useRole, useUser } from "../lib/store";

export const Route = createFileRoute("/ai-scanner")({
  head: () => ({ meta: [{ title: "AI Scanner — EnviroWaste" }, { name: "description", content: "Suggest a material category for a waste photo, then review, correct and save it as a human-verified observation. Observations are never measured weights." }] }),
  component: Scanner,
});

type Score = { material: string; score: number };
type Clip = { top_material: string; results: Score[] };
type Obs = { id: string; is_demo: boolean; building: string | null; photo_filename: string | null; classifier: string; suggested_category: string; suggestion_scores: Score[]; reviewed_category: string; reviewed_by: string; reviewed_at: string; notes: string | null; review_history: { at: string; by: string; action: string; category: string; note?: string | null; site_model_label?: string | null }[] };
const COLS = "id,is_demo,building,photo_filename,classifier,suggested_category,suggestion_scores,reviewed_category,reviewed_by,reviewed_at,notes,review_history";
const CLASSIFIER = "CLIP ViT-B/32 zero-shot (original EnviroTrap Nexus scanner service)";

function newestAnswer(messages: UIMessage[]): string {
  const last = messages.at(-1);
  return last?.role === "assistant" ? last.parts.map((p) => (p.type === "text" ? p.text : "")).join("") : "";
}
function parsed(text: string): unknown { try { return JSON.parse(text); } catch { return null; } }
async function sha256(f: File) {
  const h = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function Scanner() {
  const { user, ready } = useUser(); const { role, canWrite } = useRole(user); const mode = useMode();
  const { records } = useRecords();
  const buildings = useMemo(() => [...new Set(records.map((r) => r.building).filter(Boolean) as string[])].sort(), [records]);
  const store = useMemo(() => createAiChatStore("waste-photo-scanner"), []);
  const chat = useAiChat(store, { backend });
  const files = useAiFiles(store, ["image"]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [building, setBuilding] = useState(""); const [notes, setNotes] = useState("");
  const [clip, setClip] = useState<Clip | null>(null); const [clipErr, setClipErr] = useState(""); const [busy, setBusy] = useState(false);
  const [site, setSite] = useState<Answer | null>(null);
  const [cat, setCat] = useState(""); const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState(""); const [obs, setObs] = useState<Obs[]>([]); const [n, setN] = useState(0);
  const [edit, setEdit] = useState<Record<string, { cat: string; note: string }>>({});

  useEffect(() => {
    if (!user) { setObs([]); return; }
    backend.from("waste_observations").select(COLS).eq("is_demo", mode === "demo").order("reviewed_at", { ascending: false }).limit(500)
      .then(({ data }) => setObs((data ?? []) as Obs[]));
  }, [user?.id, mode, n]);

  function pick(list: FileList | null) {
    const f = list?.[0]; if (!f) return;
    setClip(null); setClipErr(""); setSite(null); setCat(""); setOk(false); setMsg("");
    if (!["image/jpeg", "image/png"].includes(f.type)) { setPhoto(null); files.clear(); setClipErr("Attach a JPG or PNG photo of waste."); return; }
    setPhoto(f); files.clear(); files.add([f]);
  }
  async function run() {
    if (!photo) return;
    setBusy(true); setClipErr(""); setClip(null); setSite(null); setCat(""); setOk(false); setMsg("");
    const session = (await backend.auth.getSession()).data.session;
    const fd = new FormData(); fd.append("file", photo);
    const clipP = fetch("/api/clip-classify", { method: "POST", headers: { authorization: "Bearer " + (session?.access_token ?? "") }, body: fd })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "The CLIP scanner failed."); return j as Clip; });
    const siteP = (async () => {
      await store.clear(); await store.send("Classify this waste photo for human review.", files.files);
      const read = answer.safeParse(parsed(newestAnswer(store.chat.messages))); return read.success ? read.data : null;
    })().catch(() => null);
    const [c, s] = await Promise.allSettled([clipP, siteP]);
    if (c.status === "fulfilled") { setClip(c.value); setCat(c.value.results.some((x) => x.material === c.value.top_material) ? c.value.top_material : ""); } else setClipErr(c.reason?.message ?? "The CLIP scanner failed.");
    if (s.status === "fulfilled") setSite(s.value);
    setBusy(false);
  }
  async function save() {
    if (!clip || !photo || !user || !cat || !ok) return;
    const at = new Date().toISOString(); const email = user.email.toLowerCase();
    const { error } = await backend.from("waste_observations").insert({
      is_demo: mode === "demo", building: building || null, photo_filename: photo.name, photo_sha256: await sha256(photo),
      classifier: CLASSIFIER, classifier_service: "tjpppppppppp-envirotrap-ai-backend.hf.space/api/classify",
      suggested_category: clip.top_material, suggestion_scores: clip.results, reviewed_category: cat, human_verified: true, reviewed_by: email, notes: notes || null,
      review_history: [{ at, by: email, action: "verified", category: cat, note: notes || null, site_model_label: site?.label ?? null }],
    });
    if (error) { setMsg("Not saved: " + error.message); return; }
    setMsg("Saved as a human-verified observation."); setPhoto(null); files.clear(); setClip(null); setSite(null); setCat(""); setOk(false); setNotes(""); setN((x) => x + 1);
  }
  async function reReview(o: Obs) {
    const e = edit[o.id]; if (!e) return;
    const at = new Date().toISOString(); const email = (user?.email ?? "").toLowerCase();
    const { error } = await backend.from("waste_observations").update({ reviewed_category: e.cat, notes: e.note || null, reviewed_by: email, reviewed_at: at, human_verified: true,
      review_history: [...o.review_history, { at, by: email, action: "re-reviewed", category: e.cat, note: e.note || null }] }).eq("id", o.id);
    if (error) { setMsg("Not saved: " + error.message); return; }
    setEdit((x) => { const { [o.id]: _, ...rest } = x; return rest; }); setN((x) => x + 1);
  }
  const exp = () => downloadCsv(`reviewed-observations-${mode}.csv`, [["data_set", "reviewed_at", "reviewed_by", "building", "photo_filename", "suggested_category_clip", "reviewed_category", "human_verified", "classifier", "scores_are_probabilities", "notes", "review_history"],
    ...obs.map((o) => [o.is_demo ? "demo" : "project", o.reviewed_at, o.reviewed_by, o.building, o.photo_filename, o.suggested_category, o.reviewed_category, "yes", o.classifier, "no (cosine similarity)", o.notes, JSON.stringify(o.review_history)])]);
  const sel: CSSProperties = { minHeight: 36 };

  return (
    <AppShell title="AI Scanner" active="/ai-scanner">
      <p className="nx-lead">Suggest a material category for a waste photo, then review it. Suggestions come from CLIP, a zero-shot image–text model, and are never verified until you confirm them. Observations are not measured weights and are kept apart from LoadMan and audit data.</p>
      {!ready ? null : !user ? <p className="msg warn">The scanner is for signed-in researchers. <Link to="/sign-in">Sign in</Link> to use it.</p>
        : !canWrite && <p className="msg warn">Your role ({role}) can view this page but only researchers and administrators can scan and save observations.</p>}
      <p className="msg warn" style={{ fontSize: 12.5 }}>Only the photo is sent to the outside CLIP scanner. Building and notes stay in this site's database. Upload waste photos only, never university documents. Saving to <b>{mode === "demo" ? "Demo" : "Project"}</b> data; switch the mode above to change.</p>
      {user && canWrite && <div className="card">
        <h2>1. Photo</h2>
        <div className="bar">
          <label htmlFor="ph" className="sr-only">Waste photo, JPG or PNG</label>
          <input id="ph" type="file" accept={files.accept} onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
        </div>
        {files.picked.map((p) => <div key={p.key} className="bar">{p.preview && <Image src={p.preview} alt={p.name} width={160} height={160} style={{ maxHeight: 160, width: "auto", maxWidth: "100%", borderRadius: 8 }} />}<span>{p.name}{!p.file && !p.error && " — preparing…"}</span>{p.error && <span className="msg warn">{p.error}</span>}</div>)}
        <div className="bar">
          <label htmlFor="bd">Building (optional)</label>
          <select id="bd" className="ctl" style={sel} value={building} onChange={(e) => setBuilding(e.target.value)}>
            <option value="">Not specified</option>{buildings.map((b) => <option key={b}>{b}</option>)}
          </select>
          <Button disabled={!photo || busy || files.uploading} onClick={run}>{busy ? "Classifying…" : "Classify photo"}</Button>
        </div>
        {buildings.length === 0 && <p style={{ fontSize: 12.5 }}>No source-mapper buildings in the {mode} data yet; the observation will be saved without one.</p>}
        {clipErr && <p className="msg warn" role="alert">{clipErr}</p>}
      </div>}
      {clip && <div className="card">
        <h2>2. Suggestion — awaiting human review</h2>
        <p>CLIP's top similarity: <b>{clip.top_material}</b>. Scores are cosine similarities, not probabilities, and say nothing about recyclability.</p>
        <table className="t"><thead><tr><th>Category</th><th>Similarity score</th></tr></thead><tbody>{clip.results.map((r) => <tr key={r.material}><td>{r.material}</td><td>{r.score.toFixed(3)}</td></tr>)}</tbody></table>
        {site ? <p style={{ fontSize: 13 }}>The site's own AI model, a different model from CLIP, also suggests <b>{site.label}</b>{site.reason ? `: ${site.reason}` : "."} This is only a suggestion, not a verified category.</p>
          : chat.errorText && <p style={{ fontSize: 13 }}>The site's AI model gave no second suggestion: {chat.errorText}</p>}
        <h2>3. Review and save</h2>
        <div className="bar">
          <label htmlFor="cat">Category</label>
          <select id="cat" className="ctl" style={sel} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Choose a category</option>{MATERIALS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <label htmlFor="nt">Notes</label>
        <textarea id="nt" className="ctl" style={{ width: "100%", minHeight: 70 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <label className="bar"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I have looked at the photo and verify this category myself.</label>
        <Button disabled={!cat || !ok} onClick={save}>Save verified observation</Button>
      </div>}
      {msg && <p className="msg warn" role="status">{msg}</p>}
      <div className="card scroll">
        <h2>Reviewed observations ({mode === "demo" ? "Demo" : "Project"})</h2>
        <div className="bar"><Button variant="outline" size="sm" disabled={obs.length === 0} onClick={exp}>Export CSV</Button><span>{obs.length} reviewed observations — categories only, no weights</span></div>
        {!user ? <p style={{ fontSize: 13 }}>Sign in to see saved observations.</p> : obs.length === 0 ? <p style={{ fontSize: 13 }}>No reviewed observations yet.</p> :
          <table className="t"><thead><tr><th>Reviewed</th><th>Building</th><th>Photo</th><th>CLIP suggested</th><th>Verified category</th><th>Notes</th><th>History</th><th /></tr></thead>
            <tbody>{obs.map((o) => { const e = edit[o.id]; return <tr key={o.id}>
              <td>{o.reviewed_at.slice(0, 16).replace("T", " ")}<br /><small>{o.reviewed_by}</small></td><td>{o.building ?? <em>not specified</em>}</td><td>{o.photo_filename}</td><td>{o.suggested_category}</td>
              <td>{e ? <select className="ctl" aria-label="Category" value={e.cat} onChange={(x) => setEdit({ ...edit, [o.id]: { ...e, cat: x.target.value } })}>{MATERIALS.map((m) => <option key={m}>{m}</option>)}</select> : o.reviewed_category}</td>
              <td>{e ? <input className="ctl" aria-label="Notes" value={e.note} onChange={(x) => setEdit({ ...edit, [o.id]: { ...e, note: x.target.value } })} /> : o.notes}</td>
              <td>{o.review_history.length} review{o.review_history.length === 1 ? "" : "s"}</td>
              <td>{canWrite && (e ? <Button size="sm" onClick={() => reReview(o)}>Save re-review</Button> : <Button variant="outline" size="sm" onClick={() => setEdit({ ...edit, [o.id]: { cat: o.reviewed_category, note: o.notes ?? "" } })}>Re-review</Button>)}</td></tr>; })}</tbody></table>}
      </div>
    </AppShell>
  );
}
