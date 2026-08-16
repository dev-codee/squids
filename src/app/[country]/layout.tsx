import type { Metadata } from "next";
import PublicHeader from "@/components/store/PublicHeader";
import PublicFooter from "@/components/store/PublicFooter";
import { getDictionary } from "@/i18n";
import { DictionaryProvider } from "@/i18n/DictionaryProvider";
import { CurrencyProvider } from "@/i18n/CurrencyProvider";
import {
  getRegionConfig,
  getSiteUrl,
  regionName,
  REGION_CODES,
} from "@/lib/regions";
import { convert, getUsdRates } from "@/lib/fx";

/**
 * Per-region metadata: canonical URL, hreflang alternates for every configured
 * region, Open Graph locale, and geo meta tags. This is what makes `/de`, `/us`,
 * `/pk` etc. each advertise their own locale, currency and geography to crawlers.
 */
export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  const region = getRegionConfig(params.country);
  const site = getSiteUrl();
  const path = `/${region.country.toLowerCase()}`;
  const ogLocale = region.locale.replace("-", "_");

  // hreflang: one entry per configured region, plus x-default at the root.
  const languages: Record<string, string> = {};
  for (const code of REGION_CODES) {
    const r = getRegionConfig(code);
    languages[r.locale] = `${site}/${code.toLowerCase()}`;
  }
  languages["x-default"] = site;

  const alternateLocales = REGION_CODES.filter(
    (c) => c !== region.country,
  ).map((c) => getRegionConfig(c).locale.replace("-", "_"));

  return {
    alternates: {
      canonical: `${site}${path}`,
      languages,
    },
    openGraph: {
      type: "website",
      siteName: "Foxzil",
      url: `${site}${path}`,
      locale: ogLocale,
      alternateLocale: alternateLocales,
    },
    other: {
      "geo.region": region.country,
      "geo.placename": regionName(region),
      "content-language": region.locale,
      currency: region.currency,
    },
  };
}

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { country: string };
}) {
  const region = getRegionConfig(params.country);
  const [dictionary, rates] = await Promise.all([
    getDictionary(params.country),
    getUsdRates(),
  ]);
  // USD → region rate for client-side price formatting (1 when unavailable).
  const usdRate = convert(1, "USD", region.currency, rates);

  return (
    <DictionaryProvider dictionary={dictionary}>
      <CurrencyProvider region={region} usdRate={usdRate}>
        <PublicHeader country={region.country} />
        {children}
        <PublicFooter country={region.country} />
      </CurrencyProvider>
    </DictionaryProvider>
  );
}
