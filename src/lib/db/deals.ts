/**
 * MongoDB persistence layer for Deals (promotions/offers).
 *
 * Stores the normalised `Deal` type from `@/lib/deals` with a
 * `syncedAt` timestamp. Provides bulk upsert (for cron sync) and
 * query/filter/paginate (for the API route).
 *
 * Multi-network: keyed on composite `(network, id)` to avoid ID collisions
 * between Awin and Admitad (or future networks).
 */

import type { AnyBulkWriteOperation } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { cleanAdvertiserName } from "@/lib/networks";
import type { Deal, DealQuery, PagedDeals } from "@/lib/deals";
import { DEFAULT_DEALS_PAGE_SIZE, MAX_DEALS_PAGE_SIZE } from "@/lib/deals";

const COLLECTION = "deals";

interface DealDoc extends Deal {
  syncedAt: Date;
}

// ---------------------------------------------------------------------------
// Write — used by the cron sync job
// ---------------------------------------------------------------------------

/**
 * Upsert a batch of deals into MongoDB.
 * Uses bulk `updateOne` with `upsert: true` keyed on `(network, id)`.
 */
export async function upsertDeals(
  deals: Deal[],
): Promise<{ upserted: number; modified: number }> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  // Ensure composite unique index for multi-network support
  await col.createIndex({ network: 1, id: 1 }, { unique: true });

  const now = new Date();
  const ops = deals.map((d) => ({
    updateOne: {
      filter: { network: d.network ?? "awin", id: d.id },
      update: { $setOnInsert: { ...d, network: d.network ?? "awin", syncedAt: now } },
      upsert: true,
    },
  }));

  if (ops.length === 0) return { upserted: 0, modified: 0 };

  const result = await col.bulkWrite(ops, { ordered: false });
  return {
    upserted: result.upsertedCount,
    modified: result.modifiedCount,
  };
}

// ---------------------------------------------------------------------------
// Read — used by the API route
// ---------------------------------------------------------------------------

/**
 * Build MongoDB filter from the query parameters.
 */
function buildFilter(query: DealQuery & { network?: string }): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [];

  if (query.network) {
    conditions.push({ network: query.network });
  }

  if (query.search?.trim()) {
    const searchRegex = { $regex: query.search.trim(), $options: "i" };
    conditions.push({
      $or: [
        { title: searchRegex },
        { "advertiser.name": searchRegex },
        { description: searchRegex },
        { code: searchRegex },
      ],
    });
  }

  if (query.advertiserId) {
    conditions.push({ "advertiser.id": query.advertiserId });
  }

  if (query.status && query.status !== "all") {
    conditions.push({ status: query.status });
  }

  if (query.type && query.type !== "all") {
    conditions.push({ type: query.type });
  }

  if (query.country?.trim()) {
    const cc = query.country.trim().toUpperCase();
    conditions.push({
      $or: [
        { regionCodes: { $size: 0 } },
        { regionCodes: cc },
        { regionCodes: { $exists: false } },
      ],
    });
  }

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
}

/**
 * Query deals from MongoDB with filtering and pagination.
 * Returns the same `PagedDeals` shape the API route expects.
 */
export async function getDealsFromDb(
  query: DealQuery & { network?: string },
): Promise<PagedDeals | null> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  // If the collection is empty, return null so the caller falls back to Awin
  const count = await col.estimatedDocumentCount();
  if (count === 0) return null;

  const filter = buildFilter(query);

  const pageSize = Math.min(
    Math.max(1, query.pageSize || DEFAULT_DEALS_PAGE_SIZE),
    MAX_DEALS_PAGE_SIZE,
  );
  const total = await col.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page || 1), totalPages);
  const skip = (page - 1) * pageSize;

  const docs = await col
    .find(filter, { projection: { _id: 0, syncedAt: 0 } })
    .sort({ "advertiser.name": 1, title: 1 })
    .skip(skip)
    .limit(pageSize)
    .toArray();

  return {
    deals: docs as unknown as Deal[],
    page,
    pageSize,
    total,
    totalPages,
  };
}

/**
 * Most recently created/updated deals for the homepage showcase, newest first.
 * Excludes generic auto-welcome deals so the showcase highlights real offers.
 */
