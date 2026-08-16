import { notFound } from "next/navigation";
import AdvertisersClient from "../AdvertisersClient";

export const dynamic = "force-dynamic";

// 2-letter country code check
const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

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
