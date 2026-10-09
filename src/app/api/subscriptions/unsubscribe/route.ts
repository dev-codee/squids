import { NextRequest, NextResponse } from "next/server";
import { unsubscribe } from "@/lib/db/subscribers";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscriptions/unsubscribe?token=...&store=slug&country=us
 *
 * One-click unsubscribe from an alert email. `store` is optional — omit it to
 * stop all alerts, or pass a store slug to unfollow just that one.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const store = request.nextUrl.searchParams.get("store") || undefined;
  const country = (request.nextUrl.searchParams.get("country") || "us").toLowerCase();
  const dest = new URL(`/${country}/subscriptions`, request.url);

  if (!token) {
    dest.searchParams.set("status", "invalid");
    return NextResponse.redirect(dest);
  }

  const ok = await unsubscribe(token, store);
  dest.searchParams.set("status", ok ? "unsubscribed" : "invalid");
  if (ok) dest.searchParams.set("token", token);
  return NextResponse.redirect(dest);
}
