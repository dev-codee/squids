/**
 * Merchant and store-market.
 *
 * The brief separates a merchant from the market it trades in: "Stable merchant
 * ID; separate store-market ID; canonical store URL; country, currency,
 * approved domains, local policies, feed/source IDs and programme permissions.
 * Never join by display name alone."
 *
 * That last sentence is the defect this entity exists to fix. Today the public
 * store page is resolved by slugging the advertiser's display name, and market
 * eligibility is read off `region`/`countryCode` fields on the same document —
 * which is how Australian beauty offers surfaced in other markets. Here the
 * slug is stored data keyed to one market, not a string derived from a name.
 */

/** Stable store-market ID: `<network>:<merchantId>:<MARKET>`. */
export type MerchantMarketId = string;

export function merchantMarketId(
  network: string,
  merchantId: number | string,
  market: string,
): MerchantMarketId {
  return `${network.toLowerCase()}:${merchantId}:${market.toUpperCase()}`;
}

/** What we are permitted to do with this merchant, per channel. */
export interface ProgrammePermissions {
  /** Permitted to publish organic pages for this merchant-market. */
  seo: boolean;
  /** Permitted to run paid search to it. */
  ppc: boolean;
  /** Permitted to bid on the merchant's brand terms. */
  brandBidding: boolean;
  /** Permitted to deep-link past the homepage. */
  deepLinks: boolean;
  /** Permitted to distribute voucher codes. */
  voucherDistribution: boolean;
  /** Free-text restrictions that do not fit the flags above. */
  notes?: string;
  /** Where these permissions came from, and when they were last confirmed. */
  sourceUrl?: string | null;
  confirmedAt?: string | null;
  confirmedBy?: string | null;
}

export const NO_PERMISSIONS: ProgrammePermissions = {
  seo: false,
  ppc: false,
  brandBidding: false,
  deepLinks: false,
  voucherDistribution: false,
  sourceUrl: null,
  confirmedAt: null,
  confirmedBy: null,
};

/** Commission terms as contracted, kept out of public records. */
export interface CommissionTerms {
  basis?: string | null;
  exclusions?: string[];
  validationPeriodDays?: number | null;
  paymentProcess?: string | null;
  termsUrl?: string | null;
  reviewedAt?: string | null;
}

export type MerchantMarketStatus =
  | "active"
  | "pending"
  | "suspended"
  | "ended";

export interface MerchantMarket {
  /** Stable store-market ID. Public pages join on this, never on a name. */
  id: MerchantMarketId;
  /** Stable merchant ID — the advertiser id within its network. */
  merchantId: number;
  network: string;
  /** ISO-3166-1 alpha-2, uppercase. One document per market. */
  market: string;

  /** Local merchant name as it should be displayed in this market. */
  displayName: string;
  /**
   * Canonical URL slug. Stored, not derived at query time, so renaming a
   * merchant cannot silently move its page.
   */
  slug: string;
  /** Currency this market prices in. Distinct from language and from country. */
  currency: string;

  /** The merchant's own site for this market. */
  websiteUrl: string | null;
  /** Hosts we accept as genuinely this merchant's, for destination checks. */
  approvedDomains: string[];

  /** Feed/source identifiers that supply this market's data. */
  feedSourceIds: string[];

  permissions: ProgrammePermissions;
  commission?: CommissionTerms;

  /** Links to the merchant's own published policies for this market. */
  policyUrls?: {
    delivery?: string | null;
    returns?: string | null;
    payment?: string | null;
    support?: string | null;
  };

  status: MerchantMarketStatus;

  /** Who last reviewed this record, and when. Never written automatically. */
  reviewedBy?: string | null;
  reviewedAt?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Whether this merchant-market may be published at all.
 *
 * The brief gates publishing on confirmed rights: "Show expired or unconfirmed
 * access before any publishing or campaign action" and "Block if rights or
 * identity are unknown."
 */
export function canPublish(mm: MerchantMarket): boolean {
  return mm.status === "active" && mm.permissions.seo;
}

/** Whether paid search to this merchant-market is permitted. */
export function canRunPaidSearch(mm: MerchantMarket): boolean {
  return mm.status === "active" && mm.permissions.ppc;
}
