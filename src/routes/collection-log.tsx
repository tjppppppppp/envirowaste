import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "../components/shell";
import { Button } from "../components/ui/button";
import { toCsv } from "../lib/csv";
import { fmt, useRecords } from "../lib/store";

export const Route = createFileRoute("/collection-log")({
  head: () => ({ meta: [{ title: "Collection Log — EnviroTrap Nexus" }, { name: "description", content: "Browse and export collection records in the selected dataset; unknown values stay unknown." }] }),
  component: Log,
});
function Log() {
  const { mode, records } = useRecords(); const [q, setQ] = useState(""); const [page, setPage] = useState(0);
  const f = records.filter((r) => !q || [r.building, r.container, r.stream].join(" ").toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date));
  const exp = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([toCsv([["date", "weight_t", "building", "container", "stream", "source"], ...f.map((r) => [r.date, r.weight, r.building, r.container, r.stream, r.source])])], { type: "text/csv" })); a.download = "collection-log.csv"; a.click(); };
  return (
    <AppShell title="Collection Log" active="/collection-log">
      <p className="nx-lead">Read-only log of collection records in the {mode === "demo" ? "demo" : "project"} dataset. Entering new pickups from a driver interface is planned for a later phase.</p>
      <div className="bar"><label className="sr-only" htmlFor="lq">Filter</label><input id="lq" className="ctl" placeholder="Filter by building, container, stream" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /><Button variant="outline" size="sm" onClick={exp}>Export CSV</Button><span>{fmt(f.length)} records</span></div>
      <div className="card scroll"><table className="t"><thead><tr><th>Date</th><th>Weight (t)</th><th>Building</th><th>Container</th><th>Stream</th><th>Source</th></tr></thead>
        <tbody>{f.slice(page * 25, page * 25 + 25).map((r, i) => <tr key={i}><td>{r.date || <em>unknown</em>}</td><td>{r.weight == null ? <em>unknown</em> : fmt(r.weight, 3)}</td><td>{r.building ?? <em>unknown</em>}</td><td>{r.container || <em>unknown</em>}</td><td>{r.stream}</td><td>{r.source}</td></tr>)}</tbody></table>
        {f.length === 0 && <p style={{ padding: 8, fontSize: 13 }}>No records.</p>}</div>
      <div className="bar"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={(page + 1) * 25 >= f.length} onClick={() => setPage(page + 1)}>Next</Button></div>
    </AppShell>
  );
}
