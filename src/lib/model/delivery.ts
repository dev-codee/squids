/**
 * Delivery and other mandatory charges.
 *
 * The brief: "Destination zone or postcode range; thresholds and
 * before/after-discount basis; service level; mandatory fees; tax-included
 * flag; source URL and checked time. Unknown is a distinct value, never zero."
 *
 * Every money field here is a `Known<number>`, so an absent delivery charge
 * cannot be read as free delivery.
 */

import type { Known } from "./known";
import { known, unknown, sumKnown } from "./known";
import type { MerchantMarketId } from "./merchantMarket";

/**
 * Whether a free-delivery or coupon threshold is measured before or after the
 * discount is applied. Merchants differ, and the brief is explicit: "Do not
 * assume every merchant uses the same rule."
 */
export type ThresholdBasis = "before-discount" | "after-discount" | "unknown";

/** Who a delivery rule applies to. */
export interface DeliveryZone {
  /** Country the rule covers. */
  market: string;
  /**
   * Optional narrowing within the market: named regions, or postcode prefixes.
   * Empty means the whole market.
   */
  regions?: string[];
  postcodePrefixes?: string[];
}

export interface DeliveryRule {
  id: string;
  merchantMarketId: MerchantMarketId;
  zone: DeliveryZone;

  /** e.g. "standard", "express". Rules are per service level. */
  serviceLevel: string;

  /** The delivery charge itself. Unknown until sourced — never assumed zero. */
  charge: Known<number>;
  currency: string;

  /** Basket value above which delivery is free, if the merchant offers one. */
  freeThreshold: Known<number>;
  /** Whether that threshold counts the basket before or after discount. */
  thresholdBasis: ThresholdBasis;

  /** Non-delivery charges the shopper must pay (handling, surcharge). */
  mandatoryFees: Known<number>;

  /** Whether listed prices already include tax. Null = not established. */
  taxIncluded: boolean | null;

  /** Free-text restrictions, e.g. "not to PO boxes". */
  restrictions?: string[];

  /** Where this came from and when a person last checked it. */
  sourceUrl: string | null;
  checkedAt: string | null;
  checkedBy?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

/** A delivery rule with nothing established — the honest default. */
export function emptyDeliveryRule(
  id: string,
  merchantMarketId: MerchantMarketId,
  market: string,
  currency: string,
): DeliveryRule {
  return {
    id,
    merchantMarketId,
    zone: { market },
    serviceLevel: "standard",
    charge: unknown("not-sourced"),
    currency,
    freeThreshold: unknown("not-sourced"),
    thresholdBasis: "unknown",
    mandatoryFees: unknown("not-sourced"),
    taxIncluded: null,
    sourceUrl: null,
    checkedAt: null,
  };
}

/**
 * Delivery payable for a basket under this rule.
 *
 * Returns unknown unless we can actually determine it:
 *  - unknown charge → unknown delivery;
 *  - a free threshold we cannot evaluate (unknown basis, or a basket amount we
 *    do not have) → unknown, because the answer depends on which basis applies.
 */
export function deliveryFor(
  rule: DeliveryRule,
  basket: { beforeDiscount: Known<number>; afterDiscount: Known<number> },
): Known<number> {
  if (!rule.charge.known) return rule.charge;

  // No free-delivery threshold on record: the flat charge applies.
  if (!rule.freeThreshold.known) return rule.charge;

  if (rule.thresholdBasis === "unknown") {
    // We know a threshold exists but not what it is measured against, so we
    // cannot say whether this basket clears it.
    return unknown("conflicting");
  }

  const applicable =
    rule.thresholdBasis === "before-discount"
      ? basket.beforeDiscount
      : basket.afterDiscount;

  if (!applicable.known) return unknown("needs-shopper-input");

  return applicable.value >= rule.freeThreshold.value ? known(0) : rule.charge;
}

/**
 * All mandatory charges on top of the item price: delivery plus any other fees.
 * One unknown component makes the whole thing unknown.
 */
export function mandatoryChargesFor(
  rule: DeliveryRule,
  basket: { beforeDiscount: Known<number>; afterDiscount: Known<number> },
): Known<number> {
  return sumKnown([deliveryFor(rule, basket), rule.mandatoryFees]);
}

/** Whether a rule has enough on record to be shown as a delivery fact. */
export function isSourced(rule: DeliveryRule): boolean {
  return Boolean(rule.sourceUrl && rule.checkedAt) && rule.charge.known;
}

/** Pick the rule covering a destination, most specific first. */
export function ruleForDestination(
  rules: readonly DeliveryRule[],
  destination: { market: string; postcode?: string | null; serviceLevel?: string },
): DeliveryRule | null {
  const market = destination.market.toUpperCase();
  const service = destination.serviceLevel ?? "standard";
  const candidates = rules.filter(
    (r) => r.zone.market.toUpperCase() === market && r.serviceLevel === service,
  );

  if (destination.postcode) {
    const postcode = destination.postcode.replace(/\s+/g, "").toUpperCase();
    const byPostcode = candidates.find((r) =>
      (r.zone.postcodePrefixes ?? []).some((prefix) =>
        postcode.startsWith(prefix.replace(/\s+/g, "").toUpperCase()),
      ),
    );
    if (byPostcode) return byPostcode;
  }

  // Fall back to the market-wide rule — one with no narrowing.
  return (
    candidates.find(
      (r) => !r.zone.postcodePrefixes?.length && !r.zone.regions?.length,
    ) ?? null
  );
}
