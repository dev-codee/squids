import { notFound, redirect } from "next/navigation";
import { getHomeSettings } from "@/lib/db/homeSettings";
import { getRecentDeals, getPopularShops } from "@/lib/db/deals";
import AdvertisersClient from "./AdvertisersClient";

export const dynamic = "force-dynamic";

// 2-letter country code check
const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

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
