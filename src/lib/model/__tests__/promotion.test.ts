import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDiscountText,
  emptyPromotionStructure,
  isCalculable,
  decisiveRestrictions,
} from "../promotion";
import { known } from "../known";

test("a percentage label parses into a structured benefit", () => {
  const b = parseDiscountText("20% OFF");
  assert.equal(b.kind, "percentage");
  assert.deepEqual(b.value, known(20));
  assert.equal(b.isUpTo, false);
});

test("'up to' is preserved as a ceiling, not an amount", () => {
  const b = parseDiscountText("Up to 50% off");
  assert.equal(b.isUpTo, true);
  assert.deepEqual(b.value, known(50));
});

test("a fixed amount parses with its currency", () => {
  const b = parseDiscountText("$15 OFF", "AUD");
  assert.equal(b.kind, "fixed-amount");
  assert.deepEqual(b.value, known(15));
  assert.equal(b.currency, "AUD");
});

test("free delivery is a delivery benefit, not cash off", () => {
  const b = parseDiscountText("Free shipping");
  assert.equal(b.kind, "free-delivery");
  assert.equal(b.value.known, false, "there is no cash value to claim");
});

test("cashback is kept separate from the amount payable at checkout", () => {
  const b = parseDiscountText("8% CASHBACK");
  assert.equal(b.kind, "cashback");
  assert.deepEqual(b.value, known(8));
});

test("an unparseable label yields unknown rather than a guess", () => {
  for (const label of ["Great deal!", "", null, undefined, "Sale now on"]) {
    const b = parseDiscountText(label);
    assert.equal(b.value.known, false, `"${label}" should not produce a value`);
  }
});

test("a freshly structured promotion is not calculable", () => {
  assert.equal(isCalculable(emptyPromotionStructure()), false);
});

test("an 'up to' benefit is never calculable", () => {
  const s = emptyPromotionStructure();
  s.benefit = parseDiscountText("Up to 30% off");
  assert.equal(isCalculable(s), false);
});

test("a flat percentage with no unknown conditions is calculable", () => {
  const s = emptyPromotionStructure();
  s.benefit = parseDiscountText("20% off");
  assert.equal(isCalculable(s), true);
});

test("a min spend with an unknown basis blocks calculation", () => {
  const s = emptyPromotionStructure();
  s.benefit = parseDiscountText("20% off");
  s.conditions.minSpend = known(50);
  s.conditions.minSpendBasis = "unknown";
  assert.equal(isCalculable(s), false);
  s.conditions.minSpendBasis = "before-discount";
  assert.equal(isCalculable(s), true);
});

test("decisive restrictions surface before the outbound click", () => {
  const s = emptyPromotionStructure();
  s.conditions.customerType = "new";
  s.conditions.requiresApp = true;
  s.conditions.minSpend = known(50);
  s.conditions.exclusions = ["Excludes sale items"];
  const out = decisiveRestrictions(s);
  assert.ok(out.includes("New customers only"));
  assert.ok(out.includes("App required"));
  assert.ok(out.includes("Minimum spend 50"));
  assert.ok(out.includes("Excludes sale items"));
});

test("a promotion with no restrictions lists none", () => {
  assert.deepEqual(decisiveRestrictions(emptyPromotionStructure()), []);
});
