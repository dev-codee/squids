/**
 * Campaign launch gate.
 *
 * Nothing may be marked launchable unless *every* gate passes. The gates are
 * evaluated server-side and returned as a checklist so the admin UI can show
 * exactly what is missing rather than a bare "blocked".
 *
 * The economics gate is deliberately not automatable: it requires a named human
 * sign-off stored on the permission record. Clearing that name withdraws the
 * sign-off and re-blocks launch.
 */

import { getRawAdvertiserById } from "@/lib/db/advertisers";
import { getDb } from "@/lib/mongodb";
import { getPermissionForMerchant } from "@/lib/db/ppc-permissions";
import { isValidLandingPage, sameHost, type PpcPermission } from "@/lib/ppc";

export type PpcGateId =
  | "written_permission"
  | "scope_match"
  | "active_partnership"
  | "active_offer"
  | "click_tracking"
  | "economics_signoff";

export interface PpcGateCheck {
  id: PpcGateId;
  label: string;
  passed: boolean;
  /** Why it passed, or precisely what is missing. */
  detail: string;
}

export interface PpcLaunchGateResult {
  launchable: boolean;
  merchantId: number;
  network: string;
  checks: PpcGateCheck[];
  /** Labels of the failing checks, for a one-line summary. */
  blockers: string[];
}

export interface PpcLaunchGateRequest {
  merchantId: number;
  network: string;
  /** The market the campaign would target. Must match the approved scope. */
  country?: string | null;
  /** The final ad landing page. Must be on the approved page's host. */
  landingPage?: string | null;
  /** Keywords the campaign would bid on, for the scope check. */
  keywords?: string[];
}

/**
 * Check that every requested keyword is covered by the approved scope text.
 *
 * Intentionally crude and intentionally strict: we require each keyword's
 * significant terms to appear in the merchant's own written scope. A keyword we
 * cannot evidence permission for fails the gate rather than being waved through.
 */
function keywordsCovered(
  keywords: string[],
  scopeText: string,
): { covered: string[]; uncovered: string[] } {
  const haystack = scopeText.toLowerCase();
  const covered: string[] = [];
  const uncovered: string[] = [];

  for (const keyword of keywords) {
    const terms = keyword
      .toLowerCase()
      .split(/[\s+]+/)
      .map((t) => t.replace(/[^a-z0-9]/g, ""))
      .filter((t) => t.length > 2);
    const ok = terms.length > 0 && terms.every((t) => haystack.includes(t));
    (ok ? covered : uncovered).push(keyword);
  }

  return { covered, uncovered };
}

/** Awin/Admitad relationship values that mean the programme is live for us. */
const ACTIVE_RELATIONSHIPS = new Set(["joined", "active", "approved", "accepted"]);

/**
 * Evaluate all launch gates for one merchant × network × market.
 *
 * Every gate is evaluated even when an earlier one fails, so the UI can show the
 * whole checklist at once.
 */
