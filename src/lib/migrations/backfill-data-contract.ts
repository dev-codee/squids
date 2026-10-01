/**
 * Phase B backfill: derive the data-contract entities from what we already hold.
 *
 * Rules this backfill follows, from the brief:
 *  - Nothing is invented. A field we cannot derive stays absent or unknown.
 *  - Nothing auto-publishes. Derived merchant-markets start with no permissions
 *    and derived offers start as drafts, because rights and prices have not
 *    been confirmed by anyone.
 *  - It is idempotent. Re-running must not duplicate records or reset
 *    operator-owned fields.
 *
 * Run it with `npm run migrate:data-contract`.
 */

import { getDb } from "@/lib/mongodb";
import { storeSlug } from "@/lib/networks";
import {
  merchantMarketId,
  NO_PERMISSIONS,
  type MerchantMarket,
} from "@/lib/model/merchantMarket";
import { offerFromLegacyProduct, type RetailerOfferRecord } from "@/lib/model/offer";
import { parseDiscountText, emptyPromotionStructure } from "@/lib/model/promotion";
import {
  upsertMerchantMarkets,
  ensureMerchantMarketIndexes,
} from "@/lib/db/merchant-markets";
import { upsertOffers, ensureOfferIndexes } from "@/lib/db/offers";
import { ensureDeliveryIndexes } from "@/lib/db/delivery";
import { getRegionConfig, REGION_CODES } from "@/lib/regions";
import { resolveMarkets } from "@/lib/model/marketResolution";

export interface BackfillReport {
  merchantMarkets: { scanned: number; upserted: number; modified: number; skipped: number };
  offers: { scanned: number; upserted: number; modified: number; skipped: number };
  promotions: { scanned: number; structured: number; parsed: number; skipped: number };
  warnings: string[];
}

export async function backfillMerchantMarkets(
  opts: { dryRun?: boolean } = {},
): Promise<BackfillReport["merchantMarkets"] & { warnings: string[] }> {
  const db = await getDb();
  const advertisers = await db
    .collection("advertisers")
    .find({}, { projection: { _id: 0 } })
    .toArray();

  const warnings: string[] = [];
  const records: MerchantMarket[] = [];
  let skipped = 0;

  for (const adv of advertisers) {
    const name = String(adv.name ?? "").trim();
    const network = String(adv.network ?? "awin").toLowerCase();
    const id = Number(adv.id);

    if (!name || !Number.isFinite(id)) {
      skipped++;
      warnings.push(`advertiser ${adv.id ?? "?"}: missing name or id, skipped`);
      continue;
    }

    const slug = storeSlug(name);
    if (!slug) {
      skipped++;
      warnings.push(`advertiser ${id} ("${name}"): name produces an empty slug, skipped`);
      continue;
    }

    const { markets, worldwide } = resolveMarkets(
      {
        countryCodes: Array.isArray(adv.countryCodes) ? adv.countryCodes : null,
        countryCode: adv.countryCode ?? null,
        region: adv.region ?? null,
      },
      REGION_CODES,
    );

    // An advertiser that names no configured market is skipped, not parked in a
    // default one. A first dry run against live data put 730 merchants into US
    // this way — among them "Kiwi BR", "Casa Andina PE", "Answear UA",
    // "Shopee MY", "Kaspersky LATAM". Assigning a merchant to a market it does
    // not serve is precisely the defect this entity exists to prevent, and a
    // `pending` status does not make a wrong country association harmless.
    if (markets.length === 0) {
      skipped++;
      warnings.push(
        worldwide
          ? `advertiser ${id} ("${name}"): worldwide code only, no specific market — skipped; assign its markets deliberately`
          : `advertiser ${id} ("${name}"): no configured market on record — skipped; assign a market before publishing`,
      );
      continue;
    }

    for (const market of markets) {
      const region = getRegionConfig(market);
      records.push({
        id: merchantMarketId(network, id, market),
        merchantId: id,
        network,
        market,
        displayName: name,
        slug,
        currency: adv.currencyCode || region.currency,
        websiteUrl: adv.url ?? null,
        approvedDomains: hostOf(adv.url),
        feedSourceIds: [network],
        // Rights have not been confirmed by anyone, so nothing is granted and
        // nothing becomes publishable just because a row was created.
        permissions: { ...NO_PERMISSIONS },
        status: "pending",
        reviewedBy: null,
        reviewedAt: null,
      });
    }
  }

  // `(market, slug)` is uniquely indexed, because it is the public store URL.
  // Two advertisers resolving to the same pair is a data-quality duplicate
  // ("Nolo (US)" and "Nolo US"; four separate "Triple Eight Distribution"
  // rows). Writing them would either throw a duplicate-key error mid-batch or
  // hand one merchant's canonical URL to another arbitrarily, so the whole
  // colliding group is withheld for an operator to merge.
  const byKey = new Map<string, MerchantMarket[]>();
  for (const r of records) {
    const key = `${r.market}|${r.slug}`;
    const group = byKey.get(key) ?? [];
    group.push(r);
    byKey.set(key, group);
  }

  const safe: MerchantMarket[] = [];
  for (const [key, group] of byKey) {
    if (group.length === 1) {
      safe.push(group[0]);
      continue;
    }
    skipped += group.length;
    warnings.push(
      `slug collision on ${key}: ${group.length} advertisers resolve to the same store URL (${group
        .map((g) => `${g.merchantId} "${g.displayName}"`)
        .join(", ")}) — all withheld; merge the duplicates first`,
    );
  }

  if (opts.dryRun) {
    return { scanned: advertisers.length, upserted: safe.length, modified: 0, skipped, warnings };
  }

  await ensureMerchantMarketIndexes();
  const res = await upsertMerchantMarkets(safe);
  return { scanned: advertisers.length, ...res, skipped, warnings };
}

