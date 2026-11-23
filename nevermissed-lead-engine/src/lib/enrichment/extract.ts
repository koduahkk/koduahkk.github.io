/**
 * Pure HTML extraction for website enrichment: public contact emails,
 * Instagram handle, Facebook page, and online booking platform.
 */
import type { BookingPlatform } from "@/lib/domain";

export const BOOKING_PATTERNS: { platform: BookingPlatform; re: RegExp }[] = [
  { platform: "Vagaro", re: /vagaro\.com/i },
  { platform: "Booksy", re: /booksy\.com/i },
  { platform: "Fresha", re: /fresha\.com|shedul\.com/i },
  { platform: "GlossGenius", re: /glossgenius\.com|\.glossgenius\./i },
  { platform: "Square", re: /squareup\.com\/appointments|square\.site|book\.squareup\.com/i },
  { platform: "StyleSeat", re: /styleseat\.com/i },
  { platform: "Schedulicity", re: /schedulicity\.com/i },
];

const EMAIL_RE = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi;
const JUNK_EMAIL = /(\.(png|jpe?g|gif|svg|webp)$)|example\.(com|org)|sentry|wixpress|godaddy|domain\.com|email\.com|yourname|@2x|u003e/i;
const IG_RESERVED = new Set(["p", "reel", "reels", "explore", "stories", "accounts", "tv", "about", "developer", "legal", "direct"]);
const FB_RESERVED = new Set(["sharer", "sharer.php", "share", "plugins", "tr", "dialog", "login", "groups", "events", "watch", "help", "policies"]);

export type Extracted = {
  emails: string[];
  instagram: string | null;
  facebook: string | null;
  bookingPlatform: BookingPlatform | null;
  bookingUrl: string | null;
  contactLinks: string[];
};

function decodeEntities(s: string) {
  return s.replace(/&#64;|&commat;/gi, "@").replace(/&#46;|&period;/gi, ".").replace(/&amp;/g, "&");
}

export function extractFromHtml(html: string, baseUrl?: string): Extracted {
  const text = decodeEntities(html);
  const hrefs = Array.from(text.matchAll(/href\s*=\s*["']([^"']+)["']/gi)).map((m) => m[1]);
  const srcs = Array.from(text.matchAll(/src\s*=\s*["']([^"']+)["']/gi)).map((m) => m[1]);

  // Emails: mailto links first (most reliable), then visible text.
  const emails = new Set<string>();
  for (const h of hrefs) {
    const m = h.match(/^mailto:([^?]+)/i);
    if (m) emails.add(decodeURIComponent(m[1]).trim().toLowerCase());
  }
  const visible = text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ");
  for (const m of visible.match(EMAIL_RE) ?? []) emails.add(m.toLowerCase());
  const cleanEmails = Array.from(emails).filter((e) => !JUNK_EMAIL.test(e) && e.length < 80);
  // Prefer the site's own domain, then common inbox names.
  const host = baseUrl ? safeHost(baseUrl)?.replace(/^www\./, "") : null;
  cleanEmails.sort((a, b) => score(b) - score(a));
  function score(e: string) {
    let s = 0;
    if (host && e.endsWith("@" + host)) s += 10;
    if (/^(info|hello|contact|book|booking|appointments|salon|studio|owner)@/.test(e)) s += 3;
    if (/^(noreply|no-reply|support|privacy|abuse)@/.test(e)) s -= 10;
    return s;
  }

  let instagram: string | null = null;
  let facebook: string | null = null;
  for (const h of hrefs) {
    const ig = h.match(/instagram\.com\/([A-Za-z0-9_.]{1,30})\/?(?:[?#].*)?$/i);
    if (!instagram && ig && !IG_RESERVED.has(ig[1].toLowerCase())) instagram = ig[1];
    const fb = h.match(/facebook\.com\/([A-Za-z0-9_.\-]{2,80})\/?(?:[?#].*)?$/i);
    if (!facebook && fb && !FB_RESERVED.has(fb[1].toLowerCase())) facebook = `https://www.facebook.com/${fb[1]}`;
  }

  let bookingPlatform: BookingPlatform | null = null;
  let bookingUrl: string | null = null;
  outer: for (const pool of [hrefs, srcs, [text]]) {
    for (const s of pool) {
      for (const p of BOOKING_PATTERNS) {
        if (p.re.test(s)) {
          bookingPlatform = p.platform;
          bookingUrl = pool === hrefs ? s : null;
          break outer;
        }
      }
    }
  }

  const contactLinks = hrefs
    .filter((h) => /contact|about|book/i.test(h) && !/^(mailto|tel|javascript):/i.test(h))
    .map((h) => absolutize(h, baseUrl))
    .filter((h): h is string => !!h && (!host || safeHost(h)?.replace(/^www\./, "") === host))
    .slice(0, 3);

  return { emails: cleanEmails.slice(0, 5), instagram, facebook, bookingPlatform, bookingUrl, contactLinks };
}

function safeHost(u: string) {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function absolutize(h: string, base?: string) {
  try {
    return new URL(h, base).toString();
  } catch {
    return null;
  }
}

export function mergeExtracted(parts: Extracted[]): Extracted {
  const first = <K extends keyof Extracted>(k: K) => parts.map((p) => p[k]).find((v) => v) ?? null;
  return {
    emails: Array.from(new Set(parts.flatMap((p) => p.emails))).slice(0, 5),
    instagram: first("instagram") as string | null,
    facebook: first("facebook") as string | null,
    bookingPlatform: first("bookingPlatform") as BookingPlatform | null,
    bookingUrl: first("bookingUrl") as string | null,
    contactLinks: [],
  };
}
