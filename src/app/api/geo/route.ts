import { NextRequest, NextResponse } from "next/server";
import { getUserCountry } from "@/lib/geo";

// Depends on request headers / IP, so never prerender.
export const dynamic = "force-dynamic";

/**
 * GET /api/geo
 *
 * Returns the caller's detected country, e.g. `{ "country": "PK", "source": "vercel" }`.
 */
export async function GET(request: NextRequest) {
  const geo = await getUserCountry(request);
  return NextResponse.json(geo);
}
