import { NextRequest, NextResponse } from "next/server";
import {
  fetchDeals,
  queryDeals,
  AwinConfigError,
  AwinApiError,
} from "@/lib/deals";

// Always run on the server, never statically prerendered.
export const dynamic = "force-dynamic";

/**
 * GET /api/deals?advertiserId=&status=active&type=all&country=PK&search=&page=1&pageSize=24
 *
 * Fetches promotions/offers from the Awin Offers API (cached 15 min),
 * applies search/type/status/country filters, and returns a single page.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const advertiserIdRaw = params.get("advertiserId");
  const advertiserId = advertiserIdRaw
    ? Number.parseInt(advertiserIdRaw, 10) || undefined
    : undefined;

  const status = params.get("status") ?? "active";
  const type = params.get("type") ?? "all";
  const country = params.get("country") ?? undefined;
  const search = params.get("search") ?? undefined;
  const page = Number.parseInt(params.get("page") ?? "1", 10) || 1;
  const pageSize =
    Number.parseInt(params.get("pageSize") ?? "", 10) || undefined;

  try {
    // Build Awin API filters. We fetch a broad set and filter locally
    // so we can cache effectively and avoid per-search API calls.
    const apiFilters: Record<string, unknown> = {
      status: status !== "all" ? status : undefined,
      type: type !== "all" ? type : undefined,
      advertiserIds: advertiserId ? [advertiserId] : undefined,
      regionCodes: country ? [country] : undefined,
      pageSize: 100, // max page from Awin
    };

    // Remove undefined keys
    const cleanFilters = Object.fromEntries(
      Object.entries(apiFilters).filter(([, v]) => v !== undefined),
    );

    const { deals: allDeals } = await fetchDeals(cleanFilters);

    // Apply additional client-side filters (search, pagination)
    const result = queryDeals(allDeals, {
      search,
      advertiserId,
      status,
      type,
      country,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AwinConfigError) {
      return NextResponse.json(
        { error: "Server is not configured. Missing Awin credentials." },
        { status: 500 },
      );
    }
    if (error instanceof AwinApiError) {
      return NextResponse.json(
        { error: "Failed to reach the Awin API. Please try again later." },
        { status: 502 },
      );
    }
    console.error("Unexpected error in /api/deals:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
