/**
 * Known / unknown values.
 *
 * The design brief is explicit that an unknown cost is a distinct value and
 * never zero: "Unknown is a distinct value, never zero", and "Unknown import
 * duties or mandatory charges prevent a complete-total claim."
 *
 * A plain `number | null` invites `?? 0` at the call site, which silently turns
 * "we have no idea what delivery costs" into "delivery is free" — the exact
 * class of bug that produced the free-delivery badge beside a paid delivery
 * term in the earlier audit. This tagged union makes that mistake impossible to
 * write: you cannot read `.value` without first proving `known === true`.
 */

/** Why a value is not known. Recorded so the UI can explain, not just blank out. */
export type UnknownReason =
  /** No source has supplied it yet. */
  | "not-sourced"
  /** The source gave conflicting values that need review. */
  | "conflicting"
  /** We held a value but it is older than this source's maximum age. */
  | "stale"
  /** It depends on shopper details we have not been given (e.g. postcode). */
  | "needs-shopper-input"
  /** It genuinely does not apply to this offer. */
  | "not-applicable";

export type Known<T> =
  | { readonly known: true; readonly value: T }
  | { readonly known: false; readonly reason: UnknownReason };

export function known<T>(value: T): Known<T> {
  return { known: true, value };
}

export function unknown<T = never>(reason: UnknownReason = "not-sourced"): Known<T> {
  return { known: false, reason };
}

export function isKnown<T>(k: Known<T>): k is { known: true; value: T } {
  return k.known;
}

/** Read the value, or a caller-supplied fallback. Never defaults to zero for you. */
export function valueOr<T>(k: Known<T>, fallback: T): T {
  return k.known ? k.value : fallback;
}

/** Apply a function to a known value, propagating the unknown reason otherwise. */
export function mapKnown<T, U>(k: Known<T>, fn: (value: T) => U): Known<U> {
  return k.known ? known(fn(k.value)) : k;
}

/**
 * Convert a nullable number from a feed or form into a `Known`.
 * `null`/`undefined`/`NaN` become unknown — not zero.
 */
export function fromNullable(
  value: number | null | undefined,
  reason: UnknownReason = "not-sourced",
): Known<number> {
  return typeof value === "number" && Number.isFinite(value)
    ? known(value)
    : unknown(reason);
}

/**
 * Sum cost components.
 *
 * **One unknown component makes the whole total unknown.** This is the rule that
 * keeps an item price from being presented as a delivered total: if delivery is
 * not known, there is no known delivered total, and the offer must be excluded
 * from any lowest-known-total claim.
 *
 * An empty list sums to a known zero — nothing to pay is a fact, not a gap.
 */
export function sumKnown(parts: readonly Known<number>[]): Known<number> {
  let total = 0;
  for (const part of parts) {
    if (!part.known) return unknown(part.reason);
    total += part.value;
  }
  return known(total);
}

/**
 * The lowest of a set of known values, ignoring unknown ones.
 *
 * Callers must state that the comparison covers only the entries whose value is
 * known — the brief requires explaining missing coverage rather than quietly
 * ranking a partial set as if it were complete.
 */
export function lowestKnown<T>(
  items: readonly T[],
  pick: (item: T) => Known<number>,
): { item: T; value: number } | null {
  let best: { item: T; value: number } | null = null;
  for (const item of items) {
    const k = pick(item);
    if (!k.known) continue;
    if (!best || k.value < best.value) best = { item, value: k.value };
  }
  return best;
}

/** How many entries in a set carry a known value — the "N known totals" count. */
export function countKnown<T>(
  items: readonly T[],
  pick: (item: T) => Known<number>,
): number {
  return items.reduce((n, item) => (pick(item).known ? n + 1 : n), 0);
}
