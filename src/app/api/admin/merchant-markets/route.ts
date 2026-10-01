import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import {
  upsertMerchantMarket,
  recordReview,
  ensureMerchantMarketIndexes,
} from "@/lib/db/merchant-markets";
import type { MerchantMarket } from "@/lib/model/merchantMarket";
import { NO_PERMISSIONS } from "@/lib/model/merchantMarket";
import { logActivity } from "@/lib/db/activity-logs";
import { revalidatePublic, CACHE_TAGS } from "@/lib/cache";

export const dynamic = "force-dynamic";

const COLLECTION = "merchant_markets";

/**
 * GET /api/admin/merchant-markets
 *
 * Operator view of the merchant registry. The brief requires that expired or
 * unconfirmed access is visible *before* any publishing or campaign action, so
 * the default listing surfaces `pending` records first.
 *
 * Query: ?market=AU&status=pending&search=amora&page=1&pageSize=50
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const market = params.get("market")?.toUpperCase();
  const status = params.get("status");
  const search = params.get("search")?.trim();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageSize = Math.min(200, Math.max(1, Number(params.get("pageSize") ?? "50") || 50));

  try {
    const db = await getDb();
    const col = db.collection<MerchantMarket>(COLLECTION);

    const filter: Record<string, unknown> = {};
    if (market) filter.market = market;
    if (status && status !== "all") filter.status = status;
    if (search) filter.displayName = { $regex: search, $options: "i" };

    const total = await col.countDocuments(filter);
    const docs = await col
      .find(filter, { projection: { _id: 0 } })
      // Unconfirmed access first — it is what blocks publishing.
      .sort({ status: 1, displayName: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();

    const byStatus = await col
      .aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }])
      .toArray();

    return NextResponse.json({
      merchantMarkets: docs,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      counts: Object.fromEntries(byStatus.map((r) => [r._id, r.n])),
    });
  } catch (error) {
    console.error("GET /api/admin/merchant-markets:", error);
    return NextResponse.json({ error: "Failed to load merchant markets." }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/merchant-markets
 *
 * Grant or withdraw rights, record policy URLs, set status, or stamp a review.
 * Body: { id, permissions?, policyUrls?, commission?, status?, reviewedBy? }
 *
 * `reviewedBy` is required to move a record to `active`: the brief forbids a
 * review date that implies checking which did not happen, so the person doing
 * it must be named.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : null;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const db = await getDb();
    const col = db.collection<MerchantMarket>(COLLECTION);
    const existing = await col.findOne({ id }, { projection: { _id: 0 } });
    if (!existing) {
      return NextResponse.json({ error: "Merchant market not found." }, { status: 404 });
    }

    const update: Record<string, unknown> = { updatedAt: new Date() };

    if (body.permissions && typeof body.permissions === "object") {
      update.permissions = {
        ...NO_PERMISSIONS,
        ...existing.permissions,
        ...body.permissions,
      };
    }
    if (body.policyUrls && typeof body.policyUrls === "object") {
      update.policyUrls = { ...(existing.policyUrls ?? {}), ...body.policyUrls };
    }
    if (body.commission && typeof body.commission === "object") {
      update.commission = { ...(existing.commission ?? {}), ...body.commission };
    }

    if (typeof body.status === "string") {
      const allowed = ["active", "pending", "suspended", "ended"];
      if (!allowed.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }
      if (body.status === "active" && !body.reviewedBy) {
        return NextResponse.json(
          { error: "reviewedBy is required to activate a merchant market." },
          { status: 400 },
        );
      }
      update.status = body.status;
    }

    await ensureMerchantMarketIndexes();
    await col.updateOne({ id }, { $set: update });

    if (typeof body.reviewedBy === "string" && body.reviewedBy.trim()) {
      await recordReview(id, body.reviewedBy.trim());
    }

    await logActivity({
      type: "store_updated",
      title: "Merchant market updated",
      description: `${existing.displayName} (${existing.market}) — ${Object.keys(update)
        .filter((k) => k !== "updatedAt")
        .join(", ") || "review stamp"}`,
      entity: id,
      status: "success",
    }).catch(() => {});

    revalidatePublic(CACHE_TAGS.advertisers);

    const updated = await col.findOne({ id }, { projection: { _id: 0 } });
    return NextResponse.json({ merchantMarket: updated });
  } catch (error) {
    console.error("PATCH /api/admin/merchant-markets:", error);
    return NextResponse.json({ error: "Failed to update merchant market." }, { status: 500 });
  }
}

/**
 * POST /api/admin/merchant-markets
 * Create a merchant-market by hand, for a merchant the feeds do not cover.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const required = ["merchantId", "network", "market", "displayName", "slug", "currency"];
    for (const key of required) {
      if (!body?.[key]) {
        return NextResponse.json({ error: `${key} is required` }, { status: 400 });
      }
    }

    const market = String(body.market).toUpperCase();
    const network = String(body.network).toLowerCase();
    const merchantId = Number(body.merchantId);

    const record: MerchantMarket = {
      id: `${network}:${merchantId}:${market}`,
      merchantId,
      network,
      market,
      displayName: String(body.displayName),
      slug: String(body.slug).toLowerCase(),
      currency: String(body.currency).toUpperCase(),
      websiteUrl: body.websiteUrl ?? null,
      approvedDomains: Array.isArray(body.approvedDomains) ? body.approvedDomains : [],
      feedSourceIds: Array.isArray(body.feedSourceIds) ? body.feedSourceIds : [],
      // A hand-created record grants nothing until rights are confirmed.
      permissions: { ...NO_PERMISSIONS },
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
    };

    await upsertMerchantMarket(record);
    revalidatePublic(CACHE_TAGS.advertisers);
    return NextResponse.json({ merchantMarket: record }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/merchant-markets:", error);
    return NextResponse.json({ error: "Failed to create merchant market." }, { status: 500 });
  }
}
