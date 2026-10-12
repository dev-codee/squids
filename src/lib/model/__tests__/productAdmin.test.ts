import { test } from "node:test";
import assert from "node:assert/strict";
import { adminId, adminNumber, adminUrl, productFields } from "../productAdmin";

test("admin product edits preserve omitted fields and explicit unknown prices", () => {
  assert.deepEqual(productFields({ salePrice: "" }, true), { salePrice: null });
  assert.deepEqual(productFields({ salePrice: "0", description: "Clear text" }, true), { description: "Clear text", salePrice: 0 });
  assert.deepEqual(productFields({}, true), {});
});
test("product validation rejects malformed values instead of silently converting them", () => {
  for (const value of [true, {}, -1, Infinity, "NaN", "   "]) assert.throws(() => adminNumber(value, "Price"));
  for (const id of [0, -1, 1.5, "3junk", Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => adminId(id));
  assert.throws(() => productFields({ title: "   " }));
  assert.throws(() => productFields({ inStock: "false" }, true));
  assert.throws(() => productFields({ packCount: 1.5 }, true));
  assert.throws(() => productFields({ rating: 6 }, true));
  assert.throws(() => productFields({ gtin: "not-a-code" }, true));
});
test("admin accepts local fixture images but not script URLs or credential URLs", () => {
  assert.equal(adminUrl("/demo/beauty-amora/serum.svg", "Image", true), "/demo/beauty-amora/serum.svg");
  assert.equal(adminUrl("https://shop.example/item", "Tracking"), "https://shop.example/item");
  for (const value of ["javascript:alert(1)", "//example.com/image", "/../secrets", "https://user:pass@example.com"]) assert.throws(() => adminUrl(value, "Image", true));
});
test("specifications require complete bounded rows and can be cleared", () => {
  assert.deepEqual(productFields({ specifications: [] }, true), { specifications: [] });
  assert.deepEqual(productFields({ specifications: [{ label: " Material ", value: " Glass " }] }, true), { specifications: [{ label: "Material", value: "Glass" }] });
  assert.throws(() => productFields({ specifications: [{ label: "Size", value: "" }] }, true));
  assert.throws(() => productFields({ specifications: "invalid" }, true));
});
