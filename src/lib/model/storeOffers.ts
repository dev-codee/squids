/** A real code belongs in Coupons, regardless of a legacy feed's type label.
 * Product promotions keep their product presentation; other offers are no-code deals. */
export function splitStoreOffers<T extends { type: string; code?: string | null }>(offers: readonly T[]) {
  const coupons: T[] = [];
  const deals: T[] = [];
  const promotions: T[] = [];
  for (const offer of offers) {
    if (offer.code?.trim()) coupons.push(offer);
    else if (offer.type === "promotion") promotions.push(offer);
    else deals.push(offer);
  }
  return { coupons, deals, promotions };
}

/** Coupon subpages must display each coupon once, even when verified or a perk. */
export function groupStoreCoupons<T extends { verified: boolean; type: string }>(coupons: readonly T[]) {
  const verified: T[] = [];
  const codes: T[] = [];
  const students: T[] = [];
  const cashback: T[] = [];
  for (const coupon of coupons) {
    if (coupon.verified) verified.push(coupon);
    else if (coupon.type === "student") students.push(coupon);
    else if (coupon.type === "cashback") cashback.push(coupon);
    else codes.push(coupon);
  }
  return { verified, codes, students, cashback };
}
