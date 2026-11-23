/**
 * Lead ingestion shared by Google Places import, CSV import and manual entry.
 * Dedupes on place_id and on normalized E.164 phone.
 */
import type { LeadSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeEmail, normalizePhone } from "@/lib/suppression";
import { zoneFor } from "@/lib/timezone";
import { hasAnyHours } from "@/lib/scheduler/slots";
import type { WeeklyHours } from "@/lib/domain";

export type LeadInput = {
  placeId?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  ownerFirstName?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  website?: string | null;
  googleRating?: number | null;
  reviewCount?: number | null;
  category?: string | null;
  openingHours?: WeeklyHours | null;
  instagram?: string | null;
  bookingPlatform?: string | null;
  territoryId?: string | null;
};

export { CSV_FIELDS, guessMapping, rowToLeadInput, type CsvMapping, type CsvFieldKey } from "@/lib/leads/csv";

export type IngestResult = { status: "created" | "updated" | "duplicate" | "invalid"; id?: string; error?: string };

export async function ingestLead(input: LeadInput, source: LeadSource, opts: { updateExisting?: boolean } = {}): Promise<IngestResult> {
  const phoneE164 = normalizePhone(input.phone);
  if (!phoneE164 && !input.placeId) return { status: "invalid", error: `${input.name}: no valid phone number` };

  const existing = await prisma.lead.findFirst({
    where: { OR: [...(input.placeId ? [{ placeId: input.placeId }] : []), ...(phoneE164 ? [{ phoneE164 }] : [])] },
  });

  const hours = hasAnyHours(input.openingHours) ? input.openingHours! : null;
  const email = normalizeEmail(input.email);
  const data: Prisma.LeadUncheckedCreateInput = {
    name: input.name,
    placeId: input.placeId || null,
    phone: input.phone ?? null,
    phoneE164,
    address: input.address ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    zip: input.zip ?? null,
    country: input.country ?? "US",
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    timezone: zoneFor(input.lat, input.lng, input.state),
    website: input.website ?? null,
    googleRating: input.googleRating ?? null,
    reviewCount: input.reviewCount != null ? Math.round(input.reviewCount) : null,
    category: input.category ?? null,
    openingHours: hours ?? undefined,
    hoursKnown: !!hours,
    placesRefreshedAt: source === "GOOGLE_PLACES" ? new Date() : null,
    source,
    ownerFirstName: input.ownerFirstName ?? null,
    primaryEmail: email,
    instagram: input.instagram ?? null,
    bookingPlatform: input.bookingPlatform ?? null,
    territoryId: input.territoryId ?? null,
  };

  if (existing) {
    if (!opts.updateExisting) return { status: "duplicate", id: existing.id };
    // Only refresh cached / empty fields — never clobber pipeline state.
    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        placeId: existing.placeId ?? data.placeId,
        address: data.address ?? existing.address,
        city: data.city ?? existing.city,
        state: data.state ?? existing.state,
        zip: data.zip ?? existing.zip,
        lat: data.lat ?? existing.lat,
        lng: data.lng ?? existing.lng,
        timezone: data.timezone ?? existing.timezone,
        website: data.website ?? existing.website,
        googleRating: data.googleRating ?? existing.googleRating,
        reviewCount: data.reviewCount ?? existing.reviewCount,
        ...(hours ? { openingHours: hours, hoursKnown: true } : {}),
        placesRefreshedAt: data.placesRefreshedAt ?? existing.placesRefreshedAt,
        primaryEmail: existing.primaryEmail ?? email,
      },
    });
    return { status: "updated", id: existing.id };
  }

  try {
    const lead = await prisma.lead.create({ data });
    if (email) {
      await prisma.leadContact.create({ data: { leadId: lead.id, kind: "EMAIL", value: email, isPrimary: true, firstName: input.ownerFirstName, source: source.toLowerCase() } });
    }
    return { status: "created", id: lead.id };
  } catch (e) {
    // Unique race (two imports at once) → treat as duplicate.
    if ((e as { code?: string }).code === "P2002") return { status: "duplicate" };
    throw e;
  }
}
