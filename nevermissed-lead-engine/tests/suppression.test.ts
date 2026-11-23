import { describe, expect, it } from "vitest";
import { checkSuppression, normalizeEmail, normalizePhone, type SuppressionEntry } from "@/lib/suppression";

describe("normalization", () => {
  it("normalizes US phone formats to E.164", () => {
    expect(normalizePhone("(404) 872-1234")).toBe("+14048721234");
    expect(normalizePhone("404.872.1234")).toBe("+14048721234");
    expect(normalizePhone("+1 404 872 1234")).toBe("+14048721234");
    expect(normalizePhone("not a phone")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
  it("normalizes emails (case, whitespace, +tags)", () => {
    expect(normalizeEmail("  Jo.Smith+Promo@Salon.COM ")).toBe("jo.smith@salon.com");
    expect(normalizeEmail("nope")).toBeNull();
  });
});

describe("checkSuppression", () => {
  const list: SuppressionEntry[] = [
    { kind: "PHONE", value: "+14048721234", reason: "DO_NOT_CALL" },
    { kind: "EMAIL", value: "owner@glam.com", reason: "UNSUBSCRIBE" },
    { kind: "EMAIL", value: "@blocked.example", reason: "MANUAL" },
  ];
  it("blocks a DNC phone in any format", () => {
    expect(checkSuppression("PHONE", "(404) 872-1234", list)).toMatchObject({ allowed: false, reason: "DO_NOT_CALL" });
  });
  it("allows phones not on the list", () => {
    expect(checkSuppression("PHONE", "(404) 872-9999", list)).toEqual({ allowed: true, normalized: "+14048729999" });
  });
  it("blocks unsubscribed emails regardless of case or +tag", () => {
    expect(checkSuppression("EMAIL", "OWNER+x@Glam.com", list)).toMatchObject({ allowed: false, reason: "UNSUBSCRIBE" });
  });
  it("blocks whole suppressed domains", () => {
    expect(checkSuppression("EMAIL", "a@blocked.example", list)).toMatchObject({ allowed: false, reason: "MANUAL" });
  });
  it("does not cross kinds", () => {
    expect(checkSuppression("EMAIL", "other@glam.com", list).allowed).toBe(true);
  });
  it("treats invalid input as not allowed", () => {
    expect(checkSuppression("PHONE", "12", list)).toMatchObject({ allowed: false, reason: "INVALID_PHONE" });
    expect(checkSuppression("EMAIL", "x", list)).toMatchObject({ allowed: false, reason: "INVALID_EMAIL" });
  });
});
