import test from "node:test";
import assert from "node:assert/strict";
import {
  isTargetPriceMet,
  canSendAlert,
  revalidateOfferBeforeAlert,
  type ProductAlert,
} from "../productAlert";

test("isTargetPriceMet triggers when price drops to or below target", () => {
  assert.equal(isTargetPriceMet(25.0, 25.0), true);
  assert.equal(isTargetPriceMet(24.99, 25.0), true);
  assert.equal(isTargetPriceMet(25.01, 25.0), false);
  assert.equal(isTargetPriceMet(30.0, 25.0), false);
});

test("canSendAlert respects confirmation status and frequency cooldown", () => {
  const alert: ProductAlert = {
    id: "alert-1",
    email: "test@example.com",
    productId: 1,
    productTitle: "Test Product",
    market: "US",
    currency: "USD",
    targetPrice: 20,
    frequency: "instant",
    status: "confirmed",
    token: "token123",
    consentScope: "price_drop_alerts",
    consentVersion: "2026-v1",
    createdAt: new Date().toISOString(),
    lastNotifiedAt: null,
  };

  assert.equal(canSendAlert(alert), true);

  // Pending alerts cannot send
  assert.equal(canSendAlert({ ...alert, status: "pending" }), false);

  // Unsubscribed alerts cannot send
  assert.equal(canSendAlert({ ...alert, status: "unsubscribed" }), false);

  // Just notified (within 6h for instant) -> false
  const now = new Date();
  const recentNotify = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  assert.equal(canSendAlert({ ...alert, lastNotifiedAt: recentNotify }, now), false);

  // Older notification (8h for instant) -> true
  const pastNotify = new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString();
  assert.equal(canSendAlert({ ...alert, lastNotifiedAt: pastNotify }, now), true);
});

test("revalidateOfferBeforeAlert blocks stale, out of stock, or unmet targets", () => {
  // Stale
  const resStale = revalidateOfferBeforeAlert({
    isCurrent: false,
    inStock: true,
    itemPrice: 20,
    targetPrice: 25,
  });
  assert.equal(resStale.canSend, false);

  // Out of stock
  const resStock = revalidateOfferBeforeAlert({
    isCurrent: true,
    inStock: false,
    itemPrice: 20,
    targetPrice: 25,
  });
  assert.equal(resStock.canSend, false);

  // Target unmet
  const resHigh = revalidateOfferBeforeAlert({
    isCurrent: true,
    inStock: true,
    itemPrice: 30,
    targetPrice: 25,
  });
  assert.equal(resHigh.canSend, false);

  // Valid
  const resValid = revalidateOfferBeforeAlert({
    isCurrent: true,
    inStock: true,
    itemPrice: 24,
    targetPrice: 25,
  });
  assert.equal(resValid.canSend, true);
  assert.equal(resValid.eligiblePrice, 24);
});
