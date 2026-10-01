/**
 * Retailer offer.
 *
 * The brief: "Merchant-market + product + source item ID; item price; currency;
 * stock; condition; destination/deep link; source update; fetch/check times;
 * eligibility; current/stale/quarantined status."
 *
 * Today a product row *is* the offer, so one product cannot carry offers from
 * two retailers without duplicating the product. Separating them is what makes
 * a real comparison table possible.
 */

import type { Known } from "./known";
import { fromNullable, unknown } from "./known";
import type { MerchantMarketId } from "./merchantMarket";
import type { ProductCondition } from "./productIdentity";

export type StockState = "in-stock" | "out-of-stock" | "unknown";

/**
 * Publication state.
 *  - current:     validated and publishable
 *  - stale:       older than this feed's maximum age; shown with an honest label
 *  - quarantined: ambiguous removal or conflicting data; never published
 *  - draft:       ingested, not yet validated
 */
export type OfferStatus = "draft" | "current" | "stale" | "quarantined";

/** Who an offer is available to. Decisive restrictions belong on the card. */
export interface OfferEligibility {
  /** Markets the offer is valid in. Empty means unrestricted (rare). */
  markets: string[];
  /** "new" / "existing" customers only, or both. */
  customerType?: "new" | "existing" | "any" | null;
  /** Requires a membership, subscription or app. */
  requiresMembership?: boolean | null;
  requiresApp?: boolean | null;
  requiresAccount?: boolean | null;
  notes?: string | null;
}

export interface RetailerOfferRecord {
  /** Stable offer ID: `<merchantMarketId>:<sourceItemId>`. */
  id: string;
  merchantMarketId: MerchantMarketId;
  /** The exact product this offer is for. */
  productId: number;
  /** The item's ID in the source feed, for idempotent upserts. */
  sourceItemId: string;

  /** Advertised item price, excluding delivery and other mandatory charges. */
  itemPrice: Known<number>;
  currency: string;

  stock: StockState;
  condition: ProductCondition;

  /** Disclosed destination the shopper is sent to. */
  destinationUrl: string | null;

  /**
   * Three distinct timestamps. The brief: "Record source_updated_at, fetched_at
   * and checked_at separately… A fetch failure must not make old data appear
   * freshly checked."
   */
  sourceUpdatedAt: string | null;
  fetchedAt: string | null;
  checkedAt: string | null;

  /** Batch that produced this record, for tracing back to a raw snapshot. */
  sourceBatchId?: string | null;

  eligibility: OfferEligibility;
  status: OfferStatus;
  /** Why it was quarantined, when it was. */
  statusReason?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export function offerId(
  merchantMarketId: MerchantMarketId,
  sourceItemId: string,
): string {
  return `${merchantMarketId}:${sourceItemId}`;
}

/**
 * Whether an offer may appear in a public comparison.
 * Current status, in stock, and an item price we actually hold.
 */
export function isComparable(offer: RetailerOfferRecord): boolean {
  return (
    offer.status === "current" &&
    offer.stock === "in-stock" &&
    offer.itemPrice.known
  );
}

/** Whether an offer is valid for a given market. */
export function isEligibleInMarket(
  offer: RetailerOfferRecord,
  market: string,
): boolean {
  const markets = offer.eligibility.markets;
  if (markets.length === 0) return true;
  return markets.includes(market.toUpperCase());
}

/**
 * Age the offer against this feed's maximum, returning the status it should
 * now hold. Freshness is measured from when the source last changed, falling
 * back to when we fetched it — never from when we happened to render a page.
 */
export function ageStatus(
  offer: RetailerOfferRecord,
  maxAgeHours: number,
  now: Date = new Date(),
): OfferStatus {
  if (offer.status === "quarantined" || offer.status === "draft") return offer.status;

  const stamp = offer.sourceUpdatedAt ?? offer.fetchedAt;
  if (!stamp) return "stale";

  const ms = now.getTime() - new Date(stamp).getTime();
  if (Number.isNaN(ms)) return "stale";

  return ms > maxAgeHours * 3_600_000 ? "stale" : "current";
}

/**
 * Build an offer from one of the existing product rows.
 *
 * Used by the backfill: the current `products` collection conflates product and
 * offer, so each row becomes one offer against the merchant-market it belongs
 * to. Nothing is invented — an absent price stays unknown, and `checkedAt` is
 * left null because nobody has checked it.
 */
export function offerFromLegacyProduct(params: {
  merchantMarketId: MerchantMarketId;
  productId: number;
  sourceItemId: string;
  salePrice: number | null;
  currency: string;
  inStock: boolean;
  trackingUrl: string | null;
  market: string;
  fetchedAt?: string | null;
}): RetailerOfferRecord {
  return {
    id: offerId(params.merchantMarketId, params.sourceItemId),
    merchantMarketId: params.merchantMarketId,
    productId: params.productId,
    sourceItemId: params.sourceItemId,
    itemPrice: fromNullable(params.salePrice),
    currency: params.currency,
    // The legacy boolean cannot distinguish "out of stock" from "never stated",
    // so a false value becomes unknown rather than a claim.
    stock: params.inStock ? "in-stock" : "unknown",
    condition: "unknown",
    destinationUrl: params.trackingUrl,
    sourceUpdatedAt: null,
    fetchedAt: params.fetchedAt ?? null,
    checkedAt: null,
    eligibility: { markets: [params.market.toUpperCase()], customerType: "any" },
    status: "draft",
    statusReason: "backfilled from legacy product row; not yet validated",
  };
}

/** An offer with no price on record. */
export function unpricedOffer(reason: Parameters<typeof unknown>[0] = "not-sourced") {
  return unknown<number>(reason);
}
