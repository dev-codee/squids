/**
 * Identifier-first matching.
 *
 * The brief (p.14): "Match on identifiers first. Treat a title match as a
 * candidate for review, not a published equivalence. Keep an audit record for
 * manual matches and conflicting identifiers. Make a comparison claim only when
 * at least two independent retailers are covered."
 *
 * The rule this module enforces is narrow and absolute: **a title match is
 * never an exact match.** It is a candidate — displayable, clearly labelled,
 * queued for a person to decide — but it can never carry an exact-match claim
 * or gate a "lowest total" statement. Only identifier agreement, or a manual
 * match a named reviewer signed off, does that.
 */

import type { MatchAudit, ProductIdentity } from "./productIdentity";
import {
  identifiersAgree,
  hasStrongIdentifier,
  isPublishableExactMatch,
} from "./productIdentity";

/** What matching concluded about one candidate. */
export type MatchDecision =
  /** Publishable as the same item. */
  | "exact"
  /** Plausible but unproven — goes to the queue, shown only as a candidate. */
  | "review"
  /** Positively not the same item. */
  | "not-a-match";

/** Why a pair needs a person to look at it. */
export type ReviewBasis =
  /** Identifiers agree on a strong code but a variant field contradicts it. */
  | "identifier-conflict"
  /** Nothing but a normalised title links them. */
  | "title-only"
  /** One side carries no strong identifier at all. */
  | "missing-identifier";

export interface MatchCandidate extends ProductIdentity {
  id: number;
  advertiserId: number;
  title: string;
}

export interface MatchResult {
  candidateId: number;
  decision: MatchDecision;
  /** How the decision was reached. Only "identifier"/"manual" are publishable. */
  basis: MatchAudit["basis"];
  matchedOn: string[];
  conflicts: string[];
  reviewBasis: ReviewBasis | null;
  /** One line a reviewer can read without opening both records. */
  reason: string;
}

/** A reviewer's standing decision about a pair, keyed by {@link matchPairId}. */
export interface MatchRuling {
  pairId: string;
  status: "approved" | "rejected" | "split-variant" | "needs-data";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  notes?: string | null;
}

