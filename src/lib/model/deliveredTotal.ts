/**
 * The eligible delivered total.
 *
 * The brief (p.15) states the formula outright:
 *
 *   Eligible delivered total =
 *       qualifying basket
 *     − eligible discount
 *     + delivery
 *     + mandatory fees
 *     + additional tax not already included
 *
 * Nothing here invents a component. Every money field is a `Known<number>`, and
 * `sumKnown` propagates unknown, so an offer whose delivery nobody has sourced
 * produces an unknown total rather than an item price wearing a delivered-total
 * label. That is the whole point: the comparison claim is only ever made over
 * the rows whose total is actually known.
 *
 * Two rules deserve calling out because they are easy to get wrong:
 *
 *  - **A promotion only reduces the total when it is eligible *and*
 *    calculable.** Anything conditional (unknown customer type, an "up to"
 *    ceiling, an exclusion list we cannot evaluate) is reported separately as a
 *    conditional offer that *may* reduce the price. It never silently lowers a
 *    number presented as what the shopper will pay.
 *  - **Cashback is contingent.** It is never subtracted from the amount payable
 *    at checkout; it is carried in its own field so the UI can show it apart.
 */

import type { Known } from "./known";
import { known, unknown, sumKnown, mapKnown } from "./known";
import type { DeliveryRule } from "./delivery";
import { deliveryFor } from "./delivery";
import type { PromotionStructure } from "./promotion";
import { isCalculable } from "./promotion";

/** The labels the brief asks for, used verbatim wherever a breakdown renders. */
export const COST_LABELS = {
  itemPrice: "Item price",
  eligibleDiscount: "Eligible discount",
  delivery: "Delivery",
  otherCharges: "Other mandatory charges",
  additionalTax: "Additional tax",
  total: "Known delivered total",
  checkedAt: "Last checked",
} as const;

/** What we know about the shopper. Anything absent is a condition, not a zero. */
export interface ShopperContext {
  market: string;
  postcode?: string | null;
  serviceLevel?: string;
  quantity?: number;
  customerType?: "new" | "existing" | "unknown";
  hasMembership?: boolean | null;
  usingApp?: boolean | null;
  hasAccount?: boolean | null;
  hasSubscription?: boolean | null;
  paymentMethod?: string | null;
}

/** A promotion as it is evaluated: structure plus the deal's own market/dates. */
export interface EvaluablePromotion {
  id: string;
  structure: PromotionStructure;
  /** Markets the deal is valid in. Empty means unrestricted. */
  markets?: string[];
  startDate?: string | null;
  endDate?: string | null;
  /** What the shopper sees on the card, for the conditional-offer list. */
  label?: string | null;
}

export type EligibilityVerdict = "eligible" | "conditional" | "ineligible";

export interface EligibilityAssessment {
  promotionId: string;
  verdict: EligibilityVerdict;
  /** Requirements we cannot confirm from here — the shopper must satisfy them. */
  conditions: string[];
  /** Reasons this cannot apply at all. */
  blockers: string[];
}

/** One line of the qualifying basket. */
export interface BasketLine {
  id: string;
  productId?: number;
  categorySlug?: string | null;
  unitPrice: Known<number>;
  quantity: number;
}

export interface DeliveredTotalInput {
  /** The offer's advertised item price, excluding delivery and charges. */
  itemPrice: Known<number>;
  currency: string;
  /** Delivery rule for the destination, or null when none is on record. */
  deliveryRule: DeliveryRule | null;
  promotions?: readonly EvaluablePromotion[];
  shopper: ShopperContext;
  /**
   * Tax on top of the listed price. Omit to derive it from the delivery rule's
   * `taxIncluded` flag — included means a known zero, anything else is unknown,
   * because unknown duties must prevent a complete-total claim.
   */
  additionalTax?: Known<number>;
  /** For the freshness stamp: the oldest check behind this total wins. */
  offerCheckedAt?: string | null;
  productId?: number;
  categorySlug?: string | null;
}

export interface DeliveredTotalBreakdown {
  currency: string;
  quantity: number;

  /** Qualifying basket: item price × quantity. */
  itemPrice: Known<number>;
  /** Discount actually applied — only from eligible, calculable promotions. */
  eligibleDiscount: Known<number>;
  delivery: Known<number>;
  otherMandatoryCharges: Known<number>;
  additionalTax: Known<number>;

