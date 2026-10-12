import test from "node:test";
import assert from "node:assert/strict";
import { requiresAdmin } from "../routeAccess";
import { validateCorrectionInput } from "../correction";

test("correction submission stays public while reports, email addresses, and review actions are protected", () => {
  assert.equal(requiresAdmin("/api/corrections", "POST"), false);
  for (const method of ["GET", "HEAD", "PATCH", "DELETE"]) assert.equal(requiresAdmin("/api/corrections", method), true);
  for (const path of ["/api/networks/earnings", "/dashboard", "/dashboard/corrections", "/api/admin/products", "/api/transactions"]) assert.equal(requiresAdmin(path, "GET"), true);
  for (const path of ["/us/products", "/api/product-alerts", "/api/search/unified", "/api/transactions-extra"]) assert.equal(requiresAdmin(path, "GET"), false);
});

test("malformed correction references are rejected before database string operations", () => {
  assert.equal(validateCorrectionInput({ country: ["US"], disputeType: "wrong_price", description: "A sufficiently long description" }).valid, false);
  assert.equal(validateCorrectionInput({ country: "US", disputeType: "wrong_match", description: "A sufficiently long description", productId: { id: 1 } }).valid, false);
});
