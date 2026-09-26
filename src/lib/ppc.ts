/**
 * PPC permission — shared domain types and pure helpers.
 *
 * Before Foxzil runs Google Ads on a merchant's brand or coupon keywords we
 * need explicit *written* permission from that merchant's programme contact.
 * A permission is its own scoped record (merchant × network × market): a new
 * promotion landing in the `deals` collection never grants it.
 *
 * This module is client-safe (no MongoDB import) so admin components can share
 * the types and badge metadata. The persistence layer lives in
 * `@/lib/db/ppc-permissions`, mirroring the `lib/deals.ts` + `lib/db/deals.ts`
 * split used elsewhere.
 */

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Lifecycle of a permission record.
 *
 * Only READY and REQUESTED are ever eligible for an automated send, and the
 * send claims in `lib/db/ppc-permissions` match on them explicitly — so
 * REFUSED / NO_RESPONSE / DO_NOT_CONTACT rows cannot be picked up by a job even
 * if a new one is added later. The sticky `doNotContact` flag is a second,
 * independent lock (see {@link PpcPermission.doNotContact}).
 */
export type PpcPermissionStatus =
  /** Has (or is expected to have) a contact + landing page; nothing sent yet. */
  | "READY"
  /** Initial request sent. Awaiting a reply or the follow-up window. */
  | "REQUESTED"
  /** The single follow-up has been sent. No further automated email, ever. */
  | "FOLLOWED_UP"
  /** A reply arrived. Needs a human to read it — never auto-classified. */
  | "REVIEW_REPLY"
  /** Written permission granted, with an agreed scope and stored evidence. */
  | "APPROVED"
  /** Merchant said no. Permanently excluded from sending. */
  | "REFUSED"
  /** Follow-up went unanswered past the grace window. Sending stops. */
  | "NO_RESPONSE"
  /** Do not email this merchant at all, for any reason. */
  | "DO_NOT_CONTACT";

/** Statuses an automated job may ever transition *out of*. */
export const PPC_SENDABLE_STATUSES: readonly PpcPermissionStatus[] = ["READY", "REQUESTED"];

/** Statuses that permanently bar any further outreach. */
export const PPC_TERMINAL_STATUSES: readonly PpcPermissionStatus[] = [
  "APPROVED",
  "REFUSED",
  "NO_RESPONSE",
  "DO_NOT_CONTACT",
];

/** Whether the brand name may appear in ad copy. `unanswered` until confirmed. */
export type PpcBrandInAdText = "allowed" | "prohibited" | "unanswered";

/** Badge label + Tailwind classes per status, for the admin tables. */
export const PPC_STATUS_META: Record<
  PpcPermissionStatus,
  { label: string; className: string; hint: string }
> = {
  READY: {
    label: "Ready",
    className: "bg-gray-100 text-gray-700",
    hint: "Queued for the initial request. Nothing has been sent.",
  },
  REQUESTED: {
    label: "Requested",
    className: "bg-blue-50 text-blue-700",
    hint: "Initial request sent. Waiting for a reply or the follow-up window.",
  },
  FOLLOWED_UP: {
    label: "Followed up",
    className: "bg-indigo-50 text-indigo-700",
    hint: "Follow-up sent. No further automated email will go out.",
  },
  REVIEW_REPLY: {
    label: "Review reply",
    className: "bg-amber-100 text-amber-800",
    hint: "A reply arrived and needs you to read it and decide.",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-green-50 text-green-700",
    hint: "Written permission on file with an agreed scope.",
  },
  REFUSED: {
    label: "Refused",
    className: "bg-red-50 text-red-700",
    hint: "Merchant declined. Never contacted again automatically.",
  },
  NO_RESPONSE: {
    label: "No response",
    className: "bg-gray-100 text-gray-500",
    hint: "Follow-up went unanswered. Outreach stopped.",
  },
  DO_NOT_CONTACT: {
    label: "Do not contact",
    className: "bg-red-100 text-red-800",
    hint: "Permanently suppressed. Excluded from every automated send.",
  },
};

