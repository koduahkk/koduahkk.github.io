"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertRole } from "@/lib/auth/session";
import { run } from "@/lib/action";
import { audit } from "@/lib/audit";
import { searchSalons } from "@/lib/places/google";
import { ingestLead, rowToLeadInput, type CsvMapping } from "@/lib/leads/ingest";
import { enrichLead } from "@/lib/jobs/enrich";
import { refreshPlace } from "@/lib/jobs/places";
import { enrollLead, stopEnrollments } from "@/lib/jobs/email";
import { evaluateLead, startOutreach } from "@/lib/jobs/scoring";
import { getSettings } from "@/lib/settings";
import { planSalonCalls, loadFrom } from "@/lib/scheduler/slots";
import { suppress, normalizeEmail } from "@/lib/suppression";
import { trySend } from "@/inngest";
import { LEAD_STAGES, type WeeklyHours } from "@/lib/domain";

/** Kick off enrichment for new leads: via Inngest if configured, else after the response. */
async function queueEnrichment(ids: string[]) {
  if (!ids.length) return;
  const sent = await Promise.all(ids.map((id) => trySend("nm/lead.enrich", { leadId: id })));
  if (sent.every(Boolean)) return;
  after(async () => {
    for (const id of ids.slice(0, 25)) await enrichLead(id).catch(() => {});
  });
}

const placesSchema = z.object({
  location: z.string().min(2, "Enter a city or ZIP"),
  radiusKm: z.coerce.number().min(1).max(50),
  category: z.string(),
  territoryId: z.string().optional(),
  maxResults: z.coerce.number().int().min(1).max(60).default(60),
});

export async function importFromPlaces(input: z.input<typeof placesSchema>) {
  return run(async () => {
    const u = await assertRole("ADMIN");
    const p = placesSchema.parse(input);
    const { places } = await searchSalons({ location: p.location, radiusMeters: p.radiusKm * 1000, category: p.category, maxResults: p.maxResults });
    const counts = { created: 0, updated: 0, duplicate: 0, invalid: 0 };
    const created: string[] = [];
    for (const pl of places) {
      const r = await ingestLead({ ...pl, category: p.category, territoryId: p.territoryId || null }, "GOOGLE_PLACES", { updateExisting: true });
      counts[r.status]++;
      if (r.status === "created" && r.id) created.push(r.id);
    }
    await queueEnrichment(created);
    await audit(u.id, "leads.import.places", undefined, { ...p, ...counts });
    revalidatePath("/leads");
    return { message: `Found ${places.length}: ${counts.created} new, ${counts.updated} refreshed, ${counts.invalid} without a phone.`, data: counts };
  });
}

export async function importCsv(rows: Record<string, string>[], mapping: CsvMapping, territoryId?: string) {
  return run(async () => {
    const u = await assertRole("ADMIN");
    if (!mapping.name || !mapping.phone) throw new Error("Map at least the Salon name and Phone columns.");
    if (rows.length > 5000) throw new Error("Import at most 5,000 rows at a time.");
    const counts = { created: 0, updated: 0, duplicate: 0, invalid: 0 };
    const errors: string[] = [];
    const created: string[] = [];
    for (const row of rows) {
      const input = rowToLeadInput(row, mapping);
      if (!input) {
        counts.invalid++;
        continue;
      }
      const r = await ingestLead({ ...input, territoryId: territoryId || null }, "CSV");
      counts[r.status]++;
      if (r.error && errors.length < 5) errors.push(r.error);
      if (r.status === "created" && r.id) created.push(r.id);
    }
    await queueEnrichment(created);
    await audit(u.id, "leads.import.csv", undefined, { rows: rows.length, ...counts });
    revalidatePath("/leads");
    return { message: `${counts.created} imported, ${counts.duplicate} duplicates skipped, ${counts.invalid} invalid.${errors.length ? " e.g. " + errors.join("; ") : ""}`, data: counts };
  });
}

