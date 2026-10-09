import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMarkets } from "../marketResolution";
import { REGION_CODES } from "../../regions";

const CONFIGURED = ["US", "GB", "DE", "FR", "AU", "AT", "CH"];

test("every configured region resolves without a store-specific exception", () => {
  for (const country of REGION_CODES) {
    assert.deepEqual(resolveMarkets({ countryCode: country.toLowerCase() }, REGION_CODES).markets, [country]);
  }
});

test("explicit country codes become markets", () => {
  const r = resolveMarkets({ countryCodes: ["AU", "DE"] }, CONFIGURED);
  assert.deepEqual(r.markets.sort(), ["AU", "DE"]);
  assert.equal(r.worldwide, false);
});

test("a worldwide code is flagged, not expanded into every region", () => {
  // Expanding WW across all markets is exactly how an Australian offer ends up
  // on a German page. The backfill must refuse to do it silently.
  const r = resolveMarkets({ countryCodes: ["WW"] }, CONFIGURED);
  assert.equal(r.worldwide, true);
  assert.deepEqual(r.markets, [], "no market is inferred from a worldwide code");
});

test("unconfigured countries are not treated as markets", () => {
  assert.deepEqual(resolveMarkets({ countryCodes: ["ZZ"] }, CONFIGURED).markets, []);
});

test("duplicate codes across the legacy fields collapse to one market", () => {
  const r = resolveMarkets({ countryCodes: ["AU"], countryCode: "au", region: "AU" }, CONFIGURED);
  assert.deepEqual(r.markets, ["AU"]);
});

test("an advertiser with no geography yields no markets", () => {
  const r = resolveMarkets({}, CONFIGURED);
  assert.deepEqual(r.markets, []);
  assert.equal(r.worldwide, false);
});

test("a worldwide advertiser that also names real markets keeps those markets", () => {
  const r = resolveMarkets({ countryCodes: ["WW", "AU"] }, CONFIGURED);
  assert.equal(r.worldwide, true);
  assert.deepEqual(r.markets, ["AU"]);
});
