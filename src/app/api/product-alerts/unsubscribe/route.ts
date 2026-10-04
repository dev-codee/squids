import { NextRequest, NextResponse } from "next/server";
import { unsubscribeProductAlert } from "@/lib/db/product-alerts";
import { getSiteUrl } from "@/lib/regions";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/product-alerts/unsubscribe?token=...&country=...
 *
 * One-click unsubscribe for a product price alert.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const country = request.nextUrl.searchParams.get("country")?.toLowerCase() || "us";
  const siteUrl = getSiteUrl();

  if (!token) {
    return NextResponse.redirect(`${siteUrl}/${country}?alert=invalid`);
  }

  await unsubscribeProductAlert(token);
  return NextResponse.redirect(`${siteUrl}/${country}?alert=unsubscribed`);
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

  const success = await unsubscribeProductAlert(token);
  return NextResponse.json({ ok: success });
}
