import { NextRequest, NextResponse } from "next/server";
import {
  fetchDeals,
  queryDeals,
  AwinConfigError,
  AwinApiError,
} from "@/lib/deals";
import { getDealsFromDb } from "@/lib/db/deals";

// Always run on the server, never statically prerendered.
export const dynamic = "force-dynamic";

/**
 * GET /api/deals?advertiserId=&status=active&type=all&country=PK&search=&page=1&pageSize=24
 *
 * Primary: reads from MongoDB (fast, no Awin rate-limit concerns).
 * Fallback: fetches directly from Awin if MongoDB is empty or unavailable.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const advertiserIdRaw = params.get("advertiserId");
  const advertiserId = advertiserIdRaw
    ? Number.parseInt(advertiserIdRaw, 10) || undefined
    : undefined;

  const status = params.get("status") || "all";
  const type = params.get("type") ?? "all";
  const country = params.get("country") ?? undefined;
  const search = params.get("search") ?? undefined;
  const page = Number.parseInt(params.get("page") ?? "1", 10) || 1;
  const pageSize =
    Number.parseInt(params.get("pageSize") ?? "", 10) || undefined;

  try {
    // Try MongoDB first
    try {
      let dbResult = await getDealsFromDb({
        search,
        advertiserId,
        status,
        type,
        country,
        page,
        pageSize,
      });

      // If querying by advertiserId and MongoDB returned 0 deals (and no search filter active),
      // fetch directly from Awin API for this advertiser and save to MongoDB!
      if (advertiserId && (!dbResult || dbResult.total === 0) && !search) {
        try {
          const { fetchDeals } = await import("@/lib/deals");
          const { upsertDeals } = await import("@/lib/db/deals");

          const { deals: freshDeals } = await fetchDeals({
            advertiserIds: [advertiserId],
            pageSize: 100,
          });

          if (freshDeals && freshDeals.length > 0) {
            await upsertDeals(freshDeals);
            dbResult = await getDealsFromDb({
              search,
              advertiserId,
              status,
              type,
              country,
              page,
              pageSize,
            });
          }
        } catch (fetchErr) {
          console.warn("[/api/deals] On-demand fetch failed for advertiser:", advertiserId, fetchErr);
        }
      }

      if (dbResult) {
        return NextResponse.json(dbResult);
      }
    } catch (dbError) {
      console.warn(
        "[/api/deals] MongoDB unavailable, falling back to Awin API:",
        dbError instanceof Error ? dbError.message : dbError,
      );
    }

    // Fallback: fetch from Awin API directly
    const apiFilters: Record<string, unknown> = {
      status: status !== "all" ? status : undefined,
      type: type !== "all" ? type : undefined,
      advertiserIds: advertiserId ? [advertiserId] : undefined,
      regionCodes: country ? [country] : undefined,
      pageSize: 100,
    };

    const cleanFilters = Object.fromEntries(
      Object.entries(apiFilters).filter(([, v]) => v !== undefined),
    );

    const { deals: allDeals } = await fetchDeals(cleanFilters);

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
