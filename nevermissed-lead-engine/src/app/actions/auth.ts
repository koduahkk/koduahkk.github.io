"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DEMO_COOKIE, demoCookieValue, isDemoMode } from "@/lib/auth/session";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";

export async function demoSignIn(userId: string) {
  if (!isDemoMode()) throw new Error("Demo mode is disabled.");
  const user = await prisma.user.findFirstOrThrow({ where: { id: userId, active: true } });
  (await cookies()).set(DEMO_COOKIE, demoCookieValue(user.id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 14 });
  await audit(user.id, "auth.demo_sign_in");
  redirect("/dashboard");
}

export async function signOut() {
  (await cookies()).delete(DEMO_COOKIE);
  if (supabaseConfigured()) await (await supabaseServer()).auth.signOut();
  redirect("/login");
}
