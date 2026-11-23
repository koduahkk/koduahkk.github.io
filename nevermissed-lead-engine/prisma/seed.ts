/**
 * Demo seed: 20 fictional salons with varied outcomes so every screen can be
 * explored without API keys. Phone numbers use the reserved 555-01xx range and
 * emails use the reserved `.example` TLD — nothing here can reach a real business.
 *
 * Run: npm run db:seed   (wipes demo data first)
 */
import { PrismaClient, type CallOutcome, type LeadStage, type Prisma } from "@prisma/client";
import { DateTime } from "luxon";
import { planSalonCalls, seededRng } from "../src/lib/scheduler/slots";
import { scoreLead, stageForTier, DEFAULT_SCORING_RULES } from "../src/lib/scoring/engine";
import { buildMergeData, renderTemplate } from "../src/lib/email/merge";
import { composeEmail } from "../src/lib/email/compose";
import { DEFAULT_STEPS } from "../src/lib/email/templates";
import { instagramDraft, walkInScript } from "../src/lib/email/manual";
import { DEFAULT_SETTINGS } from "../src/lib/settings";
import { zoneFor } from "../src/lib/timezone";
import type { WeeklyHours } from "../src/lib/domain";

const prisma = new PrismaClient();
const rng = seededRng(42);
const NOW = new Date();
const DAY = 86400_000;

const CITY = {
  Atlanta: { state: "GA", lat: 33.749, lng: -84.388, area: "404", zip: "30303" },
  Austin: { state: "TX", lat: 30.267, lng: -97.743, area: "512", zip: "78701" },
  Denver: { state: "CO", lat: 39.739, lng: -104.99, area: "303", zip: "80202" },
  Phoenix: { state: "AZ", lat: 33.448, lng: -112.074, area: "602", zip: "85004" },
  "Los Angeles": { state: "CA", lat: 34.052, lng: -118.244, area: "213", zip: "90012" },
  Seattle: { state: "WA", lat: 47.606, lng: -122.332, area: "206", zip: "98101" },
  Miami: { state: "FL", lat: 25.762, lng: -80.192, area: "305", zip: "33130" },
  Chicago: { state: "IL", lat: 41.878, lng: -87.63, area: "312", zip: "60602" },
} as const;
type City = keyof typeof CITY;

const H = {
  standard: Object.fromEntries(["tue", "wed", "thu", "fri"].map((d) => [d, [{ open: "09:00", close: "19:00" }]]).concat([["sat", [{ open: "09:00", close: "17:00" }]]])) as WeeklyHours,
  late: Object.fromEntries(["mon", "tue", "wed", "thu", "fri"].map((d) => [d, [{ open: "10:00", close: "20:00" }]]).concat([["sat", [{ open: "09:00", close: "18:00" }]]])) as WeeklyHours,
  early: Object.fromEntries(["tue", "wed", "thu", "fri", "sat"].map((d) => [d, [{ open: "08:00", close: "17:00" }]])) as WeeklyHours,
  barber: Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, [{ open: "09:00", close: "19:30" }]]).concat([["sun", [{ open: "11:00", close: "16:00" }]]])) as WeeklyHours,
  split: { tue: [{ open: "09:00", close: "12:30" }, { open: "13:30", close: "18:00" }], wed: [{ open: "09:00", close: "18:00" }], thu: [{ open: "09:00", close: "20:00" }], fri: [{ open: "09:00", close: "18:00" }], sat: [{ open: "10:00", close: "15:00" }] } as WeeklyHours,
};

type Scenario =
  | { kind: "tested"; a: CallOutcome; b: CallOutcome; daysAgo: number; stage?: LeadStage; emailsSent?: number; opened?: boolean; reply?: string; unsubscribed?: boolean; lostReason?: string }
  | { kind: "halfway"; a: CallOutcome }
  | { kind: "scheduled" }
  | { kind: "new" };

type Seed = {
  name: string; city: City; category: string; rating: number; reviews: number; owner?: string;
  email?: string; instagram?: string; platform?: string; hours: WeeklyHours | null; scenario: Scenario;
};

