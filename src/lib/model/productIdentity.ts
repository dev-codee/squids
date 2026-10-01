/**
 * Exact product identity.
 *
 * The brief: "Stable product ID; GTIN where valid; brand; model/MPN; size;
 * colour/flavour; pack count; condition; regional specification; category. Keep
 * an audit record for manual matches and conflicting identifiers."
 *
 * Without these fields the only way to decide two retailers list the same thing
 * is to compare titles, which the brief forbids publishing as an exact match.
 * This is the data that lets matching become identifier-first.
 */

export type ProductCondition = "new" | "refurbished" | "used" | "unknown";

/** A product identifier and where it came from, so conflicts stay explainable. */
export interface ProductIdentifier {
  /** GTIN-8/12/13/14, EAN, UPC, ISBN, or a merchant's own SKU. */
  kind: "gtin" | "mpn" | "sku" | "asin" | "isbn";
  value: string;
  source: string;
  recordedAt: string;
}

/** How a product record came to be treated as the same item as another. */
export interface MatchAudit {
  /** "identifier" is publishable as exact; "title" and "manual" are not, alone. */
  basis: "identifier" | "manual" | "title";
  /** Which identifier kinds agreed, when basis is "identifier". */
  matchedOn?: string[];
  /** Reviewer who approved a manual match. Required when basis is "manual". */
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  /** Why this needed review — conflicting pack size, same brand different item… */
  conflictReason?: string | null;
  /** Free-text evidence the reviewer recorded. */
  notes?: string | null;
}

/**
 * Identity fields added to a product record.
 *
 * All optional: existing products predate this and backfill cannot invent
 * values. Absent means unknown, and unknown means the product is not eligible
 * for an identifier-based exact-match claim.
 */
export interface ProductIdentity {
  gtin?: string | null;
  brand?: string | null;
  /** Manufacturer part number / model. */
  mpn?: string | null;
  /** Pack size as sold, e.g. "30 ml", "500 g". */
  size?: string | null;
  colour?: string | null;
  flavour?: string | null;
  /** Units in the pack. 1 for a single item. */
  packCount?: number | null;
  condition?: ProductCondition | null;
  /** Regional specification, e.g. "AU plug", "EU voltage". */
  regionalSpec?: string | null;
  /** Market this record's price and availability apply to. */
  market?: string | null;
  /** All identifiers seen for this product, including conflicting ones. */
  identifiers?: ProductIdentifier[];
  matchAudit?: MatchAudit | null;
}

/** Identifier kinds strong enough to assert two records are the same product. */
const STRONG_KINDS: ReadonlySet<string> = new Set(["gtin", "isbn", "asin", "mpn"]);

/**
 * Whether two products can be declared the same item on identifiers alone.
 *
 * Requires a shared strong identifier **and** no contradiction on the variant
 * fields we hold. The brief: "A matching GTIN with conflicting product detail
 * requires review."
 */
export function identifiersAgree(
  a: ProductIdentity,
  b: ProductIdentity,
): { agree: boolean; matchedOn: string[]; conflicts: string[] } {
  const matchedOn: string[] = [];
  const conflicts: string[] = [];

  if (a.gtin && b.gtin) {
    if (normalizeGtin(a.gtin) === normalizeGtin(b.gtin)) matchedOn.push("gtin");
    else conflicts.push("gtin");
  }
  if (a.mpn && b.mpn) {
    if (norm(a.mpn) === norm(b.mpn)) matchedOn.push("mpn");
    else conflicts.push("mpn");
  }
  if (a.brand && b.brand && norm(a.brand) !== norm(b.brand)) conflicts.push("brand");

  for (const [field, left, right] of [
    ["size", a.size, b.size],
    ["colour", a.colour, b.colour],
    ["flavour", a.flavour, b.flavour],
    ["regionalSpec", a.regionalSpec, b.regionalSpec],
  ] as const) {
    if (left && right && norm(left) !== norm(right)) conflicts.push(field);
  }

  if (
    typeof a.packCount === "number" &&
    typeof b.packCount === "number" &&
    a.packCount !== b.packCount
  ) {
    conflicts.push("packCount");
  }

  const aCond = a.condition ?? "unknown";
  const bCond = b.condition ?? "unknown";
  if (aCond !== "unknown" && bCond !== "unknown" && aCond !== bCond) {
    conflicts.push("condition");
  }

  const strong = matchedOn.some((kind) => STRONG_KINDS.has(kind));
  return { agree: strong && conflicts.length === 0, matchedOn, conflicts };
}

/** Whether a product carries enough identity to take part in exact matching. */
export function hasStrongIdentifier(p: ProductIdentity): boolean {
  if (p.gtin && isPlausibleGtin(p.gtin)) return true;
  if (p.mpn && p.brand) return true;
  return (p.identifiers ?? []).some((i) => STRONG_KINDS.has(i.kind) && i.value.trim() !== "");
}

/**
 * Whether a comparison row may be labelled an exact match in public.
 * Identifier agreement, or a manual match a named reviewer signed off.
 */
export function isPublishableExactMatch(audit: MatchAudit | null | undefined): boolean {
  if (!audit) return false;
  if (audit.basis === "identifier") return true;
  if (audit.basis === "manual") return Boolean(audit.reviewedBy && audit.reviewedAt);
  return false;
}

function norm(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Strip separators; a GTIN-13 and its zero-padded GTIN-14 are the same code. */
function normalizeGtin(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/^0+(?=\d{8,})/, "");
}

export function isPlausibleGtin(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return [8, 12, 13, 14].includes(digits.length);
}