/** Stable, order-independent id for a pair of products. */
export function matchPairId(a: number, b: number): string {
  return a <= b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Normalise a product title into a match key.
 *
 * Only ever used to *propose* a candidate. Two records sharing a key are a
 * question for a reviewer, never an answer.
 */
export function productMatchKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Classify one candidate against the product being compared.
 *
 * Order matters: a reviewer's ruling outranks anything derived, because a
 * person looked at both records. Identifiers come next. Titles come last and
 * never reach "exact".
 */
export function classifyMatch(
  source: MatchCandidate,
  candidate: MatchCandidate,
  rulings: ReadonlyMap<string, MatchRuling> = new Map(),
): MatchResult {
  const base = {
    candidateId: candidate.id,
    matchedOn: [] as string[],
    conflicts: [] as string[],
    reviewBasis: null as ReviewBasis | null,
  };

  const ruling = rulings.get(matchPairId(source.id, candidate.id));
  if (ruling) {
    if (ruling.status === "approved") {
      const audit: MatchAudit = {
        basis: "manual",
        reviewedBy: ruling.reviewedBy ?? null,
        reviewedAt: ruling.reviewedAt ?? null,
      };
      // An approval with no named reviewer is not a signed-off match.
      return isPublishableExactMatch(audit)
        ? { ...base, decision: "exact", basis: "manual", reason: `Approved by ${ruling.reviewedBy}` }
        : {
            ...base,
            decision: "review",
            basis: "title",
            reviewBasis: "title-only",
            reason: "Approval is missing a reviewer name or date",
          };
    }
    if (ruling.status === "rejected" || ruling.status === "split-variant") {
      return {
        ...base,
        decision: "not-a-match",
        basis: "manual",
        reason:
          ruling.status === "split-variant"
            ? "Reviewer split these as different variants"
            : "Reviewer rejected this match",
      };
    }
    // "needs-data" falls through to the derived decision, which will be review.
  }

  const sourceStrong = hasStrongIdentifier(source);
  const candidateStrong = hasStrongIdentifier(candidate);

  if (sourceStrong && candidateStrong) {
    const { agree, matchedOn, conflicts } = identifiersAgree(source, candidate);
    if (agree) {
      return {
        ...base,
        decision: "exact",
        basis: "identifier",
        matchedOn,
        reason: `Identifiers agree on ${matchedOn.join(", ")}`,
      };
    }
    if (matchedOn.length > 0) {
      // A shared code with a contradicting variant field is exactly the case
      // the brief sends to review rather than resolving either way.
      return {
        ...base,
        decision: "review",
        basis: "title",
        matchedOn,
        conflicts,
        reviewBasis: "identifier-conflict",
        reason: `${matchedOn.join(", ")} agree but ${conflicts.join(", ")} conflict`,
      };
    }
    // Both carry strong identifiers and none of them agree: different items.
    return {
      ...base,
      decision: "not-a-match",
      basis: "identifier",
      conflicts,
      reason: conflicts.length
        ? `Identifiers conflict on ${conflicts.join(", ")}`
        : "No shared identifier between two identified products",
    };
  }

  // At least one side has no strong identifier, so nothing can prove equivalence.
  if (productMatchKey(source.title) !== productMatchKey(candidate.title)) {
    return {
      ...base,
      decision: "not-a-match",
      basis: "title",
      reason: "Titles do not match and no identifier links them",
    };
  }

  const missing = !sourceStrong && !candidateStrong;
  return {
    ...base,
    decision: "review",
    basis: "title",
    reviewBasis: missing ? "title-only" : "missing-identifier",
    reason: missing
      ? "Titles match; neither record carries a strong identifier"
      : `Titles match; ${sourceStrong ? "the candidate" : "this listing"} has no strong identifier`,
  };
}

/** Whether a result may be presented to a shopper as the same item. */
export function isExactMatch(result: MatchResult): boolean {
  return result.decision === "exact";
}

/**
 * Candidates to display, in the order a shopper should see them.
 *
 * Review candidates are kept — hiding them would shrink the comparison to
 * nothing for feeds with no identifiers — but they sort after exact matches and
 * must be rendered with their label.
 */
export function orderedMatches(results: readonly MatchResult[]): MatchResult[] {
  const rank = (r: MatchResult) => (r.decision === "exact" ? 0 : 1);
  return results
    .filter((r) => r.decision !== "not-a-match")
    .slice()
    .sort((a, b) => rank(a) - rank(b));
}

/**
 * Whether a comparison claim may be made at all.
 *
 * The brief's two-independent-retailer rule: the claim needs at least two
 * distinct retailers whose rows are exact matches. Title candidates do not
 * count towards it, however many there are.
 */
export function canClaimComparison(
  rows: readonly { result: MatchResult; advertiserId: number }[],
): boolean {
  const retailers = new Set(
    rows.filter((r) => isExactMatch(r.result)).map((r) => r.advertiserId),
  );
  return retailers.size >= 2;
}

/**
 * Pairs that belong in the review queue, deduplicated by pair id.
 * A pair a reviewer has already ruled on is not re-queued.
 */
export function pendingReviews(
  source: MatchCandidate,
  results: readonly MatchResult[],
  rulings: ReadonlyMap<string, MatchRuling> = new Map(),
): { pairId: string; result: MatchResult }[] {
  const seen = new Set<string>();
  const out: { pairId: string; result: MatchResult }[] = [];
  for (const result of results) {
    if (result.decision !== "review") continue;
    const pairId = matchPairId(source.id, result.candidateId);
    if (seen.has(pairId)) continue;
    const ruling = rulings.get(pairId);
    if (ruling && ruling.status !== "needs-data") continue;
    seen.add(pairId);
    out.push({ pairId, result });
  }
  return out;
}

/**
 * The audit record to stamp on a product when a match is used.
 * Nothing is written for a review candidate — there is nothing to attest to.
 */
export function auditFor(
  result: MatchResult,
  ruling?: MatchRuling | null,
): MatchAudit | null {
  if (result.decision !== "exact") return null;
  const manual = result.basis === "manual";
  return {
    basis: manual ? "manual" : "identifier",
    matchedOn: result.matchedOn.length ? result.matchedOn : undefined,
    reviewedBy: manual ? ruling?.reviewedBy ?? null : null,
    reviewedAt: manual ? ruling?.reviewedAt ?? null : null,
    conflictReason: result.conflicts.length ? result.conflicts.join(", ") : null,
  };
}
