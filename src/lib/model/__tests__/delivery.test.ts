import { test } from "node:test";
import assert from "node:assert/strict";
import { known, unknown, sumKnown } from "../known";
import {
  emptyDeliveryRule,
  deliveryFor,
  mandatoryChargesFor,
  isSourced,
  ruleForDestination,
  type DeliveryRule,
} from "../delivery";

const basket = (before: number, after: number) => ({
  beforeDiscount: known(before),
  afterDiscount: known(after),
});

function rule(overrides: Partial<DeliveryRule> = {}): DeliveryRule {
  return { ...emptyDeliveryRule("r1", "awin:1:AU", "AU", "AUD"), ...overrides };
}

test("an unsourced delivery charge stays unknown, never free", () => {
  const r = rule();
  const d = deliveryFor(r, basket(100, 100));
  assert.equal(d.known, false);
  assert.equal(isSourced(r), false);
});

test("a flat charge applies when there is no free-delivery threshold", () => {
  const r = rule({ charge: known(5) });
  assert.deepEqual(deliveryFor(r, basket(20, 20)), known(5));
});

test("a known threshold on a known basis gives free delivery above it", () => {
  const r = rule({
    charge: known(5),
    freeThreshold: known(50),
    thresholdBasis: "after-discount",
  });
  assert.deepEqual(deliveryFor(r, basket(60, 60)), known(0));
  assert.deepEqual(deliveryFor(r, basket(60, 40)), known(5));
});

test("the threshold basis changes the answer, so it may not be assumed", () => {
  const before = rule({
    charge: known(5),
    freeThreshold: known(50),
    thresholdBasis: "before-discount",
  });
  const after = { ...before, thresholdBasis: "after-discount" as const };
  // Same basket, same merchant, opposite outcome.
  assert.deepEqual(deliveryFor(before, basket(60, 40)), known(0));
  assert.deepEqual(deliveryFor(after, basket(60, 40)), known(5));
});

test("a threshold with an unknown basis makes delivery unknown", () => {
  const r = rule({
    charge: known(5),
    freeThreshold: known(50),
    thresholdBasis: "unknown",
  });
  const d = deliveryFor(r, basket(60, 60));
  assert.equal(d.known, false);
});

test("unknown mandatory fees make the whole charge unknown", () => {
  const r = rule({ charge: known(5) });
  const total = mandatoryChargesFor(r, basket(20, 20));
  assert.equal(total.known, false, "mandatoryFees is unsourced, so the total is not known");
});

test("a rule is only sourced once it has a URL, a check time and a charge", () => {
  assert.equal(isSourced(rule({ charge: known(5) })), false);
  assert.equal(
    isSourced(rule({ charge: known(5), sourceUrl: "https://x/delivery", checkedAt: "2026-10-01T00:00:00Z" })),
    true,
  );
});

test("the most specific destination rule wins", () => {
  const wide = rule({ id: "wide", charge: known(9) });
  const remote = rule({
    id: "remote",
    charge: known(19),
    zone: { market: "AU", postcodePrefixes: ["08"] },
  });
  const rules = [wide, remote];
  assert.equal(ruleForDestination(rules, { market: "AU", postcode: "0810" })?.id, "remote");
  assert.equal(ruleForDestination(rules, { market: "AU", postcode: "2000" })?.id, "wide");
  assert.equal(ruleForDestination(rules, { market: "NZ" }), null);
});

test("the brief's worked example (p.14) ranks only the known totals", () => {
  // Retailer B: A$31 with free delivery          -> A$31 known
  // Retailer A: A$30 - A$3 eligible discount + A$5 delivery -> A$32 known
  // Retailer C: A$28 with delivery unknown       -> total unknown
  const b = sumKnown([known(31), known(0)]);
  const a = sumKnown([known(30), known(-3), known(5)]);
  const c = sumKnown([known(28), unknown<number>("not-sourced")]);

  assert.deepEqual(b, known(31));
  assert.deepEqual(a, known(32));
  assert.equal(c.known, false, "C has no known delivered total");

  const rows = [
    { name: "B", total: b },
    { name: "A", total: a },
    { name: "C", total: c },
  ];
  const knownRows = rows.filter((r) => r.total.known);
  assert.deepEqual(knownRows.map((r) => r.name), ["B", "A"]);

  const cheapest = knownRows.reduce((best, r) =>
    (r.total as { known: true; value: number }).value <
    (best.total as { known: true; value: number }).value
      ? r
      : best,
  );
  assert.equal(cheapest.name, "B", "B is lowest among the known totals");
  assert.equal(
    rows.some((r) => r.name === "C" && r.total.known),
    false,
    "C must be excluded from the lowest-known-total claim",
  );
});
