/** Refresh cached Google Places fields (ToS: only place_id is permanent). */
import { prisma } from "@/lib/db";
import { getPlace } from "@/lib/places/google";
import { zoneFor } from "@/lib/timezone";

export const PLACES_STALE_DAYS = 30;

export async function refreshPlace(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (!lead.placeId) throw new Error("This lead has no Google place_id.");
  const p = await getPlace(lead.placeId);
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      name: p.name,
      phone: p.phone ?? lead.phone,
      address: p.address,
      city: p.city,
      state: p.state,
      zip: p.zip,
      lat: p.lat,
      lng: p.lng,
      timezone: zoneFor(p.lat, p.lng, p.state) ?? lead.timezone,
      website: p.website,
      googleRating: p.googleRating,
      reviewCount: p.reviewCount,
      ...(p.openingHours ? { openingHours: p.openingHours, hoursKnown: true } : {}),
      placesRefreshedAt: new Date(),
      ...(p.closedPermanently ? { stage: "LOST", lostReason: "Closed permanently (Google)" } : {}),
    },
  });
  return p;
}

export async function refreshStalePlaces(limit = 50) {
  const cutoff = new Date(Date.now() - PLACES_STALE_DAYS * 86400_000);
  const leads = await prisma.lead.findMany({
    where: { placeId: { not: null }, OR: [{ placesRefreshedAt: null }, { placesRefreshedAt: { lt: cutoff } }] },
    take: limit,
    select: { id: true },
  });
  let ok = 0;
  for (const l of leads) {
    try {
      await refreshPlace(l.id);
      ok++;
    } catch (e) {
      console.warn("refresh failed", l.id, e);
    }
  }
  return { checked: leads.length, refreshed: ok };
}
