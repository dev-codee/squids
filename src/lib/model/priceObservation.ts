/**
 * Price observation entity and like-for-like series modeling.
 *
 * The brief (p.27):
 * "History starts at first real observation; like-for-like series;
 * corrections recorded; no synthetic 'was' prices."
 */

export interface PriceObservation {
  id: string; // Unique observation key: `${productId}:${retailerId}:${observedAt}`
  productId: number;
  market: string;
  retailerId: number | string;
  retailerName: string;
  itemPrice: number;
  deliveredTotal?: number | null;
  currency: string;
  observedAt: string; // ISO 8601 string
  sourceBatchId?: string | null;
  isCorrection?: boolean;
  originalValue?: number | null;
  correctionReason?: string | null;
  correctedBy?: string | null;
}

export interface PriceHistorySeries {
  productId: number;
  market: string;
  currency: string;
  observations: PriceObservation[];
  minPrice: number;
  maxPrice: number;
  latestPrice: number;
  firstObservedAt: string;
  lastObservedAt: string;
}

/**
 * Sorts observations chronologically, oldest first.
 */
export function sortObservationsChronological(
  observations: readonly PriceObservation[],
): PriceObservation[] {
  return [...observations].sort(
    (a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime(),
  );
}

/**
 * Summarises like-for-like price observations into a series with real boundary metrics.
 * Returns null if no observations exist.
 */
export function buildPriceHistorySeries(
  productId: number,
  market: string,
  currency: string,
  observations: readonly PriceObservation[],
): PriceHistorySeries | null {
  if (observations.length === 0) return null;

  const sorted = sortObservationsChronological(observations);
  const prices = sorted.map((o) => o.itemPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const latestPrice = sorted[sorted.length - 1].itemPrice;

  return {
    productId,
    market,
    currency,
    observations: sorted,
    minPrice,
    maxPrice,
    latestPrice,
    firstObservedAt: sorted[0].observedAt,
    lastObservedAt: sorted[sorted.length - 1].observedAt,
  };
}
