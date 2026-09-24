/**
 * Shared "expires soon" badge logic for coupon/deal cards.
 * Only surfaces a badge inside a useful window — far-future expiries
 * (or none at all) return null so cards don't get cluttered.
 */
export type ExpiryTone = "urgent" | "soon";

export interface ExpiryBadge {
  label: string;
  tone: ExpiryTone;
}

export function getExpiryBadge(expiryDate: string | null | undefined): ExpiryBadge | null {
  if (!expiryDate) return null;
  const end = new Date(expiryDate).getTime();
  if (Number.isNaN(end)) return null;

  const days = Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return null;
  if (days === 0) return { label: "Expires today", tone: "urgent" };
  if (days === 1) return { label: "Expires tomorrow", tone: "urgent" };
  if (days <= 3) return { label: `Expires in ${days} days`, tone: "urgent" };
  if (days <= 14) return { label: `Expires in ${days} days`, tone: "soon" };
  return null;
}

export const EXPIRY_BADGE_CLASSES: Record<ExpiryTone, string> = {
  urgent: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  soon: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20",
};
