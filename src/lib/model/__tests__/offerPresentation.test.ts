import test from "node:test";
import assert from "node:assert/strict";
import { deliveryKind } from "../offerPresentation";
import { known } from "../known";
import { emptyDeliveryRule } from "../delivery";
import type { MerchantMarketId } from "../merchantMarket";
const base = () => ({ ...emptyDeliveryRule("test", "test" as MerchantMarketId, "FR", "EUR"), sourceUrl: "https://example.test/delivery" });
test("paid shipping cannot become free, even with a free threshold", () => {
  const rule = { ...base(), charge: known(4.99) };
  assert.equal(deliveryKind(rule, "FR"), "paid");
  assert.equal(deliveryKind({ ...rule, freeThreshold: known(50) }, "FR"), "conditional");
});
test("unknown and wrong-country delivery are not free", () => {
  assert.equal(deliveryKind(base(), "FR"), "unknown");
  assert.equal(deliveryKind({ ...base(), charge: known(0) }, "AU"), "unknown");
  assert.equal(deliveryKind({ ...base(), charge: known(0), sourceUrl: null }, "FR"), "unknown");
});
test("sourced zero fee is free only without unresolved destination restrictions", () => {
  assert.equal(deliveryKind({ ...base(), charge: known(0) }, "FR"), "free");
  assert.equal(deliveryKind({ ...base(), charge: known(0), restrictions: ["Excludes islands"] }, "FR"), "conditional");
});
