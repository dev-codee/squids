import { test } from "node:test";
import assert from "node:assert/strict";
import { known, unknown, type Known } from "../known";
import { emptyDeliveryRule, type DeliveryRule } from "../delivery";
import { emptyPromotionStructure, type PromotionStructure } from "../promotion";
import {
  assessEligibility,
  discountAmount,
  cashbackAmount,
  combinablePromotions,
  deliveredTotal,
  rankByDeliveredTotal,
  allocateBasketDiscount,
  type EvaluablePromotion,
  type RankedRow,
} from "../deliveredTotal";

const NOW = new Date("2026-06-01T00:00:00Z");

function rule(overrides: Partial<DeliveryRule> = {}): DeliveryRule {
  return {
    ...emptyDeliveryRule("r1", "awin:1:AU", "AU", "AUD"),
    // A fully sourced rule, so a test only opts *out* of what it wants unknown.
    mandatoryFees: known(0),
    taxIncluded: true,
    ...overrides,
  };
}

function promo(
  id: string,
  structure: Partial<PromotionStructure> = {},
  rest: Partial<EvaluablePromotion> = {},
): EvaluablePromotion {
  const base = emptyPromotionStructure();
  return {
    id,
    structure: {
      ...base,
      ...structure,
      benefit: { ...base.benefit, ...(structure.benefit ?? {}) },
      conditions: { ...base.conditions, ...(structure.conditions ?? {}) },
    },
    ...rest,
  };
}

const shopper = { market: "AU", postcode: "2000" };

/* -- the brief's worked example (p.14) ------------------------------------ */

test("the brief's worked example ranks B then A and excludes C", () => {
  // Retailer B: A$31, free delivery -> A$31 known.
  const b = deliveredTotal(
    {
      itemPrice: known(31),
      currency: "AUD",
      deliveryRule: rule({ charge: known(0) }),
      shopper,
    },
    NOW,
  );

  // Retailer A: A$30 - A$3 eligible discount + A$5 delivery -> A$32 known.
  const a = deliveredTotal(
    {
      itemPrice: known(30),
      currency: "AUD",
      deliveryRule: rule({ charge: known(5), mandatoryFees: known(0) }),
      promotions: [
        promo("A3", {
          benefit: {
            kind: "fixed-amount",
            value: known(3),
            isUpTo: false,
            maxCap: unknown(),
            currency: "AUD",
          },
        }),
      ],
      shopper,
    },
    NOW,
  );

  // Retailer C: A$28, delivery unknown -> total unknown.
  const c = deliveredTotal(
    { itemPrice: known(28), currency: "AUD", deliveryRule: rule(), shopper },
    NOW,
  );

  assert.deepEqual(b.total, known(31));
  assert.deepEqual(a.total, known(32));
  assert.equal(a.eligibleDiscount.known && a.eligibleDiscount.value, 3);
  assert.equal(c.total.known, false);

  const rows: RankedRow<string>[] = [
    { row: "A", breakdown: a },
    { row: "B", breakdown: b },
    { row: "C", breakdown: c },
  ];
  const ranking = rankByDeliveredTotal(rows, (r) => r);

  assert.deepEqual(
    ranking.ranked.map((r) => r.row),
    ["B", "A"],
  );
  assert.deepEqual(
    ranking.withoutKnownTotal.map((r) => r.row),
    ["C"],
  );
  assert.equal(ranking.knownCount, 2);
  assert.equal(ranking.canClaimLowest, true);
});

test("the cheapest item price is not the cheapest delivered total", () => {
  // C at A$28 is the lowest item price but is excluded; B at A$31 wins.
  const ranking = rankByDeliveredTotal(
    [
      {
        row: "C",
        breakdown: deliveredTotal(
          { itemPrice: known(28), currency: "AUD", deliveryRule: rule(), shopper },
          NOW,
        ),
      },
      {
        row: "B",
        breakdown: deliveredTotal(
          {
            itemPrice: known(31),
            currency: "AUD",
            deliveryRule: rule({ charge: known(0) }),
            shopper,
          },
          NOW,
        ),
      },
    ],
    (r) => r,
  );
  assert.equal(ranking.ranked[0]?.row, "B");
  assert.equal(ranking.canClaimLowest, false); // only one known total
});

/* -- unknown never becomes zero -------------------------------------------- */

