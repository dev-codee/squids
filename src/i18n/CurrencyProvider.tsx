"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { RegionConfig } from "@/lib/regions";
import { formatProductPrice } from "@/lib/model/productPrice";

/**
 * Client-side currency context for the current region.
 *
 * The server (region layout) computes the region + a single USD→region rate and
 * passes them down. Recorded product currencies are formatted as supplied;
 * legacy amounts without a currency retain the USD conversion.
 */
interface CurrencyContextValue {
  region: RegionConfig;
  /** Units of the region currency per 1 USD (1 = no conversion available). */
  usdRate: number;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({
  region,
  usdRate,
  children,
}: CurrencyContextValue & { children: React.ReactNode }) {
  const value = useMemo(() => ({ region, usdRate }), [region, usdRate]);
  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  // Sensible USD default so components render even outside a provider.
  const region = ctx?.region ?? { country: "US", currency: "USD", locale: "en-US" };
  const usdRate = ctx?.usdRate ?? 1;

  return {
    region,
    /** Preserve a recorded currency; convert legacy USD amounts when omitted. */
    format(amount: number, currency?: string | null): string {
      return formatProductPrice(amount, currency, region, usdRate);
    },
  };
}