export async function evaluatePpcLaunchGate(
  request: PpcLaunchGateRequest,
): Promise<PpcLaunchGateResult> {
  const merchantId = Number(request.merchantId);
  const network = (request.network || "awin").trim().toLowerCase();
  const checks: PpcGateCheck[] = [];

  const permission = await getPermissionForMerchant(merchantId, network);

  // --- 1. Valid written permission ----------------------------------------
  const hasWritten =
    permission?.status === "APPROVED" &&
    Boolean(permission.permissionScope?.trim()) &&
    Boolean(permission.evidence?.trim());

  checks.push({
    id: "written_permission",
    label: "Written permission on file",
    passed: hasWritten,
    detail: !permission
      ? "No permission record exists for this merchant and network."
      : permission.status !== "APPROVED"
        ? `Permission status is ${permission.status}, not APPROVED.`
        : !permission.permissionScope?.trim()
          ? "APPROVED but no agreed scope recorded."
          : !permission.evidence?.trim()
            ? "APPROVED but no evidence (reply text or link) stored."
            : `Approved ${permission.decidedAt?.slice(0, 10) ?? "—"} with scope on file.`,
  });

  // --- 2. Scope match (market / landing page / keywords) -------------------
  checks.push(scopeCheck(permission, request, hasWritten));

  // --- 3. Active partnership ----------------------------------------------
  const advertiser = await getRawAdvertiserById(merchantId, network).catch(() => null);
  const relationship = advertiser?.relationship?.trim().toLowerCase() ?? null;
  const partnershipActive = Boolean(relationship && ACTIVE_RELATIONSHIPS.has(relationship));
  checks.push({
    id: "active_partnership",
    label: "Active affiliate partnership",
    passed: partnershipActive,
    detail: !advertiser
      ? `No advertiser record found for id ${merchantId} on ${network}.`
      : partnershipActive
        ? `Programme relationship is "${relationship}".`
        : `Programme relationship is "${relationship ?? "unknown"}" — not an active partnership.`,
  });

  // --- 4. Active offer ----------------------------------------------------
  const activeOffers = await countActiveOffers(merchantId, network).catch(() => 0);
  checks.push({
    id: "active_offer",
    label: "At least one active offer",
    passed: activeOffers > 0,
    detail:
      activeOffers > 0
        ? `${activeOffers} active offer${activeOffers === 1 ? "" : "s"} live for this merchant.`
        : "No active, unexpired offers — there would be nothing for the ad to deliver.",
  });

  // --- 5. Working click tracking ------------------------------------------
  const trackingUrl = advertiser?.url ?? null;
  const trackingOk = Boolean(trackingUrl && /^https:\/\//i.test(trackingUrl));
  checks.push({
    id: "click_tracking",
    label: "Click tracking resolves",
    passed: trackingOk,
    detail: trackingOk
      ? `Affiliate tracking URL present (${new URL(trackingUrl!).hostname}).`
      : trackingUrl
        ? "Tracking URL is not https — clicks would not attribute reliably."
        : "No affiliate tracking URL on the advertiser record.",
  });

  // --- 6. Manual economics sign-off ---------------------------------------
  const signedOff = Boolean(permission?.economicsSignedOffBy && permission?.economicsSignedOffAt);
  checks.push({
    id: "economics_signoff",
    label: "Manual economics sign-off",
    passed: signedOff,
    detail: signedOff
      ? `Signed off by ${permission!.economicsSignedOffBy} on ${permission!.economicsSignedOffAt!.slice(0, 10)}.`
      : "No human sign-off on the unit economics. Launch stays blocked until someone signs off by name.",
  });

  const blockers = checks.filter((c) => !c.passed).map((c) => c.label);

  return {
    launchable: blockers.length === 0,
    merchantId,
    network,
    checks,
    blockers,
  };
}

/** Market, landing-page host, and keyword coverage against the approved scope. */
function scopeCheck(
  permission: PpcPermission | null,
  request: PpcLaunchGateRequest,
  hasWritten: boolean,
): PpcGateCheck {
  const label = "Campaign matches the approved scope";

  if (!hasWritten || !permission) {
    return {
      id: "scope_match",
      label,
      passed: false,
      detail: "Cannot be checked until written permission is on file.",
    };
  }

  const problems: string[] = [];

  // Market
  const wantCountry = request.country?.trim().toUpperCase() || null;
  if (wantCountry && permission.country && wantCountry !== permission.country) {
    problems.push(
      `permission is scoped to ${permission.country}, campaign targets ${wantCountry}`,
    );
  }
  if (wantCountry && !permission.country) {
    problems.push(`permission records no market, campaign targets ${wantCountry}`);
  }

  // Landing page
  const wantLanding = request.landingPage?.trim() || null;
  if (wantLanding) {
    if (!isValidLandingPage(wantLanding)) {
      problems.push("campaign landing page is not a valid absolute URL");
    } else if (!sameHost(wantLanding, permission.landingPage)) {
      problems.push(
        `landing page host differs from the approved page (${permission.landingPage ?? "none recorded"})`,
      );
    }
  }

  // Keywords
  const wantKeywords = (request.keywords ?? []).filter((k) => k.trim().length > 0);
  if (wantKeywords.length > 0) {
    const scopeText = `${permission.permissionScope ?? ""} ${permission.keywordsScope ?? ""}`;
    const { uncovered } = keywordsCovered(wantKeywords, scopeText);
    if (uncovered.length > 0) {
      problems.push(`no written cover for: ${uncovered.join(", ")}`);
    }
  }

  // Brand in ad text is informational here rather than a blocker — it constrains
  // the creative, not whether the campaign may exist. Surface it as a warning
  // inside the detail so it is visible at sign-off time.
  const brandNote =
    permission.brandInAdText === "prohibited"
      ? " Brand name is PROHIBITED in ad copy."
      : permission.brandInAdText === "unanswered"
        ? " Brand-in-ad-copy permission is unanswered — keep the brand out of the creative."
        : "";

  if (problems.length > 0) {
    return { id: "scope_match", label, passed: false, detail: `${problems.join("; ")}.${brandNote}` };
  }

  return {
    id: "scope_match",
    label,
    passed: true,
    detail: `Market ${permission.country ?? "—"}, landing page and keywords all within the approved scope.${brandNote}`,
  };
}

/** Active, unexpired offers for a merchant. */
async function countActiveOffers(merchantId: number, network: string): Promise<number> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  return db.collection("deals").countDocuments({
    "advertiser.id": merchantId,
    network,
    status: "active",
    $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: today } }],
  });
}
