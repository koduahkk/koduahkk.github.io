"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabaseBrowser } from "@/lib/supabase/client";

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (sent) return <p className="text-sm">Check <strong>{email}</strong> for a sign-in link.</p>;
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await supabaseBrowser().auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: true } });
        setBusy(false);
        if (error) toast.error(error.message);
        else setSent(true);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      </div>
      <Button className="w-full" disabled={busy}>
        {busy ? "Sending…" : "Email me a sign-in link"}
      </Button>
      <p className="text-xs text-muted-foreground">Only invited team members can sign in. The first sign-in on a new install becomes the Admin.</p>
    </form>
  );
}