export async function setStage(leadId: string, stage: string, lostReason?: string) {
  return run(async () => {
    const u = await assertRole("CALLER");
    const s = z.enum(LEAD_STAGES).parse(stage);
    await prisma.lead.update({ where: { id: leadId }, data: { stage: s, stageOverridden: true, lostReason: s === "LOST" ? lostReason || "Marked lost" : null } });
    if (s === "LOST" || s === "CUSTOMER" || s === "DEMO_BOOKED" || s === "TRIAL") await stopEnrollments(leadId, "STOPPED_MANUAL", `Moved to ${s}`);
    await audit(u.id, "lead.stage", { type: "Lead", id: leadId }, { stage: s });
    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    return { message: `Moved to ${s.replace("_", " ").toLowerCase()}` };
  });
}

export async function clearStageOverride(leadId: string) {
  return run(async () => {
    const u = await assertRole("CALLER");
    await prisma.lead.update({ where: { id: leadId }, data: { stageOverridden: false } });
    await evaluateLead(leadId, u.id);
    revalidatePath(`/leads/${leadId}`);
    return { message: "Stage is automatic again" };
  });
}

const editSchema = z.object({
  ownerFirstName: z.string().max(60).optional(),
  primaryEmail: z.string().optional(),
  instagram: z.string().max(60).optional(),
  bookingPlatform: z.string().max(40).optional(),
  website: z.string().max(300).optional(),
  notes: z.string().max(10000).optional(),
});

export async function updateLead(leadId: string, input: z.input<typeof editSchema>) {
  return run(async () => {
    const u = await assertRole("CALLER");
    const d = editSchema.parse(input);
    let email: string | null | undefined = undefined;
    if (d.primaryEmail !== undefined) {
      email = d.primaryEmail.trim() ? normalizeEmail(d.primaryEmail) : null;
      if (d.primaryEmail.trim() && !email) throw new Error("That email address doesn't look valid.");
      if (email) await prisma.leadContact.upsert({ where: { leadId_kind_value: { leadId, kind: "EMAIL", value: email } }, create: { leadId, kind: "EMAIL", value: email, source: "manual", isPrimary: true }, update: { isPrimary: true } });
    }
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        ownerFirstName: d.ownerFirstName?.trim() || (d.ownerFirstName === undefined ? undefined : null),
        primaryEmail: email,
        instagram: d.instagram === undefined ? undefined : d.instagram.replace(/^@/, "").trim() || null,
        bookingPlatform: d.bookingPlatform === undefined ? undefined : d.bookingPlatform || null,
        website: d.website === undefined ? undefined : d.website.trim() || null,
        notes: d.notes,
      },
    });
    await audit(u.id, "lead.update", { type: "Lead", id: leadId }, Object.keys(d));
    revalidatePath(`/leads/${leadId}`);
    return { message: "Saved" };
  });
}

export async function enrichNow(leadId: string) {
  return run(async () => {
    await assertRole("CALLER");
    const r = await enrichLead(leadId);
    revalidatePath(`/leads/${leadId}`);
    if (r.status === "FAILED") throw new Error(`Couldn't read the website: ${r.reason}`);
    if (r.status === "SKIPPED") throw new Error("No website on file.");
    return { message: `Found ${r.emails.length} email(s)${r.instagram ? ", Instagram" : ""}${r.bookingPlatform ? `, ${r.bookingPlatform}` : ""}` };
  });
}

export async function refreshFromGoogle(leadId: string) {
  return run(async () => {
    await assertRole("CALLER");
    await refreshPlace(leadId);
    revalidatePath(`/leads/${leadId}`);
    return { message: "Refreshed from Google Places" };
  });
}

export async function enroll(leadId: string, sequenceId: string) {
  return run(async () => {
    const u = await assertRole("CALLER");
    await enrollLead(leadId, sequenceId, u.id);
    revalidatePath(`/leads/${leadId}`);
    return { message: "Enrolled. The first email goes out in the next send window." };
  });
}

export async function stopSequence(leadId: string) {
  return run(async () => {
    const u = await assertRole("CALLER");
    const n = await stopEnrollments(leadId, "STOPPED_MANUAL", "Stopped by " + (u.name ?? u.email));
    revalidatePath(`/leads/${leadId}`);
    return { message: n ? "Sequence stopped" : "No active sequence" };
  });
}

