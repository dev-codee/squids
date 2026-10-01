import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserCountry } from "@/lib/geo";
import { REGION_COOKIE, isValidRegionCode } from "@/lib/regions";

// Detection depends on the request (IP / geo headers), so never prerender.
export const dynamic = "force-dynamic";

/**
 * Root entry point.
 *
 * Detects the visitor's region server-side and forwards them to the canonical
 * region URL (e.g. `/pk`, `/us`) so the region is always visible in the address
 * bar. All the actual browsing UI lives under `/[country]`.
 */
export default async function RootPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Prefer the visitor's explicitly chosen region (cookie); otherwise detect
  // it from their IP so the region is still sensible on a first visit.
  const preferred = cookies().get(REGION_COOKIE)?.value;
  const country = isValidRegionCode(preferred)
    ? preferred
    : (await getUserCountry({ headers: headers() })).country;

  const search = searchParams.search;
  if (search && typeof search === "string") {
    redirect(`/${country.toLowerCase()}?search=${encodeURIComponent(search)}`);
  } else {
    redirect(`/${country.toLowerCase()}`);
  }
}
