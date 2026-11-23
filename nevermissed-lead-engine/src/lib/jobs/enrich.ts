/** Website enrichment: email, Instagram, Facebook, booking platform. */
import { prisma } from "@/lib/db";
import { extractFromHtml, mergeExtracted, type Extracted } from "@/lib/enrichment/extract";
import { fetchPage } from "@/lib/enrichment/fetch";
import { isSuppressed } from "@/lib/suppression";

export async function enrichLead(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (!lead.website) {
    await prisma.lead.update({ where: { id: leadId }, data: { enrichmentStatus: "SKIPPED", enrichedAt: new Date() } });
    return { status: "SKIPPED" as const, reason: "No website" };
  }
  try {
    const home = await fetchPage(lead.website);
    const parts: Extracted[] = [extractFromHtml(home.html, home.url)];
    // If the homepage has no email, try up to two contact/about/booking pages.
    if (!parts[0].emails.length) {
      for (const link of parts[0].contactLinks.slice(0, 2)) {
        try {
          const p = await fetchPage(link);
          parts.push(extractFromHtml(p.html, p.url));
        } catch {
          /* ignore secondary page failures */
        }
      }
    }
    const r = mergeExtracted(parts);

    let primaryEmail = lead.primaryEmail;
    for (const email of r.emails) {
      await prisma.leadContact.upsert({
        where: { leadId_kind_value: { leadId, kind: "EMAIL", value: email } },
        create: { leadId, kind: "EMAIL", value: email, source: "website", isPrimary: !primaryEmail },
        update: {},
      });
      if (!primaryEmail && (await isSuppressed(prisma, "EMAIL", email)).allowed) primaryEmail = email;
    }
    if (r.instagram) {
      await prisma.leadContact.upsert({ where: { leadId_kind_value: { leadId, kind: "INSTAGRAM", value: r.instagram } }, create: { leadId, kind: "INSTAGRAM", value: r.instagram, source: "website" }, update: {} });
    }
    if (r.facebook) {
      await prisma.leadContact.upsert({ where: { leadId_kind_value: { leadId, kind: "FACEBOOK", value: r.facebook } }, create: { leadId, kind: "FACEBOOK", value: r.facebook, source: "website" }, update: {} });
    }
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        primaryEmail,
        instagram: lead.instagram ?? r.instagram,
        facebook: lead.facebook ?? r.facebook,
        bookingPlatform: lead.bookingPlatform ?? r.bookingPlatform,
        enrichmentStatus: "DONE",
        enrichedAt: new Date(),
      },
    });
    return { status: "DONE" as const, ...r };
  } catch (e) {
    await prisma.lead.update({ where: { id: leadId }, data: { enrichmentStatus: "FAILED", enrichedAt: new Date() } });
    return { status: "FAILED" as const, reason: e instanceof Error ? e.message : String(e) };
  }
}

export async function enrichPending(limit = 25) {
  const leads = await prisma.lead.findMany({ where: { enrichmentStatus: "PENDING" }, take: limit, orderBy: { createdAt: "asc" }, select: { id: true } });
  const results = [];
  // Small concurrency to stay polite to salon websites.
  for (let i = 0; i < leads.length; i += 4) {
    results.push(...(await Promise.all(leads.slice(i, i + 4).map((l) => enrichLead(l.id)))));
  }
  return { processed: results.length, found: results.filter((r) => r.status === "DONE").length };
}
