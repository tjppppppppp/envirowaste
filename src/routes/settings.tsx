import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "../components/shell";
import { backend } from "../lib/backend";
import { MappingAdmin } from "../components/mapping-admin";
import { useRole, useUser, type Role } from "../lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings & Guide — EnviroWaste" }, { name: "description", content: "Your account and role, plus a short guide to running the demonstration, the architecture and the prototype's limits." }] }),
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
      {role === "administrator" && user && <MappingAdmin email={user.email} />}
      <div className="card"><h2>Guide: run the demonstration</h2>
        <ol style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
          <li>Open Overview in Demo mode and use the filters; unknown values show hatched, never as zero.</li>
          <li>Sign in, then open Waste Explorer, load the small example file (or your own CSV), check the suggested mapping, review validation and save.</li>
          <li>Switch to Project mode to explore your records in Source Mapper and Collection Log.</li>
          <li>Create an audit in Waste Audits and compare it with the building's collection records. Your choice of Demo or Project mode is remembered after reload.</li>
          <li>Drivers: sign in with the driver role (an administrator grants it above), open Collection Log → Driver entry, pick a truck and route, enter full and empty weight, review and save; download the Excel-compatible CSV.</li>
          <li>Records Digitization: step through the synthetic samples, or (researcher/administrator) upload a PNG, JPEG or PDF ticket, enter and verify fields, and export.</li>
          <li>Open Insights to review findings, then generate and export the summary in Reports.</li>
        </ol></div>

      <div className="card" id="roadmap"><h2>Roadmap: implemented vs planned</h2>
        <table className="t"><thead><tr><th>Order</th><th>Item</th><th>Status</th></tr></thead><tbody>
          <tr><td>—</td><td>Overview dashboard, LoadMan-style CSV importer with data quality, Source Mapper, Waste Audit Manager, Insights, Reports (completed earlier)</td><td>Implemented</td></tr>
          <tr><td>1</td><td>Driver workflow: login identity, automatic time, truck → route autofill, editable defaults, weight validation, net weight, review, save, CSV export; optional recorded building and container</td><td>Implemented. Demo mappings are synthetic and administrator-editable in Settings (changes recorded); real mappings need F&amp;S</td></tr>
          <tr><td>2</td><td>Waste Explorer: .xlsx and CSV import with column mapping; driver entries connected with building attribution and data quality, kept separate by demo/project</td><td>Implemented. A driver entry is linked to a building only when the driver recorded one; otherwise unknown. No individual pickup matching and no causation are inferred</td></tr>
          <tr><td>3</td><td>Records Digitization: private PNG/JPEG/PDF upload, document type, preview, human-entered fields, missing/duplicate flags, verification, correction history, CSV export; mock extraction only for synthetic samples</td><td>Implemented. No OCR or AI extraction is implemented or claimed</td></tr>
          <tr><td>4</td><td>Research integration: connect operational data with audits, characterization and recommendations</td><td>Partly: audit vs collection comparison, plus driver-entry attribution comparison in Waste Explorer; fuller integration planned</td></tr>
          <tr><td>Later</td><td>Importing supported route-data exports from route-management platforms (exploratory; not confirmed requirements)</td><td>Planned. No route optimization and no unapproved university integrations</td></tr>
          <tr><td>Later</td><td>Rego imports, intervention tracker, audit photo upload, QR scanning, TIFF tickets, local OCR</td><td>Planned</td></tr>
        </tbody></table></div>
      <div className="card"><h2>Hypothesis to test with F&amp;S: custom driver form vs Microsoft Forms/Excel</h2>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>This is a hypothesis, not a result validated with drivers. Microsoft Forms plus Excel is cheap, familiar and may be enough. The custom form may help where it (a) fills work order, material and disposal location from the chosen truck and route, so drivers type less, (b) blocks impossible weights (negative, or full below empty) at entry and calculates net weight, and (c) keeps the autofilled original and each correction. It adds hosting, access control and maintenance cost, and it depends on F&amp;S supplying authorized mappings. Both approaches end in Excel-compatible CSV, so neither requires a proprietary integration. Test with a small F&amp;S trial before preferring either.</p></div>
      <div className="card"><h2>Confirmations needed from F&amp;S</h2>
        <ul style={{ fontSize: 13, lineHeight: 1.7, paddingLeft: 16 }}>
          <li>Which datasets are authorized for use, and how they must be handled and stored.</li>
          <li>Actual trucks, routes, materials, work orders and disposal-location mapping (none are assumed here).</li>
          <li>Which drivers and researchers get access, and what sharing is permitted.</li>
          <li>Exceptions: unusual loads, split loads, missing work orders, re-weighs.</li>
          <li>Weights and units in use, and rounding rules.</li>
          <li>The Microsoft export format (columns, Excel or CSV, Forms/SharePoint expectations).</li>
          <li>Institution security approvals required before any real operational data or documents are used.</li>
        </ul>
        <p style={{ fontSize: 13, marginTop: 6 }}>EnviroWaste is an independent prototype, not UIUC-approved for production.</p></div>
      <div className="grid two">
        <div className="card"><h2>Architecture and data</h2><p style={{ fontSize: 13, lineHeight: 1.6 }}>A React web app with a hosted PostgreSQL database. Row-level rules keep each person's rows private; research writes need the researcher or administrator role, and collection entries (collection_entries: identity and timestamp set by the database, net weight calculated by the database, original autofill and corrections kept, no edits or deletes) can be written by driver, researcher or administrator roles only. Tables: import_batches (file, mapping, quality summary), import_records (the original row untouched, plus normalized date, kg weight, building, container, stream, flags and a list of transformations), audits (with per-material measurements), insight_reviews and user_roles. Demo data is generated in code and never stored with real data.</p></div>
        <div className="card"><h2>Limitations</h2><ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 16 }}>
          <li>An independent prototype, not an officially deployed university system.</li>
          <li>No integration with university trucks, RFID hardware or LoadMan; no access to Rego's private API.</li>
          <li>RFID tags are not assumed to be operational.</li>
          <li>Waste Explorer imports .xlsx (first sheet) and CSV, up to 5 MB and 5,000 rows; legacy .xls is not supported. Exports are Excel-compatible CSV (UTF-8 with BOM), not .xlsx. No audit photo upload or QR scanning yet.</li>
          <li>Truck, route, work-order and disposal mappings in the driver form are synthetic demonstrations, never actual UIUC assignments; project mode has no mappings configured.</li>
          <li>Records Digitization accepts PNG, JPEG and PDF up to 2.5 MB (not TIFF); files are stored privately in the project database, readable only by the uploader, checked by file signature, and are not sent to any third party. Documents are held base64-encoded in the database, with no virus scanning and no encryption beyond the host's default storage encryption. Fields are entered by a human; mock extraction exists only for synthetic samples; no OCR or AI is implemented.</li>
          <li>Rego imports and intervention tracking are later phases. Driver mappings in project mode are still not configured. Not UIUC-approved for production; no route optimization or unapproved university integrations.</li>
          <li>No map coordinates exist; the mapper is a directory with a schematic journey.</li></ul></div>
      </div>
    </AppShell>
  );
}