test("no delivery rule makes the total unknown, not the item price", () => {
  const b = deliveredTotal(
    { itemPrice: known(40), currency: "AUD", deliveryRule: null, shopper },
    NOW,
  );
  assert.equal(b.delivery.known, false);
  assert.equal(b.total.known, false);
  assert.ok(b.notes.some((n) => n.includes("No delivery rule")));
});

test("an unestablished tax basis prevents a complete total", () => {
  const b = deliveredTotal(
    {
      itemPrice: known(40),
      currency: "AUD",
      deliveryRule: rule({ charge: known(0), mandatoryFees: known(0), taxIncluded: null }),
      shopper,
    },
    NOW,
  );
  assert.equal(b.additionalTax.known, false);
  assert.equal(b.total.known, false);
});

test("tax included in the listed price is not added a second time", () => {
  const b = deliveredTotal(
    {
      itemPrice: known(40),
      currency: "AUD",
      deliveryRule: rule({ charge: known(0), mandatoryFees: known(0), taxIncluded: true }),
      shopper,
    },
    NOW,
  );
  assert.deepEqual(b.total, known(40));
});

test("an unknown item price cannot produce a total", () => {
  const b = deliveredTotal(
    {
      itemPrice: unknown(),
      currency: "AUD",
      deliveryRule: rule({ charge: known(0), mandatoryFees: known(0) }),
      shopper,
    },
    NOW,
  );
  assert.equal(b.total.known, false);
});

/* -- conditional offers never lower a stated price ------------------------- */

test("a conditional promotion is reported, not applied", () => {
  const b = deliveredTotal(
    {
      itemPrice: known(50),
      currency: "AUD",
      deliveryRule: rule({ charge: known(0), mandatoryFees: known(0) }),
      promotions: [
        promo("NEW10", {
          benefit: { kind: "percentage", value: known(10), isUpTo: false, maxCap: unknown() },
          conditions: {
            ...emptyPromotionStructure().conditions,
            customerType: "new",
          },
        }),
      ],
      shopper, // customer type not stated
    },
    NOW,
  );

  assert.deepEqual(b.eligibleDiscount, known(0));
  assert.deepEqual(b.total, known(50));
  assert.equal(b.conditionalPromotions.length, 1);
  assert.deepEqual(b.conditionalPromotions[0]?.conditions, ["New customers only"]);
});

test('an "up to" discount is a ceiling, never an amount', () => {
  const p = promo("UPTO50", {
    benefit: { kind: "percentage", value: known(50), isUpTo: true, maxCap: unknown() },
  });
  assert.equal(discountAmount(p.structure, known(100)).known, false);
  const assessment = assessEligibility(
    p,
    { shopper, qualifyingSubtotal: known(100) },
    NOW,
  );
  assert.equal(assessment.verdict, "conditional");
});

test("an expired promotion is a blocker, not a condition", () => {
  const p = promo("OLD", {}, { endDate: "2026-01-01T00:00:00Z" });
  const assessment = assessEligibility(p, { shopper, qualifyingSubtotal: known(10) }, NOW);
  assert.equal(assessment.verdict, "ineligible");
  assert.deepEqual(assessment.blockers, ["Offer has ended"]);
});

test("a date-only expiry with no timezone is flagged, not guessed", () => {
  const p = promo(
    "TZ",
    {
      benefit: { kind: "percentage", value: known(10), isUpTo: false, maxCap: unknown() },
    },
    { endDate: "2026-12-31" },
  );
  const assessment = assessEligibility(p, { shopper, qualifyingSubtotal: known(10) }, NOW);
  assert.equal(assessment.verdict, "conditional");
  assert.ok(assessment.conditions.includes("End date has no recorded timezone"));
});

test("a promotion outside the shopper's market cannot apply", () => {
  const p = promo("UKONLY", {}, { markets: ["GB"] });
  const assessment = assessEligibility(p, { shopper, qualifyingSubtotal: known(10) }, NOW);
  assert.equal(assessment.verdict, "ineligible");
});

