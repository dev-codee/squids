import { test } from "node:test";
import assert from "node:assert/strict";
import { productAssignment, selectProductMerchant } from "../productAssignment";

const merchant = { id: 42, network: "network-a", countryCode: "en_AU", countryCodes: [], currencyCode: "AUD" };

test("new admin products receive the selected store's network and market", () => {
  assert.deepEqual(productAssignment(merchant, {}), {
    advertiserId: 42, network: "network-a", regionCodes: ["AU"], market: "AU", currency: "AUD",
  });
});

test("moving a product replaces its previous store's network and country while preserving the price currency", () => {
  const moved = productAssignment(merchant, {}, {
    advertiserId: 9, network: "network-b", regionCodes: ["US"], market: "US", currency: "USD",
  });
  assert.equal(moved.network, "network-a");
  assert.deepEqual(moved.regionCodes, ["AU"]);
  assert.equal(moved.market, "AU");
  assert.equal(moved.currency, "USD");
});

test("advertiser IDs shared between networks require an explicit selection", () => {
  const other = { ...merchant, network: "network-b" };
  assert.throws(() => selectProductMerchant([merchant, other]));
  assert.equal(selectProductMerchant([merchant, other], "network-b"), other);
  assert.throws(() => selectProductMerchant([merchant], "network-b"));
});

test("editing a product keeps its explicit countries and currency", () => {
  const existing = { advertiserId: 42, network: "network-a", regionCodes: ["NZ"], market: "NZ", currency: "NZD" };
  assert.deepEqual(productAssignment(merchant, {}, existing), existing);
  assert.equal(productAssignment(merchant, { regionCodes: ["au"], currency: "aud" }, existing).currency, "AUD");
});

test("worldwide store metadata does not publish products in invented markets", () => {
  const worldwide = { ...merchant, countryCode: "WW" };
  assert.throws(() => productAssignment(worldwide, {}));
  assert.deepEqual(productAssignment(worldwide, { regionCodes: ["AU", "NZ"] }).regionCodes, ["AU", "NZ"]);
  assert.throws(() => productAssignment(merchant, { regionCodes: ["WW"] }));
  assert.throws(() => productAssignment(merchant, { currency: "invalid" }));
});
