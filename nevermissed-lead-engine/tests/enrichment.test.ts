import { describe, expect, it } from "vitest";
import { extractFromHtml } from "@/lib/enrichment/extract";
import { fromGooglePeriods, parseHoursText } from "@/lib/places/hours";
import { guessMapping, rowToLeadInput } from "@/lib/leads/csv";

describe("website enrichment", () => {
  it("extracts email, socials and booking platform", () => {
    const html = `<a href="mailto:Hello@GlowStudio.com">Email</a> <img src="logo@2x.png">
      <a href="https://instagram.com/p/abc">post</a><a href="https://www.instagram.com/glow.studio/">IG</a>
      <a href="https://facebook.com/sharer.php?u=x">share</a><a href="https://www.facebook.com/GlowStudioATL">FB</a>
      <a href="https://www.vagaro.com/glowstudio/book-now">Book</a> <a href="/contact-us">Contact</a>`;
    const r = extractFromHtml(html, "https://glowstudio.com");
    expect(r.emails[0]).toBe("hello@glowstudio.com");
    expect(r.instagram).toBe("glow.studio");
    expect(r.facebook).toBe("https://www.facebook.com/GlowStudioATL");
    expect(r.bookingPlatform).toBe("Vagaro");
    expect(r.contactLinks).toContain("https://glowstudio.com/contact-us");
  });
  it("detects embedded widgets and ignores junk emails", () => {
    const r = extractFromHtml(`<script src="https://booksy.com/widget/code.js"></script> contact: user@example.com`, "https://x.com");
    expect(r.bookingPlatform).toBe("Booksy");
    expect(r.emails).toEqual([]);
  });
});

describe("hours parsing", () => {
  it("converts Google periods (0 = Sunday)", () => {
    const h = fromGooglePeriods([{ open: { day: 2, hour: 9 }, close: { day: 2, hour: 19, minute: 30 } }, { open: { day: 6, hour: 10 }, close: { day: 6, hour: 16 } }]);
    expect(h).toEqual({ tue: [{ open: "09:00", close: "19:30" }], sat: [{ open: "10:00", close: "16:00" }] });
  });
  it("parses free-text hours from CSVs", () => {
    expect(parseHoursText("Tue-Fri 9:00-19:00; Sat 9am-5pm; Sun closed")).toEqual({
      tue: [{ open: "09:00", close: "19:00" }], wed: [{ open: "09:00", close: "19:00" }], thu: [{ open: "09:00", close: "19:00" }], fri: [{ open: "09:00", close: "19:00" }],
      sat: [{ open: "09:00", close: "17:00" }],
    });
  });
});

describe("CSV mapping", () => {
  it("guesses columns and maps a row", () => {
    const m = guessMapping(["Business Name", "Phone Number", "E-mail", "City", "Zip Code", "Reviews"]);
    expect(m).toMatchObject({ name: "Business Name", phone: "Phone Number", email: "E-mail", city: "City", zip: "Zip Code", reviewCount: "Reviews" });
    const r = rowToLeadInput({ "Business Name": "Fade Lab", "Phone Number": "(404) 872-1234", Reviews: "1,204" }, m)!;
    expect(r).toMatchObject({ name: "Fade Lab", reviewCount: 1204 });
  });
});
