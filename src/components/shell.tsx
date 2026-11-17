import { Link } from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";
import { ScanText, BarChart3, Search, MapPin, ListChecks, ClipboardList, FlaskConical, Lightbulb, Settings2, FileText, Settings, ScanSearch, Menu, UserRound, LogOut } from "lucide-react";
import { Image } from "../image";
import { backend } from "../lib/backend";
import { setMode, useMode, useUser } from "../lib/store";

const NAV = [
  { to: "/", label: "Overview", icon: BarChart3 },
  { to: "/explorer", label: "Waste Explorer", icon: Search },
  { to: "/source-mapper", label: "Source Mapper", icon: MapPin },
  { to: "/collection-log", label: "Collection Log", icon: ListChecks },
  { to: "/audits", label: "Waste Audits", icon: ClipboardList },
  { to: "/rego", label: "Rego Research", icon: FlaskConical },
  { to: "/insights", label: "Insights", icon: Lightbulb },
  { to: "/interventions", label: "Interventions", icon: Settings2 },
  { to: "/digitization", label: "Records Digitization", icon: ScanText },
  { to: "/ai-scanner", label: "AI Scanner", icon: ScanSearch },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ title, children, active }: { title: string; children: ReactNode; active: string }) {
  const mode = useMode(); const { user } = useUser(); const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [active]);
  return (
    <div className="nx">
      <aside className={"nx-side" + (open ? " open" : "")}>
        <div className="nx-brand">
          <Image src="/generated-assets/company-logo.png" alt="EnviroWaste logo" width={40} height={40} />
          <span className="nx-name">EnviroWaste</span>
          <button className="nx-burger" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}><Menu size={22} /></button>
        </div>
        <nav aria-label="Main" className="nx-nav">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={"nx-link" + (active === n.to ? " on" : "")} aria-current={active === n.to ? "page" : undefined}>
              <n.icon size={20} strokeWidth={1.8} aria-hidden />{n.label}
            </Link>
          ))}
        </nav>
        <div className="nx-user">
          {user ? (
            <>
              <UserRound size={20} aria-hidden /><span className="nx-email">{user.email}</span>
              <button aria-label="Sign out" onClick={() => backend.auth.signOut()}><LogOut size={16} /></button>
            </>
          ) : (
            <Link to="/sign-in" className="nx-signin"><UserRound size={18} aria-hidden /> Sign in</Link>
          )}
        </div>
      </aside>
      <div className="nx-main">
        <div className={"nx-banner" + (mode === "project" ? " proj" : "")}>
          <span className="nx-banner-t">{mode === "demo" ? "DEMO DATA — NOT ACTUAL UIUC OPERATIONAL RECORDS" : "PROJECT DATA — YOUR PRIVATE UPLOADS"}</span>
          <div className="nx-toggle" role="group" aria-label="Data mode">
            <button aria-pressed={mode === "demo"} className={mode === "demo" ? "on" : ""} onClick={() => setMode("demo")}>Demo</button>
            <button aria-pressed={mode === "project"} className={mode === "project" ? "on" : ""} onClick={() => setMode("project")}>Project</button>
          </div>
        </div>
        <main className="nx-content">
          <h1 className="nx-h1">{title}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}
export function Tag({ k }: { k: "REC" | "CALC" | "UNK" | "EST" }) {
  const t = { REC: "Recorded measurement", CALC: "Calculated value", UNK: "Unknown — not zero", EST: "Estimate" }[k];
  return <span className={"tag tag-" + k} title={t} aria-label={t}>{k}</span>;
}
