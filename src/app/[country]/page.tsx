import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getHomeSettings } from "@/lib/db/homeSettings";
import { getRecentDeals, getPopularShops } from "@/lib/db/deals";
import { getProductsFromDb } from "@/lib/db/products";
import type { Product } from "@/lib/products";
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
  const dict = await getDictionary(country);

  const hreflang: Record<string, string> = {};
  for (const code of REGION_CODES) {
    const r = getRegionConfig(code);
    hreflang[r.locale] = `${siteUrl}/${code.toLowerCase()}`;
  }
  hreflang["x-default"] = `${siteUrl}/us`;

  const title = dict.meta.homeTitle.replace("{country}", name);
  const description = dict.meta.homeDescription.replace("{country}", name);

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/${params.country.toLowerCase()}`,
      languages: hreflang,
    },
    openGraph: {
      title,
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
  // `?tab=products` puts the hero on the product search, and filters the
  // "Compare before you buy" row by the same query.
  const tab = searchParams.tab === "products" ? "products" : "stores";
  const country = rawCountry.toUpperCase();

  const [homeSettings, recentDeals, popularShops, products] = await Promise.all([
    getHomeSettings(),
    getRecentDeals(10, country),
    getPopularShops({ minDeals: 10, limit: 8, country }),
    // Products are optional content — an unreachable/empty collection simply
    // hides the comparison row rather than failing the page.
    getProductsFromDb({
      pageSize: 6,
      search: tab === "products" ? search : undefined,
    })
      .then((r) => r.products)
      .catch(() => [] as Product[]),
  ]);

  return (
    <AdvertisersClient
      country={country}
      initialSearch={search}
      initialTab={tab}
      homeSettings={homeSettings}
      recentDeals={recentDeals}
      popularShops={popularShops}
      products={products}
    />
  );
}
