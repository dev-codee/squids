import { formatMoney, type RegionConfig } from "../regions";

/** Recorded prices already have a currency. Only legacy USD values need FX. */
export function formatProductPrice(
  amount: number,
  currency: string | null | undefined,
  region: RegionConfig,
  usdRate: number,
): string {
  return currency
    ? formatMoney(amount, { ...region, currency })
    : formatMoney(amount * usdRate, region);
}