/** Every status, in the order they should appear in a filter dropdown. */
export const PPC_STATUS_ORDER: readonly PpcPermissionStatus[] = [
  "READY",
  "REQUESTED",
  "FOLLOWED_UP",
  "REVIEW_REPLY",
  "APPROVED",
  "REFUSED",
  "NO_RESPONSE",
  "DO_NOT_CONTACT",
];

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

/** One message in the permission's email thread. Append-only. */
export interface PpcThreadMessage {
  direction: "outbound" | "inbound";
  /** `manual` covers anything logged by hand (a phone call, a forwarded email). */
  kind: "initial" | "followup" | "reply" | "manual";
  /** RFC 5322 Message-ID, when we have one. */
  messageId: string | null;
  from: string | null;
  to: string | null;
  subject: string | null;
  /** Plain-text body. Stored verbatim — it is the evidence trail. */
  body: string;
  at: string;
  /** True when this went to the dry-run inbox rather than the merchant. */
  isTest?: boolean;
}

/**
 * A permission record, scoped to one merchant on one network.
 *
 * `_id` is a string here (not an `ObjectId`) so the same type can cross the
 * wire to the admin client components.
 */
export interface PpcPermission {
  _id?: string;

  // --- identity -----------------------------------------------------------
  merchantId: number;
  network: string;
  /** Denormalised so the directory list needs no join. */
  merchantName: string;
  merchantSlug: string | null;
  /** Our publisher/affiliate ID on this network, quoted in the outreach email. */
  publisherId: string | null;

  // --- contact ------------------------------------------------------------
  contactName: string | null;
  contactEmail: string | null;
  /** ISO 3166-1 alpha-2, uppercase. The market the permission is scoped to. */
  country: string | null;

  // --- requested scope ----------------------------------------------------
  landingPage: string | null;
  keywordsScope: string | null;
  brandInAdText: PpcBrandInAdText;

  // --- lifecycle ----------------------------------------------------------
  status: PpcPermissionStatus;
  /**
   * Sticky suppression flag. Set the moment a row becomes REFUSED or
   * DO_NOT_CONTACT and never cleared automatically. Every send claim requires
   * `doNotContact: { $ne: true }`, so flipping the status back to READY by hand
   * still will not cause an email.
   */
  doNotContact: boolean;

  sentAt: string | null;
  followupAt: string | null;
  followupSentAt: string | null;
  replyReceivedAt: string | null;
  decidedAt: string | null;

  // --- email threading ----------------------------------------------------
  /** Message-ID of our initial request. */
  requestMessageId: string | null;
  /** Message-ID of the single follow-up. */
  followupMessageId: string | null;
  /** Subject of the initial request, reused verbatim by the follow-up. */
  threadSubject: string | null;
  /** Every Message-ID in this thread — what inbound replies are matched against. */
  threadRefs: string[];
  messages: PpcThreadMessage[];

  // --- outcome ------------------------------------------------------------
  /** Free text: the exact scope the merchant agreed to, in their words. */
  permissionScope: string | null;
  /** Raw reply text or a link to it. The written proof. */
  evidence: string | null;
  notes: string | null;

  // --- manual economics sign-off (launch gate) ----------------------------
  economicsSignedOffBy: string | null;
  economicsSignedOffAt: string | null;
  economicsNotes: string | null;

