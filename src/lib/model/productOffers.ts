import type { Known } from "./known";
export interface ComparableProductOffer {
  productId: number;
  retailerKey?: string;
  retailerName: string;
  currency: string;
  inStock: boolean;
  matchBasis: "source" | "identifier" | "manual" | "title";
  breakdown: { itemPrice: Known<number>; total: Known<number> };
}
export function selectProductOffers<T extends ComparableProductOffer>(offers: readonly T[], currency: string, sort: "total" | "item" | "retailer", inStockOnly: boolean) {
  const filtered = offers.filter(o => o.currency === currency && (!inStockOnly || o.inStock));
  const eligible = filtered.filter(o=>o.inStock && o.matchBasis!=="title" && o.breakdown.total.known).sort((a,b)=>amount(a.breakdown.total)-amount(b.breakdown.total));
  const distinctRetailers = new Set(eligible.map(o=>o.retailerKey ?? String(o.productId)));
  const bestId = distinctRetailers.size >= 2 ? eligible[0]?.productId : undefined;
  const ordered = [...filtered].sort((a,b)=>{
    if (a.matchBasis === "title" && b.matchBasis !== "title") return 1;
    if (b.matchBasis === "title" && a.matchBasis !== "title") return -1;
    if (sort === "retailer") return a.retailerName.localeCompare(b.retailerName);
    const first = amount(sort==="total"?a.breakdown.total:a.breakdown.itemPrice);
    const second = amount(sort==="total"?b.breakdown.total:b.breakdown.itemPrice);
    return first===second ? a.retailerName.localeCompare(b.retailerName) : first-second;
  });
  return { ordered, bestId };
}
function amount(value: Known<number>): number {
  return value.known && Number.isFinite(value.value) ? value.value : Infinity;
}
