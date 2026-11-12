import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "../components/shell";
import { fmt, useAudits, useRecords } from "../lib/store";

export const Route = createFileRoute("/source-mapper")({
  head: () => ({ meta: [{ title: "Source Mapper — EnviroTrap Nexus" }, { name: "description", content: "Searchable building directory showing linked records, containers, streams, weights and audits, with each journey link marked verified, inferred or unknown." }] }),
  component: Mapper,
});

function Mapper() {
  const { mode, records, signedIn } = useRecords(); const { audits } = useAudits(mode);
  const [q, setQ] = useState(""); const [sel, setSel] = useState<string | null>(null);
  const dir = useMemo(() => {
    const m = new Map<string, typeof records>(); for (const r of records) { const k = r.building ?? ""; m.set(k, [...(m.get(k) ?? []), r]); }
    return [...m.entries()].filter(([k]) => k).sort((a, b) => a[0].localeCompare(b[0]));
  }, [records]);
  const list = dir.filter(([k]) => k.toLowerCase().includes(q.toLowerCase()));
  const cur = sel ?? list[0]?.[0] ?? null; const recs = cur ? dir.find(([k]) => k === cur)?.[1] ?? [] : [];
  const conts = [...new Set(recs.map((r) => r.container).filter(Boolean))]; const streams = [...new Set(recs.map((r) => r.stream))];
  const w = recs.filter((r) => r.weight != null); const tot = w.reduce((a, r) => a + (r.weight ?? 0), 0);
  const ba = audits.filter((a) => a.building === cur);
  const loadman = recs.some((r) => r.source === "LoadMan export");
  const missing = [recs.some((r) => !r.container) && `${recs.filter((r) => !r.container).length} records without a container ID`, w.length < recs.length && `${recs.length - w.length} records without a weight`, ba.length === 0 && "No waste audit for this building", "Geographic coordinates are not available; no map position is shown"].filter(Boolean) as string[];
  const journey = [
    { n: "Campus Building", s: "Verified", d: cur ? `${cur} appears in ${recs.length} records.` : "" },
    { n: "Collection Point", s: conts.length ? "Verified" : "Unknown", d: conts.length ? `Container IDs on records: ${conts.join(", ")}.` : "No container ID links this building to a collection point." },
    { n: "Truck Pickup", s: recs.length && conts.length ? "Verified" : recs.length ? "Inferred" : "Unknown", d: recs.length && conts.length ? "Pickup records carry the container ID." : "Pickups are attributed to the building but not to a container." },
    { n: "Waste Transfer Station", s: loadman ? "Inferred" : "Unknown", d: loadman ? "Truck-weight records imply a weigh event; station confirmation is not in the data." : "No record shows the station." },
    { n: "Downstream Destination", s: "Unknown", d: "Hauling and disposal records are not loaded." },
  ];
  return (
    <AppShell title="Source Mapper" active="/source-mapper">
      <p className="nx-lead">A searchable building directory and schematic journey. Locations are never invented: where a link is not in the records it is shown as unknown.</p>
      {mode === "project" && records.length === 0 && <p className="msg warn">{signedIn ? "Import a CSV in Waste Explorer to build your directory." : "Sign in to see your own records."}</p>}
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,260px) minmax(0,1fr)" }}>
        <div className="card">
          <label htmlFor="bq" className="sr-only">Search buildings</label>
          <input id="bq" className="ctl" style={{ width: "100%", marginBottom: 8 }} placeholder="Search buildings" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="list">{list.map(([k, v]) => <button key={k} aria-pressed={k === cur} onClick={() => setSel(k)}>{k}<br /><small>{v.length} records</small></button>)}{list.length === 0 && <p style={{ fontSize: 12 }}>No buildings match.</p>}</div>
        </div>
        {cur ? <div className="grid">
          <div className="card"><h2>{cur}</h2>
            <div className="grid three">
              <div><b style={{ fontSize: 20 }}>{fmt(tot, 1)} t</b><br /><small>recorded weight ({w.length} of {recs.length} records weighed)</small></div>
              <div><b style={{ fontSize: 20 }}>{conts.length || "Unknown"}</b><br /><small>containers: {conts.join(", ") || "none recorded"}</small></div>
              <div><b style={{ fontSize: 20 }}>{ba.length}</b><br /><small>audits · streams: {streams.join(", ")}</small></div>
            </div></div>
          <div className="card"><h2>Waste journey</h2>
            <div className="j">{journey.map((j) => <div className="n" key={j.n}><b>{j.n}</b><br /><span className={"st st-" + j.s}>{j.s}</span><p style={{ marginTop: 4 }}>{j.d}</p></div>)}</div></div>
          <div className="grid two">
            <div className="card"><h2>Characterization</h2>{ba.length ? <ul style={{ fontSize: 13 }}>{ba.map((a) => <li key={a.id}>{a.title} · {a.audit_date} · {a.status} · contamination {a.contamination_pct ?? "unknown"}{a.contamination_pct != null && "%"}</li>)}</ul> : <p style={{ fontSize: 13 }}>No characterization results for this building.</p>}</div>
            <div className="card"><h2>Missing information</h2><ul style={{ fontSize: 13 }}>{missing.map((m) => <li key={m}>• {m}</li>)}</ul></div>
          </div>
        </div> : <div className="card">No buildings to show.</div>}
      </div>
    </AppShell>
  );
}
