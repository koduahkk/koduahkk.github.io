import { redirect } from "next/navigation";
import { PhoneMissed } from "lucide-react";
import { prisma } from "@/lib/db";
import { authMode, getCurrentUser } from "@/lib/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { demoSignIn } from "@/app/actions/auth";
import { MagicLinkForm } from "./magic-link";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (await getCurrentUser()) redirect("/dashboard");
  const mode = authMode();
  const users = mode === "demo" ? await prisma.user.findMany({ where: { active: true }, orderBy: { role: "asc" } }) : [];

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <PhoneMissed className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl">NeverMissed Lead Engine</CardTitle>
          <CardDescription>Internal sales tool</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p> : null}
          {mode === "supabase" ? <MagicLinkForm /> : null}
          {mode === "demo" ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Demo mode: pick a seeded user.</p>
              {users.length === 0 ? <p className="text-sm">No users yet. Run <code>npm run db:seed</code>.</p> : null}
              {users.map((u) => (
                <form key={u.id} action={demoSignIn.bind(null, u.id)}>
                  <Button variant="outline" className="h-auto w-full justify-between py-2.5">
                    <span className="text-left">
                      <span className="block font-medium">{u.name ?? u.email}</span>
                      <span className="block text-xs text-muted-foreground">{u.email}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{u.role.toLowerCase()}</span>
                  </Button>
                </form>
              ))}
            </div>
          ) : null}
          {mode === "unconfigured" ? (
            <p className="text-sm text-muted-foreground">
              Authentication isn&apos;t configured. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, or <code>DEMO_MODE=true</code> for local demos.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