  // --- bookkeeping --------------------------------------------------------
  /** True for rows created by the dry-run flow. Never mixed into real reporting. */
  isTest: boolean;
  /** Last send error, when a claimed send failed. Surfaced in the Outreach Queue. */
  lastSendError: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Fields an admin may set when creating or editing a record by hand. */
export interface PpcPermissionInput {
  merchantId: number;
  network: string;
  merchantName?: string;
  merchantSlug?: string | null;
  publisherId?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  country?: string | null;
  landingPage?: string | null;
  keywordsScope?: string | null;
  brandInAdText?: PpcBrandInAdText;
  notes?: string | null;
  isTest?: boolean;
}

export interface PagedPpcPermissions {
  items: PpcPermission[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** Row count per status across the *unfiltered* set, for the filter chips. */
  counts: Record<PpcPermissionStatus, number>;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Deliberately conservative address check. A malformed contact is better left
 * for a human to fix than emailed and bounced — and the same expression is used
 * as the query-level filter in the send claim, so it must be Mongo-safe too.
 */
export const PPC_EMAIL_PATTERN = "^[^\\s@]+@[^\\s@.]+\\.[^\\s@]+$";

export function isValidContactEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return new RegExp(PPC_EMAIL_PATTERN).test(email.trim());
}

/** Landing pages must be absolute http(s) URLs — they go straight into an ad. */
export const PPC_LANDING_PAGE_PATTERN = "^https?://";

export function isValidLandingPage(url: string | null | undefined): boolean {
  if (!url) return false;
  if (!new RegExp(PPC_LANDING_PAGE_PATTERN, "i").test(url.trim())) return false;
  try {
    new URL(url.trim());
    return true;
  } catch {
    return false;
  }
}

/** Registrable-ish host comparison: ignores `www.` and case. */
export function sameHost(a: string | null | undefined, b: string | null | undefined): boolean {
  const host = (u: string | null | undefined): string | null => {
    if (!u) return null;
    try {
      return new URL(u.trim()).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return null;
    }
  };
  const ha = host(a);
  const hb = host(b);
  return ha !== null && ha === hb;
}

/**
 * Add `n` business days to `date`, preserving the time of day.
 *
 * Weekends only — public holidays vary per merchant market and guessing them
 * wrong would delay outreach silently, so they are not modelled.
 */
export function addBusinessDays(date: Date, n: number): Date {
  const out = new Date(date.getTime());
  let remaining = Math.max(0, Math.trunc(n));
  while (remaining > 0) {
    out.setUTCDate(out.getUTCDate() + 1);
    const day = out.getUTCDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return out;
}

/** Days a FOLLOWED_UP row waits before it is swept to NO_RESPONSE. */
export const PPC_NO_RESPONSE_GRACE_DAYS = 7;

/** Business days between the initial request and the single follow-up. */
export const PPC_FOLLOWUP_BUSINESS_DAYS = 2;

/** True when this row's follow-up is due and has not been sent. */
export function isFollowupOverdue(p: PpcPermission, now = new Date()): boolean {
  if (p.status !== "REQUESTED") return false;
  if (p.followupSentAt || p.replyReceivedAt) return false;
  if (!p.followupAt) return false;
  return new Date(p.followupAt).getTime() <= now.getTime();
}

/** Human summary of where a record stands, for the queue list. */
export function describeNextAction(p: PpcPermission, now = new Date()): string {
  switch (p.status) {
    case "READY":
      if (!isValidContactEmail(p.contactEmail)) return "Needs a valid contact email";
      if (!isValidLandingPage(p.landingPage)) return "Needs a landing page URL";
      return "Initial request goes out on the next daily run";
    case "REQUESTED": {
      if (p.lastSendError) return `Send failed — needs a manual retry`;
      if (!p.followupAt) return "Awaiting reply";
      const due = new Date(p.followupAt);
      if (due.getTime() <= now.getTime()) return "Follow-up overdue";
      return `Follow-up due ${due.toISOString().slice(0, 10)}`;
    }
    case "FOLLOWED_UP":
      return "Awaiting reply — will close as no-response after the grace window";
    case "REVIEW_REPLY":
      return "Read the reply and record approve / refuse";
    case "APPROVED":
      return p.economicsSignedOffAt
        ? "Approved and signed off"
        : "Approved — economics sign-off still required before launch";
    default:
      return PPC_STATUS_META[p.status].hint;
  }
}
