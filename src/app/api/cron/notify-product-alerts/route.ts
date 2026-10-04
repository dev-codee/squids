import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import {
  canSendAlert,
  revalidateOfferBeforeAlert,
  type ProductAlert,
} from "@/lib/model/productAlert";
import { markProductAlertNotified } from "@/lib/db/product-alerts";
import { getProductById } from "@/lib/db/products";
import { sendMail, priceDropAlertEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/regions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // Local development allow if not configured

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const querySecret = request.nextUrl.searchParams.get("secret");
  return querySecret === secret;
}

/**
 * GET /api/cron/notify-product-alerts
 *
 * Scans confirmed product price alerts, revalidates current offers,
 * and delivers notification emails when target prices are met.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteUrl = getSiteUrl();
  const now = new Date();

  try {
    const db = await getDb();
    const alertsCol = db.collection<ProductAlert>("product_alerts");
    const activeAlerts = await alertsCol
      .find({ status: "confirmed" })
      .toArray();

    let evaluated = 0;
    let notificationsSent = 0;
    let skippedCooldown = 0;
    let failedRevalidation = 0;

    for (const alert of activeAlerts) {
      evaluated++;

      // 1. Check cooldown and frequency
      if (!canSendAlert(alert, now)) {
        skippedCooldown++;
        continue;
      }

      // 2. Fetch live product data
      const product = await getProductById(alert.productId);
      if (!product) continue;

      // 3. Revalidate live offer: in stock, price valid, meets target
      const livePrice = product.salePrice ?? null;
      const reval = revalidateOfferBeforeAlert({
        isCurrent: true,
        inStock: product.inStock,
        itemPrice: livePrice,
        targetPrice: alert.targetPrice,
      });

      if (!reval.canSend || typeof reval.eligiblePrice !== "number") {
        failedRevalidation++;
        continue;
      }

      // 4. Send email notification
      const productUrl = `${siteUrl}/${alert.market.toLowerCase()}/product/${alert.productId}`;
      const unsubscribeUrl = `${siteUrl}/api/product-alerts/unsubscribe?token=${alert.token}&country=${alert.market.toLowerCase()}`;

      const { subject, html } = priceDropAlertEmail({
        productTitle: alert.productTitle,
        currentPrice: `${alert.currency} ${reval.eligiblePrice.toFixed(2)}`,
        targetPrice: `${alert.currency} ${alert.targetPrice.toFixed(2)}`,
        productUrl,
        unsubscribeUrl,
      });

      const sent = await sendMail({ to: alert.email, subject, html });
      if (sent) {
        notificationsSent++;
        await markProductAlertNotified(alert.id, reval.eligiblePrice, now);
      }
    }

    return NextResponse.json({
      success: true,
      evaluated,
      notificationsSent,
      skippedCooldown,
      failedRevalidation,
    });
  } catch (error) {
    console.error("[cron/notify-product-alerts] Execution failed:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
