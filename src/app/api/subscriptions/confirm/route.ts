import { NextRequest, NextResponse } from "next/server";
import { confirmSubscriber } from "@/lib/db/subscribers";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscriptions/confirm?token=...&country=us
 *
 * Double opt-in confirmation link from the "confirm your alerts" email.
 * Redirects to the manage page with a status flag rather than rendering
 * anything itself, since the site's UI all lives under `/[country]/*`.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const country = (request.nextUrl.searchParams.get("country") || "us").toLowerCase();
  const dest = new URL(`/${country}/subscriptions`, request.url);

  if (!token) {
    dest.searchParams.set("status", "invalid");
    return NextResponse.redirect(dest);
  }

  const subscriber = await confirmSubscriber(token);
  dest.searchParams.set("status", subscriber ? "confirmed" : "invalid");
  if (subscriber) dest.searchParams.set("token", token);
  return NextResponse.redirect(dest);
}
