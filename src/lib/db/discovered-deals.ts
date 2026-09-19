/**
 * MongoDB persistence layer for Discovered / Researched Deals.
 *
 * Candidate coupons and promotions found across external sites (RetailMeNot,
 * CouponCabin, Slickdeals, official merchant stores, etc.) via n8n / AI search
 * are staged here before being approved and promoted to the live `deals` collection.
 */

import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getAdvertiserByIdFromDb } from "@/lib/db/advertisers";
import { createDeal, getNextDealId } from "@/lib/db/deals";
import { resolveAffiliateTrackingUrl } from "@/lib/affiliateUrls";
import { revalidatePublic, CACHE_TAGS } from "@/lib/cache";
import { logActivity } from "@/lib/db/activity-logs";
import type { Deal } from "@/lib/deals";

const COLLECTION = "discovered_deals";
const LIVE_DEALS_COLLECTION = "deals";

export interface DiscoveredDeal {
  _id?: ObjectId;
  /** Generated unique candidate identifier */
  candidateId: string;
  advertiser: {
    id: number;
    name: string;
    logoUrl?: string | null;
  };
  network: string;
  title: string;
  description?: string | null;
  type: "voucher" | "deal" | "promotion";
  code?: string | null;
  discountText?: string | null;
  terms?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  trackingUrl?: string | null;
  regionCodes?: string[];
  sourceName?: string | null;
  sourceUrl?: string | null;
  confidenceScore?: number | null;
  status: "pending" | "approved" | "rejected";
  discoveredAt: Date;
  reviewedAt?: Date | null;
  promotedDealId?: number | null;
}

export interface DiscoveredDealInput {
  advertiserId?: number;
  advertiserName?: string;
  network?: string;
  title: string;
  description?: string;
  type?: "voucher" | "deal" | "promotion";
  code?: string;
  discountText?: string;
  terms?: string;
  startDate?: string;
  endDate?: string;
  trackingUrl?: string;
  regionCodes?: string[];
  sourceName?: string;
  sourceUrl?: string;
  confidenceScore?: number;
}

/**
 * Normalise a code string for comparison.
 */
function normalizeCode(code?: string | null): string {
  if (!code) return "";
  return code.trim().toUpperCase().replace(/[\s-_]/g, "");
}

/**
 * Save candidate deals discovered by n8n or AI search.
 * Deduplicates against already existing live deals and pending candidates.
 */
