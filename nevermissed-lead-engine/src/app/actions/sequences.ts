"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertRole } from "@/lib/auth/session";
import { run } from "@/lib/action";
import { audit } from "@/lib/audit";
import { DEFAULT_STEPS } from "@/lib/email/templates";

const stepSchema = z.object({
  id: z.string().optional(),
  dayOffset: z.number().int().min(0).max(120),
  name: z.string().min(1).max(80),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  templateKey: z.string().min(1).max(60).regex(/^[a-z0-9_]+$/, "lowercase letters, numbers and _ only"),
});
const seqSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  active: z.boolean(),
  stopOnReply: z.boolean(),
  autoEnrollTiers: z.array(z.enum(["HOT", "WARM", "COLD"])),
  steps: z.array(stepSchema).min(1, "Add at least one step"),
});
export type SequenceInput = z.input<typeof seqSchema>;

export async function saveSequence(id: string, input: SequenceInput) {
  return run(async () => {
    const u = await assertRole("ADMIN");
    const d = seqSchema.parse(input);
    const days = d.steps.map((s) => s.dayOffset);
    if (days.some((x, i) => i > 0 && x <= days[i - 1])) throw new Error("Each step must be sent on a later day than the one before it.");
    await prisma.$transaction(async (tx) => {
      await tx.sequence.update({ where: { id }, data: { name: d.name, description: d.description, active: d.active, stopOnReply: d.stopOnReply, autoEnrollTiers: d.autoEnrollTiers } });
      const keep = d.steps.map((s) => s.id).filter(Boolean) as string[];
      await tx.sequenceStep.deleteMany({ where: { sequenceId: id, id: { notIn: keep } } });
      // Re-number in two passes to dodge the (sequenceId, order) unique constraint.
      await tx.sequenceStep.updateMany({ where: { sequenceId: id }, data: { order: { increment: 1000 } } });
      for (const [i, s] of d.steps.entries()) {
        const data = { order: i + 1, dayOffset: s.dayOffset, name: s.name, subject: s.subject, body: s.body, templateKey: s.templateKey };
        if (s.id) await tx.sequenceStep.update({ where: { id: s.id }, data });
        else await tx.sequenceStep.create({ data: { ...data, sequenceId: id } });
      }
    });
    await audit(u.id, "sequence.update", { type: "Sequence", id });
    revalidatePath("/sequences");
    revalidatePath(`/sequences/${id}`);
    return { message: "Sequence saved" };
  });
}

export async function createSequence() {
  const u = await assertRole("ADMIN");
  const s = await prisma.sequence.create({ data: { name: "New sequence", autoEnrollTiers: [], active: false, steps: { create: DEFAULT_STEPS.map((st) => ({ ...st, templateKey: `${st.templateKey}_${Date.now().toString(36)}` })) } } });
  await audit(u.id, "sequence.create", { type: "Sequence", id: s.id });
  redirect(`/sequences/${s.id}`);
}

export async function deleteSequence(id: string) {
  return run(async () => {
    const u = await assertRole("ADMIN");
    const active = await prisma.sequenceEnrollment.count({ where: { sequenceId: id, status: "ACTIVE" } });
    if (active) throw new Error(`${active} lead(s) are still active in this sequence. Pause it instead.`);
    await prisma.sequence.delete({ where: { id } });
    await audit(u.id, "sequence.delete", { type: "Sequence", id });
    revalidatePath("/sequences");
    return { message: "Deleted" };
  });
}

export async function runEmailDispatcher() {
  return run(async () => {
    await assertRole("ADMIN");
    const { dispatchEmails } = await import("@/lib/jobs/email");
    const r = await dispatchEmails();
    revalidatePath("/sequences");
    if ("error" in r && r.error) throw new Error(r.error);
    return { message: `Queued ${r.queued}, sent ${r.sent}, deferred ${r.deferred}${r.failed ? `, failed ${r.failed}` : ""}` };
  });
}
