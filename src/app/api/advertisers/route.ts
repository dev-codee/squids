import { NextRequest, NextResponse } from "next/server";
import {
  fetchProgrammesForRelationships,
  queryAdvertisers,
  AwinConfigError,
  AwinApiError,
} from "@/lib/awin";
import { getAdvertisersFromDb } from "@/lib/db/advertisers";

// Always run on the server, never statically prerendered.
export const dynamic = "force-dynamic";

/**
 * GET /api/advertisers?page=1&pageSize=24&search=&region=&relationship=
 *
 * Primary: reads from MongoDB (fast, no Awin rate-limit concerns).
 * Fallback: fetches directly from Awin if MongoDB is empty or unavailable.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const query = {
    search: params.get("search") ?? undefined,
    region: params.get("region") ?? undefined,
    relationship: params.get("relationship") ?? undefined,
    country: params.get("country") ?? undefined,
    page: Number.parseInt(params.get("page") ?? "1", 10) || 1,
    pageSize: Number.parseInt(params.get("pageSize") ?? "", 10) || undefined,
  };

  try {
    // Try MongoDB first
    try {
      const dbResult = await getAdvertisersFromDb(query);
      if (dbResult) {
        return NextResponse.json(dbResult);
      }
    } catch (dbError) {
      console.warn(
        "[/api/advertisers] MongoDB unavailable, falling back to Awin API:",
        dbError instanceof Error ? dbError.message : dbError,
      );
    }

    // Fallback: fetch from Awin API directly
    const all = await fetchProgrammesForRelationships();
    const result = queryAdvertisers(all, query);
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
    console.error("Unexpected error in /api/advertisers:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
