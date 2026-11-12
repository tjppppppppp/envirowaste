import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "../components/shell";
import { backend } from "../lib/backend";
import { useRole, useUser, type Role } from "../lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings & Guide — EnviroTrap Nexus" }, { name: "description", content: "Your account and role, plus a short guide to running the demonstration, the architecture and the prototype's limits." }] }),
  component: Settings,
});
const ROLES: Role[] = ["viewer", "driver", "fs_staff", "researcher", "administrator"];
function Settings() {
  const { user } = useUser(); const { role } = useRole(user); const [rows, setRows] = useState<any[]>([]); const [msg, setMsg] = useState("");
  useEffect(() => { if (user && role === "administrator") backend.from("user_roles").select("user_id,role,organization").then(({ data }) => setRows(data ?? [])); }, [user?.id, role]);
  const change = async (id: string, r: string) => { const { error } = await backend.from("user_roles").update({ role: r }).eq("user_id", id); setMsg(error ? error.message : "Role updated."); setRows(rows.map((x) => (x.user_id === id ? { ...x, role: r } : x))); };
  return (
    <AppShell title="Settings" active="/settings">
      <div className="card"><h2>Account</h2>
        {user ? <p style={{ fontSize: 13 }}>Signed in as {user.email}. Role: <b>{role.replace("_", " ")}</b>. New accounts start as viewer (least privilege); an administrator grants more.</p> : <p style={{ fontSize: 13 }}><Link to="/sign-in" style={{ textDecoration: "underline" }}>Sign in</Link> to import records, create audits and keep review statuses.</p>}
      </div>
      {role === "administrator" && user && <div className="card"><h2>Users and roles</h2>{msg && <p className="msg" role="status">{msg}</p>}
        <table className="t"><thead><tr><th>User ID</th><th>Organization</th><th>Role</th></tr></thead><tbody>{rows.map((r) => <tr key={r.user_id}><td>{r.user_id}</td><td>{r.organization}</td><td><select aria-label={"Role for " + r.user_id} value={r.role} onChange={(e) => change(r.user_id, e.target.value)}>{ROLES.map((x) => <option key={x}>{x}</option>)}</select></td></tr>)}</tbody></table></div>}
      <div className="card"><h2>Guide: run the demonstration</h2>
        <ol style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
          <li>Open Overview in Demo mode and use the filters; unknown values show hatched, never as zero.</li>
          <li>Sign in, then open Waste Explorer, load the small example file (or your own CSV), check the suggested mapping, review validation and save.</li>
          <li>Switch to Project mode to explore your records in Source Mapper and Collection Log.</li>
          <li>Create an audit in Waste Audits and compare it with the building's collection records.</li>
          <li>Open Insights to review findings, then generate and export the summary in Reports.</li>
        </ol></div>
      <div className="grid two">
        <div className="card"><h2>Architecture and data</h2><p style={{ fontSize: 13, lineHeight: 1.6 }}>A React web app with a hosted PostgreSQL database. Row-level rules keep each person's rows private; writes need the researcher or administrator role. Tables: import_batches (file, mapping, quality summary), import_records (the original row untouched, plus normalized date, kg weight, building, container, stream, flags and a list of transformations), audits (with per-material measurements), insight_reviews and user_roles. Demo data is generated in code and never stored with real data.</p></div>
        <div className="card"><h2>Limitations</h2><ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 16 }}>
          <li>An independent prototype, not an officially deployed university system.</li>
          <li>No integration with university trucks, RFID hardware or LoadMan; no access to Rego's private API.</li>
          <li>RFID tags are not assumed to be operational.</li>
          <li>CSV only (up to 5 MB, 5,000 rows); no Excel, photo upload or QR scanning yet.</li>
          <li>Driver logging, Rego imports, intervention tracking and advanced reports are later phases.</li>
          <li>No map coordinates exist; the mapper is a directory with a schematic journey.</li></ul></div>
      </div>
    </AppShell>
  );
}
