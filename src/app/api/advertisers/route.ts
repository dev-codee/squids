import { NextRequest, NextResponse } from "next/server";
import {
  fetchProgrammesForRelationships,
  queryAdvertisers,
  AwinConfigError,
  AwinApiError,
} from "@/lib/awin";

// Always run on the server, never statically prerendered.
export const dynamic = "force-dynamic";

/**
 * GET /api/advertisers?page=1&pageSize=24&search=&region=&relationship=
 *
 * Fetches the publisher's programmes from Awin (cached briefly), then applies
 * search/region/status filters and returns a single page — so the client never
 * loads the whole dataset at once.
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
