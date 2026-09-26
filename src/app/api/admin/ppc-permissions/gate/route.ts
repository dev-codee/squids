import { NextRequest, NextResponse } from "next/server";
import { evaluatePpcLaunchGate } from "@/lib/ppc/gate";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ppc-permissions/gate?merchantId=&network=&country=&landingPage=&keywords=
 *
 * Evaluates every launch gate for one merchant × network × market and returns the
 * full checklist. `launchable` is true only when all six gates pass — including
 * the manual economics sign-off, which no automated caller can satisfy.
 *
 * `keywords` is a comma-separated list.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const merchantId = Number(params.get("merchantId"));
  if (!Number.isFinite(merchantId) || merchantId <= 0) {
    return NextResponse.json({ error: "merchantId is required" }, { status: 400 });
  }

  const result = await evaluatePpcLaunchGate({
    merchantId,
    network: params.get("network") ?? "awin",
    country: params.get("country"),
    landingPage: params.get("landingPage"),
    keywords: (params.get("keywords") ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  });

  return NextResponse.json(result);
}