test("an unmet minimum spend blocks; an unknown basis only conditions", () => {
  const withBasis = promo("MIN50", {
    benefit: { kind: "percentage", value: known(10), isUpTo: false, maxCap: unknown() },
    conditions: {
      ...emptyPromotionStructure().conditions,
      minSpend: known(50),
      minSpendBasis: "before-discount",
    },
  });
  assert.equal(
    assessEligibility(withBasis, { shopper, qualifyingSubtotal: known(20) }, NOW).verdict,
    "ineligible",
  );
  assert.equal(
    assessEligibility(withBasis, { shopper, qualifyingSubtotal: known(60) }, NOW).verdict,
    "eligible",
  );

  const withoutBasis = promo("MINUNK", {
    benefit: { kind: "percentage", value: known(10), isUpTo: false, maxCap: unknown() },
    conditions: {
      ...emptyPromotionStructure().conditions,
      minSpend: known(50),
      minSpendBasis: "unknown",
    },
  });
  assert.equal(
    assessEligibility(withoutBasis, { shopper, qualifyingSubtotal: known(60) }, NOW).verdict,
    "conditional",
  );
});

/* -- discount arithmetic ---------------------------------------------------- */

test("a percentage discount respects its cap", () => {
  const p = promo("P20", {
    benefit: { kind: "percentage", value: known(20), isUpTo: false, maxCap: known(15) },
  });
  assert.deepEqual(discountAmount(p.structure, known(200)), known(15));
  assert.deepEqual(discountAmount(p.structure, known(50)), known(10));
});

test("a fixed discount never exceeds the basket", () => {
  const p = promo("F30", {
    benefit: { kind: "fixed-amount", value: known(30), isUpTo: false, maxCap: unknown() },
  });
  assert.deepEqual(discountAmount(p.structure, known(12)), known(12));
});

test("free delivery and gifts take nothing off the item price", () => {
  for (const kind of ["free-delivery", "gift"] as const) {
    const p = promo(kind, {
      benefit: { kind, value: unknown(), isUpTo: false, maxCap: unknown(), description: "x" },
    });
    assert.deepEqual(discountAmount(p.structure, known(100)), known(0));
  }
});

test("cashback is contingent and never reduces the payable total", () => {
  const p = promo("CB5", {
    benefit: { kind: "cashback", value: known(5), isUpTo: false, maxCap: unknown() },
  });
  const b = deliveredTotal(
    {
      itemPrice: known(100),
      currency: "AUD",
      deliveryRule: rule({ charge: known(0), mandatoryFees: known(0) }),
      promotions: [p],
      shopper,
    },
    NOW,
  );
  assert.deepEqual(b.total, known(100));
  assert.deepEqual(b.contingentCashback, known(5));
  assert.deepEqual(cashbackAmount(p.structure, known(100)), known(5));
});

/* -- stacking --------------------------------------------------------------- */

test("promotions combine only when every one is explicitly stackable", () => {
  const base = emptyPromotionStructure().conditions;
  const stackA = promo("A", {
    benefit: { kind: "fixed-amount", value: known(5), isUpTo: false, maxCap: unknown() },
    conditions: { ...base, stackable: true },
  });
  const stackB = promo("B", {
    benefit: { kind: "fixed-amount", value: known(8), isUpTo: false, maxCap: unknown() },
    conditions: { ...base, stackable: true },
  });
  const unrecorded = promo("C", {
    benefit: { kind: "fixed-amount", value: known(8), isUpTo: false, maxCap: unknown() },
    conditions: { ...base, stackable: null },
  });

  const both = combinablePromotions([stackA, stackB], (p) =>
    discountAmount(p.structure, known(100)),
  );
  assert.deepEqual(both.map((p) => p.id), ["A", "B"]);

  // An unrecorded stacking rule is not a yes: only the largest applies.
  const one = combinablePromotions([stackA, unrecorded], (p) =>
    discountAmount(p.structure, known(100)),
  );
  assert.deepEqual(one.map((p) => p.id), ["C"]);
});

test("stacked promotions sum into one discount", () => {
  const base = emptyPromotionStructure().conditions;
  const b = deliveredTotal(
    {
      itemPrice: known(100),
      currency: "AUD",
      deliveryRule: rule({ charge: known(0), mandatoryFees: known(0) }),
      promotions: [
        promo("A", {
          benefit: { kind: "fixed-amount", value: known(5), isUpTo: false, maxCap: unknown() },
          conditions: { ...base, stackable: true },
        }),
        promo("B", {
          benefit: { kind: "fixed-amount", value: known(8), isUpTo: false, maxCap: unknown() },
          conditions: { ...base, stackable: true },
        }),
      ],
      shopper,
    },
    NOW,
  );
  assert.deepEqual(b.eligibleDiscount, known(13));
  assert.deepEqual(b.total, known(87));
});

/* -- threshold basis -------------------------------------------------------- */

