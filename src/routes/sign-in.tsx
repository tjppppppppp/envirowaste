import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "../components/shell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { backend } from "../lib/backend";
import { finishGoogleSignIn, signInWithGoogle } from "../integrations/foundable/sign-in";

export const Route = createFileRoute("/sign-in")({
  head: () => ({ meta: [{ title: "Sign in — EnviroTrap Nexus" }, { name: "description", content: "Sign in to keep your uploaded records and audits private to your account." }] }),
  component: SignIn,
});
function SignIn() {
  const nav = useNavigate(); const [email, setEmail] = useState(""); const [code, setCode] = useState(""); const [sent, setSent] = useState(false); const [msg, setMsg] = useState(""); const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); finishGoogleSignIn(backend).then((r) => { if (r === "signed-in") nav({ to: "/" }); else if (r === "failed" || r === "cancelled" || r === "not-started") setMsg("Google sign-in did not complete. Try again."); }); }, []);
  const send = async (e: React.FormEvent) => { e.preventDefault(); const { error } = await backend.auth.signInWithOtp({ email }); if (error) setMsg("Could not send a code: " + error.message); else { setSent(true); setMsg("We emailed you a code."); } };
  const verify = async (e: React.FormEvent) => { e.preventDefault(); const { error } = await backend.auth.verifyOtp({ email, token: code, type: "email" }); if (error) { setMsg("That code did not work. Request a new one."); setSent(false); } else nav({ to: "/" }); };
  return (
    <AppShell title="Sign in" active="/sign-in">
      <div className="card" style={{ maxWidth: 460 }}>
        <p style={{ fontSize: 13, marginBottom: 10 }}>Your uploaded records and audits are private to your account.</p>
        <Button onClick={() => signInWithGoogle()} disabled={!ready}>Sign in with Google</Button>
        <hr style={{ margin: "14px 0" }} />
        {!sent ? <form onSubmit={send} className="fld"><label htmlFor="em">Email me a code</label><Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /><Button type="submit" variant="outline" disabled={!ready}>Email me a code</Button></form>
          : <form onSubmit={verify} className="fld"><label htmlFor="cd">Code from your email</label><Input id="cd" required value={code} onChange={(e) => setCode(e.target.value)} /><Button type="submit">Verify and sign in</Button></form>}
        {msg && <p className="msg" role="status" style={{ marginTop: 10 }}>{msg}</p>}
      </div>
    </AppShell>
  );
}
