/**
 * Email outreach engine: enrollment, the dispatcher (materialize due steps →
 * queue with spacing + daily limits → send), and the stop conditions
 * (reply, bounce, unsubscribe).
 */
import { DateTime } from "luxon";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettings, type AppSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { isSuppressed, normalizeEmail, suppress } from "@/lib/suppression";
import { buildMergeData, renderTemplate } from "@/lib/email/merge";
import { composeEmail, ComplianceError } from "@/lib/email/compose";
import { allocateSendTimes, nextSendWindow } from "@/lib/email/allocate";
import { getProvider } from "@/lib/email/provider";
import { sign, token as newToken } from "@/lib/crypto";
import { appUrl } from "@/lib/utils";

const DAY_MS = 86400_000;

export async function enrollLead(leadId: string, sequenceId: string, actorId?: string | null) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (!lead.primaryEmail) throw new Error("This lead has no email address.");
  const check = await isSuppressed(prisma, "EMAIL", lead.primaryEmail);
  if (!check.allowed) throw new Error(`Email is suppressed (${check.reason}).`);
  const enr = await prisma.sequenceEnrollment.upsert({
    where: { leadId_sequenceId: { leadId, sequenceId } },
    create: { leadId, sequenceId, nextStep: 1, nextSendAt: new Date() },
    update: {},
  });
  await audit(actorId, "sequence.enroll", { type: "Lead", id: leadId }, { sequenceId });
  return enr;
}

export async function stopEnrollments(
  leadId: string,
  status: "STOPPED_REPLY" | "STOPPED_BOUNCE" | "STOPPED_UNSUBSCRIBE" | "STOPPED_MANUAL",
  reason: string,
  opts: { onlyStopOnReply?: boolean } = {},
) {
  const where: Prisma.SequenceEnrollmentWhereInput = { leadId, status: "ACTIVE", ...(opts.onlyStopOnReply ? { sequence: { stopOnReply: true } } : {}) };
  const active = await prisma.sequenceEnrollment.findMany({ where, select: { id: true } });
  const ids = active.map((a) => a.id);
  if (!ids.length) return 0;
  await prisma.$transaction([
    prisma.sequenceEnrollment.updateMany({ where: { id: { in: ids } }, data: { status, stoppedAt: new Date(), stopReason: reason, nextSendAt: null } }),
    prisma.emailMessage.updateMany({ where: { enrollmentId: { in: ids }, status: "QUEUED" }, data: { status: "CANCELLED", error: reason } }),
  ]);
  return ids.length;
}

function dayBounds(now: Date, zone: string) {
  const s = DateTime.fromJSDate(now, { zone }).startOf("day");
  return { start: s.toJSDate(), end: s.plus({ days: 1 }).toJSDate() };
}

async function senderLoads(settings: AppSettings, now: Date) {
  const senders = await prisma.senderIdentity.findMany({ where: { active: true } });
  const { start, end } = dayBounds(now, settings.general.plannerTimezone);
  return Promise.all(
    senders.map(async (s) => {
      const usedToday = await prisma.emailMessage.count({ where: { senderId: s.id, status: { in: ["QUEUED", "SENT"] }, scheduledAt: { gte: start, lt: end } } });
      const last = await prisma.emailMessage.findFirst({ where: { senderId: s.id, status: { in: ["QUEUED", "SENT"] } }, orderBy: { scheduledAt: "desc" }, select: { scheduledAt: true } });
      return { sender: s, load: { id: s.id, dailyLimit: s.dailyLimit, usedToday, lastScheduledAt: last?.scheduledAt ?? null } };
    }),
  );
}

