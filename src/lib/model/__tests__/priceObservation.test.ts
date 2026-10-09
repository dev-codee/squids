import test from "node:test";
import assert from "node:assert/strict";
import {
  sortObservationsChronological,
  buildPriceHistorySeries,
  type PriceObservation,
} from "../priceObservation";

test("chronological sorting orders observations by timestamp", () => {
  const o1: PriceObservation = {
    id: "1:100:2026-10-01T00:00:00Z",
    productId: 1,
    market: "US",
    retailerId: 100,
    retailerName: "Store A",
    itemPrice: 29.99,
    currency: "USD",
    observedAt: "2026-10-01T00:00:00Z",
  };
  const o2: PriceObservation = {
    id: "1:100:2026-10-03T00:00:00Z",
    productId: 1,
    market: "US",
    retailerId: 100,
    retailerName: "Store A",
    itemPrice: 24.99,
    currency: "USD",
    observedAt: "2026-10-03T00:00:00Z",
  };
  const o3: PriceObservation = {
    id: "1:100:2026-09-28T00:00:00Z",
    productId: 1,
    market: "US",
    retailerId: 100,
    retailerName: "Store A",
    itemPrice: 32.0,
    currency: "USD",
    observedAt: "2026-09-28T00:00:00Z",
  };

  const sorted = sortObservationsChronological([o1, o2, o3]);
  assert.equal(sorted[0].observedAt, "2026-09-28T00:00:00Z");
  assert.equal(sorted[1].observedAt, "2026-10-01T00:00:00Z");
  assert.equal(sorted[2].observedAt, "2026-10-03T00:00:00Z");
});

test("buildPriceHistorySeries computes genuine boundaries and tracks latest", () => {
  const obs: PriceObservation[] = [
    {
      id: "1:10:2026-10-01T10:00:00Z",
      productId: 1,
      market: "US",
      retailerId: 10,
      retailerName: "Retailer X",
      itemPrice: 45.0,
      currency: "USD",
      observedAt: "2026-10-01T10:00:00Z",
    },
    {
      id: "1:10:2026-10-02T10:00:00Z",
      productId: 1,
      market: "US",
      retailerId: 10,
      retailerName: "Retailer X",
      itemPrice: 38.0,
      currency: "USD",
      observedAt: "2026-10-02T10:00:00Z",
    },
    {
      id: "1:10:2026-10-04T10:00:00Z",
      productId: 1,
      market: "US",
      retailerId: 10,
      retailerName: "Retailer X",
      itemPrice: 42.0,
      currency: "USD",
      observedAt: "2026-10-04T10:00:00Z",
    },
  ];

  const series = buildPriceHistorySeries(1, "US", "USD", obs);
  assert.ok(series !== null);
  assert.equal(series.minPrice, 38.0);
  assert.equal(series.maxPrice, 45.0);
  assert.equal(series.latestPrice, 42.0);
  assert.equal(series.firstObservedAt, "2026-10-01T10:00:00Z");
  assert.equal(series.lastObservedAt, "2026-10-04T10:00:00Z");
});

test("buildPriceHistorySeries returns null for empty observation list", () => {
  const series = buildPriceHistorySeries(1, "US", "USD", []);
  assert.equal(series, null);
});
