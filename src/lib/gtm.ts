/**
 * Google Tag Manager & GA4 DataLayer Utility
 *
 * Provides a type-safe interface for pushing interaction events to window.dataLayer
 * for Google Tag Manager (GTM) and Google Analytics 4 (GA4).
 */

declare global {
  interface Window {
    dataLayer?: Record<string, any>[];
  }
}

export type GtmCouponEventName =
  | "show_coupon_click"
  | "coupon_reveal"
  | "coupon_copy"
  | "affiliate_click";

export interface GtmCouponPayload {
  merchant_id: string;
  merchant_name: string;
  market: string;
  coupon_id: string;
  offer_type: "code" | "deal" | "cashback" | "student" | string;
  button_location: "coupon_card" | "reveal_modal" | "sidebar" | "header" | string;
  coupon_code?: string;
}

/**
 * Pushes a structured coupon interaction event to GTM's dataLayer.
 * Safe to execute during SSR (no-op on server).
 */
export function trackCouponEvent(
  event: GtmCouponEventName,
  payload: GtmCouponPayload,
): void {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    merchant_id: payload.merchant_id,
    merchant_name: payload.merchant_name,
    market: payload.market.toUpperCase(),
    coupon_id: payload.coupon_id,
    offer_type: payload.offer_type,
    button_location: payload.button_location,
  });
}