const SALONS: Seed[] = [
  { name: "Glow Studio", city: "Atlanta", category: "hair_salon", rating: 4.8, reviews: 212, owner: "Tasha", email: "hello@glowstudio.example", instagram: "glowstudio.atl", platform: "Vagaro", hours: H.standard, scenario: { kind: "tested", a: "NO_ANSWER_NO_VOICEMAIL", b: "VOICEMAIL_FULL", daysAgo: 6, emailsSent: 2, opened: true } },
  { name: "Fade Factory Barbers", city: "Atlanta", category: "barber_shop", rating: 4.6, reviews: 389, instagram: "fadefactoryatl", platform: "Booksy", hours: H.barber, scenario: { kind: "tested", a: "BUSY", b: "NO_ANSWER_NO_VOICEMAIL", daysAgo: 3 } },
  { name: "Polished Nail Bar", city: "Atlanta", category: "nail_salon", rating: 4.4, reviews: 98, owner: "Linh", email: "book@polishednailbar.example", platform: "Fresha", hours: H.late, scenario: { kind: "tested", a: "NO_ANSWER_NO_VOICEMAIL", b: "VOICEMAIL_WITH_BOOKING_INFO", daysAgo: 4, emailsSent: 1 } },
  { name: "Luxe Lash Lounge", city: "Atlanta", category: "lash_brow", rating: 4.9, reviews: 156, email: "info@luxelash.example", platform: "GlossGenius", hours: H.standard, scenario: { kind: "tested", a: "ANSWERED_HUMAN", b: "ANSWERED_AI_OR_SERVICE", daysAgo: 5 } },
  { name: "The Mane Event", city: "Austin", category: "hair_salon", rating: 4.7, reviews: 274, owner: "Rosa", email: "rosa@librarymane.example", platform: "Square", hours: H.split, scenario: { kind: "tested", a: "VOICEMAIL_FULL", b: "NO_ANSWER_NO_VOICEMAIL", daysAgo: 9, emailsSent: 2, opened: true, reply: "Hi Sam, honestly yes, we miss a ton of calls on Saturdays. What does pricing look like? Could you do a quick call Thursday afternoon?" } },
  { name: "Bloom Day Spa", city: "Austin", category: "spa", rating: 4.5, reviews: 431, owner: "Priya", email: "priya@bloomdayspa.example", platform: "Vagaro", hours: H.early, scenario: { kind: "tested", a: "VOICEMAIL_BASIC", b: "NO_ANSWER_NO_VOICEMAIL", daysAgo: 12, stage: "DEMO_BOOKED", emailsSent: 2, opened: true, reply: "Let's do the demo. Tuesday 2pm works." } },
  { name: "Sharp Edge Barbershop", city: "Austin", category: "barber_shop", rating: 3.9, reviews: 41, hours: H.barber, scenario: { kind: "tested", a: "DISCONNECTED_OR_WRONG_NUMBER", b: "DISCONNECTED_OR_WRONG_NUMBER", daysAgo: 8 } },
  { name: "Velvet Brow Bar", city: "Austin", category: "lash_brow", rating: 4.8, reviews: 188, owner: "Mia", email: "mia@velvetbrow.example", instagram: "velvetbrowbar", platform: "StyleSeat", hours: H.standard, scenario: { kind: "tested", a: "NO_ANSWER_NO_VOICEMAIL", b: "BUSY", daysAgo: 16, stage: "TRIAL", emailsSent: 3, opened: true, reply: "Signed up for the trial, thanks!" } },
  { name: "Crown & Comb", city: "Denver", category: "barber_shop", rating: 4.7, reviews: 302, owner: "Marcus", email: "marcus@crownandcomb.example", platform: "Booksy", hours: H.barber, scenario: { kind: "tested", a: "ANSWERED_HUMAN", b: "NO_ANSWER_NO_VOICEMAIL", daysAgo: 20, stage: "CUSTOMER", emailsSent: 2, opened: true, reply: "We're in. Send the onboarding link." } },
  { name: "Serenity Nails", city: "Denver", category: "nail_salon", rating: 4.2, reviews: 77, email: "serenitynails@mail.example", hours: H.late, scenario: { kind: "tested", a: "ANSWERED_HUMAN", b: "VOICEMAIL_WITH_BOOKING_INFO", daysAgo: 7 } },
  { name: "Halo Hair Co.", city: "Denver", category: "hair_salon", rating: 4.6, reviews: 143, owner: "Jess", email: "jess@halohair.example", platform: "Schedulicity", hours: H.standard, scenario: { kind: "tested", a: "NO_ANSWER_NO_VOICEMAIL", b: "VOICEMAIL_FULL", daysAgo: 10, emailsSent: 1, unsubscribed: true } },
  { name: "Studio 22 Salon", city: "Phoenix", category: "beauty_salon", rating: 4.3, reviews: 65, owner: "Dana", email: "dana@studio22.example", platform: "Vagaro", hours: H.early, scenario: { kind: "tested", a: "BUSY", b: "VOICEMAIL_FULL", daysAgo: 25, stage: "LOST", emailsSent: 4, lostReason: "Happy with front desk staff" } },
  { name: "Gilded Nail Lounge", city: "Phoenix", category: "nail_salon", rating: 4.5, reviews: 120, email: "hello@gildednails.example", platform: "Fresha", hours: H.late, scenario: { kind: "halfway", a: "NO_ANSWER_NO_VOICEMAIL" } },
  { name: "Ritual Skin & Spa", city: "Los Angeles", category: "spa", rating: 4.9, reviews: 512, email: "care@ritualskin.example", platform: "GlossGenius", hours: H.standard, scenario: { kind: "scheduled" } },
  { name: "Kinks & Curls", city: "Seattle", category: "hair_salon", rating: 4.8, reviews: 233, instagram: "kinksandcurlssea", platform: "StyleSeat", hours: H.split, scenario: { kind: "scheduled" } },
  { name: "Cut Above Barbers", city: "Miami", category: "barber_shop", rating: 4.4, reviews: 167, hours: null, scenario: { kind: "scheduled" } },
  { name: "Lacquer Lab", city: "Chicago", category: "nail_salon", rating: 4.6, reviews: 89, email: "studio@lacquerlab.example", hours: H.standard, scenario: { kind: "new" } },
  { name: "Brow Theory", city: "Chicago", category: "lash_brow", rating: 4.7, reviews: 140, instagram: "browtheorychi", platform: "Square", hours: H.late, scenario: { kind: "new" } },
  { name: "Honey Hair Lounge", city: "Atlanta", category: "hair_salon", rating: 4.1, reviews: 52, email: "honeyhair@mail.example", hours: H.standard, scenario: { kind: "new" } },
  { name: "Tress Studio", city: "Atlanta", category: "hair_salon", rating: 4.5, reviews: 71, hours: null, scenario: { kind: "new" } },
];

