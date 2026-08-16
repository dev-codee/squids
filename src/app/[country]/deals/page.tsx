import { notFound } from "next/navigation";
import TopDealsClient from "./TopDealsClient";

export const dynamic = "force-dynamic";

// 2-letter country code check
const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

export default function DealsPage({ params }: { params: { country: string } }) {
  const rawCountry = params.country;
  if (!COUNTRY_CODE_RE.test(rawCountry)) notFound();

  return <TopDealsClient country={rawCountry.toUpperCase()} />;
}
