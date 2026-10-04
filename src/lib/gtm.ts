/**
 * Google Tag Manager & GA4 DataLayer Utility
 *
 * Implements the 11 named analytics events from PDF specification (p.29)
 * with consistent dimensions: page_type, canonical_url, market, timestamps.
 */

declare global {
  interface Window {
    dataLayer?: Record<string, any>[];
  }
}

export type GtmEventName =
  | "search_submit"
  | "product_view"
  | "variant_select"
  | "comparison_view"
  | "offer_terms_open"
  | "save_item"
  | "alert_opt_in"
  | "correction_submit"
  | "show_coupon_click"
  | "coupon_reveal"
  | "coupon_copy"
  | "affiliate_click";

export type GtmCouponEventName = GtmEventName;

export interface BaseEventDimensions {
  page_type?: "home" | "category" | "store" | "product" | "utility";
  canonical_url?: string;
  market?: string;
}

export interface GtmEventPayload extends BaseEventDimensions {
  [key: string]: any;
}

export interface GtmCouponPayload extends BaseEventDimensions {
  merchant_id: string;
  merchant_name: string;
  market: string;
  coupon_id: string;
  offer_type: "code" | "deal" | "cashback" | "student" | string;
  button_location: "coupon_card" | "reveal_modal" | "sidebar" | "header" | string;
  coupon_code?: string;
}

/**
 * Pushes a generic typed analytics event with base dimensions to GTM's dataLayer.
 * Safe to execute during SSR.
 */
export function trackEvent(
  event: GtmEventName,
  payload: GtmEventPayload = {},
): void {
  if (typeof window === "undefined") return;

  const canonical = payload.canonical_url || window.location.href;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    timestamp: new Date().toISOString(),
    canonical_url: canonical,
    page_type: payload.page_type,
    market: payload.market ? payload.market.toUpperCase() : undefined,
    ...payload,
  });
}

/**
 * Convenience wrapper for coupon interaction events.
 */
export function trackCouponEvent(
  event: GtmEventName,
  payload: GtmCouponPayload,
): void {
  trackEvent(event, {
    merchant_id: payload.merchant_id,
    merchant_name: payload.merchant_name,
    market: payload.market,
    coupon_id: payload.coupon_id,
    offer_type: payload.offer_type,
    button_location: payload.button_location,
    coupon_code: payload.coupon_code,
  });
}

/**
 * Tracks a search submission across products/stores.
 */
export function trackSearchSubmit(query: string, searchType = "all", resultsCount = 0): void {
  trackEvent("search_submit", {
    query,
    search_type: searchType,
    results_count: resultsCount,
  });
}

/**
 * Tracks product detail view.
 */
export function trackProductView(productId: number, title: string, category?: string | null): void {
  trackEvent("product_view", {
    page_type: "product",
    product_id: productId,
    product_title: title,
    category: category || null,
  });
}

/**
 * Tracks variant switch selection.
 */
export function trackVariantSelect(productId: number, variantLabel: string): void {
  trackEvent("variant_select", {
    product_id: productId,
    variant_label: variantLabel,
  });
}

/**
 * Tracks comparison table view with candidate count and proven match status.
 */
export function trackComparisonView(productId: number, retailersCount: number, exactMatch: boolean): void {
  trackEvent("comparison_view", {
    product_id: productId,
    retailers_count: retailersCount,
    is_exact_match: exactMatch,
  });
}

/**
 * Tracks opening of terms panel on a coupon or offer.
 */
export function trackOfferTermsOpen(offerId: string, offerType: string): void {
  trackEvent("offer_terms_open", {
    offer_id: offerId,
    offer_type: offerType,
  });
}

/**
 * Tracks saving an item for later.
 */
export function trackSaveItem(productId: number, title: string): void {
  trackEvent("save_item", {
    product_id: productId,
    product_title: title,
  });
}

/**
 * Tracks alert opt-in request.
 */
export function trackAlertOptIn(productId: number, targetPrice: number, frequency: string): void {
  trackEvent("alert_opt_in", {
    product_id: productId,
    target_price: targetPrice,
    frequency,
  });
}

/**
 * Tracks submission of a match or store correction report.
 */
export function trackCorrectionSubmit(entityType: string, entityId: string | number, reason: string): void {
  trackEvent("correction_submit", {
    entity_type: entityType,
    entity_id: entityId,
    reason,
  });
}
