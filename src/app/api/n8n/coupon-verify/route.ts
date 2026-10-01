import { NextRequest, NextResponse } from "next/server";
import { saveVerification } from "@/lib/db/coupon-verifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/n8n/coupon-verify
 *
 * Called by N8n after it finishes testing a coupon at checkout.
 * Expects Authorization: Bearer <N8N_WEBHOOK_SECRET> header.
 *
 * Body:
 *   couponId       – ID of the coupon tested
 *   couponCode     – the actual code used (or null for deal-type)
 *   storeSlug      – store slug
 *   storeName      – human-readable store name
 *   status         – "working" | "failed" | "expired"
 *   screenshotUrl  – URL of the uploaded checkout screenshot
 *   discountApplied – e.g. "15% off" or "€12.50 saved"
 *   cartTotal      – checkout total string after coupon
 *   notes          – optional free text
 */
export async function POST(req: NextRequest) {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const required = ["couponId", "storeSlug", "storeName", "status", "verifiedBy"];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
    }
  }

  if (!["working", "failed", "expired"].includes(body.status)) {
    return NextResponse.json({ error: "status must be working | failed | expired" }, { status: 400 });
  }

  await saveVerification({
    couponId: body.couponId,
    couponCode: body.couponCode ?? null,
    storeSlug: body.storeSlug,
    storeName: body.storeName,
    verifiedAt: new Date(),
    verifiedBy: body.verifiedBy ?? "Foxzil Bot",
    status: body.status,
    screenshotUrl: body.screenshotUrl ?? null,
    discountApplied: body.discountApplied ?? null,
    cartTotal: body.cartTotal ?? null,
    notes: body.notes ?? null,
  });

  return NextResponse.json({ ok: true });
}
