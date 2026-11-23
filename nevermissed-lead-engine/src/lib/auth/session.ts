/**
 * Authentication + role checks.
 *
 * Two modes:
 *  - Supabase Auth (production): magic-link sign-in; the Supabase user is
 *    matched to an invited `User` row by email. The very first sign-in on an
 *    empty database becomes the Admin.
 *  - Demo mode (DEMO_MODE=true, local only unless ALLOW_DEMO_IN_PRODUCTION):
 *    pick a seeded user on the login page. Lets every screen be explored
 *    without any API keys.
 */
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sign, verify } from "@/lib/crypto";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";

export const DEMO_COOKIE = "nm_demo_user";

export function isDemoMode() {
  if (process.env.DEMO_MODE !== "true") return false;
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_IN_PRODUCTION === "true";
}

export function authMode(): "demo" | "supabase" | "unconfigured" {
  if (isDemoMode()) return "demo";
  return supabaseConfigured() ? "supabase" : "unconfigured";
}

export function demoCookieValue(userId: string) {
  return `${userId}.${sign("demo:" + userId)}`;
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const mode = authMode();
  if (mode === "demo") {
    const raw = (await cookies()).get(DEMO_COOKIE)?.value;
    if (!raw) return null;
    const [id, sig] = raw.split(".");
    if (!id || !sig || !verify("demo:" + id, sig)) return null;
    return prisma.user.findFirst({ where: { id, active: true } });
  }
  if (mode !== "supabase") return null;

  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  const au = data.user;
  if (!au?.email) return null;

  const email = au.email.toLowerCase();
  let user = await prisma.user.findFirst({ where: { OR: [{ authId: au.id }, { email }] } });
  if (!user) {
    // Bootstrap: first person to sign in on an empty install becomes Admin.
    const count = await prisma.user.count();
    if (count > 0) return null; // not invited
    user = await prisma.user.create({ data: { email, authId: au.id, role: "ADMIN", name: au.user_metadata?.name ?? null } });
  } else if (!user.authId) {
    user = await prisma.user.update({ where: { id: user.id }, data: { authId: au.id } });
  }
  return user.active ? user : null;
});

const RANK: Record<Role, number> = { VIEWER: 0, CALLER: 1, ADMIN: 2 };

export function hasRole(user: Pick<User, "role"> | null, min: Role) {
  return !!user && RANK[user.role] >= RANK[min];
}

/** For pages: redirect to /login when signed out. */
export async function requireUser(min: Role = "VIEWER"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, min)) redirect("/dashboard?denied=1");
  return user;
}

export class AuthError extends Error {}

/** For server actions / route handlers: throw instead of redirecting. */
export async function assertRole(min: Role): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("You are signed out. Please sign in again.");
  if (!hasRole(user, min)) throw new AuthError(`This action needs the ${min.toLowerCase()} role.`);
  return user;
}