export async function getRecentDeals(
  limit = 10,
  country?: string,
): Promise<Deal[]> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  const filter: Record<string, unknown> = {
    ...buildFilter({ country } as DealQuery),
    isAutoWelcome: { $ne: true },
  };

  const docs = await col
    .find(filter, { projection: { _id: 0, syncedAt: 0 } })
    .sort({ syncedAt: -1 })
    .limit(Math.max(1, limit))
    .toArray();

  return docs as unknown as Deal[];
}

/** A popular store derived from deal counts (for the homepage grid). */
export interface PopularShopData {
  id: number;
  network: string;
  name: string;
  logoUrl: string | null;
  dealCount: number;
}

/**
 * Stores with more than `minDeals` deals/coupons, ranked by deal count.
 * Used to auto-populate the homepage "Popular shops" grid.
 */
export async function getPopularShops(opts?: {
  minDeals?: number;
  limit?: number;
  country?: string;
}): Promise<PopularShopData[]> {
  const { minDeals = 1, limit = 8, country } = opts ?? {};
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  const rows = await col
    .aggregate([
      { $match: buildFilter({ country } as DealQuery) },
      {
        $group: {
          _id: { id: "$advertiser.id", network: "$network" },
          dealName: { $first: "$advertiser.name" },
          dealLogoUrl: { $first: "$advertiser.logoUrl" },
          dealCount: { $sum: 1 },
        },
      },
      { $sort: { dealCount: -1 } },
      { $limit: Math.max(1, limit * 3) },
      {
        $lookup: {
          from: "advertisers",
          let: { advId: "$_id.id", advNet: "$_id.network" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$id", "$$advId"] },
                    { $eq: ["$network", "$$advNet"] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: "advDoc",
        },
      },
    ])
    .toArray();

  const results: PopularShopData[] = [];
  const seenNames = new Set<string>();

  for (const r of rows) {
    const adv = r.advDoc?.[0];
    const rawName = adv?.name || r.dealName || "";
    const cleanName = cleanAdvertiserName(rawName);
    const key = cleanName.toLowerCase().trim();

    if (!key || seenNames.has(key)) continue;
    seenNames.add(key);

    const logoUrl = adv?.logoUrl || r.dealLogoUrl || null;

    results.push({
      id: r._id.id,
      network: r._id.network,
      name: cleanName,
      logoUrl,
      dealCount: r.dealCount,
    });

    if (results.length >= limit) break;
  }

  return results;
}

/**
 * Check if there is any data in the deals collection.
 */
export async function hasDealsData(): Promise<boolean> {
  const db = await getDb();
  const col = db.collection(COLLECTION);
  const count = await col.estimatedDocumentCount();
  return count > 0;
}

/**
 * Remove deals whose `endDate` has passed.
 * Deals with no `endDate` are kept (they're open-ended promotions).
 *
 * @returns Number of expired deals removed.
 */
export async function removeExpiredDeals(): Promise<number> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  const now = new Date().toISOString();

  const result = await col.deleteMany({
    endDate: { $ne: null, $lt: now },
  });

  return result.deletedCount;
}

/**
 * Remove deals that are no longer present in the API response
 * **for a specific network**. Called after upserting fresh data — any deal
 * in that network whose `id` is NOT in `currentIds` gets deleted.
 *
 * @param currentIds IDs that are still valid for this network.
 * @param network The network to scope the removal to (e.g. "awin", "admitad").
 * @returns Number of stale deals removed.
 */
export async function removeStaleDeals(
  currentIds: number[],
  network: string = "awin",
): Promise<number> {
  if (currentIds.length === 0) return 0;

  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  const result = await col.deleteMany({
    network,
    id: { $nin: currentIds, $lt: WELCOME_DEAL_ID_BASE },
    // Ids in the welcome band are auto-generated and intentionally absent from
    // any network feed, so they must never be treated as "stale" — even after an
    // admin edits them and the isAutoWelcome flag is cleared.
  });

  return result.deletedCount;
}

// ---------------------------------------------------------------------------
// Auto "welcome" deals for joined advertisers with no real deals
// ---------------------------------------------------------------------------

/**
 * Deterministic id band for auto-generated welcome deals: `BASE + advertiserId`.
 * Kept far above the manual-deal range (900000+) so ids never collide, and so a
 * welcome deal can be re-derived idempotently for the same advertiser.
 */
const WELCOME_DEAL_ID_BASE = 1_000_000_000;

/** Default copy for an auto-generated welcome deal. Admin can edit afterwards. */
export const WELCOME_DEAL_DEFAULTS = {
  discountText: "SPECIAL OFFER",
  title: (name: string) => `Shop ${name} & Start Saving`,
  description: (name: string) =>
    `Explore the latest products, promotions and exclusive savings at ${name}. Click through to grab today's best offers.`,
};

interface WelcomeAdvertiser {
  id: number;
  network?: string;
  name: string;
  logoUrl?: string | null;
  url?: string | null;
  countryCode?: string | null;
  countryCodes?: string[];
}

/** Build (but don't persist) a welcome Deal for a joined advertiser. */
function buildWelcomeDeal(a: WelcomeAdvertiser): Deal {
  const network = a.network ?? "awin";
  const regionCodes =
    Array.isArray(a.countryCodes) && a.countryCodes.length > 0
      ? a.countryCodes.map((c) => String(c).toUpperCase())
      : a.countryCode
      ? [String(a.countryCode).toUpperCase()]
      : [];

  return {
    id: WELCOME_DEAL_ID_BASE + a.id,
    network,
    title: WELCOME_DEAL_DEFAULTS.title(a.name),
    description: WELCOME_DEAL_DEFAULTS.description(a.name),
    advertiser: {
      id: a.id,
      name: a.name,
      logoUrl: a.logoUrl ?? null,
    },
    type: "promotion",
    code: null,
    startDate: null,
    endDate: null, // open-ended — survives removeExpiredDeals
    status: "active",
    trackingUrl: a.url ?? null,
    regionCodes,
    discountText: WELCOME_DEAL_DEFAULTS.discountText,
    placement: "todays",
    isAutoWelcome: true,
  };
}

/**
 * Ensure every **joined** advertiser has at least one deal so it surfaces on the
 * public pages (which require `requireDeals`).
 *
 * For each joined advertiser with no real (non-welcome) deal, upserts a generic
 * welcome deal carrying the advertiser's affiliate link. Uses `$setOnInsert`, so
 * an admin can freely edit the deal afterwards without the sync overwriting it.
 *
 * Also self-cleans: removes welcome deals once the advertiser gains a real deal,
 * or is no longer joined.
 *
 * @returns counts of welcome deals created and removed.
 */
export async function generateWelcomeDeals(): Promise<{
  created: number;
  removed: number;
  joined: number;
}> {
  const db = await getDb();
  const dealsCol = db.collection<DealDoc>(COLLECTION);
  const advCol = db.collection("advertisers");

  await dealsCol.createIndex({ network: 1, id: 1 }, { unique: true });

  const joined = (await advCol
    .find(
      { relationship: "joined" },
      {
        projection: {
          _id: 0,
          id: 1,
          network: 1,
          name: 1,
          logoUrl: 1,
          url: 1,
          countryCode: 1,
          countryCodes: 1,
        },
      },
    )
    .toArray()) as unknown as WelcomeAdvertiser[];

  // Advertiser keys (network:id) that already have a real, non-welcome deal.
  const realDealGroups = await dealsCol
    .aggregate([
      { $match: { isAutoWelcome: { $ne: true } } },
      { $group: { _id: { network: "$network", advId: "$advertiser.id" } } },
    ])
    .toArray();
  const realKeys = new Set(
    realDealGroups.map((g) => `${g._id.network}:${g._id.advId}`),
  );

  const now = new Date();
  const joinedKeys = new Set<string>();
  const ops: AnyBulkWriteOperation<DealDoc>[] = [];

  for (const a of joined) {
    if (!a?.id || !a.name) continue;
    const key = `${a.network ?? "awin"}:${a.id}`;
    joinedKeys.add(key);
    if (realKeys.has(key)) continue; // already has a real deal — no welcome needed

    const welcome = buildWelcomeDeal(a);
    ops.push({
      updateOne: {
        filter: { network: welcome.network, id: welcome.id },
        update: { $setOnInsert: { ...welcome, syncedAt: now } },
        upsert: true,
      },
    });
  }

  let created = 0;
  if (ops.length > 0) {
    const res = await dealsCol.bulkWrite(ops, { ordered: false });
    created = res.upsertedCount;
  }

  // Cleanup: drop welcome deals that are now redundant (advertiser gained a real
  // deal) or orphaned (advertiser no longer joined).
  const welcomeDeals = await dealsCol
    .find(
      { isAutoWelcome: true },
      { projection: { _id: 0, id: 1, network: 1, advertiser: 1 } },
    )
    .toArray();

  const toRemove = welcomeDeals.filter((d) => {
    const key = `${d.network}:${d.advertiser?.id}`;
    return realKeys.has(key) || !joinedKeys.has(key);
  });

  let removed = 0;
  if (toRemove.length > 0) {
    const res = await dealsCol.deleteMany({
      isAutoWelcome: true,
      $or: toRemove.map((d) => ({ network: d.network, id: d.id })),
    });
    removed = res.deletedCount;
  }

  return { created, removed, joined: joinedKeys.size };
}

/**
 * Get the next available deal ID for newly created items.
 */
export async function getNextDealId(): Promise<number> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);
  const maxDoc = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const maxId = maxDoc.length > 0 ? maxDoc[0].id : 0;
  return Math.max(maxId + 1, 900000); // 900000+ range for custom created deals
}

