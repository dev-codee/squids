import { NextRequest, NextResponse } from "next/server";
import { unsubscribeProductAlert } from "@/lib/db/product-alerts";
import { getSiteUrl, getRegionConfig } from "@/lib/regions";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/product-alerts/unsubscribe?token=...&country=...
 *
 * One-click unsubscribe for a product price alert.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const country = getRegionConfig(request.nextUrl.searchParams.get("country")).country.toLowerCase();
  const siteUrl = getSiteUrl();

  if (!token) {
    return NextResponse.redirect(`${siteUrl}/${country}?alert=invalid`);
  }

  try {
    const ok = await unsubscribeProductAlert(token);
    return NextResponse.redirect(`${siteUrl}/${country}?alert=${ok ? "unsubscribed" : "invalid"}`);
  } catch {
    return NextResponse.redirect(`${siteUrl}/${country}?alert=error`);
  }
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const token = typeof body?.token === "string" ? body.token : request.nextUrl.searchParams.get("token") || "";

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  try {
    const success = await unsubscribeProductAlert(token);
    return success ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Invalid alert link." }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Could not unsubscribe. Please try again." }, { status: 503 });
  }
}