  /** The formula's result. Unknown if any component is unknown. */
  total: Known<number>;

  /** Promotions that reduced the total. */
  appliedPromotionIds: string[];
  /** Offers that may reduce it further but could not be confirmed from here. */
  conditionalPromotions: EligibilityAssessment[];
  /** Cashback, never subtracted — it is not payable-at-checkout money. */
  contingentCashback: Known<number>;

  /**
   * True when the result depends on shopper details we assumed rather than
   * know. Render such a total as "estimated", per the brief.
   */
  estimated: boolean;
  /** Plain-language notes explaining assumptions and gaps. */
  notes: string[];
  /** Oldest check time across the components. Null when nothing was checked. */
  checkedAt: string | null;
}

/* -------------------------------------------------------------------------- */
/* Eligibility                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Decide whether a promotion applies to this shopper and this item.
 *
 * Three outcomes, never two: a requirement we can disprove is a blocker, a
 * requirement we simply cannot see is a condition. Conditions keep the offer
 * visible without letting it change the price.
 */
export function assessEligibility(
  promotion: EvaluablePromotion,
  context: {
    shopper: ShopperContext;
    qualifyingSubtotal: Known<number>;
    subtotalAfterOtherDiscounts?: Known<number>;
    productId?: number;
    categorySlug?: string | null;
  },
  now: Date = new Date(),
): EligibilityAssessment {
  const { structure } = promotion;
  const c = structure.conditions;
  const conditions: string[] = [];
  const blockers: string[] = [];

  // Market.
  const markets = (promotion.markets ?? []).map((m) => m.toUpperCase());
  if (markets.length > 0 && !markets.includes(context.shopper.market.toUpperCase())) {
    blockers.push(`Not valid in ${context.shopper.market.toUpperCase()}`);
  }

  // Dates. A date with no time and no recorded timezone cannot be resolved to an
  // instant, so it becomes a condition rather than a silent pass or fail.
  const window = assessWindow(promotion, now);
  if (window.expired) blockers.push("Offer has ended");
  if (window.notStarted) blockers.push("Offer has not started");
  if (window.ambiguous) conditions.push("End date has no recorded timezone");

  // Who it is for.
  if (c.customerType === "new" || c.customerType === "existing") {
    const shopperType = context.shopper.customerType ?? "unknown";
    if (shopperType === "unknown") {
      conditions.push(c.customerType === "new" ? "New customers only" : "Existing customers only");
    } else if (shopperType !== c.customerType) {
      blockers.push(c.customerType === "new" ? "New customers only" : "Existing customers only");
    }
  }

  requirement(c.requiresMembership, context.shopper.hasMembership, "Membership required", conditions, blockers);
  requirement(c.requiresApp, context.shopper.usingApp, "App purchase required", conditions, blockers);
  requirement(c.requiresAccount, context.shopper.hasAccount, "Account required", conditions, blockers);
  requirement(c.requiresSubscription, context.shopper.hasSubscription, "Subscription required", conditions, blockers);

  if (c.paymentMethod) {
    const paying = context.shopper.paymentMethod;
    if (!paying) conditions.push(`${c.paymentMethod} only`);
    else if (norm(paying) !== norm(c.paymentMethod)) blockers.push(`${c.paymentMethod} only`);
  }

  // Which items qualify.
  if (c.eligibleProductIds.length > 0) {
    if (context.productId == null) conditions.push("Applies to selected products only");
    else if (!c.eligibleProductIds.includes(context.productId)) {
      blockers.push("Does not apply to this product");
    }
  }
  if (c.eligibleCategories.length > 0) {
    const slug = context.categorySlug ? norm(context.categorySlug) : null;
    if (!slug) conditions.push("Applies to selected categories only");
    else if (!c.eligibleCategories.some((cat) => norm(cat) === slug)) {
      blockers.push("Does not apply to this category");
    }
  }

  // Exclusions are free text; nothing here can evaluate them.
  for (const exclusion of c.exclusions) conditions.push(exclusion);

  // Minimum spend, on the basis the merchant actually uses.
  if (c.minSpend.known) {
    if (c.minSpendBasis === "unknown") {
      conditions.push(`Minimum spend ${c.minSpend.value} (basis not recorded)`);
    } else {
      const basket =
        c.minSpendBasis === "after-discount"
          ? context.subtotalAfterOtherDiscounts ?? context.qualifyingSubtotal
          : context.qualifyingSubtotal;
      if (!basket.known) conditions.push(`Minimum spend ${c.minSpend.value}`);
      else if (basket.value < c.minSpend.value) {
        blockers.push(`Minimum spend ${c.minSpend.value} not met`);
      }
    }
  }

  // A benefit we cannot compute can never be a guaranteed reduction.
  if (!isCalculable(structure)) {
    conditions.push(
      structure.benefit.isUpTo
        ? "Advertised as an “up to” discount"
        : "Discount amount not recorded",
    );
  }

  const verdict: EligibilityVerdict =
    blockers.length > 0 ? "ineligible" : conditions.length > 0 ? "conditional" : "eligible";

  return { promotionId: promotion.id, verdict, conditions, blockers };
}