async function wipe() {
  // Order matters for FKs.
  await prisma.emailEvent.deleteMany();
  await prisma.emailMessage.deleteMany();
  await prisma.sequenceEnrollment.deleteMany();
  await prisma.sequenceStep.deleteMany();
  await prisma.sequence.deleteMany();
  await prisma.task.deleteMany();
  await prisma.leadScore.deleteMany();
  await prisma.callAttempt.deleteMany();
  await prisma.leadContact.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.territory.deleteMany();
  await prisma.senderIdentity.deleteMany();
  await prisma.suppression.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.sourcingRun.deleteMany();
  await prisma.user.deleteMany();
  await prisma.settings.deleteMany();
}

async function main() {
  await wipe();

  const settings = {
    general: { ...DEFAULT_SETTINGS.general, businessName: "NeverMissed", businessAddress: "123 Demo Street, Suite 100, Atlanta, GA 30303", senderName: "Sam from NeverMissed", demoLink: "https://nevermissed.example/demo", demoPhone: "(404) 555-0199" },
    calling: DEFAULT_SETTINGS.calling,
    scoring: DEFAULT_SETTINGS.scoring,
    email: DEFAULT_SETTINGS.email,
  };

  const [admin, caller] = await Promise.all([
    prisma.user.create({ data: { email: "admin@demo.example", name: "Alex Admin", role: "ADMIN", timezone: "America/New_York" } }),
    prisma.user.create({ data: { email: "caller@demo.example", name: "Casey Caller", role: "CALLER", timezone: "America/Chicago" } }),
    prisma.user.create({ data: { email: "viewer@demo.example", name: "Vic Viewer", role: "VIEWER", timezone: "America/Los_Angeles" } }),
  ]);

  const territories = Object.fromEntries(
    await Promise.all(
      (["Atlanta", "Austin", "Denver"] as City[]).map(async (c, i) => [c, await prisma.territory.create({ data: { name: `${c} metro`, city: c, state: CITY[c].state, radiusMeters: 25000, priority: 10 - i * 3 } })] as const),
    ),
  );
  await prisma.settings.create({ data: { id: 1, ...settings, general: { ...settings.general, priorityTerritoryId: territories.Atlanta.id } } });

  const sender = await prisma.senderIdentity.create({ data: { name: "Sam from NeverMissed", email: "sam@outreach.nevermissed.example", replyTo: "sam@nevermissed.example", dailyLimit: 40 } });
  const sequence = await prisma.sequence.create({
    data: {
      name: "Missed-call proof (default)",
      description: "4-step sequence for HOT and WARM leads, using the exact missed call times as proof.",
      autoEnrollTiers: ["HOT", "WARM"],
      steps: { create: DEFAULT_STEPS },
    },
    include: { steps: { orderBy: { order: "asc" } } },
  });


  let i = 0;
  for (const s of SALONS) {
    i++;
    const c = CITY[s.city];
    const lat = c.lat + (rng() - 0.5) * 0.08;
    const lng = c.lng + (rng() - 0.5) * 0.08;
    const zone = zoneFor(lat, lng, c.state)!;
    const phone = `(${c.area}) 555-${String(100 + i).padStart(4, "0")}`;
    const phoneE164 = `+1${c.area}555${String(100 + i).padStart(4, "0")}`;
    const slug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const hasPlace = i % 3 !== 0;
    const lead = await prisma.lead.create({
      data: {
        name: s.name,
        placeId: hasPlace ? `demo_place_${slug}` : null,
        phone,
        phoneE164,
        address: `${100 + i * 7} ${["Peachtree St", "Congress Ave", "Larimer St", "Central Ave", "Sunset Blvd", "Pike St", "Ocean Dr", "Wabash Ave"][Object.keys(CITY).indexOf(s.city)]}`,
        city: s.city,
        state: c.state,
        zip: c.zip,
        lat,
        lng,
        timezone: zone,
        website: `https://${slug}.example`,
        googleRating: s.rating,
        reviewCount: s.reviews,
        category: s.category,
        openingHours: s.hours ?? undefined,
        hoursKnown: !!s.hours,
        placesRefreshedAt: hasPlace ? new Date(NOW.getTime() - (i % 5) * 9 * DAY) : null,
        source: hasPlace ? "GOOGLE_PLACES" : "CSV",
        ownerFirstName: s.owner ?? null,
        primaryEmail: s.email ?? null,
        instagram: s.instagram ?? null,
        bookingPlatform: s.platform ?? null,
        enrichmentStatus: "DONE",
        enrichedAt: new Date(NOW.getTime() - 14 * DAY),
        lineType: i % 4 === 0 ? "MOBILE" : "LANDLINE",
        lineTypeCheckedAt: new Date(NOW.getTime() - 3 * DAY),
        territoryId: territories[s.city as "Atlanta"]?.id ?? null,
        createdAt: new Date(NOW.getTime() - 30 * DAY + i * 3600_000),
      },
    });
    if (s.email) await prisma.leadContact.create({ data: { leadId: lead.id, kind: "EMAIL", value: s.email, isPrimary: true, firstName: s.owner, source: "website" } });
    if (s.instagram) await prisma.leadContact.create({ data: { leadId: lead.id, kind: "INSTAGRAM", value: s.instagram, source: "website" } });

    const sc = s.scenario;
    if (sc.kind === "new") continue;

    // Plan from a point in the past (tested) or now (scheduled) using the real scheduler.
    const planFrom = sc.kind === "tested" ? new Date(NOW.getTime() - sc.daysAgo * DAY - 8 * DAY) : sc.kind === "halfway" ? new Date(NOW.getTime() - 2 * DAY) : NOW;
    const plan = planSalonCalls({ hours: s.hours, zone, now: planFrom, rng })!;
    const plannedFor = DateTime.fromJSDate(planFrom, { zone: "America/New_York" }).toISODate();

    const mk = (type: "A" | "B", at: Date, outcome: CallOutcome | null, by = caller.id): Prisma.CallAttemptCreateManyInput => ({
      leadId: lead.id,
      type,
      scheduledAt: at,
      windowLabel: type === "A" ? plan.a.windowLabel : plan.b.windowLabel,
      hoursAssumed: plan.hoursAssumed,
      ...(outcome
        ? { status: "COMPLETED", outcome, executedAt: new Date(at.getTime() + Math.floor(rng() * 4) * 60_000), callerId: by, durationSec: 20 + Math.floor(rng() * 40), notes: outcome === "ANSWERED_HUMAN" ? "Receptionist was friendly, quoted $65 for a cut." : null }
        : { status: "SCHEDULED" }),
    });

    if (sc.kind === "scheduled") {
      await prisma.callAttempt.createMany({ data: [mk("A", plan.a.at, null), mk("B", plan.b.at, null)] });
      await prisma.lead.update({ where: { id: lead.id }, data: { stage: "TESTING", plannedFor: DateTime.now().setZone("America/New_York").toISODate() } });
      continue;
    }
    if (sc.kind === "halfway") {
      // Call A happened two days ago; Call B is re-planned from now so it lands in a real after-hours slot.
      const later = planSalonCalls({ hours: s.hours, zone, now: NOW, rng, config: { separateDays: false } })!;
      await prisma.callAttempt.createMany({ data: [mk("A", plan.a.at, sc.a), { ...mk("B", later.b.at, null), windowLabel: later.b.windowLabel }] });
      await prisma.lead.update({ where: { id: lead.id }, data: { stage: "TESTING", plannedFor } });
      continue;
    }

    // Tested
    await prisma.callAttempt.createMany({ data: [mk("A", plan.a.at, sc.a), mk("B", plan.b.at, sc.b)] });
    const calls = await prisma.callAttempt.findMany({ where: { leadId: lead.id } });
    const score = scoreLead(calls.map((x) => ({ type: x.type, outcome: x.outcome!, executedAt: x.executedAt! })), zone, DEFAULT_SCORING_RULES)!;
    const scoredAt = new Date(Math.max(...calls.map((x) => x.executedAt!.getTime())) + 60_000);
    await prisma.leadScore.create({ data: { leadId: lead.id, tier: score.tier, reason: score.reason, evidence: score.evidence, computedAt: scoredAt } });

    let stage: LeadStage = sc.stage ?? stageForTier(score.tier);
    const merge = buildMergeData({ ...lead }, calls, { senderName: settings.general.senderName, demoLink: settings.general.demoLink, demoPhone: settings.general.demoPhone });

    if ((score.tier === "HOT" || score.tier === "WARM") && s.email && sc.emailsSent) {
      if (!sc.stage) stage = sc.reply ? "REPLIED" : "EMAILED";
      const enrolledAt = scoredAt;
      const steps = sequence.steps.slice(0, sc.emailsSent);
      const finished = sc.emailsSent >= sequence.steps.length;
      const enr = await prisma.sequenceEnrollment.create({
        data: {
          leadId: lead.id,
          sequenceId: sequence.id,
          enrolledAt,
          status: sc.reply ? "STOPPED_REPLY" : sc.unsubscribed ? "STOPPED_UNSUBSCRIBE" : finished ? "COMPLETED" : "ACTIVE",
          nextStep: sc.emailsSent + 1,
          nextSendAt: sc.reply || sc.unsubscribed || finished ? null : new Date(Math.max(enrolledAt.getTime() + sequence.steps[sc.emailsSent].dayOffset * DAY, NOW.getTime() + 2 * 3600_000)),
          stoppedAt: sc.reply || sc.unsubscribed ? new Date(NOW.getTime() - DAY) : null,
          stopReason: sc.reply ? "Lead replied" : sc.unsubscribed ? "Unsubscribed" : null,
        },
      });
      for (const st of steps) {
        const sentAt = new Date(Math.min(enrolledAt.getTime() + st.dayOffset * DAY + 3600_000, NOW.getTime() - 3600_000));
        const tok = `demo_${slug}_${st.order}`;
        const bodyText = renderTemplate(st.body, merge);
        const composed = composeEmail({ bodyText, businessName: settings.general.businessName, businessAddress: settings.general.businessAddress, unsubscribeUrl: `http://localhost:3000/api/unsubscribe/${tok}` });
        const isLast = st.order === steps.length;
        const msg = await prisma.emailMessage.create({
          data: {
            leadId: lead.id, enrollmentId: enr.id, stepId: st.id, templateKey: st.templateKey, senderId: sender.id, toEmail: s.email,
            subject: renderTemplate(st.subject, merge), bodyText, bodyHtml: composed.html, status: "SENT", scheduledAt: sentAt, sentAt,
            provider: "console", providerMessageId: `console_${tok}`, token: tok,
            openedAt: sc.opened ? new Date(sentAt.getTime() + 5 * 3600_000) : null,
            repliedAt: sc.reply && isLast ? new Date(sentAt.getTime() + 20 * 3600_000) : null,
          },
        });
        await prisma.emailEvent.create({ data: { messageId: msg.id, leadId: lead.id, type: "SENT", occurredAt: sentAt } });
        if (sc.opened) await prisma.emailEvent.create({ data: { messageId: msg.id, leadId: lead.id, type: "OPENED", occurredAt: msg.openedAt! } });
        if (sc.reply && isLast) {
          await prisma.emailEvent.create({ data: { messageId: msg.id, leadId: lead.id, type: "REPLIED", occurredAt: msg.repliedAt!, handled: stage !== "REPLIED", payload: { from: `${s.owner} <${s.email}>`, subject: `Re: ${msg.subject}`, text: sc.reply } } });
        }
        if (sc.unsubscribed && isLast) {
          await prisma.emailEvent.create({ data: { messageId: msg.id, leadId: lead.id, type: "UNSUBSCRIBED", occurredAt: new Date(NOW.getTime() - DAY) } });
          await prisma.suppression.create({ data: { kind: "EMAIL", value: s.email, reason: "UNSUBSCRIBE", note: "One-click unsubscribe" } });
        }
      }
    }

    if ((score.tier === "HOT" || score.tier === "WARM") && !s.email) {
      const tasks: Prisma.TaskCreateManyInput[] = [];
      if (s.instagram) tasks.push({ leadId: lead.id, type: "INSTAGRAM_DM", title: `DM @${s.instagram} on Instagram`, body: instagramDraft(merge), dueAt: NOW, assigneeId: caller.id });
      tasks.push({ leadId: lead.id, type: "WALK_IN", title: `Walk-in visit: ${s.name}`, body: walkInScript(merge), dueAt: new Date(NOW.getTime() + 2 * DAY), assigneeId: caller.id });
      await prisma.task.createMany({ data: tasks });
    }
    if (stage === "DEMO_BOOKED") await prisma.task.create({ data: { leadId: lead.id, type: "FOLLOW_UP", title: `Run demo with ${s.owner} (${s.name})`, dueAt: new Date(NOW.getTime() + DAY), assigneeId: admin.id } });

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        stage,
        currentTier: score.tier,
        scoreReason: score.reason,
        plannedFor,
        lostReason: sc.lostReason ?? (score.tier === "DEAD" ? "Disconnected / wrong number" : null),
        stageOverridden: !!sc.stage,
        notes: sc.stage === "CUSTOMER" ? "Signed annual plan. Wants Booksy integration live before the holidays." : null,
      },
    });
  }

  // Mark one number as do-not-call (Honey Hair Lounge = index 19).
  await prisma.suppression.upsert({ where: { kind_value: { kind: "PHONE", value: "+14045550119" } }, create: { kind: "PHONE", value: "+14045550119", reason: "DO_NOT_CALL" }, update: {} });

  const counts = await prisma.lead.groupBy({ by: ["stage"], _count: true });
  console.log("Seeded 20 salons:", Object.fromEntries(counts.map((c) => [c.stage, c._count])));
  console.log("Demo users: admin@demo.example (Admin), caller@demo.example (Caller), viewer@demo.example (Viewer)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
