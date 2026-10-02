import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyMatch,
  matchPairId,
  productMatchKey,
  orderedMatches,
  canClaimComparison,
  pendingReviews,
  auditFor,
  isExactMatch,
  type MatchCandidate,
  type MatchRuling,
} from "../matching";
import { isPublishableExactMatch } from "../productIdentity";

function product(overrides: Partial<MatchCandidate> & { id: number }): MatchCandidate {
  return {
    advertiserId: overrides.id,
    title: "Acme Serum 30ml",
    ...overrides,
  };
}

const rulings = (...list: MatchRuling[]) =>
  new Map(list.map((r) => [r.pairId, r] as const));

test("a pair id is the same whichever way round it is built", () => {
  assert.equal(matchPairId(7, 3), matchPairId(3, 7));
});

test("a shared GTIN with no contradiction is an exact match", () => {
  const a = product({ id: 1, gtin: "9312345678907" });
  const b = product({ id: 2, advertiserId: 2, gtin: "9312345678907" });
  const result = classifyMatch(a, b);
  assert.equal(result.decision, "exact");
  assert.equal(result.basis, "identifier");
  assert.deepEqual(result.matchedOn, ["gtin"]);
});

test("a matching GTIN with a conflicting pack size goes to review, not exact", () => {
  const a = product({ id: 1, gtin: "9312345678907", packCount: 1 });
  const b = product({ id: 2, advertiserId: 2, gtin: "9312345678907", packCount: 3 });
  const result = classifyMatch(a, b);
  assert.equal(result.decision, "review");
  assert.equal(result.reviewBasis, "identifier-conflict");
  assert.ok(result.conflicts.includes("packCount"));
  assert.equal(isExactMatch(result), false);
});

test("two identified products with different codes are not a match", () => {
  const a = product({ id: 1, gtin: "9312345678907" });
  const b = product({ id: 2, advertiserId: 2, gtin: "4006381333931" });
  assert.equal(classifyMatch(a, b).decision, "not-a-match");
});

test("an identical title is never an exact match on its own", () => {
  const a = product({ id: 1 });
  const b = product({ id: 2, advertiserId: 2 });
  const result = classifyMatch(a, b);
  assert.equal(result.decision, "review");
  assert.equal(result.basis, "title");
  assert.equal(result.reviewBasis, "title-only");
});

test("a title match where only one side is identified still needs review", () => {
  const a = product({ id: 1, gtin: "9312345678907" });
  const b = product({ id: 2, advertiserId: 2 });
  const result = classifyMatch(a, b);
  assert.equal(result.decision, "review");
  assert.equal(result.reviewBasis, "missing-identifier");
});

test("different titles with no identifier are not a match", () => {
  const a = product({ id: 1, title: "Acme Serum 30ml" });
  const b = product({ id: 2, advertiserId: 2, title: "Acme Cleanser 200ml" });
  assert.equal(classifyMatch(a, b).decision, "not-a-match");
});

test("a reviewer's approval makes a title pair exact", () => {
  const a = product({ id: 1 });
  const b = product({ id: 2, advertiserId: 2 });
  const result = classifyMatch(
    a,
    b,
    rulings({
      pairId: matchPairId(1, 2),
      status: "approved",
      reviewedBy: "ops@example.com",
      reviewedAt: "2026-06-01T00:00:00Z",
    }),
  );
  assert.equal(result.decision, "exact");
  assert.equal(result.basis, "manual");

  const audit = auditFor(result, {
    pairId: matchPairId(1, 2),
    status: "approved",
    reviewedBy: "ops@example.com",
    reviewedAt: "2026-06-01T00:00:00Z",
  });
  assert.equal(isPublishableExactMatch(audit), true);
});

test("an approval with no named reviewer is not publishable as exact", () => {
  const a = product({ id: 1 });
  const b = product({ id: 2, advertiserId: 2 });
  const result = classifyMatch(
    a,
    b,
    rulings({ pairId: matchPairId(1, 2), status: "approved", reviewedBy: null }),
  );
  assert.equal(result.decision, "review");
});

test("a rejection and a variant split both remove the row", () => {
  const a = product({ id: 1, gtin: "9312345678907" });
  const b = product({ id: 2, advertiserId: 2, gtin: "9312345678907" });
  for (const status of ["rejected", "split-variant"] as const) {
    const result = classifyMatch(a, b, rulings({ pairId: matchPairId(1, 2), status }));
    assert.equal(result.decision, "not-a-match", status);
  }
});

test("exact matches sort ahead of review candidates, and non-matches are dropped", () => {
  const source = product({ id: 1, gtin: "9312345678907" });
  const results = [
    classifyMatch(source, product({ id: 2, advertiserId: 2 })), // review
    classifyMatch(source, product({ id: 3, advertiserId: 3, gtin: "9312345678907" })), // exact
    classifyMatch(source, product({ id: 4, advertiserId: 4, title: "Something else" })),
  ];
  const ordered = orderedMatches(results);
  assert.deepEqual(ordered.map((r) => r.candidateId), [3, 2]);
});

test("the comparison claim needs two independent retailers matched on identifiers", () => {
  const source = product({ id: 1, gtin: "9312345678907" });
  const exact = classifyMatch(
    source,
    product({ id: 3, advertiserId: 3, gtin: "9312345678907" }),
  );
  const titleOnly = classifyMatch(source, product({ id: 2, advertiserId: 2 }));

  // One exact match plus any number of title candidates is not a claim.
  assert.equal(
    canClaimComparison([
      { result: exact, advertiserId: 3 },
      { result: titleOnly, advertiserId: 2 },
    ]),
    false,
  );

  const second = classifyMatch(
    source,
    product({ id: 5, advertiserId: 5, gtin: "9312345678907" }),
  );
  assert.equal(
    canClaimComparison([
      { result: exact, advertiserId: 3 },
      { result: second, advertiserId: 5 },
    ]),
    true,
  );

  // The same retailer twice is one retailer.
  assert.equal(
    canClaimComparison([
      { result: exact, advertiserId: 3 },
      { result: second, advertiserId: 3 },
    ]),
    false,
  );
});

test("review candidates queue once, and a ruled pair does not re-queue", () => {
  const source = product({ id: 1 });
  const results = [
    classifyMatch(source, product({ id: 2, advertiserId: 2 })),
    classifyMatch(source, product({ id: 3, advertiserId: 3 })),
  ];
  assert.equal(pendingReviews(source, results).length, 2);

  const ruled = pendingReviews(
    source,
    results,
    rulings({ pairId: matchPairId(1, 2), status: "rejected" }),
  );
  assert.deepEqual(ruled.map((r) => r.result.candidateId), [3]);

  // "needs-data" keeps the pair in the queue — it is unresolved, not decided.
  const needsData = pendingReviews(
    source,
    results,
    rulings({ pairId: matchPairId(1, 2), status: "needs-data" }),
  );
  assert.equal(needsData.length, 2);
});

test("nothing is attested for a review candidate", () => {
  const source = product({ id: 1 });
  assert.equal(auditFor(classifyMatch(source, product({ id: 2, advertiserId: 2 }))), null);
});

test("the match key normalises punctuation and case", () => {
  assert.equal(productMatchKey("Acme  Serum — 30ml!"), "acme serum 30ml");
});
