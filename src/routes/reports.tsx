import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "../components/shell";
import { Button } from "../components/ui/button";
import { insights, stats, weekly } from "../lib/analysis";
import { fmt, useAudits, useRecords } from "../lib/store";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — EnviroWaste" }, { name: "description", content: "Generate and export a research summary from the selected dataset and audits." }] }),
  component: Reports,
});
function Reports() {
  const { mode, records } = useRecords(); const { audits } = useAudits(mode); const [text, setText] = useState("");
  const gen = () => {
    const s = stats(records); const wk = weekly(records); const ins = insights(records, audits);
    const dates = records.map((r) => r.date).filter(Boolean).sort();
    setText([
      `EnviroWaste research summary`, `Generated ${new Date().toLocaleString()}`,
      mode === "demo" ? "DATA: DEMO DATA — NOT ACTUAL UIUC OPERATIONAL RECORDS" : "DATA: project records uploaded by the signed-in user",
      "", "COLLECTION RECORDS",
      s.n ? `${fmt(s.n)} records${dates.length ? ` dated ${dates[0]} to ${dates[dates.length - 1]}` : ""}; ${fmt(s.total, 1)} t recorded across ${wk.length} weeks (records without weight excluded, not counted as zero: ${s.missingWeight}).` : "No collection records in this dataset.",
      s.n ? `Attributed to a building: ${fmt(s.attributed)}; unknown building: ${fmt(s.unknown)} (${s.pctUnknown?.toFixed(1)}%). Possible duplicates: ${s.dup}.` : "",
      "", "WASTE AUDITS", ...(audits.length ? audits.map((a) => `- ${a.title} (${a.building}, ${a.audit_date}, ${a.status}, ${a.method}): sample ${a.sample_weight_kg ?? "unknown"} kg; contamination ${a.contamination_pct ?? "unknown"}${a.contamination_pct != null ? "%" : ""}; ` + a.measurements.map((m) => `${m.name} ${m.kg ?? "unknown"}`).join(", ")) : ["No audits in this dataset."]),
      "", "INSIGHTS (suggestions requiring human review)", ...(ins.length ? ins.flatMap((i) => [`- ${i.title}: ${i.finding}`, `  Evidence: ${i.evidence}`, `  Uncertainty: ${i.uncertainty}`]) : ["None."]),
      "", "LIMITATIONS", "Audit samples are point-in-time and are not compared as if they described every pickup. Unknown values are reported as unknown. This is an independent research prototype, not an official university system.",
    ].filter((l) => l !== undefined).join("\n"));
  };
  const dl = (ext: string, type: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = "research-summary." + ext; a.click(); };
  return (
    <AppShell title="Reports" active="/reports">
      <p className="nx-lead">Generate a summary from the dataset selected with the Demo / Project switch (currently {mode}) and its audits.</p>
      <div className="bar"><Button onClick={gen}>Generate research summary</Button><Button variant="outline" disabled={!text} onClick={() => dl("txt", "text/plain")}>Export text</Button><Button variant="outline" disabled={!text} onClick={() => window.print()}>Print / save as PDF</Button></div>
      {text && <div className="card"><pre className="prose" aria-label="Research summary">{text}</pre></div>}
    </AppShell>
  );
}
