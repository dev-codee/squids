import { test } from "node:test";
import assert from "node:assert/strict";
import {
  identifiersAgree,
  hasStrongIdentifier,
  isPublishableExactMatch,
  isPlausibleGtin,
  type ProductIdentity,
} from "../productIdentity";

const serum = (o: Partial<ProductIdentity> = {}): ProductIdentity => ({
  gtin: "9312345678907",
  brand: "Rivana",
  size: "30 ml",
  packCount: 1,
  condition: "new",
  ...o,
});

test("a shared GTIN with no conflicting detail is an exact match", () => {
  const r = identifiersAgree(serum(), serum());
  assert.equal(r.agree, true);
  assert.deepEqual(r.matchedOn, ["gtin"]);
  assert.deepEqual(r.conflicts, []);
});

test("a matching GTIN with a conflicting pack size is NOT an exact match", () => {
  // The brief: "A matching GTIN with conflicting product detail requires review."
  const r = identifiersAgree(serum(), serum({ size: "60 ml" }));
  assert.equal(r.agree, false);
  assert.ok(r.conflicts.includes("size"));
});

test("a conflicting pack count blocks the match", () => {
  const r = identifiersAgree(serum(), serum({ packCount: 3 }));
  assert.equal(r.agree, false);
  assert.ok(r.conflicts.includes("packCount"));
});

test("new and refurbished are not the same product", () => {
  const r = identifiersAgree(serum(), serum({ condition: "refurbished" }));
  assert.equal(r.agree, false);
  assert.ok(r.conflicts.includes("condition"));
});

test("an unknown condition does not manufacture a conflict", () => {
  const r = identifiersAgree(serum(), serum({ condition: "unknown" }));
  assert.equal(r.agree, true);
});

test("GTIN-13 and its zero-padded GTIN-14 are the same code", () => {
  const r = identifiersAgree(serum(), serum({ gtin: "09312345678907" }));
  assert.equal(r.agree, true);
});

test("different GTINs never agree", () => {
  const r = identifiersAgree(serum(), serum({ gtin: "9312345678914" }));
  assert.equal(r.agree, false);
  assert.ok(r.conflicts.includes("gtin"));
});

test("brand + MPN is a strong identifier when there is no GTIN", () => {
  const a: ProductIdentity = { brand: "Nevi", mpn: "XR-500", gtin: null };
  const b: ProductIdentity = { brand: "Nevi", mpn: "xr-500", gtin: null };
  assert.equal(hasStrongIdentifier(a), true);
  assert.equal(identifiersAgree(a, b).agree, true);
});

test("a product with no identifiers at all cannot match on identity", () => {
  const a: ProductIdentity = { brand: "Nevi" };
  const b: ProductIdentity = { brand: "Nevi" };
  assert.equal(hasStrongIdentifier(a), false);
  assert.equal(identifiersAgree(a, b).agree, false, "same brand is not the same product");
});

test("a title match is never publishable as exact", () => {
  assert.equal(isPublishableExactMatch({ basis: "title" }), false);
  assert.equal(isPublishableExactMatch(null), false);
  assert.equal(isPublishableExactMatch(undefined), false);
});

test("a manual match is publishable only when a named reviewer signed it off", () => {
  assert.equal(isPublishableExactMatch({ basis: "manual" }), false);
  assert.equal(
    isPublishableExactMatch({ basis: "manual", reviewedBy: "ed", reviewedAt: "2026-10-01" }),
    true,
  );
});

test("an identifier match is publishable", () => {
  assert.equal(isPublishableExactMatch({ basis: "identifier", matchedOn: ["gtin"] }), true);
});

test("GTIN plausibility accepts the real lengths only", () => {
  assert.equal(isPlausibleGtin("9312345678907"), true);
  assert.equal(isPlausibleGtin("12345678"), true);
  assert.equal(isPlausibleGtin("123"), false);
});