export async function backfillOffers(
  opts: { dryRun?: boolean } = {},
): Promise<BackfillReport["offers"] & { warnings: string[] }> {
  const db = await getDb();
  const products = await db
    .collection("products")
    .find({}, { projection: { _id: 0 } })
    .toArray();

  // Resolve each product's advertiser to a merchant-market. A product whose
  // advertiser has no merchant-market record is skipped, not guessed at.
  const mmDocs = await db
    .collection("merchant_markets")
    .find({}, { projection: { _id: 0, id: 1, merchantId: 1, network: 1, market: 1, currency: 1 } })
    .toArray();

  const byMerchant = new Map<number, typeof mmDocs>();
  for (const mm of mmDocs) {
    const list = byMerchant.get(mm.merchantId) ?? [];
    list.push(mm);
    byMerchant.set(mm.merchantId, list);
  }

  const warnings: string[] = [];
  const offers: RetailerOfferRecord[] = [];
  let skipped = 0;

  for (const p of products) {
    const advertiserId = Number(p.advertiserId);
    const productId = Number(p.id);
    if (!Number.isFinite(advertiserId) || !Number.isFinite(productId)) {
      skipped++;
      continue;
    }

    const candidates = byMerchant.get(advertiserId) ?? [];
    if (candidates.length === 0) {
      skipped++;
      warnings.push(
        `product ${productId}: advertiser ${advertiserId} has no merchant-market record — run the merchant-market backfill first`,
      );
      continue;
    }
    if (candidates.length > 1) {
      warnings.push(
        `product ${productId}: advertiser ${advertiserId} trades in ${candidates.length} markets — offer created in each; an operator should confirm the price applies to all`,
      );
    }

    for (const mm of candidates) {
      offers.push(
        offerFromLegacyProduct({
          merchantMarketId: mm.id,
          productId,
          sourceItemId: String(p.id),
          salePrice: typeof p.salePrice === "number" ? p.salePrice : null,
          currency: mm.currency || "USD",
          inStock: Boolean(p.inStock),
          trackingUrl: p.trackingUrl ?? null,
          market: mm.market,
        }),
      );
    }
  }

  if (opts.dryRun) {
    return { scanned: products.length, upserted: offers.length, modified: 0, skipped, warnings };
  }

  await ensureOfferIndexes();
  const res = await upsertOffers(offers);
  return { scanned: products.length, ...res, skipped, warnings };
}

/**
 * Seed `promotion` on deals that have none.
 *
 * The benefit is parsed from `discountText` where it can be read confidently;
 * everything else stays unknown. Evidence is `merchant-listed` at best — a feed
 * label is not a checkout test. Existing structures are never overwritten.
 */
export async function backfillPromotionStructure(
  opts: { dryRun?: boolean } = {},
): Promise<BackfillReport["promotions"] & { warnings: string[] }> {
  const db = await getDb();
  const col = db.collection("deals");
  const deals = await col
    .find({ promotion: { $exists: false } }, { projection: { _id: 0, id: 1, network: 1, discountText: 1, syncedAt: 1 } })
    .toArray();

  const warnings: string[] = [];
  let parsed = 0;
  const ops = deals.map((d) => {
    const structure = emptyPromotionStructure();
    const benefit = parseDiscountText(d.discountText ?? null);
    if (benefit.value.known || benefit.kind !== "percentage") {
      structure.benefit = benefit;
      parsed++;
    }
    return {
      updateOne: {
        filter: { network: d.network ?? "awin", id: d.id },
        update: {
          $set: {
            promotion: structure,
            // `syncedAt` is our write time, so it is a fetch stamp at best. It
            // is explicitly not a check stamp — `checkedAt` stays null until a
            // person verifies the offer.
            fetchedAt: d.syncedAt ? new Date(d.syncedAt).toISOString() : null,
            sourceUpdatedAt: null,
            checkedAt: null,
          },
        },
      },
    };
  });

  if (deals.length > 0) {
    warnings.push(
      `${deals.length - parsed} deals had a discount label that could not be read confidently; their benefit stays unknown`,
    );
  }

  if (opts.dryRun || ops.length === 0) {
    return { scanned: deals.length, structured: ops.length, parsed, skipped: 0, warnings };
  }

  await col.bulkWrite(ops, { ordered: false });
  return { scanned: deals.length, structured: ops.length, parsed, skipped: 0, warnings };
}

/** Run every backfill in dependency order. */
export async function runDataContractBackfill(
  opts: { dryRun?: boolean } = {},
): Promise<BackfillReport> {
  await ensureDeliveryIndexes();

  const mm = await backfillMerchantMarkets(opts);
  const offers = await backfillOffers(opts);
  const promotions = await backfillPromotionStructure(opts);

  return {
    merchantMarkets: mm,
    offers,
    promotions,
    warnings: [...mm.warnings, ...offers.warnings, ...promotions.warnings],
  };
}

function hostOf(url: unknown): string[] {
  if (typeof url !== "string" || !url.trim()) return [];
  try {
    return [new URL(url).host.replace(/^www\./, "")];
  } catch {
    return [];
  }
}