export async function createManualTasks(leadId: string) {
  return run(async () => {
    const u = await assertRole("CALLER");
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    const tier = lead.currentTier === "HOT" || lead.currentTier === "WARM" ? lead.currentTier : "WARM";
    const r = await startOutreach(leadId, tier, u.id);
    revalidatePath(`/leads/${leadId}`);
    return { message: r.enrolled ? "Enrolled in sequence" : `Created ${"tasks" in r ? r.tasks : 0} manual task(s)` };
  });
}

export async function addToDoNotCall(leadId: string) {
  return run(async () => {
    const u = await assertRole("CALLER");
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    if (!lead.phone) throw new Error("No phone number");
    await suppress(prisma, "PHONE", lead.phone, "DO_NOT_CALL", `From lead ${lead.name}`);
    await prisma.callAttempt.updateMany({ where: { leadId, status: "SCHEDULED" }, data: { status: "CANCELLED", routedReason: "Do-not-call" } });
    await audit(u.id, "lead.dnc", { type: "Lead", id: leadId });
    revalidatePath(`/leads/${leadId}`);
    return { message: "Added to do-not-call. Scheduled calls cancelled." };
  });
}

/** Put one lead into testing right now (outside the daily planner). */
export async function scheduleTestCalls(leadId: string) {
  return run(async () => {
    const u = await assertRole("CALLER");
    const settings = await getSettings();
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { calls: true } });
    if (lead.calls.some((c) => c.status === "SCHEDULED" || c.status === "COMPLETED")) throw new Error("This salon already has test calls.");
    const existing = await prisma.callAttempt.findMany({ where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } }, select: { scheduledAt: true } });
    const plan = planSalonCalls({ hours: lead.hoursKnown ? (lead.openingHours as WeeklyHours) : null, zone: lead.timezone ?? settings.general.plannerTimezone, now: new Date(), config: settings.calling, load: loadFrom(existing.map((e) => e.scheduledAt)) });
    if (!plan) throw new Error("No free slot in the planning horizon.");
    await prisma.callAttempt.deleteMany({ where: { leadId, status: { in: ["CANCELLED", "SKIPPED", "FAILED"] } } });
    const mode = settings.calling.automatedEnabled ? "AUTOMATED" : "HUMAN";
    await prisma.$transaction([
      prisma.callAttempt.create({ data: { leadId, type: "A", scheduledAt: plan.a.at, windowLabel: plan.a.windowLabel, hoursAssumed: plan.hoursAssumed, mode } }),
      prisma.callAttempt.create({ data: { leadId, type: "B", scheduledAt: plan.b.at, windowLabel: plan.b.windowLabel, hoursAssumed: plan.hoursAssumed, mode } }),
      prisma.lead.update({ where: { id: leadId }, data: { stage: "TESTING" } }),
    ]);
    await audit(u.id, "lead.schedule_calls", { type: "Lead", id: leadId });
    revalidatePath(`/leads/${leadId}`);
    return { message: "Call A and Call B scheduled" };
  });
}

const taskSchema = z.object({ leadId: z.string().optional(), type: z.enum(["INSTAGRAM_DM", "WALK_IN", "CALL", "EMAIL", "FOLLOW_UP", "OTHER"]), title: z.string().min(1), body: z.string().optional(), dueAt: z.string().optional() });

export async function createTask(input: z.input<typeof taskSchema>) {
  return run(async () => {
    const u = await assertRole("CALLER");
    const t = taskSchema.parse(input);
    await prisma.task.create({ data: { ...t, dueAt: t.dueAt ? new Date(t.dueAt) : null, assigneeId: u.id } });
    if (t.leadId) revalidatePath(`/leads/${t.leadId}`);
    revalidatePath("/tasks");
    return { message: "Task added" };
  });
}

export async function setTaskStatus(taskId: string, status: "OPEN" | "DONE" | "CANCELLED") {
  return run(async () => {
    const u = await assertRole("CALLER");
    const t = await prisma.task.update({ where: { id: taskId }, data: { status, completedAt: status === "DONE" ? new Date() : null } });
    await audit(u.id, "task.status", { type: "Task", id: taskId }, { status });
    if (t.leadId) revalidatePath(`/leads/${t.leadId}`);
    revalidatePath("/tasks");
    return { message: status === "DONE" ? "Task done" : "Task updated" };
  });
}
