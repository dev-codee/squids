/**
 * MongoDB Persistence for Outbound Affiliate Clicks
 *
 * Records every outbound click with its generated Foxzil Click ID and
 * Google Ads identifier (gclid/gbraid/wbraid) for down-funnel sale attribution.
 */

import { getDb } from "@/lib/mongodb";

export const CLICKS_COLLECTION = "clicks";

export interface ClickDoc {
  clickId: string;
  couponId?: string;
  advertiserId?: number;
  storeSlug: string;
  storeName: string;
  network?: string;
  market: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  destinationUrl: string;
  referrer?: string;
  userAgent?: string;
  createdAt: Date;
}

/**
 * Ensures indexes exist on the clicks collection.
 */
async function ensureIndexes() {
  const db = await getDb();
  const col = db.collection<ClickDoc>(CLICKS_COLLECTION);
  await Promise.all([
    col.createIndex({ clickId: 1 }, { unique: true }),
    col.createIndex({ gclid: 1 }),
    col.createIndex({ createdAt: -1 }),
    col.createIndex({ storeSlug: 1, market: 1 }),
  ]);
}

let indexesInitialized = false;

/**
 * Inserts a new outbound click record into MongoDB.
 */
export async function recordOutboundClick(click: ClickDoc): Promise<void> {
  const db = await getDb();
  const col = db.collection<ClickDoc>(CLICKS_COLLECTION);

  if (!indexesInitialized) {
    ensureIndexes().catch((e) => console.warn("[clicks] Failed to ensure indexes:", e));
    indexesInitialized = true;
  }

  await col.insertOne(click);
}

/**
 * Finds a click record by its unique Foxzil Click ID.
 */
export async function getClickById(clickId: string): Promise<ClickDoc | null> {
  if (!clickId) return null;
  const db = await getDb();
  const col = db.collection<ClickDoc>(CLICKS_COLLECTION);
  return col.findOne({ clickId });
}
