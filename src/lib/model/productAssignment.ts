import { normalizeCountryCode } from "../countries";

interface ProductMerchant {
  id: number;
  network: string;
  countryCode?: string | null;
  countryCodes?: string[];
  currencyCode?: string | null;
}

interface Assignment {
  advertiserId: number;
  network?: string;
  regionCodes?: string[];
  market?: string | null;
  currency?: string | null;
}

export class ProductAssignmentError extends Error {}

export function selectProductMerchant(merchants: ProductMerchant[], network?: string): ProductMerchant {
  const matches = network ? merchants.filter(m => m.network === network) : merchants;
  if (matches.length !== 1) {
    throw new ProductAssignmentError(matches.length
      ? "Select the advertiser and its network from the search results."
      : "The selected advertiser was not found. Please select it again.");
  }
  return matches[0];
}

export function merchantProductRegions(merchant: ProductMerchant): string[] {
  return Array.from(new Set([merchant.countryCode, ...(merchant.countryCodes ?? [])]
    .map(normalizeCountryCode)
    .filter(code => /^[A-Z]{2}$/.test(code) && code !== "WW")));
}

/** Store ownership includes the network; numeric advertiser IDs alone are not unique. */
export function productAssignment(
  merchant: ProductMerchant,
  input: { regionCodes?: string[]; currency?: string | null },
  existing?: Assignment,
): Assignment {
  const changed = !existing || existing.advertiserId !== merchant.id || existing.network !== merchant.network;
  const regions = input.regionCodes ?? (changed || !existing.regionCodes?.length ? merchantProductRegions(merchant) : existing.regionCodes);
  const regionCodes = Array.from(new Set((regions ?? merchantProductRegions(merchant)).map(normalizeCountryCode)));
  if (!regionCodes.length || regionCodes.some(code => !/^[A-Z]{2}$/.test(code) || code === "WW")) {
    throw new ProductAssignmentError("Enter the product's country codes. Worldwide stores require explicit product markets.");
  }
  const currency = (input.currency?.trim() || existing?.currency || merchant.currencyCode)?.toUpperCase() || null;
  if (currency && !/^[A-Z]{3}$/.test(currency)) {
    throw new ProductAssignmentError("Currency must be a three-letter currency code.");
  }
  return {
    advertiserId: merchant.id,
    network: merchant.network,
    regionCodes,
    market: regionCodes.length === 1 ? regionCodes[0] : existing?.market && regionCodes.includes(existing.market) ? existing.market : null,
    currency,
  };
}
