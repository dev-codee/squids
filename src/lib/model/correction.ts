/**
 * Correction / Dispute Model (§15)
 *
 * Provides structured tracking for shopper and retailer reported issues:
 * - Incorrect product matches
 * - Stale / inaccurate prices
 * - Expired deals or voucher codes
 * - Broken affiliate or tracking links
 * - Outdated retailer details
 * - General data corrections
 *
 * Implements a strict state machine: pending -> reviewing -> resolved | rejected.
 */

export const DISPUTE_TYPES = [
  "wrong_match",
  "wrong_price",
  "expired_deal",
  "broken_link",
  "merchant_info",
  "other",
] as const;

export type DisputeType = (typeof DISPUTE_TYPES)[number];

export const CORRECTION_STATUSES = [
  "pending",
  "reviewing",
  "resolved",
  "rejected",
] as const;

export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

export interface CorrectionTicket {
  id: string;
  country: string;
  disputeType: DisputeType;
  productId?: string;
  productTitle?: string;
  dealId?: string;
  storeSlug?: string;
  pageUrl?: string;
  description: string;
  reporterEmail?: string;
  status: CorrectionStatus;
  resolutionNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCorrectionInput {
  country: string;
  disputeType: DisputeType;
  productId?: string;
  productTitle?: string;
  dealId?: string;
  storeSlug?: string;
  pageUrl?: string;
  description: string;
  reporterEmail?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTRY_RE = /^[A-Za-z]{2}$/;

/**
 * Validates a correction ticket submission.
 */
export function validateCorrectionInput(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== "object") {
    return { valid: false, errors: ["Input must be an object"] };
  }

  const data = input as Partial<CreateCorrectionInput>;

  // Country
  if (!data.country || !COUNTRY_RE.test(data.country)) {
    errors.push("Valid 2-letter ISO country code is required");
  }

  // Dispute Type
  if (!data.disputeType || !DISPUTE_TYPES.includes(data.disputeType as DisputeType)) {
    errors.push(
      `Dispute type must be one of: ${DISPUTE_TYPES.join(", ")}`,
    );
  }

  // Description
  if (!data.description || typeof data.description !== "string" || data.description.trim().length < 10) {
    errors.push("Description is required and must be at least 10 characters");
  } else if (data.description.length > 2000) {
    errors.push("Description must not exceed 2000 characters");
  }

  // Reporter Email (optional, but if provided must be valid)
  if (data.reporterEmail && (typeof data.reporterEmail !== "string" || !EMAIL_RE.test(data.reporterEmail.trim()))) {
    errors.push("Reporter email is invalid");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates whether a state transition is permitted.
 */
export function canTransitionCorrection(
  current: CorrectionStatus,
  next: CorrectionStatus,
): boolean {
  if (current === next) return true;

  switch (current) {
    case "pending":
      return next === "reviewing" || next === "resolved" || next === "rejected";
    case "reviewing":
      return next === "resolved" || next === "rejected" || next === "pending";
    case "resolved":
    case "rejected":
      // Re-opening allowed back to reviewing
      return next === "reviewing";
    default:
      return false;
  }
}