export async function saveDiscoveredDeals(
  candidates: DiscoveredDealInput[],
  defaultAdvertiserId?: number,
): Promise<{ inserted: number; skippedExisting: number; items: DiscoveredDeal[] }> {
  if (!candidates || candidates.length === 0) {
    return { inserted: 0, skippedExisting: 0, items: [] };
  }

  const db = await getDb();
  const col = db.collection(COLLECTION);
  const liveCol = db.collection(LIVE_DEALS_COLLECTION);
  const advertisersCol = db.collection("advertisers");

  // Ensure index
  await col.createIndex({ status: 1, discoveredAt: -1 });
  await col.createIndex({ "advertiser.id": 1, candidateId: 1 });

  let insertedCount = 0;
  let skippedCount = 0;
  const savedItems: DiscoveredDeal[] = [];

  for (const item of candidates) {
    const advId = item.advertiserId || defaultAdvertiserId;
    if (!advId && !item.advertiserName) {
      skippedCount++;
      continue;
    }

    // Resolve advertiser information
    let advDoc: any = null;
    if (advId) {
      advDoc = await getAdvertiserByIdFromDb(advId);
    }
    if (!advDoc && item.advertiserName) {
      const regex = new RegExp(`^${item.advertiserName.trim()}$`, "i");
      advDoc = await advertisersCol.findOne({ name: regex });
    }

    const advertiserId = advDoc ? Number(advDoc.id) : (advId || 0);
    const advertiserName = advDoc?.name || item.advertiserName || "Merchant";
    const network = item.network || advDoc?.network || "awin";

    // Build tracking URL using user's store affiliate link
    let trackingUrl = item.trackingUrl || advDoc?.url || null;
    trackingUrl = resolveAffiliateTrackingUrl(network, advertiserId, trackingUrl);

    // Resolve regions
    let regionCodes: string[] = item.regionCodes || [];
    if (regionCodes.length === 0 && advDoc) {
      if (advDoc.countryCodes && advDoc.countryCodes.length > 0) {
        regionCodes = advDoc.countryCodes.map((c: string) => c.trim().toUpperCase());
      } else if (advDoc.countryCode) {
        regionCodes = [advDoc.countryCode.trim().toUpperCase()];
      } else if (advDoc.region) {
        regionCodes = [advDoc.region.trim().toUpperCase()];
      }
    }

    const code = item.code ? item.code.trim() : null;
    const offerType: "voucher" | "deal" | "promotion" =
      item.type || (code ? "voucher" : "deal");

    // Deduplication check:
    // 1. Does a live deal already exist for this advertiser with this code?
    if (code) {
      const existingLive = await liveCol.findOne({
        "advertiser.id": advertiserId,
        code: { $regex: new RegExp(`^${code.trim()}$`, "i") },
      });
      if (existingLive) {
        skippedCount++;
        continue;
      }

      // 2. Does an already pending or approved candidate exist in discovered_deals?
      const existingCandidate = await col.findOne({
        "advertiser.id": advertiserId,
        code: { $regex: new RegExp(`^${code.trim()}$`, "i") },
        status: { $in: ["pending", "approved"] },
      });
      if (existingCandidate) {
        skippedCount++;
        continue;
      }
    } else {
      // For codeless deals, check if exact title already exists for this advertiser
      const existingTitle = await liveCol.findOne({
        "advertiser.id": advertiserId,
        title: { $regex: new RegExp(`^${item.title.trim()}$`, "i") },
      });
      if (existingTitle) {
        skippedCount++;
        continue;
      }
    }

    const candidateId = `disc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();

    const doc: DiscoveredDeal = {
      candidateId,
      advertiser: {
        id: advertiserId,
        name: advertiserName,
        logoUrl: advDoc?.logoUrl || null,
      },
      network,
      title: item.title.trim(),
      description: item.description ? item.description.trim() : null,
      type: offerType,
      code,
      discountText: item.discountText ? item.discountText.trim() : null,
      terms: item.terms ? item.terms.trim() : null,
      startDate: item.startDate || null,
      endDate: item.endDate || null,
      trackingUrl,
      regionCodes,
      sourceName: item.sourceName || "Web Research",
      sourceUrl: item.sourceUrl || null,
      confidenceScore: item.confidenceScore ?? 1.0,
      status: "pending",
      discoveredAt: now,
    };

    const res = await col.insertOne(doc);
    doc._id = res.insertedId;
    savedItems.push(doc);
    insertedCount++;
  }

  return { inserted: insertedCount, skippedExisting: skippedCount, items: savedItems };
}

/**
 * Fetch discovered deals with pagination & status filters.
 */
export async function getDiscoveredDeals(query?: {
  status?: string;
  advertiserId?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ items: DiscoveredDeal[]; total: number; page: number; pageSize: number }> {
  const db = await getDb();
  const col = db.collection<DiscoveredDeal>(COLLECTION);

  const filter: Record<string, unknown> = {};
  if (query?.status && query.status !== "all") {
    filter.status = query.status;
  } else if (!query?.status) {
    filter.status = "pending";
  }

  if (query?.advertiserId) {
    filter["advertiser.id"] = Number(query.advertiserId);
  }

  const page = Math.max(1, query?.page || 1);
  const pageSize = Math.min(100, Math.max(1, query?.pageSize || 30));
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    col
      .find(filter)
      .sort({ discoveredAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .toArray(),
    col.countDocuments(filter),
  ]);

  return { items, total, page, pageSize };
}

/**
 * Get count of pending deals needing admin review.
 */
export async function getPendingDiscoveredCount(): Promise<number> {
  try {
    const db = await getDb();
    const col = db.collection(COLLECTION);
    return await col.countDocuments({ status: "pending" });
  } catch {
    return 0;
  }
}

/**
 * Approve a discovered deal and promote it to the live `deals` collection.
 */
export async function approveDiscoveredDeal(
  candidateId: string,
  overrides?: Partial<Deal>,
): Promise<{ ok: boolean; deal?: Deal; error?: string }> {
  const db = await getDb();
  const col = db.collection<DiscoveredDeal>(COLLECTION);

  const candidate = await col.findOne({ candidateId });
  if (!candidate) {
    return { ok: false, error: "Candidate deal not found." };
  }

  if (candidate.status === "approved" && candidate.promotedDealId) {
    return { ok: false, error: "Deal is already approved." };
  }

  const nextId = await getNextDealId();

  const newDeal: Deal = {
    id: nextId,
    network: overrides?.network || candidate.network || "awin",
    title: (overrides?.title || candidate.title).trim(),
    description: overrides?.description !== undefined ? overrides.description : (candidate.description ?? null),
    advertiser: {
      id: candidate.advertiser.id,
      name: candidate.advertiser.name,
      logoUrl: candidate.advertiser.logoUrl || null,
    },
    type: (overrides?.type || candidate.type || "voucher") as "voucher" | "deal" | "promotion",
    code: overrides?.code !== undefined ? overrides.code : (candidate.code ?? null),
    discountText: overrides?.discountText !== undefined ? overrides.discountText : (candidate.discountText ?? null),
    startDate: overrides?.startDate || candidate.startDate || null,
    endDate: overrides?.endDate || candidate.endDate || null,
    status: "active",
    trackingUrl: overrides?.trackingUrl || candidate.trackingUrl || null,
    regionCodes: overrides?.regionCodes || candidate.regionCodes || [],
    isManual: true,
  };

  const created = await createDeal(newDeal);

  // Update candidate record
  await col.updateOne(
    { candidateId },
    {
      $set: {
        status: "approved",
        reviewedAt: new Date(),
        promotedDealId: created.id,
      },
    },
  );

  // Invalidate public deal caches so the new coupon immediately appears on live pages
  revalidatePublic(CACHE_TAGS.deals, CACHE_TAGS.advertisers, CACHE_TAGS.categories);

  await logActivity({
    type: "deal_added",
    title: `Discovered Coupon Approved: ${created.title}`,
    description: `Approved researched ${created.type} "${created.title}" for ${created.advertiser.name} from ${candidate.sourceName || "AI Research"}.`,
    network: created.network,
    entity: "deals",
    status: "success",
  }).catch(() => {});

  return { ok: true, deal: created };
}

/**
 * Reject or dismiss a discovered deal.
 */
export async function rejectDiscoveredDeal(candidateId: string): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<DiscoveredDeal>(COLLECTION);

  const res = await col.updateOne(
    { candidateId },
    {
      $set: {
        status: "rejected",
        reviewedAt: new Date(),
      },
    },
  );

  return res.matchedCount > 0;
}
