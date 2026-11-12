import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/shell";

export const Route = createFileRoute("/rego")({
  head: () => ({ meta: [{ title: "Rego Research — EnviroTrap Nexus" }, { name: "description", content: "Rego characterization data is planned for a later phase." }] }),
  component: () => (
    <AppShell title="Rego Research" active="/rego">
      <div className="card" style={{ maxWidth: 640 }}>
        <h2>Planned for a later phase</h2>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>Importing Rego characterization results will be built once supported exports or authorized access exist. Nexus has no access to Rego's private API and does not scrape Rego's platform. Until then, record physical findings in Waste Audits.</p>
      </div>
    </AppShell>
  ),
});
