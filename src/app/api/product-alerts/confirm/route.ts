import { NextRequest, NextResponse } from "next/server";
import { confirmProductAlert } from "@/lib/db/product-alerts";
import { getSiteUrl, getRegionConfig } from "@/lib/regions";

export const dynamic = "force-dynamic";

/**
 * GET /api/product-alerts/confirm?token=...&country=...
 *
 * Confirms double opt-in for a product price alert.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const country = getRegionConfig(request.nextUrl.searchParams.get("country")).country.toLowerCase();
  const siteUrl = getSiteUrl();

  if (!token) {
    return NextResponse.redirect(`${siteUrl}/${country}?alert=invalid`);
  }

  try {
    const alert = await confirmProductAlert(token);
    if (!alert) {
      return NextResponse.redirect(`${siteUrl}/${country}?alert=expired`);
    }

    // Redirect to product page with confirmation query param
    return NextResponse.redirect(
      `${siteUrl}/${getRegionConfig(alert.market).country.toLowerCase()}/product/${alert.productId}?alert=confirmed`,
    );
  } catch {
    return NextResponse.redirect(`${siteUrl}/${country}?alert=error`);
  }
}