/** Step 1: turn due enrollment steps into QUEUED messages with send slots. */
export async function materializeDueSteps(now = new Date()) {
  const settings = await getSettings();
  const due = await prisma.sequenceEnrollment.findMany({
    where: { status: "ACTIVE", nextSendAt: { lte: now }, sequence: { active: true } },
    include: { sequence: { include: { steps: { orderBy: { order: "asc" } } } }, lead: { include: { calls: true } } },
    take: 200,
    orderBy: { nextSendAt: "asc" },
  });
  if (!due.length) return { queued: 0, deferred: 0, stopped: 0 };

  const loads = await senderLoads(settings, now);
  if (!loads.length) return { queued: 0, deferred: due.length, stopped: 0, error: "No active sender identities (Settings → Email)." };

  let queued = 0, deferred = 0, stopped = 0;
  const ready: typeof due = [];
  for (const enr of due) {
    const step = enr.sequence.steps.find((s) => s.order === enr.nextStep);
    if (!step) {
      await prisma.sequenceEnrollment.update({ where: { id: enr.id }, data: { status: "COMPLETED", nextSendAt: null } });
      continue;
    }
    const email = enr.lead.primaryEmail;
    const sup = email ? await isSuppressed(prisma, "EMAIL", email) : { allowed: false as const, reason: "NO_EMAIL" };
    if (!sup.allowed) {
      await stopEnrollments(enr.leadId, sup.reason === "BOUNCE" ? "STOPPED_BOUNCE" : "STOPPED_UNSUBSCRIBE", `Suppressed: ${sup.reason}`);
      stopped++;
      continue;
    }
    // Only send inside the lead's local business window.
    const windowAt = nextSendWindow(now, enr.lead.timezone ?? settings.general.plannerTimezone, settings.email.sendWindowStart, settings.email.sendWindowEnd, settings.email.sendDays);
    if (windowAt.getTime() > now.getTime() + 60_000) {
      await prisma.sequenceEnrollment.update({ where: { id: enr.id }, data: { nextSendAt: windowAt } });
      deferred++;
      continue;
    }
    ready.push(enr);
  }

  const slots = allocateSendTimes({
    senders: loads.map((l) => l.load),
    count: ready.length,
    now,
    minSpacingSec: settings.email.minSpacingSec,
    maxSpacingSec: settings.email.maxSpacingSec,
  });

  for (let i = 0; i < ready.length; i++) {
    const enr = ready[i];
    const slot = slots[i];
    if (!slot) {
      // Daily limits reached — try again tomorrow morning.
      const tomorrow = DateTime.fromJSDate(now, { zone: settings.general.plannerTimezone }).plus({ days: 1 }).startOf("day").toJSDate();
      await prisma.sequenceEnrollment.update({ where: { id: enr.id }, data: { nextSendAt: tomorrow } });
      deferred++;
      continue;
    }
    const sender = loads.find((l) => l.sender.id === slot.senderId)!.sender;
    const step = enr.sequence.steps.find((s) => s.order === enr.nextStep)!;
    const merge = buildMergeData(enr.lead, enr.lead.calls, {
      senderName: settings.general.senderName || sender.name,
      demoLink: settings.general.demoLink,
      demoPhone: settings.general.demoPhone,
      rules: settings.scoring,
    });
    const tok = newToken();
    await prisma.$transaction([
      prisma.emailMessage.create({
        data: {
          leadId: enr.leadId,
          enrollmentId: enr.id,
          stepId: step.id,
          templateKey: step.templateKey,
          senderId: sender.id,
          toEmail: enr.lead.primaryEmail!,
          subject: renderTemplate(step.subject, merge),
          bodyText: renderTemplate(step.body, merge),
          bodyHtml: "", // composed at send time (footer + tracking)
          scheduledAt: slot.at,
          token: tok,
        },
      }),
      // Parked until this message is sent; the next step is scheduled then.
      prisma.sequenceEnrollment.update({ where: { id: enr.id }, data: { nextSendAt: null } }),
    ]);
    queued++;
  }
  return { queued, deferred, stopped };
}

export function trackedLink(token: string, url: string) {
  return appUrl(`/api/track/click/${token}?u=${encodeURIComponent(url)}&s=${sign(token + "|" + url)}`);
}

