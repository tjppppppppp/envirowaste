import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "../components/shell";
import { backend } from "../lib/backend";
import { insights } from "../lib/analysis";
import { useAudits, useRecords, useRole, useUser } from "../lib/store";

export const Route = createFileRoute("/insights")({
  head: () => ({ meta: [{ title: "Insights — EnviroWaste" }, { name: "description", content: "Evidence-based research insights with source, uncertainty, missing attribution and human-review status." }] }),
  component: Insights,
});
const ST = ["Under Investigation", "Validated", "Rejected", "Recommended for Action"];
function Insights() {
  const { user } = useUser(); const { canWrite } = useRole(user); const { mode, records } = useRecords(); const { audits } = useAudits(mode);
  const list = insights(records, audits); const [rev, setRev] = useState<Record<string, string>>({}); const [msg, setMsg] = useState("");
  useEffect(() => { if (user) backend.from("insight_reviews").select("insight_key,status").then(({ data }) => setRev(Object.fromEntries((data ?? []).map((d) => [d.insight_key, d.status])))); }, [user?.id]);
  const set = async (key: string, status: string) => {
    setRev({ ...rev, [key]: status }); setMsg("");
    if (!user) { setMsg("Sign in to keep review statuses."); return; }
    const { error } = await backend.from("insight_reviews").upsert({ user_id: user.id, insight_key: key, status, updated_at: new Date().toISOString() }, { onConflict: "user_id,insight_key" });
    setMsg(error ? (error.code === "42501" ? "Your role cannot change review status." : error.message) : "Review status saved.");
  };
  return (
    <AppShell title="Insights" active="/insights">
      <p className="nx-lead">Each finding is a suggestion computed from the selected dataset. It states its evidence and uncertainty and needs human review; nothing is implemented automatically.</p>
      <div className="card"><h2>Sourced research context</h2><p style={{ fontSize: 13 }}>EnviroTrap analyzed a consolidated dataset containing approximately 79,533 LoadMan truck-weight records. Only 9,989 records could be attributed to specific buildings using the full dataset as the denominator. This represents approximately 12.6%. These findings do not mean that 87.4% of all campus waste is untracked. They indicate limitations in the building attribution available within the analyzed dataset.</p></div>
      {msg && <p className="msg" role="status">{msg}</p>}
      {list.length === 0 && <p className="msg warn">No records in this dataset yet, so there is nothing to base insights on.</p>}
      <div className="grid two">{list.map((i) => (
        <article key={i.key} className="card">
          <h2>{i.title}</h2>
          <p style={{ fontSize: 13 }}><b>Finding:</b> {i.finding}</p>
          <p style={{ fontSize: 13 }}><b>Evidence:</b> {i.evidence}</p>
          <p style={{ fontSize: 13 }}><b>Uncertainty:</b> {i.uncertainty}</p>
          <div className="fld" style={{ marginTop: 8 }}><label htmlFor={"r-" + i.key}>Human review status {rev[i.key] ? "" : "(not yet reviewed)"}</label>
            <select id={"r-" + i.key} value={rev[i.key] ?? ""} disabled={!!user && !canWrite} onChange={(e) => e.target.value && set(i.key, e.target.value)}><option value="">Select status</option>{ST.map((s) => <option key={s}>{s}</option>)}</select></div>
        </article>))}</div>
    </AppShell>
  );
}
