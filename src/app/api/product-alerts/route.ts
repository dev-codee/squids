import { NextRequest, NextResponse } from "next/server";
import { createOrUpdateProductAlert } from "@/lib/db/product-alerts";
import { getProductById } from "@/lib/db/products";
import { sendMail, confirmProductAlertEmail } from "@/lib/email";
import { getSiteUrl, getRegionConfig } from "@/lib/regions";
import type { AlertFrequency } from "@/lib/model/productAlert";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_FREQUENCIES: AlertFrequency[] = ["instant", "daily", "weekly"];

/**
 * POST /api/product-alerts
 *
 * Sets up a product target-price alert with double opt-in.
 * Body: { email, productId, targetPrice, frequency, country, consent: true }
 */
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const productId = Number(body?.productId);
  const targetPrice = Number(body?.targetPrice);
  const consent = body?.consent === true;
  const frequency: AlertFrequency = VALID_FREQUENCIES.includes(body?.frequency)
    ? body.frequency
    : "instant";
  const country = typeof body?.country === "string" && /^[a-z]{2}$/i.test(body.country)
    ? body.country.toLowerCase()
    : "us";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!Number.isFinite(productId) || productId <= 0) {
    return NextResponse.json({ error: "Invalid product ID." }, { status: 400 });
  }
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
    return NextResponse.json({ error: "Please enter a valid target price greater than 0." }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json(
      { error: "Please confirm consent to receive price drop alerts." },
      { status: 400 },
    );
  }

  const product = await getProductById(productId);
  if (!product || !product.regionCodes?.includes(country.toUpperCase())) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const region = getRegionConfig(country);
  const currency = product.currency?.toUpperCase() || "USD";

  try {
    const { alert, needsConfirmation } = await createOrUpdateProductAlert({
      email,
      productId,
      productTitle: product.title,
      market: country,
      currency,
      targetPrice,
      frequency,
      consentScope: "price_drop_alerts",
      consentVersion: "2026-v1",
    });

    if (needsConfirmation) {
      const siteUrl = getSiteUrl();
      const confirmUrl = `${siteUrl}/api/product-alerts/confirm?token=${alert.token}&country=${country}`;
      const unsubscribeUrl = `${siteUrl}/api/product-alerts/unsubscribe?token=${alert.token}&country=${country}`;

      const { subject, html } = confirmProductAlertEmail({
        confirmUrl,
        unsubscribeUrl,
        productTitle: product.title,
        targetPrice: `${currency} ${targetPrice.toFixed(2)}`,
      });

      await sendMail({ to: alert.email, subject, html });
    }

    return NextResponse.json({
      ok: true,
      needsConfirmation,
      message: needsConfirmation
        ? "Please check your email to confirm your alert."
        : "Alert updated successfully.",
    });
  } catch (error) {
    console.error("[product-alerts] Subscription error:", error);
    return NextResponse.json(
      { error: "Failed to set up alert. Please try again." },
      { status: 500 },
    );
  }
}
