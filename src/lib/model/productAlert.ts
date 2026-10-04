/**
 * Product price alert data model.
 *
 * The brief (p.27):
 * "Alert setup with explicit consent; send-time revalidation;
 * dedup/cooldown/unsubscribe; usefulness metrics."
 */

export type ProductAlertStatus = "pending" | "confirmed" | "unsubscribed";
export type AlertFrequency = "instant" | "daily" | "weekly";

export interface ProductAlert {
  id: string;
  email: string;
  productId: number;
  productTitle: string;
  market: string;
  currency: string;
  targetPrice: number;
  frequency: AlertFrequency;
  status: ProductAlertStatus;
  token: string;
  consentScope: string; // e.g. "price_drop_alerts"
  consentVersion: string; // e.g. "2026-v1"
  createdAt: string;
  confirmedAt?: string | null;
  unsubscribedAt?: string | null;
  lastNotifiedAt?: string | null;
  lastCheckedPrice?: number | null;
}

export interface RevalidationResult {
  canSend: boolean;
  reason?: string;
  eligiblePrice?: number;
}

/**
 * Checks whether the current observed price meets or beats the subscriber's target price.
 */
export function isTargetPriceMet(currentPrice: number, targetPrice: number): boolean {
  if (typeof currentPrice !== "number" || typeof targetPrice !== "number") return false;
  return currentPrice <= targetPrice;
}

/**
 * Cooldown periods between notifications per frequency tier.
 */
const COOLDOWN_HOURS: Record<AlertFrequency, number> = {
  instant: 6, // Don't notify the same alert more than once every 6 hours
  daily: 22,
  weekly: 160,
};

/**
 * Evaluates whether an alert can be sent right now according to its status,
 * notification cooldown, and frequency tier.
 */
export function canSendAlert(alert: ProductAlert, now: Date = new Date()): boolean {
  if (alert.status !== "confirmed") return false;
  if (!alert.lastNotifiedAt) return true;

  const lastNotified = new Date(alert.lastNotifiedAt).getTime();
  const cooldownMs = (COOLDOWN_HOURS[alert.frequency] ?? 24) * 60 * 60 * 1000;
  return now.getTime() - lastNotified >= cooldownMs;
}

/**
 * Revalidates offer freshness and eligibility before dispatching an alert email.
 * "Send-time revalidation — recheck source freshness, exact variant, stock,
 * eligibility, delivered-total basis."
 */
export function revalidateOfferBeforeAlert(params: {
  isCurrent: boolean;
  inStock: boolean;
  itemPrice?: number | null;
  targetPrice: number;
}): RevalidationResult {
  if (!params.isCurrent) {
    return { canSend: false, reason: "Offer is stale or not currently active" };
  }
  if (!params.inStock) {
    return { canSend: false, reason: "Product is reported out of stock" };
  }
  if (typeof params.itemPrice !== "number" || params.itemPrice <= 0) {
    return { canSend: false, reason: "Offer price is missing or invalid" };
  }
  if (!isTargetPriceMet(params.itemPrice, params.targetPrice)) {
    return {
      canSend: false,
      reason: `Current price (${params.itemPrice}) does not meet target (${params.targetPrice})`,
    };
  }

  return { canSend: true, eligiblePrice: params.itemPrice };
}
