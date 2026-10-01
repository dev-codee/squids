/**
 * Persistence for delivery rules and other mandatory charges.
 *
 * Money fields are stored as `Known<number>` documents (`{known:true,value}` /
 * `{known:false,reason}`) rather than nullable numbers, so a missing charge
 * survives the round-trip to Mongo as "unknown" and cannot be read back as
 * free delivery.
 */

import { getDb } from "@/lib/mongodb";
import type { DeliveryRule } from "@/lib/model/delivery";
import { isSourced, ruleForDestination } from "@/lib/model/delivery";
import type { MerchantMarketId } from "@/lib/model/merchantMarket";

const COLLECTION = "delivery_rules";

interface DeliveryDoc extends DeliveryRule {
  _id?: unknown;
}

export async function ensureDeliveryIndexes(): Promise<void> {
  const db = await getDb();
  const col = db.collection<DeliveryDoc>(COLLECTION);
  await Promise.all([
    col.createIndex({ id: 1 }, { unique: true }),
    col.createIndex({ merchantMarketId: 1, serviceLevel: 1 }),
    col.createIndex({ "zone.market": 1 }),
  ]);
}

function strip(doc: DeliveryDoc): DeliveryRule {
  const { _id, ...rest } = doc;
  return rest as DeliveryRule;
}

export async function getDeliveryRules(
  merchantMarketId: MerchantMarketId,
): Promise<DeliveryRule[]> {
  const db = await getDb();
  const col = db.collection<DeliveryDoc>(COLLECTION);
  return (await col.find({ merchantMarketId }).toArray()).map(strip);
}

/**
 * The rule to apply for a destination, or null when none is on record.
 *
 * A null return means "we have no delivery facts for this destination" — the
 * caller must render that as unknown, never as free.
 */
export async function getDeliveryRuleFor(
  merchantMarketId: MerchantMarketId,
  destination: { market: string; postcode?: string | null; serviceLevel?: string },
): Promise<DeliveryRule | null> {
  const rules = await getDeliveryRules(merchantMarketId);
  return ruleForDestination(rules, destination);
}

/** Only rules a person has actually sourced and checked may be shown as fact. */
export async function getSourcedDeliveryRules(
  merchantMarketId: MerchantMarketId,
): Promise<DeliveryRule[]> {
  return (await getDeliveryRules(merchantMarketId)).filter(isSourced);
}

export async function upsertDeliveryRule(rule: DeliveryRule): Promise<void> {
  const db = await getDb();
  const col = db.collection<DeliveryDoc>(COLLECTION);
  await ensureDeliveryIndexes();
  const now = new Date();
  await col.updateOne(
    { id: rule.id },
    {
      $set: { ...rule, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function deleteDeliveryRule(id: string): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<DeliveryDoc>(COLLECTION);
  const res = await col.deleteOne({ id });
  return res.deletedCount > 0;
}

/**
 * Merchant-markets with no sourced delivery facts.
 *
 * This is the gap report: until a merchant-market appears sourced here, its
 * product offers cannot produce a known delivered total, and the store page
 * must say delivery is unknown rather than guess.
 */
export async function merchantMarketsMissingDelivery(
  merchantMarketIds: readonly MerchantMarketId[],
): Promise<MerchantMarketId[]> {
  if (merchantMarketIds.length === 0) return [];
  const db = await getDb();
  const col = db.collection<DeliveryDoc>(COLLECTION);
  const docs = await col
    .find({ merchantMarketId: { $in: [...merchantMarketIds] } })
    .toArray();

  const sourced = new Set(
    docs.map(strip).filter(isSourced).map((r) => r.merchantMarketId),
  );
  return merchantMarketIds.filter((id) => !sourced.has(id));
}
