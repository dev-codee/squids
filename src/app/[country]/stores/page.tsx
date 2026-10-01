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
    hreflang[r.locale] = `${siteUrl}/${code.toLowerCase()}/stores`;
  }
  hreflang["x-default"] = `${siteUrl}/us/stores`;

  return {
    title: dict.meta.storesTitle.replace("{country}", name),
    description: dict.meta.storesDescription.replace("{country}", name),
    alternates: {
      canonical: `${siteUrl}/${params.country.toLowerCase()}/stores`,
      languages: hreflang,
    },
  };
}

export default function StoresPage({
  params,
  searchParams,
}: {
  params: { country: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const rawCountry = params.country;
  if (!COUNTRY_CODE_RE.test(rawCountry)) notFound();

  const search = typeof searchParams.search === "string" ? searchParams.search : "";
  return (
    <AdvertisersClient
      country={rawCountry.toUpperCase()}
      initialSearch={search}
      variant="stores"
    />
  );
}
