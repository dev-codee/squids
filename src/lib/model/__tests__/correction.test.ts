import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCorrectionInput,
  canTransitionCorrection,
  DISPUTE_TYPES,
  CORRECTION_STATUSES,
  type CreateCorrectionInput,
} from "../correction";

test("validateCorrectionInput accepts valid input", () => {
  const input: CreateCorrectionInput = {
    country: "US",
    disputeType: "wrong_match",
    productId: "101",
    productTitle: "Wireless Headphones X1",
    pageUrl: "https://foxzil.com/us/product/101",
    description: "The second retailer in this comparison is selling the refurbished edition, not brand new.",
    reporterEmail: "shopper@example.com",
  };

  const result = validateCorrectionInput(input);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("validateCorrectionInput rejects invalid or missing fields", () => {
  const invalid = {
    country: "USA", // invalid ISO
    disputeType: "not_a_type",
    description: "short", // less than 10 chars
    reporterEmail: "not-an-email",
  };

  const result = validateCorrectionInput(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("ISO country code")));
  assert.ok(result.errors.some((e) => e.includes("Dispute type")));
  assert.ok(result.errors.some((e) => e.includes("at least 10 characters")));
  assert.ok(result.errors.some((e) => e.includes("Reporter email is invalid")));
});

test("validateCorrectionInput accepts optional email being absent", () => {
  const input = {
    country: "GB",
    disputeType: "expired_deal",
    description: "This coupon code expired yesterday at midnight.",
  };

  const result = validateCorrectionInput(input);
  assert.equal(result.valid, true);
});

test("canTransitionCorrection enforces valid state lifecycle", () => {
  // pending can go to reviewing, resolved, rejected
  assert.equal(canTransitionCorrection("pending", "reviewing"), true);
  assert.equal(canTransitionCorrection("pending", "resolved"), true);
  assert.equal(canTransitionCorrection("pending", "rejected"), true);

  // reviewing can go to resolved or rejected
  assert.equal(canTransitionCorrection("reviewing", "resolved"), true);
  assert.equal(canTransitionCorrection("reviewing", "rejected"), true);
  assert.equal(canTransitionCorrection("reviewing", "pending"), true);

  // resolved can be reopened to reviewing, but not directly rejected
  assert.equal(canTransitionCorrection("resolved", "reviewing"), true);
  assert.equal(canTransitionCorrection("resolved", "rejected"), false);

  // same state is always allowed
  assert.equal(canTransitionCorrection("resolved", "resolved"), true);
});
