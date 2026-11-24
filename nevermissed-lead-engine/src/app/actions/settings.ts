"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
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
    if (section === "sourcing" && (value as { enabled?: boolean }).enabled) {
      const { sourcingSchema, setupGaps } = await import("@/lib/sourcing/plan");
      const gaps = setupGaps(sourcingSchema.parse(value), await prisma.territory.count({ where: { active: true } }));
      if (gaps.length) throw new Error(`Before switching on daily salon finding: ${gaps.join(" ")}`);
      await audit(u.id, "settings.sourcing_enabled");
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

const territorySchema = z.object({
  state: z.string().length(2),
  /** "any" = rotate through every city in the state; "cities" = only the listed ones. */
  mode: z.enum(["any", "cities"]),
  cities: z.array(z.string().min(1)).max(200).default([]),
});

/** City names for one state (largest first), for the territory picker. */
export async function getCities(state: string) {
  await assertRole("VIEWER");
  const { citiesIn } = await import("@/lib/sourcing/cities");
  return citiesIn(state).map((c) => ({ name: c.name, population: c.population }));
}

export async function addTerritories(input: z.input<typeof territorySchema>) {
  return run(async () => {
    const u = await assertRole("ADMIN");
    const t = territorySchema.parse(input);
    const { STATE_NAMES, findCity, territoryLabel } = await import("@/lib/sourcing/cities");
    const state = t.state.toUpperCase();
    if (!STATE_NAMES[state]) throw new Error("Choose a state.");
    const existing = await prisma.territory.findMany({ where: { state } });
    const has = (city: string | null) => existing.some((e) => (e.city ?? null) === city);
    let rows: { city: string | null }[];
    let already: string[] = [];
    if (t.mode === "any") {
      if (has(null)) throw new Error(`${STATE_NAMES[state]} (any city) is already a territory.`);
      rows = [{ city: null }];
    } else {
      if (!t.cities.length) throw new Error("Pick at least one city, or choose Any city.");
      const unknown = t.cities.filter((c) => !findCity(state, c));
      if (unknown.length) throw new Error(`Not in the ${STATE_NAMES[state]} city list: ${unknown.join(", ")}`);
      const all = t.cities.map((c) => findCity(state, c)!.name);
      rows = all.filter((c) => !has(c)).map((city) => ({ city }));
      already = all.filter((c) => has(c));
      if (!rows.length) throw new Error("Those cities are already territories.");
    }
    await prisma.territory.createMany({ data: rows.map((r) => ({ state, city: r.city, name: territoryLabel({ state, city: r.city }) })) });
    await audit(u.id, "territory.create", undefined, { state, cities: rows.map((r) => r.city ?? "any") });
    revalidatePath("/settings");
    const added = rows.length === 1 ? `Added ${territoryLabel({ state, city: rows[0].city })}` : `Added ${rows.length} cities in ${STATE_NAMES[state]}`;
    return { message: already.length ? `${added}. Already a territory: ${already.join(", ")}.` : added };
  });
}

export async function deleteTerritory(id: string) {
  return run(async () => {
    const u = await assertRole("ADMIN");
    // Leads keep their data; they just lose the territory link.
    await prisma.lead.updateMany({ where: { territoryId: id }, data: { territoryId: null } });
    await prisma.territory.delete({ where: { id } });
    await audit(u.id, "territory.delete", { type: "Territory", id });
    revalidatePath("/settings");
    return { message: "Territory removed. Its salons stay in your leads." };
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

export async function runSourcingNow() {
  return run(async () => {
    const u = await assertRole("ADMIN");
    const { runSourcing } = await import("@/lib/jobs/sourcing");
    const { queueEnrichment } = await import("@/lib/enqueue");
    const r = await runSourcing({ trigger: "manual", actorId: u.id });
    if (!r.ran) throw new Error(r.message);
    if (!r.found && /stopped the run|no matching city/.test(r.message)) throw new Error(r.message);
    await queueEnrichment(r.createdIds);
    revalidatePath("/settings");
    revalidatePath("/leads");
    revalidatePath("/dashboard");
    return { message: r.message };
  });
}

export async function resetTerritoryProgress(id: string) {
  return run(async () => {
    const u = await assertRole("ADMIN");
    await prisma.territory.update({ where: { id }, data: { sourcingCursor: Prisma.DbNull, exhaustedAt: null } });
    await audit(u.id, "territory.reset_search", { type: "Territory", id });
    revalidatePath("/settings");
    return { message: "Search progress reset. The next run starts from the center again (salons you already have are skipped)." };
  });
}
