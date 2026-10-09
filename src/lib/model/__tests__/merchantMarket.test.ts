import { test } from "node:test";
import assert from "node:assert/strict";
import {
  merchantMarketId,
  canPublish,
  canRunPaidSearch,
  NO_PERMISSIONS,
  type MerchantMarket,
} from "../merchantMarket";

function mm(o: Partial<MerchantMarket> = {}): MerchantMarket {
  return {
    id: merchantMarketId("awin", 1, "AU"),
    merchantId: 1,
    network: "awin",
    market: "AU",
    displayName: "Beauty Amora",
    slug: "beauty-amora",
    currency: "AUD",
    websiteUrl: "https://example.test",
    approvedDomains: ["example.test"],
    feedSourceIds: [],
    permissions: { ...NO_PERMISSIONS },
    status: "active",
    ...o,
  };
}

test("store-market IDs are stable and market-scoped", () => {
  assert.equal(merchantMarketId("awin", 1, "AU"), "awin:1:AU");
  assert.equal(merchantMarketId("AWIN", 1, "au"), "awin:1:AU");
  assert.notEqual(merchantMarketId("awin", 1, "AU"), merchantMarketId("awin", 1, "DE"));
});

test("the same merchant in two markets is two records", () => {
  const au = mm();
  const de = mm({ id: merchantMarketId("awin", 1, "DE"), market: "DE", currency: "EUR" });
  assert.equal(au.merchantId, de.merchantId, "same merchant");
  assert.notEqual(au.id, de.id, "different store-market");
  assert.notEqual(au.currency, de.currency, "currency is per market, not per merchant");
});

test("publishing is blocked until rights are confirmed", () => {
  assert.equal(canPublish(mm()), false, "default permissions grant nothing");
  assert.equal(canPublish(mm({ permissions: { ...NO_PERMISSIONS, seo: true } })), true);
});

test("a suspended merchant-market cannot be published even with SEO rights", () => {
  const suspended = mm({ status: "suspended", permissions: { ...NO_PERMISSIONS, seo: true } });
  assert.equal(canPublish(suspended), false);
});

test("paid search needs its own permission, not the SEO one", () => {
  const seoOnly = mm({ permissions: { ...NO_PERMISSIONS, seo: true } });
  assert.equal(canRunPaidSearch(seoOnly), false);
  const both = mm({ permissions: { ...NO_PERMISSIONS, seo: true, ppc: true } });
  assert.equal(canRunPaidSearch(both), true);
});

test("the slug is stored data, so renaming cannot move the page", () => {
  const before = mm({ displayName: "Beauty Amora", slug: "beauty-amora" });
  const renamed = { ...before, displayName: "Beauty Amora Australia" };
  assert.equal(renamed.slug, "beauty-amora", "the canonical URL is unaffected by a rename");
});
