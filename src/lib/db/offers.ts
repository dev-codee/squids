/**
 * Persistence for retailer offers.
 *
 * Offers live apart from products so one product can carry offers from several
 * retailers — the thing the comparison table needs and the current conflated
 * `products` collection cannot express.
 */

import type { AnyBulkWriteOperation } from "mongodb";
import { getDb } from "@/lib/mongodb";
import type { RetailerOfferRecord, OfferStatus } from "@/lib/model/offer";
import { ageStatus, isComparable, isEligibleInMarket } from "@/lib/model/offer";

const COLLECTION = "offers";

interface OfferDoc extends RetailerOfferRecord {
  _id?: unknown;
}

export async function ensureOfferIndexes(): Promise<void> {
  const db = await getDb();
  const col = db.collection<OfferDoc>(COLLECTION);
  await Promise.all([
    col.createIndex({ id: 1 }, { unique: true }),
    // The comparison query: every offer for one product.
    col.createIndex({ productId: 1, status: 1 }),
    col.createIndex({ merchantMarketId: 1, status: 1 }),
    // Staleness sweeps scan by freshness.
    col.createIndex({ status: 1, sourceUpdatedAt: 1 }),
    col.createIndex({ sourceBatchId: 1 }),
  ]);
}

function strip(doc: OfferDoc): RetailerOfferRecord {
  const { _id, ...rest } = doc;
  return rest as RetailerOfferRecord;
}

/**
 * Offers for a product that may appear in a public comparison.
 *
 * Filtering happens here rather than in the page so a count and a list can
 * never disagree — they come from the same call.
 */
export async function getComparableOffers(
  productId: number,
  market: string,
): Promise<RetailerOfferRecord[]> {
  const db = await getDb();
  const col = db.collection<OfferDoc>(COLLECTION);
  const docs = await col.find({ productId, status: "current" }).toArray();
  return docs
    .map(strip)
    .filter((o) => isComparable(o) && isEligibleInMarket(o, market));
}

/** Every offer for a product, whatever its state — for admin and diagnostics. */
export async function getAllOffersForProduct(
  productId: number,
): Promise<RetailerOfferRecord[]> {
  const db = await getDb();
  const col = db.collection<OfferDoc>(COLLECTION);
  return (await col.find({ productId }).toArray()).map(strip);
}

export async function getOffersForMerchantMarket(
  merchantMarketId: string,
  limit = 100,
): Promise<RetailerOfferRecord[]> {
  const db = await getDb();
  const col = db.collection<OfferDoc>(COLLECTION);
  return (await col.find({ merchantMarketId }).limit(limit).toArray()).map(strip);
}

/**
 * Idempotent bulk upsert, keyed on the stable offer ID.
 *
 * Re-running a batch must not duplicate offers. Operator-owned fields —
 * `status`, `statusReason`, `checkedAt` — are only set on insert, so an
 * ingest cannot silently republish something a reviewer quarantined or mark
 * data as freshly checked when nobody checked it.
 */
export async function upsertOffers(
  offers: readonly RetailerOfferRecord[],
): Promise<{ upserted: number; modified: number }> {
  if (offers.length === 0) return { upserted: 0, modified: 0 };
  const db = await getDb();
  const col = db.collection<OfferDoc>(COLLECTION);
  await ensureOfferIndexes();

  const now = new Date();
  const ops = offers.map((o) => ({
    updateOne: {
      filter: { id: o.id },
      update: {
        $set: {
          merchantMarketId: o.merchantMarketId,
          productId: o.productId,
          sourceItemId: o.sourceItemId,
          itemPrice: o.itemPrice,
          currency: o.currency,
          stock: o.stock,
          condition: o.condition,
          destinationUrl: o.destinationUrl,
          sourceUpdatedAt: o.sourceUpdatedAt,
          fetchedAt: o.fetchedAt,
          eligibility: o.eligibility,
          sourceBatchId: o.sourceBatchId ?? null,
          updatedAt: now,
        },
        $setOnInsert: {
          id: o.id,
          status: o.status,
          statusReason: o.statusReason ?? null,
          checkedAt: o.checkedAt,
          createdAt: now,
        },
      },
      upsert: true as const,
    },
  }));

  const result = await col.bulkWrite(ops, { ordered: false });
  return { upserted: result.upsertedCount, modified: result.modifiedCount };
}

/**
 * Re-age offers against a maximum freshness, flipping current ⇄ stale.
 *
 * The brief: "A fetch failure must not make old data appear freshly checked."
 * This only ever moves between `current` and `stale` — quarantined and draft
 * records are left for a human.
 */
export async function refreshStaleness(
  maxAgeHours: number,
  now: Date = new Date(),
): Promise<{ markedStale: number; markedCurrent: number }> {
  const db = await getDb();
  const col = db.collection<OfferDoc>(COLLECTION);
  const docs = await col
    .find({ status: { $in: ["current", "stale"] as OfferStatus[] } })
    .toArray();

  let markedStale = 0;
  let markedCurrent = 0;
  const ops: AnyBulkWriteOperation<OfferDoc>[] = [];

  for (const doc of docs) {
    const offer = strip(doc);
    const next = ageStatus(offer, maxAgeHours, now);
    if (next === offer.status) continue;
    if (next === "stale") markedStale++;
    else markedCurrent++;
    ops.push({
      updateOne: {
        filter: { id: offer.id },
        update: {
          $set: {
            status: next,
            statusReason:
              next === "stale" ? `older than ${maxAgeHours}h at ${now.toISOString()}` : null,
            updatedAt: now,
          },
        },
      },
    });
  }

  if (ops.length > 0) await col.bulkWrite(ops, { ordered: false });
  return { markedStale, markedCurrent };
}

/**
 * Quarantine an offer. Used when a removal is ambiguous or data conflicts —
 * never delete, because a failed import must not erase valid records.
 */
export async function quarantineOffer(id: string, reason: string): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<OfferDoc>(COLLECTION);
  const res = await col.updateOne(
    { id },
    { $set: { status: "quarantined", statusReason: reason, updatedAt: new Date() } },
  );
  return res.matchedCount > 0;
}

/** Operator action: record that a person actually checked this offer. */
export async function recordOfferCheck(
  id: string,
  checkedAt: string = new Date().toISOString(),
): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<OfferDoc>(COLLECTION);
  const res = await col.updateOne({ id }, { $set: { checkedAt, updatedAt: new Date() } });
  return res.matchedCount > 0;
}

/** Publish a reviewed draft. */
export async function publishOffer(id: string): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<OfferDoc>(COLLECTION);
  const res = await col.updateOne(
    { id, status: "draft" },
    { $set: { status: "current", statusReason: null, updatedAt: new Date() } },
  );
  return res.modifiedCount > 0;
}

export async function countOffersByStatus(): Promise<Record<string, number>> {
  const db = await getDb();
  const col = db.collection<OfferDoc>(COLLECTION);
  const rows = await col
    .aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }])
    .toArray();
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
}
