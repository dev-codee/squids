/**
 * Persistence layer for product price alerts.
 *
 * Stores user price targets, explicit consent metadata, and double opt-in tokens.
 */

import { randomBytes } from "crypto";
import { getDb } from "@/lib/mongodb";
import type {
  ProductAlert,
  AlertFrequency,
  ProductAlertStatus,
} from "@/lib/model/productAlert";

const COLLECTION = "product_alerts";

interface ProductAlertDoc extends ProductAlert {
  _id?: unknown;
}

export async function ensureProductAlertIndexes(): Promise<void> {
  const db = await getDb();
  const col = db.collection<ProductAlertDoc>(COLLECTION);
  await Promise.all([
    col.createIndex({ id: 1 }, { unique: true }),
    col.createIndex({ token: 1 }, { unique: true }),
    col.createIndex({ email: 1, productId: 1, market: 1 }),
    col.createIndex({ status: 1, market: 1, productId: 1 }),
  ]);
}

function strip(doc: ProductAlertDoc): ProductAlert {
  const { _id, ...rest } = doc;
  return rest as ProductAlert;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Register a product price alert.
 * If user already subscribed to this product, updates the target price and frequency.
 * Returns whether confirmation email needs to be sent.
 */
export async function createOrUpdateProductAlert(params: {
  email: string;
  productId: number;
  productTitle: string;
  market: string;
  currency: string;
  targetPrice: number;
  frequency: AlertFrequency;
  consentScope?: string;
  consentVersion?: string;
}): Promise<{ alert: ProductAlert; needsConfirmation: boolean }> {
  const db = await getDb();
  const col = db.collection<ProductAlertDoc>(COLLECTION);
  await ensureProductAlertIndexes();

  const email = normalizeEmail(params.email);
  const market = params.market.toUpperCase();
  const now = new Date();

  const existing = await col.findOne({
    email,
    productId: params.productId,
    market,
  });

  if (!existing) {
    const alert: ProductAlert = {
      id: randomBytes(16).toString("hex"),
      email,
      productId: params.productId,
      productTitle: params.productTitle,
      market,
      currency: params.currency,
      targetPrice: params.targetPrice,
      frequency: params.frequency,
      status: "pending",
      token: randomBytes(24).toString("hex"),
      consentScope: params.consentScope || "price_drop_alerts",
      consentVersion: params.consentVersion || "2026-v1",
      createdAt: now.toISOString(),
      confirmedAt: null,
      unsubscribedAt: null,
      lastNotifiedAt: null,
      lastCheckedPrice: null,
    };

    await col.insertOne(alert);
    return { alert, needsConfirmation: true };
  }

  // Reactivating or updating target price
  const reactivating = existing.status === "unsubscribed";
  const newStatus: ProductAlertStatus = reactivating ? "pending" : existing.status;
  const token = reactivating ? randomBytes(24).toString("hex") : existing.token;

  await col.updateOne(
    { id: existing.id },
    {
      $set: {
        targetPrice: params.targetPrice,
        frequency: params.frequency,
        status: newStatus,
        token,
        productTitle: params.productTitle,
        ...(reactivating ? { confirmedAt: null, unsubscribedAt: null } : {}),
      },
    },
  );

  const updated = await col.findOne({ id: existing.id });
  return {
    alert: strip(updated!),
    needsConfirmation: newStatus === "pending",
  };
}

/**
 * Confirm a pending alert via verification token.
 */
export async function confirmProductAlert(token: string): Promise<ProductAlert | null> {
  if (!token) return null;
  const db = await getDb();
  const col = db.collection<ProductAlertDoc>(COLLECTION);
  const now = new Date().toISOString();

  const res = await col.findOneAndUpdate(
    { token, status: "pending" },
    { $set: { status: "confirmed", confirmedAt: now } },
    { returnDocument: "after" },
  );

  if (res) return strip(res);
  const existing = await col.findOne({ token, status: "confirmed" });
  return existing ? strip(existing) : null;
}

/**
 * Unsubscribe an alert by token.
 */
export async function unsubscribeProductAlert(token: string): Promise<boolean> {
  if (!token) return false;
  const db = await getDb();
  const col = db.collection<ProductAlertDoc>(COLLECTION);

  const res = await col.updateOne(
    { token },
    { $set: { status: "unsubscribed", unsubscribedAt: new Date().toISOString() } },
  );

  return res.matchedCount > 0;
}

/**
 * Fetch all confirmed alerts for a given product and market.
 */
export async function getActiveAlertsForProduct(
  productId: number,
  market: string,
): Promise<ProductAlert[]> {
  const db = await getDb();
  const col = db.collection<ProductAlertDoc>(COLLECTION);

  const docs = await col
    .find({
      productId,
      market: market.toUpperCase(),
      status: "confirmed",
    })
    .toArray();

  return docs.map(strip);
}

/**
 * Mark alert as notified and update last checked price.
 */
export async function markProductAlertNotified(
  id: string,
  price: number,
  notifiedAt: Date = new Date(),
): Promise<void> {
  const db = await getDb();
  const col = db.collection<ProductAlertDoc>(COLLECTION);

  await col.updateOne(
    { id },
    {
      $set: {
        lastNotifiedAt: notifiedAt.toISOString(),
        lastCheckedPrice: price,
      },
    },
  );
}

export interface AlertOperationsMetrics {
  totalAlerts: number;
  confirmedAlerts: number;
  pendingAlerts: number;
  unsubscribedAlerts: number;
  distinctProductsTracked: number;
}

/**
 * Operational metrics for the admin alerts dashboard.
 */
export async function getProductAlertOperationsMetrics(): Promise<AlertOperationsMetrics> {
  const db = await getDb();
  const col = db.collection<ProductAlertDoc>(COLLECTION);

  const [total, confirmed, pending, unsubscribed, distinctProducts] = await Promise.all([
    col.countDocuments({}),
    col.countDocuments({ status: "confirmed" }),
    col.countDocuments({ status: "pending" }),
    col.countDocuments({ status: "unsubscribed" }),
    col.distinct("productId", { status: "confirmed" }),
  ]);

  return {
    totalAlerts: total,
    confirmedAlerts: confirmed,
    pendingAlerts: pending,
    unsubscribedAlerts: unsubscribed,
    distinctProductsTracked: distinctProducts.length,
  };
}
