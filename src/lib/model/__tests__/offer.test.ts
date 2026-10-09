import { test } from "node:test";
import assert from "node:assert/strict";
import { known, unknown } from "../known";
import {
  offerId,
  isComparable,
  isEligibleInMarket,
  ageStatus,
  offerFromLegacyProduct,
  type RetailerOfferRecord,
} from "../offer";

function offer(o: Partial<RetailerOfferRecord> = {}): RetailerOfferRecord {
  return {
    id: "awin:1:AU:sku-1",
    merchantMarketId: "awin:1:AU",
    productId: 1,
    sourceItemId: "sku-1",
    itemPrice: known(30),
    currency: "AUD",
    stock: "in-stock",
    condition: "new",
    destinationUrl: "https://example.test/p",
    sourceUpdatedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    checkedAt: null,
    eligibility: { markets: ["AU"], customerType: "any" },
    status: "current",
    ...o,
  };
}

test("offer IDs are stable and derived from merchant-market plus source item", () => {
  assert.equal(offerId("awin:1:AU", "sku-1"), "awin:1:AU:sku-1");
});

test("an offer is comparable only when current, in stock and priced", () => {
  assert.equal(isComparable(offer()), true);
  assert.equal(isComparable(offer({ status: "stale" })), false);
  assert.equal(isComparable(offer({ status: "quarantined" })), false);
  assert.equal(isComparable(offer({ stock: "unknown" })), false);
  assert.equal(isComparable(offer({ itemPrice: unknown("not-sourced") })), false);
});

test("market eligibility is explicit, not inferred from the merchant", () => {
  const au = offer({ eligibility: { markets: ["AU"] } });
  assert.equal(isEligibleInMarket(au, "AU"), true);
  assert.equal(isEligibleInMarket(au, "DE"), false, "an AU offer must not show in DE");
});

test("an offer with no market restriction is eligible anywhere", () => {
  const any = offer({ eligibility: { markets: [] } });
  assert.equal(isEligibleInMarket(any, "DE"), true);
});

test("freshness is measured from the source, not from render time", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const fresh = offer({ sourceUpdatedAt: "2026-10-01T09:00:00Z" });
  const old = offer({ sourceUpdatedAt: "2026-09-20T09:00:00Z" });
  assert.equal(ageStatus(fresh, 6, now), "current");
  assert.equal(ageStatus(old, 6, now), "stale");
});

test("a fetch that recorded no timestamps is stale, not fresh", () => {
  const none = offer({ sourceUpdatedAt: null, fetchedAt: null });
  assert.equal(ageStatus(none, 6), "stale");
});

test("ageing never un-quarantines an offer", () => {
  const q = offer({ status: "quarantined", sourceUpdatedAt: new Date().toISOString() });
  assert.equal(ageStatus(q, 6), "quarantined");
});

test("legacy backfill invents nothing", () => {
  const o = offerFromLegacyProduct({
    merchantMarketId: "awin:1:AU",
    productId: 7,
    sourceItemId: "7",
    salePrice: null,
    currency: "AUD",
    inStock: false,
    trackingUrl: null,
    market: "au",
  });
  assert.equal(o.itemPrice.known, false, "an absent price stays unknown, not zero");
  assert.equal(o.stock, "unknown", "legacy false cannot distinguish out-of-stock from unstated");
  assert.equal(o.checkedAt, null, "nobody has checked it, so checkedAt stays null");
  assert.equal(o.status, "draft", "backfilled rows are never auto-published");
  assert.deepEqual(o.eligibility.markets, ["AU"]);
});
