/**
 * Persistence for merchant-markets.
 *
 * One document per (merchant, market). Public pages resolve a store by
 * `(market, slug)` against this collection rather than by slugging a display
 * name, which is what the brief means by "Never join by display name alone".
 */

import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/mongodb";
import { CACHE_TAGS, PUBLIC_REVALIDATE } from "@/lib/cache";
import type { MerchantMarket, MerchantMarketId } from "@/lib/model/merchantMarket";
import { canPublish, merchantMarketId } from "@/lib/model/merchantMarket";

const COLLECTION = "merchant_markets";

interface MerchantMarketDoc extends MerchantMarket {
  _id?: unknown;
}

export async function ensureMerchantMarketIndexes(): Promise<void> {
  const db = await getDb();
  const col = db.collection<MerchantMarketDoc>(COLLECTION);
  await Promise.all([
    col.createIndex({ id: 1 }, { unique: true }),
    // The lookup every public store page performs.
    col.createIndex({ market: 1, slug: 1 }, { unique: true }),
    col.createIndex({ merchantId: 1, network: 1 }),
    col.createIndex({ status: 1, market: 1 }),
  ]);
}

function strip(doc: MerchantMarketDoc | null): MerchantMarket | null {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest as MerchantMarket;
}

/** Resolve a store page by its market and canonical slug. */
async function getByMarketSlugUncached(
  market: string,
  slug: string,
): Promise<MerchantMarket | null> {
  const db = await getDb();
  const col = db.collection<MerchantMarketDoc>(COLLECTION);
  const doc = await col.findOne({
    market: market.toUpperCase(),
    slug: slug.toLowerCase(),
  });
  return strip(doc);
}

export const getMerchantMarketBySlug = unstable_cache(
  getByMarketSlugUncached,
  ["public:merchant-market-by-slug"],
  { revalidate: PUBLIC_REVALIDATE, tags: [CACHE_TAGS.advertisers] },
);

async function getByIdUncached(id: MerchantMarketId): Promise<MerchantMarket | null> {
  const db = await getDb();
  const col = db.collection<MerchantMarketDoc>(COLLECTION);
  return strip(await col.findOne({ id }));
}

export const getMerchantMarketById = unstable_cache(
  getByIdUncached,
  ["public:merchant-market-by-id"],
  { revalidate: PUBLIC_REVALIDATE, tags: [CACHE_TAGS.advertisers] },
);

/** Every market a merchant trades in — used to build hreflang honestly. */
export async function getMarketsForMerchant(
  network: string,
  merchantId: number,
): Promise<MerchantMarket[]> {
  const db = await getDb();
  const col = db.collection<MerchantMarketDoc>(COLLECTION);
  const docs = await col.find({ network, merchantId }).toArray();
  return docs.map((d) => strip(d)!).filter(Boolean);
}

/**
 * Markets this merchant may be published in.
 *
 * The brief gates publishing on confirmed rights, so this filters on status and
 * the SEO permission rather than returning everything on file.
 */
export async function getPublishableMarkets(
  network: string,
  merchantId: number,
): Promise<MerchantMarket[]> {
  const all = await getMarketsForMerchant(network, merchantId);
  return all.filter(canPublish);
}

export async function upsertMerchantMarket(mm: MerchantMarket): Promise<void> {
  const db = await getDb();
  const col = db.collection<MerchantMarketDoc>(COLLECTION);
  const now = new Date();
  await col.updateOne(
    { id: mm.id },
    {
      // Permissions, policy URLs and review stamps are operator-owned; a
      // re-run of the backfill must not reset them to defaults.
      $set: {
        merchantId: mm.merchantId,
        network: mm.network,
        market: mm.market,
        displayName: mm.displayName,
        slug: mm.slug,
        currency: mm.currency,
        websiteUrl: mm.websiteUrl,
        approvedDomains: mm.approvedDomains,
        feedSourceIds: mm.feedSourceIds,
        updatedAt: now,
      },
      $setOnInsert: {
        id: mm.id,
        permissions: mm.permissions,
        commission: mm.commission ?? {},
        policyUrls: mm.policyUrls ?? {},
        status: mm.status,
        reviewedBy: mm.reviewedBy ?? null,
        reviewedAt: mm.reviewedAt ?? null,
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

/** Bulk upsert for the backfill. Returns how many documents were created. */
export async function upsertMerchantMarkets(
  records: readonly MerchantMarket[],
): Promise<{ upserted: number; modified: number }> {
  if (records.length === 0) return { upserted: 0, modified: 0 };
  const db = await getDb();
  const col = db.collection<MerchantMarketDoc>(COLLECTION);
  await ensureMerchantMarketIndexes();

  const now = new Date();
  const ops = records.map((mm) => ({
    updateOne: {
      filter: { id: mm.id },
      update: {
        $set: {
          merchantId: mm.merchantId,
          network: mm.network,
          market: mm.market,
          displayName: mm.displayName,
          slug: mm.slug,
          currency: mm.currency,
          websiteUrl: mm.websiteUrl,
          approvedDomains: mm.approvedDomains,
          feedSourceIds: mm.feedSourceIds,
          updatedAt: now,
        },
        $setOnInsert: {
          id: mm.id,
          permissions: mm.permissions,
          commission: mm.commission ?? {},
          policyUrls: mm.policyUrls ?? {},
          status: mm.status,
          reviewedBy: null,
          reviewedAt: null,
          createdAt: now,
        },
      },
      upsert: true as const,
    },
  }));

  const result = await col.bulkWrite(ops, { ordered: false });
  return { upserted: result.upsertedCount, modified: result.modifiedCount };
}

/** Operator action: record who confirmed rights, and when. Never automatic. */
export async function recordReview(
  id: MerchantMarketId,
  reviewedBy: string,
): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<MerchantMarketDoc>(COLLECTION);
  const res = await col.updateOne(
    { id },
    { $set: { reviewedBy, reviewedAt: new Date().toISOString(), updatedAt: new Date() } },
  );
  return res.matchedCount > 0;
}

export { merchantMarketId };
