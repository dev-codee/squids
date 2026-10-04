/**
 * Persistence layer for price observations.
 *
 * Append-only observation store. Every price change or check writes a new
 * timestamped record. History is never fabricated or back-filled from RRP.
 */

import { getDb } from "@/lib/mongodb";
import type { PriceObservation } from "@/lib/model/priceObservation";
import { sortObservationsChronological } from "@/lib/model/priceObservation";

const COLLECTION = "price_observations";

interface PriceObservationDoc extends PriceObservation {
  _id?: unknown;
}

export async function ensurePriceObservationIndexes(): Promise<void> {
  const db = await getDb();
  const col = db.collection<PriceObservationDoc>(COLLECTION);
  await Promise.all([
    col.createIndex({ id: 1 }, { unique: true }),
    col.createIndex({ productId: 1, market: 1, observedAt: 1 }),
    col.createIndex({ retailerId: 1, observedAt: 1 }),
  ]);
}

function strip(doc: PriceObservationDoc): PriceObservation {
  const { _id, ...rest } = doc;
  return rest as PriceObservation;
}

/**
 * Record a single price observation.
 */
export async function recordPriceObservation(
  obs: PriceObservation,
): Promise<void> {
  const db = await getDb();
  const col = db.collection<PriceObservationDoc>(COLLECTION);
  await ensurePriceObservationIndexes();

  await col.updateOne(
    { id: obs.id },
    { $set: obs },
    { upsert: true },
  );
}

/**
 * Batch insert price observations idempotently.
 */
export async function recordPriceObservationsBatch(
  observations: readonly PriceObservation[],
): Promise<number> {
  if (observations.length === 0) return 0;
  const db = await getDb();
  const col = db.collection<PriceObservationDoc>(COLLECTION);
  await ensurePriceObservationIndexes();

  const ops = observations.map((o) => ({
    updateOne: {
      filter: { id: o.id },
      update: { $set: o },
      upsert: true,
    },
  }));

  const res = await col.bulkWrite(ops, { ordered: false });
  return res.upsertedCount + res.modifiedCount;
}

/**
 * Fetch chronological price observations for a product and market.
 */
export async function getPriceHistory(
  productId: number,
  market: string,
  limit = 200,
): Promise<PriceObservation[]> {
  const db = await getDb();
  const col = db.collection<PriceObservationDoc>(COLLECTION);

  const docs = await col
    .find({ productId, market: market.toUpperCase() })
    .sort({ observedAt: 1 })
    .limit(limit)
    .toArray();

  return sortObservationsChronological(docs.map(strip));
}

/**
 * Record a correction to an existing observation with audit details.
 */
export async function recordCorrection(params: {
  id: string;
  correctedPrice: number;
  correctedBy: string;
  reason: string;
}): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<PriceObservationDoc>(COLLECTION);

  const existing = await col.findOne({ id: params.id });
  if (!existing) return false;

  const res = await col.updateOne(
    { id: params.id },
    {
      $set: {
        itemPrice: params.correctedPrice,
        isCorrection: true,
        originalValue: existing.itemPrice,
        correctionReason: params.reason,
        correctedBy: params.correctedBy,
      },
    },
  );

  return res.modifiedCount > 0;
}
