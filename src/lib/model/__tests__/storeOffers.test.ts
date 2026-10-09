import { test } from "node:test";
import assert from "node:assert/strict";
import { splitStoreOffers, groupStoreCoupons } from "../storeOffers";

test("codes are never lost to legacy type labels and empty vouchers become deals", () => {
  const offers = [
    { id: 1, type: "voucher", code: "SAVE", isExclusive: true },
    { id: 2, type: "deal", code: "LEGACY" },
    { id: 3, type: "voucher", code: "   " },
    { id: 4, type: "deal", code: null },
    { id: 5, type: "promotion", code: null, imageUrl: "https://example.test/item.jpg", salePrice: 0 },
    { id: 6, type: "promotion", code: "PRODUCTCODE" },
  ];
  const result = splitStoreOffers(offers);
  assert.deepEqual(result.coupons.map((o) => o.id), [1, 2, 6]);
  assert.deepEqual(result.deals.map((o) => o.id), [3, 4]);
  assert.deepEqual(result.promotions.map((o) => o.id), [5]);
  assert.equal(result.coupons[0].isExclusive, true);
  assert.equal(result.promotions[0], offers[4]);
  assert.equal(result.promotions[0].salePrice, 0);
  assert.equal(result.coupons.length + result.deals.length + result.promotions.length, offers.length);
});

test("verified, student and cashback coupons appear in exactly one group", () => {
  const coupons = [
    { id: 1, type: "code", verified: true },
    { id: 2, type: "student", verified: true },
    { id: 3, type: "student", verified: false },
    { id: 4, type: "cashback", verified: false },
    { id: 5, type: "code", verified: false },
  ];
  const result = groupStoreCoupons(coupons);
  assert.deepEqual(result.verified.map((c) => c.id), [1, 2]);
  assert.deepEqual(result.codes.map((c) => c.id), [5]);
  assert.deepEqual(result.students.map((c) => c.id), [3]);
  assert.deepEqual(result.cashback.map((c) => c.id), [4]);
  const all = Object.values(result).flat();
  assert.equal(all.length, coupons.length);
  assert.equal(new Set(all.map((c) => c.id)).size, coupons.length);
});