/** Step 2: send QUEUED messages whose slot has arrived. */
export async function sendQueued(now = new Date(), limit = 50) {
  const settings = await getSettings();
  const msgs = await prisma.emailMessage.findMany({
    where: { status: "QUEUED", scheduledAt: { lte: now } },
    include: { sender: true, enrollment: { include: { sequence: { include: { steps: true } } } }, lead: true },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });
  let sent = 0, failed = 0;
  const provider = await getProvider(settings.email.provider);

  for (const m of msgs) {
    // Re-check suppression at the last moment — unsubscribes are immediate.
    const sup = await isSuppressed(prisma, "EMAIL", m.toEmail);
    if (!sup.allowed || (m.enrollmentId && m.enrollment?.status !== "ACTIVE")) {
      await prisma.emailMessage.update({ where: { id: m.id }, data: { status: "CANCELLED", error: sup.allowed ? "Enrollment stopped" : `Suppressed: ${sup.reason}` } });
      continue;
    }
    const unsubscribeUrl = appUrl(`/api/unsubscribe/${m.token}`);
    try {
      const composed = composeEmail({
        bodyText: m.bodyText,
        businessName: settings.general.businessName,
        businessAddress: settings.general.businessAddress,
        unsubscribeUrl,
        trackLink: settings.email.trackClicks ? (u) => trackedLink(m.token, u) : undefined,
        openPixelUrl: settings.email.trackOpens ? appUrl(`/api/track/open/${m.token}`) : undefined,
      });
      const replyTo = settings.email.replyDomain ? `reply+${m.token}@${settings.email.replyDomain}` : m.sender?.replyTo ?? m.sender?.email;
      const res = await provider.send({
        from: { name: m.sender?.name ?? settings.general.senderName, email: m.sender!.email },
        to: m.toEmail,
        replyTo,
        subject: m.subject,
        text: composed.text,
        html: composed.html,
        headers: composed.headers,
        token: m.token,
      });
      const sentAt = new Date();
      await prisma.$transaction(async (tx) => {
        await tx.emailMessage.update({ where: { id: m.id }, data: { status: "SENT", sentAt, provider: provider.name, providerMessageId: res.id, bodyHtml: composed.html } });
        await tx.emailEvent.create({ data: { messageId: m.id, leadId: m.leadId, type: "SENT" } });
        if (["HOT", "WARM", "COLD"].includes(m.lead.stage)) await tx.lead.update({ where: { id: m.leadId }, data: { stage: "EMAILED" } });
        if (m.enrollment) {
          const steps = m.enrollment.sequence.steps.sort((a, b) => a.order - b.order);
          const current = steps.find((s) => s.id === m.stepId);
          const next = steps.find((s) => s.order > (current?.order ?? m.enrollment!.nextStep));
          await tx.sequenceEnrollment.update({
            where: { id: m.enrollment.id },
            data: next
              ? { nextStep: next.order, nextSendAt: new Date(Math.max(m.enrollment.enrolledAt.getTime() + next.dayOffset * DAY_MS, sentAt.getTime() + DAY_MS)) }
              : { status: "COMPLETED", nextSendAt: null, nextStep: (current?.order ?? 0) + 1 },
          });
        }
      });
      sent++;
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.emailMessage.update({ where: { id: m.id }, data: { status: e instanceof ComplianceError ? "QUEUED" : "FAILED", error: msg } });
      if (e instanceof ComplianceError) return { sent, failed, error: msg }; // fix settings first
    }
  }
  return { sent, failed };
}

export async function dispatchEmails(now = new Date()) {
  const materialized = await materializeDueSteps(now);
  const delivered = await sendQueued(now);
  return { ...materialized, ...delivered };
}

// ───────────────────────── Stop conditions ─────────────────────────

export async function handleUnsubscribe(token: string) {
  const m = await prisma.emailMessage.findUnique({ where: { token } });
  if (!m) return null;
  await suppress(prisma, "EMAIL", m.toEmail, "UNSUBSCRIBE", "One-click unsubscribe");
  await prisma.emailEvent.create({ data: { messageId: m.id, leadId: m.leadId, type: "UNSUBSCRIBED" } });
  await stopEnrollments(m.leadId, "STOPPED_UNSUBSCRIBE", "Unsubscribed");
  await audit(null, "email.unsubscribe", { type: "Lead", id: m.leadId });
  return m;
}

export async function handleBounce(where: { providerMessageId?: string; token?: string }, payload?: Prisma.InputJsonValue, hard = true) {
  const m = await prisma.emailMessage.findFirst({ where: where.token ? { token: where.token } : { providerMessageId: where.providerMessageId } });
  if (!m) return null;
  await prisma.emailMessage.update({ where: { id: m.id }, data: { status: "BOUNCED", bouncedAt: new Date() } });
  await prisma.emailEvent.create({ data: { messageId: m.id, leadId: m.leadId, type: "BOUNCED", payload } });
  if (hard) {
    await suppress(prisma, "EMAIL", m.toEmail, "BOUNCE", "Hard bounce");
    await stopEnrollments(m.leadId, "STOPPED_BOUNCE", "Email bounced");
  }
  return m;
}

