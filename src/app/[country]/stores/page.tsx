import { getPublicAdvertisers } from "@/lib/db/advertisers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import AdvertisersClient from "../AdvertisersClient";
import { getSiteUrl, REGION_CODES, getRegionConfig } from "@/lib/regions";
import { countryName } from "@/lib/countries";
import { getDictionary } from "@/i18n";

export const dynamic = "force-dynamic";

// 2-letter country code check
const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

export async function generateMetadata({
  params, searchParams,
}: {
  params: { country: string };
  searchParams: { [key: string]: string | string[] | undefined };
}): Promise<Metadata> {
  if (!COUNTRY_CODE_RE.test(params.country)) return {};
  const country = params.country.toUpperCase();
  const siteUrl = getSiteUrl();
  const name = countryName(country);
  const dict = await getDictionary(country);

  const hreflang: Record<string, string> = {};
  for (const code of REGION_CODES) {
    const r = getRegionConfig(code);
    hreflang[r.locale] = `${siteUrl}/${code.toLowerCase()}/stores`;
  }
  hreflang["x-default"] = `${siteUrl}/us/stores`;

  const page = Math.max(1, parseInt(String(searchParams.page || "1"), 10) || 1);
  return {
    robots: searchParams.search ? { index: false, follow: true } : { index: true, follow: true },
    title: dict.meta.storesTitle.replace("{country}", name),
    description: dict.meta.storesDescription.replace("{country}", name),
    alternates: {
      canonical: `${siteUrl}/${params.country.toLowerCase()}/stores${page > 1 ? `?page=${page}` : ""}`,
      languages: hreflang,
    },
  };
}

export default async function StoresPage({
  params,
  searchParams,
}: {
  params: { country: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const rawCountry = params.country;
  if (!COUNTRY_CODE_RE.test(rawCountry)) notFound();

  const search = typeof searchParams.search === "string" ? searchParams.search : "";
  const page = Math.max(1, parseInt(String(searchParams.page || "1"), 10) || 1);
  const initialData = await getPublicAdvertisers({ country: rawCountry.toUpperCase(), search, page, pageSize: 35, requireDeals: false });
  return (
    <AdvertisersClient
      key={`${rawCountry}:${search}:${page}`}
      initialData={initialData}
      country={rawCountry.toUpperCase()}
      initialSearch={search}
      variant="stores"
    />
  );
}
