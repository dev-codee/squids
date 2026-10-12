import AlertStatusBanner from "@/components/common/AlertStatusBanner";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidRegionCode } from "@/lib/regions";
import PublicHeader from "@/components/store/PublicHeader";
import PublicFooter from "@/components/store/PublicFooter";
import CookieConsentBanner from "@/components/common/CookieConsentBanner";
import { getDictionary } from "@/i18n";
import { DictionaryProvider } from "@/i18n/DictionaryProvider";
import { CurrencyProvider } from "@/i18n/CurrencyProvider";
import {
  getRegionConfig,
  regionName,
  REGION_CODES,
} from "@/lib/regions";
import { convert, getUsdRates } from "@/lib/fx";

/**
 * Per-region Open Graph locale and geo meta tags. Page-specific canonical
 * URLs and hreflang alternates are owned by each page. This is what makes `/de`, `/us`,
 * `/pk` etc. each advertise their own locale, currency and geography to crawlers.
 */
export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  if (!isValidRegionCode(params.country)) notFound();
  const region = getRegionConfig(params.country);
  const ogLocale = region.locale.replace("-", "_");

  const alternateLocales = REGION_CODES.filter(
    (c) => c !== region.country,
  ).map((c) => getRegionConfig(c).locale.replace("-", "_"));

  return {

    openGraph: {
      type: "website",
      siteName: "Foxzil",
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
  if (!isValidRegionCode(params.country)) notFound();
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
        <AlertStatusBanner />
        {children}
        <PublicFooter country={region.country} dict={dictionary} />
        <CookieConsentBanner country={region.country} />
      </CurrencyProvider>
    </DictionaryProvider>
  );
}