export async function handleComplaint(where: { providerMessageId?: string; token?: string }) {
  const m = await prisma.emailMessage.findFirst({ where: where.token ? { token: where.token } : { providerMessageId: where.providerMessageId } });
  if (!m) return null;
  await suppress(prisma, "EMAIL", m.toEmail, "COMPLAINT", "Spam complaint");
  await prisma.emailEvent.create({ data: { messageId: m.id, leadId: m.leadId, type: "COMPLAINED" } });
  await stopEnrollments(m.leadId, "STOPPED_UNSUBSCRIBE", "Spam complaint");
  return m;
}

export async function recordEngagement(kind: "OPENED" | "CLICKED" | "DELIVERED", where: { token?: string; providerMessageId?: string }, payload?: Prisma.InputJsonValue) {
  const m = await prisma.emailMessage.findFirst({ where: where.token ? { token: where.token } : { providerMessageId: where.providerMessageId } });
  if (!m) return null;
  const data: Prisma.EmailMessageUpdateInput = {};
  if (kind === "OPENED" && !m.openedAt) data.openedAt = new Date();
  if (kind === "CLICKED" && !m.clickedAt) data.clickedAt = new Date();
  if (Object.keys(data).length) await prisma.emailMessage.update({ where: { id: m.id }, data });
  await prisma.emailEvent.create({ data: { messageId: m.id, leadId: m.leadId, type: kind, payload } });
  return m;
}

/**
 * Inbound reply from webhook or IMAP. Matched by reply+TOKEN@ address, then
 * by In-Reply-To message id, then by the sender's address.
 */
export async function handleReply(input: { from: string; to?: string[]; subject?: string; text?: string; inReplyTo?: string | null }) {
  const tokenMatch = (input.to ?? []).join(",").match(/reply\+([A-Za-z0-9_-]+)@/);
  let m = tokenMatch ? await prisma.emailMessage.findUnique({ where: { token: tokenMatch[1] } }) : null;
  if (!m && input.inReplyTo) {
    const id = input.inReplyTo.replace(/[<>]/g, "");
    m = await prisma.emailMessage.findFirst({ where: { providerMessageId: { in: [id, id.split("@")[0]] } } });
  }
  const fromEmail = normalizeEmail(input.from.match(/<([^>]+)>/)?.[1] ?? input.from);
  if (!m && fromEmail) {
    m = await prisma.emailMessage.findFirst({ where: { toEmail: { equals: fromEmail, mode: "insensitive" }, status: "SENT" }, orderBy: { sentAt: "desc" } });
  }
  if (!m) return null;

  const payload = { from: input.from, subject: input.subject ?? "", text: (input.text ?? "").slice(0, 20000) };
  await prisma.$transaction(async (tx) => {
    await tx.emailMessage.update({ where: { id: m!.id }, data: { repliedAt: m!.repliedAt ?? new Date() } });
    await tx.emailEvent.create({ data: { messageId: m!.id, leadId: m!.leadId, type: "REPLIED", payload } });
    const lead = await tx.lead.findUniqueOrThrow({ where: { id: m!.leadId } });
    if (["NEW", "TESTING", "HOT", "WARM", "COLD", "EMAILED"].includes(lead.stage)) {
      await tx.lead.update({ where: { id: lead.id }, data: { stage: "REPLIED" } });
    }
  });
  await stopEnrollments(m.leadId, "STOPPED_REPLY", "Lead replied", { onlyStopOnReply: true });
  // Auto-replies / "remove me" replies still go to the inbox for a human.
  if (/\b(unsubscribe|remove me|stop emailing|take me off)\b/i.test(payload.text)) {
    await suppress(prisma, "EMAIL", m.toEmail, "UNSUBSCRIBE", "Asked to stop in a reply");
  }
  await audit(null, "email.reply", { type: "Lead", id: m.leadId });
  return m;
}
