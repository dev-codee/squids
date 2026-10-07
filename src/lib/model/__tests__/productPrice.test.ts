import { test } from "node:test";
import assert from "node:assert/strict";
import { formatProductPrice } from "../productPrice";

const au = { country: "AU", currency: "AUD", locale: "en-AU" };

test("an AUD product price stays AUD across cards and comparisons", () => {
  assert.equal(formatProductPrice(26, "AUD", au, 1.43), "$26.00");
  assert.equal(formatProductPrice(49, "AUD", au, 1.43), "$49.00");
});

test("a recorded foreign currency is labelled without applying a USD rate", () => {
  assert.equal(formatProductPrice(26, "EUR", au, 1.43), "EUR\u00a026.00");
});

test("legacy prices without currency retain their existing USD conversion", () => {
  assert.equal(formatProductPrice(26, null, au, 1.43), "$37.18");
});
