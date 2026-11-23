"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertRole } from "@/lib/auth/session";
import { run } from "@/lib/action";
import { saveSettingsSection, type SettingsSection } from "@/lib/settings";
import { SECRET_KEYS, setSecret, type SecretKey } from "@/lib/secrets";
import { suppress, normalizeFor } from "@/lib/suppression";
import { audit } from "@/lib/audit";

export async function saveSection(section: SettingsSection, value: unknown) {
  return run(async () => {
    const u = await assertRole("ADMIN");
    if (section === "calling" && (value as { automatedEnabled?: boolean }).automatedEnabled) {
      // Turning automated mode on is a compliance-relevant change — always audit it.
      await audit(u.id, "settings.automated_calling_enabled");
    }
    await saveSettingsSection(section, value);
    await audit(u.id, "settings.update", { type: "Settings", id: section });
    revalidatePath("/", "layout");
    return { message: "Settings saved" };
  });
}

export async function saveSecret(key: string, value: string) {
  return run(async () => {
    const u = await assertRole("ADMIN");
    if (!SECRET_KEYS.some((s) => s.key === key)) throw new Error("Unknown key");
    await setSecret(key as SecretKey, value.trim() || null);
    await audit(u.id, value.trim() ? "secret.set" : "secret.clear", { type: "Secret", id: key });
    revalidatePath("/settings");
    return { message: value.trim() ? "Key saved (encrypted)" : "Key removed" };
  });
}

const territorySchema = z.object({ name: z.string().min(1), city: z.string().optional(), state: z.string().max(2).optional(), zip: z.string().optional(), radiusKm: z.coerce.number().min(1).max(50).optional(), priority: z.coerce.number().int().default(0) });

export async function addTerritory(input: z.input<typeof territorySchema>) {
  return run(async () => {
    const u = await assertRole("ADMIN");
    const t = territorySchema.parse(input);
    const row = await prisma.territory.create({ data: { name: t.name, city: t.city || null, state: t.state?.toUpperCase() || null, zip: t.zip || null, radiusMeters: t.radiusKm ? t.radiusKm * 1000 : null, priority: t.priority } });
    await audit(u.id, "territory.create", { type: "Territory", id: row.id });
    revalidatePath("/settings");
    return { message: `Territory "${t.name}" added` };
  });
}

export async function toggleTerritory(id: string, active: boolean) {
  return run(async () => {
    await assertRole("ADMIN");
    await prisma.territory.update({ where: { id }, data: { active } });
    revalidatePath("/settings");
    return { message: active ? "Territory activated" : "Territory paused" };
  });
}

const memberSchema = z.object({ email: z.string().email(), name: z.string().optional(), role: z.enum(["ADMIN", "CALLER", "VIEWER"]), timezone: z.string().default("America/New_York") });

export async function inviteMember(input: z.input<typeof memberSchema>) {
  return run(async () => {
    const u = await assertRole("ADMIN");
    const m = memberSchema.parse(input);
    await prisma.user.upsert({ where: { email: m.email.toLowerCase() }, create: { ...m, email: m.email.toLowerCase() }, update: { role: m.role, name: m.name, active: true } });
    await audit(u.id, "team.invite", undefined, { email: m.email, role: m.role });
    revalidatePath("/settings");
    return { message: `${m.email} can now sign in as ${m.role.toLowerCase()}` };
  });
}

export async function updateMember(id: string, data: { role?: "ADMIN" | "CALLER" | "VIEWER"; active?: boolean; timezone?: string }) {
  return run(async () => {
    const u = await assertRole("ADMIN");
    if (id === u.id && (data.role && data.role !== "ADMIN" || data.active === false)) throw new Error("You can't demote or deactivate yourself.");
    await prisma.user.update({ where: { id }, data });
    await audit(u.id, "team.update", { type: "User", id }, data);
    revalidatePath("/settings");
    return { message: "Team member updated" };
  });
}

export async function addSuppression(kind: "PHONE" | "EMAIL", value: string, note?: string) {
  return run(async () => {
    const u = await assertRole("CALLER");
    const v = await suppress(prisma, kind, value, kind === "PHONE" ? "DO_NOT_CALL" : "MANUAL", note);
    if (kind === "PHONE") {
      await prisma.callAttempt.updateMany({ where: { status: "SCHEDULED", lead: { phoneE164: v } }, data: { status: "CANCELLED", routedReason: "Added to do-not-call list" } });
    } else {
      const leads = await prisma.lead.findMany({ where: { primaryEmail: { equals: v, mode: "insensitive" } }, select: { id: true } });
      const { stopEnrollments } = await import("@/lib/jobs/email");
      for (const l of leads) await stopEnrollments(l.id, "STOPPED_MANUAL", "Added to suppression list");
    }
    await audit(u.id, "suppression.add", undefined, { kind, value: v });
    revalidatePath("/settings");
    return { message: `${v} added to the ${kind === "PHONE" ? "do-not-call" : "suppression"} list` };
  });
}

export async function removeSuppression(id: string) {
  return run(async () => {
    const u = await assertRole("ADMIN");
    const s = await prisma.suppression.findUniqueOrThrow({ where: { id } });
    if (s.reason === "UNSUBSCRIBE" || s.reason === "COMPLAINT") throw new Error("Unsubscribes and complaints can't be removed. They must be honored permanently.");
    await prisma.suppression.delete({ where: { id } });
    await audit(u.id, "suppression.remove", undefined, { kind: s.kind, value: s.value });
    revalidatePath("/settings");
    return { message: "Removed" };
  });
}

export async function addSender(input: { name: string; email: string; replyTo?: string; dailyLimit: number }) {
  return run(async () => {
    const u = await assertRole("ADMIN");
    const d = z.object({ name: z.string().min(1), email: z.string().email(), replyTo: z.string().email().optional().or(z.literal("")), dailyLimit: z.coerce.number().int().min(1).max(500) }).parse(input);
    if (!normalizeFor("EMAIL", d.email)) throw new Error("Invalid email");
    await prisma.senderIdentity.create({ data: { name: d.name, email: d.email.toLowerCase(), replyTo: d.replyTo || null, dailyLimit: d.dailyLimit } });
    await audit(u.id, "sender.create", undefined, { email: d.email });
    revalidatePath("/settings");
    return { message: "Sender added" };
  });
}

export async function updateSender(id: string, data: { dailyLimit?: number; active?: boolean }) {
  return run(async () => {
    await assertRole("ADMIN");
    await prisma.senderIdentity.update({ where: { id }, data });
    revalidatePath("/settings");
    return { message: "Sender updated" };
  });
}