test("the free-delivery threshold is evaluated on the merchant's own basis", () => {
  const promotions = [
    promo("TEN", {
      benefit: { kind: "fixed-amount", value: known(10), isUpTo: false, maxCap: unknown() },
    }),
  ];
  const input = {
    itemPrice: known(55) as Known<number>,
    currency: "AUD",
    promotions,
    shopper,
  };

  // Before discount: A$55 clears a A$50 threshold -> free delivery.
  const before = deliveredTotal(
    {
      ...input,
      deliveryRule: rule({
        charge: known(9),
        mandatoryFees: known(0),
        freeThreshold: known(50),
        thresholdBasis: "before-discount",
      }),
    },
    NOW,
  );
  assert.deepEqual(before.delivery, known(0));
  assert.deepEqual(before.total, known(45));

  // After discount: A$45 does not clear it -> the charge applies.
  const after = deliveredTotal(
    {
      ...input,
      deliveryRule: rule({
        charge: known(9),
        mandatoryFees: known(0),
        freeThreshold: known(50),
        thresholdBasis: "after-discount",
      }),
    },
    NOW,
  );
  assert.deepEqual(after.delivery, known(9));
  assert.deepEqual(after.total, known(54));
});

test("a threshold whose basis is unrecorded makes delivery unknown", () => {
  const b = deliveredTotal(
    {
      itemPrice: known(55),
      currency: "AUD",
      deliveryRule: rule({
        charge: known(9),
        mandatoryFees: known(0),
        freeThreshold: known(50),
        thresholdBasis: "unknown",
      }),
      shopper,
    },
    NOW,
  );
  assert.equal(b.delivery.known, false);
  assert.equal(b.total.known, false);
});

/* -- quantity, freshness, estimates ---------------------------------------- */

test("quantity multiplies the qualifying basket", () => {
  const b = deliveredTotal(
    {
      itemPrice: known(12.5),
      currency: "AUD",
      deliveryRule: rule({ charge: known(5), mandatoryFees: known(0) }),
      shopper: { ...shopper, quantity: 3 },
    },
    NOW,
  );
  assert.deepEqual(b.itemPrice, known(37.5));
  assert.deepEqual(b.total, known(42.5));
});

test("a delivery charge quoted with no postcode is labelled an estimate", () => {
  const b = deliveredTotal(
    {
      itemPrice: known(20),
      currency: "AUD",
      deliveryRule: rule({ charge: known(7), mandatoryFees: known(0) }),
      shopper: { market: "AU" },
    },
    NOW,
  );
  assert.equal(b.estimated, true);
});

test("the total is only as fresh as its stalest component", () => {
  const b = deliveredTotal(
    {
      itemPrice: known(20),
      currency: "AUD",
      deliveryRule: rule({
        charge: known(0),
        mandatoryFees: known(0),
        checkedAt: "2026-05-01T00:00:00Z",
      }),
      offerCheckedAt: "2026-05-20T00:00:00Z",
      shopper,
    },
    NOW,
  );
  assert.equal(b.checkedAt, "2026-05-01T00:00:00Z");
});

/* -- basket allocation ------------------------------------------------------ */

test("a basket discount is allocated pro rata, not applied in full to each line", () => {
  const shares = allocateBasketDiscount(known(10), [
    { id: "a", unitPrice: known(30), quantity: 1 },
    { id: "b", unitPrice: known(70), quantity: 1 },
  ]);
  assert.deepEqual(shares.get("a"), known(3));
  assert.deepEqual(shares.get("b"), known(7));
});

test("allocated shares sum back to the whole discount", () => {
  const lines = [
    { id: "a", unitPrice: known(10), quantity: 1 },
    { id: "b", unitPrice: known(10), quantity: 1 },
    { id: "c", unitPrice: known(10), quantity: 1 },
  ];
  const shares = allocateBasketDiscount(known(10), lines);
  const sum = lines.reduce((n, l) => {
    const s = shares.get(l.id);
    return n + (s?.known ? s.value : NaN);
  }, 0);
  assert.equal(Math.round(sum * 100) / 100, 10);
});

test("one unpriced line makes every share unknown", () => {
  const shares = allocateBasketDiscount(known(10), [
    { id: "a", unitPrice: known(30), quantity: 1 },
    { id: "b", unitPrice: unknown(), quantity: 1 },
  ]);
  assert.equal(shares.get("a")?.known, false);
  assert.equal(shares.get("b")?.known, false);
});
