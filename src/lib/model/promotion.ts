/**
 * Promotion (coupon / deal) structure.
 *
 * The brief: "Stable promotion ID; code or automatic benefit; value/cap;
 * qualifying products/categories; min spend; customer type; market; start/end
 * and timezone; stacking; evidence status and source."
 *
 * The existing `deals` collection already supplies the stable ID, code, market
 * and dates. What it lacks is *structure*: `discountText` is free prose
 * ("20% OFF"), so nothing can evaluate eligibility or compute a discount. These
 * fields are additive on the deal record.
 */

import type { Known } from "./known";
import { known, unknown } from "./known";

/** What the shopper actually gets. */
export type BenefitKind =
  | "percentage"
  | "fixed-amount"
  | "free-delivery"
  | "gift"
  | "cashback";

/**
 * Evidence behind an offer. The brief defines exactly three labels, and they
 * mean different things to a shopper — a binary `verified` flag cannot say
 * which.
 */
export type EvidenceStatus =
  /** A real recorded checkout check, with conditions. */
  | "checkout-tested"
  /** Sourced from the merchant or their feed, not independently proven. */
  | "merchant-listed"
  /** An attributed report awaiting or lacking verification. */
  | "community-reported";

export interface PromotionBenefit {
  kind: BenefitKind;
  /** Percentage points, or an amount in `currency`. Unknown stays unknown. */
  value: Known<number>;
  currency?: string | null;
  /** True when the merchant advertises "up to" this value. */
  isUpTo: boolean;
  /** Maximum discount the benefit can produce, if capped. */
  maxCap: Known<number>;
  /** Gift or delivery benefits are not cash off — described, not totalled. */
  description?: string | null;
}

export interface PromotionConditions {
  /** Minimum qualifying basket. */
  minSpend: Known<number>;
  /** Whether minSpend is measured before or after other discounts. */
  minSpendBasis: "before-discount" | "after-discount" | "unknown";
  /** Categories or product IDs the benefit applies to. Empty = sitewide. */
  eligibleCategories: string[];
  eligibleProductIds: number[];
  /** Explicit exclusions, e.g. "excludes sale items". */
  exclusions: string[];

  customerType: "new" | "existing" | "any" | "unknown";
  requiresMembership: boolean | null;
  requiresApp: boolean | null;
  requiresAccount: boolean | null;
  requiresSubscription: boolean | null;
  /** Payment method requirement, e.g. "Visa only". */
  paymentMethod: string | null;

  /** Whether this may be combined with other offers. */
  stackable: boolean | null;
  stackingNotes: string | null;
}

/** Structured promotion data layered onto an existing deal record. */
export interface PromotionStructure {
  benefit: PromotionBenefit;
  conditions: PromotionConditions;

  /** IANA timezone the start/end dates are expressed in, e.g. "Australia/Sydney". */
  timezone: string | null;

  evidenceStatus: EvidenceStatus;
  evidenceSourceUrl: string | null;
  evidenceCheckedAt: string | null;
  evidenceCheckedBy: string | null;
}

/** Everything unknown — what a deal that nobody has structured yet looks like. */
export function emptyPromotionStructure(): PromotionStructure {
  return {
    benefit: {
      kind: "percentage",
      value: unknown("not-sourced"),
      isUpTo: false,
      maxCap: unknown("not-sourced"),
    },
    conditions: {
      minSpend: unknown("not-sourced"),
      minSpendBasis: "unknown",
      eligibleCategories: [],
      eligibleProductIds: [],
      exclusions: [],
      customerType: "unknown",
      requiresMembership: null,
      requiresApp: null,
      requiresAccount: null,
      requiresSubscription: null,
      paymentMethod: null,
      stackable: null,
      stackingNotes: null,
    },
    timezone: null,
    evidenceStatus: "merchant-listed",
    evidenceSourceUrl: null,
    evidenceCheckedAt: null,
    evidenceCheckedBy: null,
  };
}

/**
 * Parse a free-text discount label into a structured benefit.
 *
 * Used by the backfill to seed `benefit` from the existing `discountText`.
 * Deliberately conservative: anything it cannot read confidently stays unknown,
 * because a wrong structured value is worse than an honest gap. Parsing a label
 * proves nothing, so the result is never better than `merchant-listed`.
 */
export function parseDiscountText(
  text: string | null | undefined,
  currency?: string | null,
): PromotionBenefit {
  const empty: PromotionBenefit = {
    kind: "percentage",
    value: unknown("not-sourced"),
    isUpTo: false,
    maxCap: unknown("not-sourced"),
  };
  if (!text) return empty;

  const raw = text.trim();
  const isUpTo = /\b(up to|bis zu|jusqu'a|hasta|fino a)\b/i.test(raw);

  if (/free\s+(delivery|shipping)|gratis versand|livraison gratuite|envio gratis|spedizione gratuita/i.test(raw)) {
    return { ...empty, kind: "free-delivery", isUpTo, description: raw };
  }
  if (/cashback/i.test(raw)) {
    const pct = raw.match(/(\d+(?:[.,]\d+)?)\s*%/);
    return {
      ...empty,
      kind: "cashback",
      isUpTo,
      value: pct ? known(toNumber(pct[1])) : unknown("not-sourced"),
      description: raw,
    };
  }
  if (/\b(gift|geschenk|cadeau|regalo|omaggio)\b/i.test(raw)) {
    return { ...empty, kind: "gift", isUpTo, description: raw };
  }

  const pct = raw.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (pct) {
    return { ...empty, kind: "percentage", isUpTo, value: known(toNumber(pct[1])) };
  }

  // A currency amount: "$15 OFF", "15 EUR off".
  const amount = raw.match(
    /(?:[$£€¥₹]|AUD|USD|EUR|GBP)\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:[$£€¥₹])/i,
  );
  if (amount) {
    const digits = amount[1] ?? amount[2];
    return {
      ...empty,
      kind: "fixed-amount",
      isUpTo,
      value: known(toNumber(digits)),
      currency: currency ?? null,
    };
  }

  return empty;
}

/**
 * Whether a promotion's conditions are complete enough to compute a discount.
 * Incomplete conditions produce a *conditional* offer, never a guaranteed price.
 */
export function isCalculable(structure: PromotionStructure): boolean {
  const { benefit, conditions } = structure;
  if (!benefit.value.known) return false;
  if (benefit.isUpTo) return false; // "up to" is a ceiling, not an amount
  if (benefit.kind === "gift" || benefit.kind === "free-delivery") return false;
  if (conditions.minSpend.known && conditions.minSpendBasis === "unknown") return false;
  return true;
}

/**
 * Restrictions decisive enough that a shopper must see them before clicking
 * out. The brief: "Put decisive restrictions on the card before the outbound
 * click."
 */
export function decisiveRestrictions(structure: PromotionStructure): string[] {
  const out: string[] = [];
  const c = structure.conditions;
  if (c.customerType === "new") out.push("New customers only");
  if (c.customerType === "existing") out.push("Existing customers only");
  if (c.requiresMembership) out.push("Membership required");
  if (c.requiresApp) out.push("App required");
  if (c.requiresAccount) out.push("Account required");
  if (c.requiresSubscription) out.push("Subscription required");
  if (c.paymentMethod) out.push(`${c.paymentMethod} only`);
  if (c.minSpend.known) out.push(`Minimum spend ${c.minSpend.value}`);
  if (c.exclusions.length > 0) out.push(...c.exclusions);
  return out;
}

function toNumber(value: string): number {
  return Number(value.replace(",", "."));
}
