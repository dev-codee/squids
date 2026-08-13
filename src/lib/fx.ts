/**
 * Foreign-exchange rates for per-region price conversion.
 *
 * Rates come from the free, key-less open.er-api.com endpoint (base = USD).
 * The result is cached by Next.js' `fetch` for 6 hours, so at most a handful of
 * lookups happen per day regardless of traffic. Every failure path degrades
 * gracefully to "no conversion" (the caller keeps the original amount), so a
 * flaky FX provider can never break price rendering.
 */

export type UsdRates = Record<string, number>;

const ENDPOINT = "https://open.er-api.com/v6/latest/USD";
const SIX_HOURS = 60 * 60 * 6;

/**
 * Fetch `units of <currency> per 1 USD` for every supported currency.
 * Returns an empty map on any error (callers treat that as "don't convert").
 */
export async function getUsdRates(): Promise<UsdRates> {
  try {
    const res = await fetch(ENDPOINT, { next: { revalidate: SIX_HOURS } });
    if (!res.ok) return {};
    const data = (await res.json()) as { result?: string; rates?: UsdRates };
    if (data.result !== "success" || !data.rates) return {};
    return data.rates;
  } catch {
    return {};
  }
}

/**
 * Convert `amount` from one currency to another using USD-based rates.
 * If either currency is missing from `rates`, the amount is returned unchanged.
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: UsdRates,
): number {
  if (from === to) return amount;
  const fromRate = from === "USD" ? 1 : rates[from];
  const toRate = to === "USD" ? 1 : rates[to];
  if (!fromRate || !toRate) return amount;
  const usd = amount / fromRate;
  return usd * toRate;
}
