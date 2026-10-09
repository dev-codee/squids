import { test } from "node:test";
import assert from "node:assert/strict";
import {
  known,
  unknown,
  isKnown,
  valueOr,
  fromNullable,
  sumKnown,
  lowestKnown,
  countKnown,
} from "../known";

test("an unknown value never reads as zero", () => {
  const u = unknown<number>("not-sourced");
  assert.equal(isKnown(u), false);
  // The only way to get a number out is to supply the fallback yourself.
  assert.equal(valueOr(u, 99), 99);
});

test("fromNullable turns absent feed values into unknown, not zero", () => {
  assert.deepEqual(fromNullable(null), unknown("not-sourced"));
  assert.deepEqual(fromNullable(undefined), unknown("not-sourced"));
  assert.deepEqual(fromNullable(Number.NaN), unknown("not-sourced"));
  assert.deepEqual(fromNullable(0), known(0));
  assert.deepEqual(fromNullable(12.5), known(12.5));
});

test("a known zero is distinct from unknown", () => {
  const free = known(0);
  const notSourced = unknown<number>("not-sourced");
  assert.equal(isKnown(free), true);
  assert.equal(isKnown(notSourced), false);
  assert.notDeepEqual(free, notSourced);
});

test("one unknown component makes the whole total unknown", () => {
  const total = sumKnown([known(30), unknown("not-sourced"), known(5)]);
  assert.equal(total.known, false);
  if (!total.known) assert.equal(total.reason, "not-sourced");
});

test("summing only known components gives a known total", () => {
  const total = sumKnown([known(30), known(5), known(0)]);
  assert.deepEqual(total, known(35));
});

test("an empty set of charges is a known zero, not unknown", () => {
  assert.deepEqual(sumKnown([]), known(0));
});

test("lowestKnown ignores unknown entries and reports the count covered", () => {
  const rows = [
    { name: "A", total: known(32) },
    { name: "B", total: known(31) },
    { name: "C", total: unknown<number>("not-sourced") },
  ];
  const best = lowestKnown(rows, (r) => r.total);
  assert.equal(best?.item.name, "B");
  assert.equal(best?.value, 31);
  // C is excluded from the claim, and the coverage count says so.
  assert.equal(countKnown(rows, (r) => r.total), 2);
});

test("lowestKnown returns null when nothing is known", () => {
  const rows = [{ total: unknown<number>("not-sourced") }];
  assert.equal(lowestKnown(rows, (r) => r.total), null);
});
