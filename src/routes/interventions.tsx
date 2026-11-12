import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/shell";

export const Route = createFileRoute("/interventions")({
  head: () => ({ meta: [{ title: "Interventions — EnviroTrap Nexus" }, { name: "description", content: "Intervention tracking is planned for a later phase." }] }),
  component: () => (
    <AppShell title="Interventions" active="/interventions">
      <div className="card" style={{ maxWidth: 640 }}>
        <h2>Planned for a later phase</h2>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>Tracking proposed interventions with baselines and follow-up observations comes after the Phase 1 workflows. For now, review findings in Insights.</p>
      </div>
    </AppShell>
  ),
});
