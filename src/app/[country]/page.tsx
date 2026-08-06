import { redirect } from "next/navigation";
import AdvertisersClient from "./AdvertisersClient";

// Region comes from the request/URL, so never statically prerender.
export const dynamic = "force-dynamic";

const CODE_RE = /^[A-Za-z]{2}$/;

/**
 * Public, region-scoped advertisers page.
 *
 * The `country` route segment is the visitor's region, e.g. `/pk` or `/us`.
 * We keep the URL canonical (lowercase) and only accept 2-letter ISO codes —
 * anything else bounces back to `/`, which re-detects the region.
 */
export default function CountryPage({
  params,
}: {
  params: { country: string };
}) {
  const raw = params.country;

  if (!CODE_RE.test(raw)) {
    redirect("/");
  }

  // Canonicalise the URL to lowercase (e.g. /PK -> /pk).
  if (raw !== raw.toLowerCase()) {
    redirect(`/${raw.toLowerCase()}`);
  }

  return <AdvertisersClient country={raw.toUpperCase()} />;
}
