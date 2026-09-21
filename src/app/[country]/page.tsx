import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getHomeSettings } from "@/lib/db/homeSettings";
import { getRecentDeals, getPopularShops } from "@/lib/db/deals";
import AdvertisersClient from "./AdvertisersClient";
import { getDictionary } from "@/i18n";
import { getSiteUrl, REGION_CODES, getRegionConfig } from "@/lib/regions";
import { countryName } from "@/lib/countries";

export const dynamic = "force-dynamic";

// 2-letter country code check
const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  if (!COUNTRY_CODE_RE.test(params.country)) return {};
  const country = params.country.toUpperCase();
  const siteUrl = getSiteUrl();
  const name = countryName(country);

  const hreflang: Record<string, string> = {};
  for (const code of REGION_CODES) {
    const r = getRegionConfig(code);
    hreflang[r.locale] = `${siteUrl}/${code.toLowerCase()}`;
  }
  hreflang["x-default"] = `${siteUrl}/us`;

  return {
    title: `${name} Coupon Codes & Deals · FoxZil`,
    description: `Browse verified coupon codes, promo codes and deals for ${name}. Save on top stores with FoxZil.`,
    alternates: {
      canonical: `${siteUrl}/${params.country.toLowerCase()}`,
      languages: hreflang,
    },
    openGraph: {
      title: `${name} Coupon Codes & Deals · FoxZil`,
      url: `${siteUrl}/${params.country.toLowerCase()}`,
    },
  };
}

export default async function CountryHomePage({
  params,
  searchParams,
}: {
  params: { country: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const rawCountry = params.country;

  if (!COUNTRY_CODE_RE.test(rawCountry)) {
    // Fallback: If it's not a 2-letter country code, it might be an old store slug.
    // Redirect to US as a default to prevent 404s on old links.
    redirect(`/us/${rawCountry.toLowerCase()}`);
  }

  const search = typeof searchParams.search === "string" ? searchParams.search : "";
  const country = rawCountry.toUpperCase();
  const [homeSettings, recentDeals, popularShops] = await Promise.all([
    getHomeSettings(),
    getRecentDeals(10, country),
    getPopularShops({ minDeals: 10, limit: 8, country }),
  ]);
  return (
    <AdvertisersClient
      country={country}
      initialSearch={search}
      homeSettings={homeSettings}
      recentDeals={recentDeals}
      popularShops={popularShops}
    />
  );
}
