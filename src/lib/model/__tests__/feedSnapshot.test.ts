import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateNextRetryTime,
  generateBatchId,
} from "../feedSnapshot";

test("calculateNextRetryTime calculates bounded exponential backoff", () => {
  const base = new Date("2026-10-04T12:00:00.000Z");

  const r0 = calculateNextRetryTime(0, base);
  assert.equal(r0.deadLetter, false);
  assert.equal(r0.nextRetryAt, "2026-10-04T12:02:00.000Z"); // 2 min

  const r1 = calculateNextRetryTime(1, base);
  assert.equal(r1.deadLetter, false);
  assert.equal(r1.nextRetryAt, "2026-10-04T12:04:00.000Z"); // 4 min

  const r4 = calculateNextRetryTime(4, base);
  assert.equal(r4.deadLetter, false);
  assert.equal(r4.nextRetryAt, "2026-10-04T12:32:00.000Z"); // 32 min

  const r5 = calculateNextRetryTime(5, base);
  assert.equal(r5.deadLetter, true);
  assert.equal(r5.nextRetryAt, null);
});

test("generateBatchId creates network and entity prefixed IDs", () => {
  const batchId = generateBatchId("awin", "deals");
  assert.ok(batchId.startsWith("awin_deals_"));
});
