import test from "node:test";
import assert from "node:assert/strict";
import { listingSeo } from "../listingSeo";
import { readProductCatalogParams } from "../productCatalog";
import { getRegionConfig, isValidRegionCode } from "../../regions";

test("pagination has distinct canonicals without tracking or display parameters", () => {
  assert.deepEqual(listingSeo("https://foxzil.com/us/products", { page: "2", utm_source: "test", view: "grid" }), {
    canonical: "https://foxzil.com/us/products?page=2", robots: { index: true, follow: true },
  });
  assert.equal(listingSeo("/category", { page: "3" }, { tab: "deals" }).canonical, "/category?tab=deals&page=3");
  assert.equal(listingSeo("/products", { search: "shoes" }, { refined: true }).robots.index, false);
});

test("invalid and repeated page parameters normalize to the first page", () => {
  for (const page of ["-1", "0", "Infinity", "1.5", "1e30", ["2", "3"]]) {
    assert.equal(listingSeo("/products", { page }).canonical, "/products");
  }
});

test("catalog filters safely parse repeated input and reversed price bounds", () => {
  const q = readProductCatalogParams({ min: "40", max: "10", currency: "gbp", search: ["x", "y"] });
  assert.equal(q.minPrice, 10);
  assert.equal(q.maxPrice, 40);
  assert.equal(q.currency, "GBP");
  assert.equal(q.search, "");
});

test("unsupported regions fall back to a route that exists and Norway matches its English UI", () => {
  assert.equal(isValidRegionCode("ZZ"), false);
  assert.equal(getRegionConfig("ZZ").country, "US");
  assert.equal(getRegionConfig("NO").locale, "en-NO");
});

test("sitemap XML escapes URLs and distinguishes indexes from URL sets", async () => {
  const { sitemapXml } = await import("../sitemapXml");
  assert.match(sitemapXml(["https://example.com/?a=1&b=2"]), /<url><loc>https:\/\/example.com\/\?a=1&amp;b=2<\/loc><\/url>/);
  assert.match(sitemapXml(["https://example.com/sitemap/0"], true), /<sitemapindex[^>]*><sitemap>/);
});