function requirement(
  required: boolean | null,
  held: boolean | null | undefined,
  label: string,
  conditions: string[],
  blockers: string[],
): void {
  if (!required) return;
  if (held === true) return;
  if (held === false) blockers.push(label);
  else conditions.push(label);
}

function assessWindow(
  promotion: EvaluablePromotion,
  now: Date,
): { expired: boolean; notStarted: boolean; ambiguous: boolean } {
  const out = { expired: false, notStarted: false, ambiguous: false };
  const tz = promotion.structure.timezone;

  if (promotion.endDate) {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(promotion.endDate.trim());
    const end = new Date(dateOnly ? `${promotion.endDate.trim()}T23:59:59Z` : promotion.endDate);
    if (!Number.isNaN(end.getTime())) {
      // A date-only expiry is a local midnight somewhere. Without a timezone the
      // last day is ambiguous, so we flag it rather than guess which it was.
      if (dateOnly && !tz) out.ambiguous = true;
      if (end.getTime() < now.getTime()) out.expired = true;
    }
  }

  if (promotion.startDate) {
    const start = new Date(promotion.startDate);
    if (!Number.isNaN(start.getTime()) && start.getTime() > now.getTime()) {
      out.notStarted = true;
    }
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* Discount                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The cash discount a promotion takes off a qualifying subtotal.
 *
 * Returns a known zero for benefits that are not money off the items —
 * free delivery is handled by the delivery rule, a gift is not cash, and
 * cashback is contingent and reported separately.
 */
export function discountAmount(
  structure: PromotionStructure,
  qualifyingSubtotal: Known<number>,
): Known<number> {
  const { benefit } = structure;

  // Benefits that are not money off the items are a known zero here whatever
  // else is unrecorded: free delivery belongs to the delivery rule, a gift is
  // not cash, and cashback is contingent and reported on its own.
  if (
    benefit.kind === "free-delivery" ||
    benefit.kind === "gift" ||
    benefit.kind === "cashback"
  ) {
    return known(0);
  }

  if (!isCalculable(structure)) return unknown("needs-shopper-input");

  switch (benefit.kind) {
    case "percentage": {
      if (!benefit.value.known) return unknown("not-sourced");
      const pct = benefit.value.value;
      return mapKnown(qualifyingSubtotal, (subtotal) =>
        capped(round2((subtotal * pct) / 100), benefit.maxCap, subtotal),
      );
    }
    case "fixed-amount": {
      if (!benefit.value.known) return unknown("not-sourced");
      const amount = benefit.value.value;
      // A discount cannot exceed the basket it comes off.
      return mapKnown(qualifyingSubtotal, (subtotal) =>
        capped(round2(Math.min(amount, subtotal)), benefit.maxCap, subtotal),
      );
    }
    default:
      return known(0);
  }
}

function capped(amount: number, maxCap: Known<number>, subtotal: number): number {
  const limited = maxCap.known ? Math.min(amount, maxCap.value) : amount;
  return round2(Math.max(0, Math.min(limited, subtotal)));
}

/** Contingent cashback: paid later, never deducted from the checkout total. */
export function cashbackAmount(
  structure: PromotionStructure,
  qualifyingSubtotal: Known<number>,
): Known<number> {
  const { benefit } = structure;
  if (benefit.kind !== "cashback") return known(0);
  if (benefit.isUpTo || !benefit.value.known) return unknown("needs-shopper-input");
  const rate = benefit.value.value;
  return mapKnown(qualifyingSubtotal, (subtotal) =>
    capped(round2((subtotal * rate) / 100), benefit.maxCap, subtotal),
  );
}

/**
 * Which eligible promotions may be applied together.
 *
 * The brief: combine only when explicitly permitted. `stackable === true` on
 * every member is the only thing that permits it; a null (unrecorded) is not a
 * yes. Otherwise the single largest discount is applied on its own.
 */
export function combinablePromotions<T extends { structure: PromotionStructure }>(
  promotions: readonly T[],
  valueOf: (promotion: T) => Known<number>,
): T[] {
  const applicable = promotions.filter((p) => valueOf(p).known);
  if (applicable.length <= 1) return applicable;

  if (applicable.every((p) => p.structure.conditions.stackable === true)) {
    return applicable;
  }

  let best: T | null = null;
  let bestValue = -Infinity;
  for (const p of applicable) {
    const v = valueOf(p);
    if (v.known && v.value > bestValue) {
      best = p;
      bestValue = v.value;
    }
  }
  return best ? [best] : [];
}

/* -------------------------------------------------------------------------- */
/* The calculator                                                             */
/* -------------------------------------------------------------------------- */

/** Compute the eligible delivered total for one offer. */
export function deliveredTotal(
  input: DeliveredTotalInput,
  now: Date = new Date(),
): DeliveredTotalBreakdown {
  const quantity = Math.max(1, Math.floor(input.shopper.quantity ?? 1));
  const notes: string[] = [];

  const qualifyingBasket = mapKnown(input.itemPrice, (price) => round2(price * quantity));

  // 1. Eligibility, then discount — in that order, because an ineligible
  //    promotion must never contribute a number.
  const assessments = (input.promotions ?? []).map((promotion) =>
    assessEligibility(
      promotion,
      {
        shopper: input.shopper,
        qualifyingSubtotal: qualifyingBasket,
        productId: input.productId,
        categorySlug: input.categorySlug,
      },
      now,
    ),
  );

  const byId = new Map(assessments.map((a) => [a.promotionId, a]));
  const promotions = input.promotions ?? [];
  const eligible = promotions.filter((p) => byId.get(p.id)?.verdict === "eligible");
  const conditional = assessments.filter((a) => a.verdict === "conditional");

  const applied = combinablePromotions(eligible, (p) =>
    discountAmount(p.structure, qualifyingBasket),
  );

  const eligibleDiscount = applied.length
    ? sumKnown(applied.map((p) => discountAmount(p.structure, qualifyingBasket)))
    : known(0);

  const contingentCashback = sumKnown(
    eligible.map((p) => cashbackAmount(p.structure, qualifyingBasket)),
  );

  const subtotalAfterDiscount: Known<number> = sumKnown([
    qualifyingBasket,
    mapKnown(eligibleDiscount, (d) => -d),
  ]);

  // 2. Delivery, on the merchant's own threshold basis.
  const rule = input.deliveryRule;
  const delivery = rule
    ? deliveryFor(rule, {
        beforeDiscount: qualifyingBasket,
        afterDiscount: subtotalAfterDiscount,
      })
    : unknown<number>("not-sourced");
  if (!rule) notes.push("No delivery rule on record for this destination.");

  const otherMandatoryCharges = rule ? rule.mandatoryFees : unknown<number>("not-sourced");

  // 3. Tax. Included in the listed price means a known zero on top — adding it
  //    again would double-count. Anything else is unknown, and unknown duties
  //    must prevent a complete-total claim.
  const additionalTax =
    input.additionalTax ??
    (rule?.taxIncluded === true ? known(0) : unknown<number>("not-sourced"));
  if (!input.additionalTax && rule?.taxIncluded !== true) {
    notes.push("Tax basis not established for this merchant.");
  }

  const total = sumKnown([
    subtotalAfterDiscount,
    delivery,
    otherMandatoryCharges,
    additionalTax,
  ]);

  // A delivery charge quoted without a postcode is an estimate for the market.
  const estimated = delivery.known && delivery.value > 0 && !input.shopper.postcode;
  if (estimated) {
    notes.push("Delivery estimated for the market; enter a postcode for an exact charge.");
  }
  if (conditional.length > 0) {
    notes.push("Conditional offers may reduce this total if you qualify.");
  }

  return {
    currency: input.currency,
    quantity,
    itemPrice: qualifyingBasket,
    eligibleDiscount,
    delivery,
    otherMandatoryCharges,
    additionalTax,
    total: mapKnown(total, round2),
    appliedPromotionIds: applied.map((p) => p.id),
    conditionalPromotions: conditional,
    contingentCashback,
    estimated,
    notes,
    checkedAt: oldest(input.offerCheckedAt ?? null, rule?.checkedAt ?? null),
  };
}

/* -------------------------------------------------------------------------- */
/* Ranking                                                                    */
/* -------------------------------------------------------------------------- */

export interface RankedRow<T> {
  row: T;
  breakdown: DeliveredTotalBreakdown;
}

export interface Ranking<T> {
  /** Rows with a known delivered total, cheapest first. */
  ranked: RankedRow<T>[];
  /** Rows whose total could not be completed — never ranked, never hidden. */
  withoutKnownTotal: RankedRow<T>[];
  knownCount: number;
  /**
   * Whether a "lowest delivered total" claim may be made at all. The brief
   * requires at least two independent retailers with known totals.
   */
  canClaimLowest: boolean;
}

/**
 * Rank by known delivered total.
 *
 * Rows without a known total are returned separately rather than sorted to the
 * bottom, so a caller cannot accidentally present them as the expensive end of
 * a complete comparison. Independence is counted by retailer key: the same
 * retailer twice is one retailer.
 */
export function rankByDeliveredTotal<T>(
  rows: readonly RankedRow<T>[],
  retailerKey: (row: T) => string,
): Ranking<T> {
  const ranked = rows
    .filter((r) => r.breakdown.total.known)
    .sort((a, b) => totalOf(a) - totalOf(b));
  const withoutKnownTotal = rows.filter((r) => !r.breakdown.total.known);

  const retailers = new Set(ranked.map((r) => retailerKey(r.row)));

  return {
    ranked,
    withoutKnownTotal,
    knownCount: ranked.length,
    canClaimLowest: retailers.size >= 2,
  };
}

function totalOf<T>(r: RankedRow<T>): number {
  return r.breakdown.total.known ? r.breakdown.total.value : Number.POSITIVE_INFINITY;
}

/* -------------------------------------------------------------------------- */
/* Basket allocation                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Spread a basket-level discount across the lines that earned it.
 *
 * The brief is explicit that a basket discount cannot be applied in full to
 * every product card. Allocation is pro rata on line value, with the rounding
 * remainder given to the largest line so the parts sum back to the whole.
 */
export function allocateBasketDiscount(
  discount: Known<number>,
  lines: readonly BasketLine[],
): Map<string, Known<number>> {
  const out = new Map<string, Known<number>>();
  if (!discount.known) {
    for (const line of lines) out.set(line.id, discount);
    return out;
  }

  const values = lines.map((line) => ({
    id: line.id,
    value: line.unitPrice.known ? round2(line.unitPrice.value * line.quantity) : null,
  }));

  // One unpriced line makes every share unknown: we cannot say what fraction of
  // the basket the others represent.
  if (values.some((v) => v.value === null)) {
    for (const line of lines) out.set(line.id, unknown<number>("not-sourced"));
    return out;
  }

  const subtotal = values.reduce((sum, v) => sum + (v.value ?? 0), 0);
  if (subtotal <= 0) {
    for (const line of lines) out.set(line.id, known(0));
    return out;
  }

  let allocated = 0;
  let largest = { id: values[0]?.id ?? "", value: -Infinity };
  for (const v of values) {
    const share = round2((discount.value * (v.value ?? 0)) / subtotal);
    out.set(v.id, known(share));
    allocated = round2(allocated + share);
    if ((v.value ?? 0) > largest.value) largest = { id: v.id, value: v.value ?? 0 };
  }

  const remainder = round2(discount.value - allocated);
  if (remainder !== 0 && largest.id) {
    const current = out.get(largest.id);
    if (current?.known) out.set(largest.id, known(round2(current.value + remainder)));
  }

  return out;
}

/* -------------------------------------------------------------------------- */

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function norm(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** The oldest of two check stamps — a total is only as fresh as its stalest part. */
function oldest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}
