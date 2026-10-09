import { test } from "node:test";
import assert from "node:assert/strict";
import { singleFlight } from "../singleFlight";
import { publicMerchantCountKey } from "../publication";

test("concurrent category and directory reads share one market load", async () => {
  let calls = 0;
  let finish!: (value: number) => void;
  const read = singleFlight(async () => {
    calls++;
    return new Promise<number>((resolve) => { finish = resolve; });
  });
  const reads = Array.from({ length: 20 }, () => read("US"));
  await Promise.resolve();
  assert.equal(calls, 1);
  finish(42);
  assert.deepEqual(await Promise.all(reads), Array(20).fill(42));
});

test("different markets never share results and later reads reload", async () => {
  let calls = 0;
  const read = singleFlight(async (market) => { calls++; return market; });
  assert.deepEqual(await Promise.all([read("US"), read("AU")]), ["US", "AU"]);
  assert.equal(calls, 2);
  assert.equal(await read("US"), "US");
  assert.equal(calls, 3);
});

test("a database failure is shared but does not poison subsequent reads", async () => {
  let calls = 0;
  const read = singleFlight(async () => {
    if (++calls === 1) throw new Error("database timeout");
    return 7;
  });
  const first = read("US");
  assert.equal(read("US"), first);
  await assert.rejects(first, /database timeout/);
  assert.equal(await read("US"), 7);
});

test("offer counts join numeric and string IDs without mixing networks or names", () => {
  assert.equal(publicMerchantCountKey("awin", 123, "shop"), publicMerchantCountKey("awin", "123", "shop"));
  assert.notEqual(publicMerchantCountKey("awin", 123, "shop"), publicMerchantCountKey("admitad", 123, "shop"));
  assert.notEqual(publicMerchantCountKey("awin", 123, "shop"), publicMerchantCountKey("awin", 123, "other"));
  assert.notEqual(publicMerchantCountKey("awin", 123, "shop"), publicMerchantCountKey("awin", "0123", "shop"));
});