/**
 * Create a new deal in MongoDB.
 */
export async function createDeal(deal: Deal): Promise<Deal> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  await col.createIndex({ network: 1, id: 1 }, { unique: true });

  const doc: DealDoc = {
    ...deal,
    network: deal.network ?? "awin",
    syncedAt: new Date(),
  };

  await col.updateOne(
    { network: doc.network, id: deal.id },
    { $set: doc },
    { upsert: true }
  );

  return deal;
}

/**
 * Update an existing deal in MongoDB.
 */
export async function updateDeal(
  id: number,
  data: Partial<Deal>,
  network: string = "awin",
): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  const result = await col.updateOne(
    { network, id },
    { $set: { ...data, syncedAt: new Date() } }
  );

  return result.matchedCount > 0;
}

// ---------------------------------------------------------------------------
// AI-generated deal copy (Claude)
// ---------------------------------------------------------------------------

/** Fetch a single deal by its composite key. */
export async function getDealByCompositeId(
  id: number,
  network: string = "awin",
): Promise<Deal | null> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);
  const doc = await col.findOne(
    { network, id },
    { projection: { _id: 0, syncedAt: 0 } },
  );
  return (doc as unknown as Deal) || null;
}

/** Persist AI-generated title/description on a deal. */
export async function setDealAiContent(
  id: number,
  network: string,
  content: { title: string; description: string },
): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);
  const result = await col.updateOne(
    { network, id },
    {
      $set: {
        aiTitle: content.title,
        aiDescription: content.description,
        aiGeneratedAt: new Date().toISOString(),
        syncedAt: new Date(),
      },
    },
  );
  return result.matchedCount > 0;
}

/**
 * Ensure a deal has AI copy, generating it the first time and caching it in the
 * DB so tokens are never spent twice. Best-effort: if generation is unconfigured
 * or fails, the original deal is returned unchanged. Pass `force` to regenerate.
 */
export async function ensureDealAiContent(
  deal: Deal,
  opts?: { force?: boolean },
): Promise<Deal> {
  if (!opts?.force && deal.aiTitle && deal.aiDescription) return deal;

  const { isAiConfigured, generateDealContent } = await import("@/lib/ai/dealContent");
  if (!isAiConfigured()) return deal;

  try {
    const copy = await generateDealContent(deal);
    await setDealAiContent(deal.id, deal.network ?? "awin", copy);
    return {
      ...deal,
      aiTitle: copy.title,
      aiDescription: copy.description,
      aiGeneratedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(
      `[ai] Failed to generate deal copy for ${deal.network}:${deal.id}:`,
      err instanceof Error ? err.message : err,
    );
    return deal;
  }
}

/**
 * Delete a deal from MongoDB by ID.
 */
export async function deleteDeal(
  id: number,
  network: string = "awin",
): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  const result = await col.deleteOne({ network, id });
  return result.deletedCount > 0;
}
