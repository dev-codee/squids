import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { recordOutboundClick } from "@/lib/db/clicks";
import { appendNetworkSubId, resolveAffiliateTrackingUrl } from "@/lib/affiliateUrls";
import { ATTRIBUTION_COOKIE_NAME, VisitorAttribution } from "@/lib/attribution";
import { getAdvertiserBySlug } from "@/lib/db/advertisers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const dealId = searchParams.get("dealId");
  const slug = searchParams.get("slug") || "";
  const market = (searchParams.get("market") || "AU").toUpperCase();
  const rawUrl = searchParams.get("url") || "";

  // 1. Resolve destination URL and advertiser info
  let destinationUrl = rawUrl;
  let advertiserId: number | undefined;
  let storeName = slug;
  let network = "commission-factory";

  const db = await getDb();

  if (dealId) {
    const numId = Number(dealId);
    const dealDoc = await db.collection("deals").findOne(
      Number.isFinite(numId) ? { $or: [{ id: numId }, { id: dealId }] } : { id: dealId }
    );
    if (dealDoc) {
      destinationUrl = dealDoc.trackingUrl || destinationUrl;
      advertiserId = dealDoc.advertiser?.id;
      storeName = dealDoc.advertiser?.name || storeName;
      network = dealDoc.network || network;
    }
  }

  if (!advertiserId && slug) {
    const adv = await getAdvertiserBySlug(slug, market);
    if (adv) {
      advertiserId = adv.id;
      storeName = adv.name || storeName;
      network = adv.network || network;
      if (!destinationUrl) {
        destinationUrl = adv.url || "";
      }
    }
  }

  if (!destinationUrl) {
    destinationUrl = `https://www.${slug.toLowerCase() || "foxzil"}.com`;
  }

  // Ensure official publisher affiliate tracking link
  destinationUrl = resolveAffiliateTrackingUrl(network, advertiserId, destinationUrl);

  // 2. Read attribution (gclid, gbraid, etc.) from cookie or query params
  let gclid = searchParams.get("gclid") || undefined;
  let gbraid = searchParams.get("gbraid") || undefined;
  let wbraid = searchParams.get("wbraid") || undefined;
  let utm_source = searchParams.get("utm_source") || undefined;
  let utm_medium = searchParams.get("utm_medium") || undefined;
  let utm_campaign = searchParams.get("utm_campaign") || undefined;

  const attrCookie = request.cookies.get(ATTRIBUTION_COOKIE_NAME)?.value;
  if (attrCookie) {
    try {
      let raw = attrCookie;
      try { raw = decodeURIComponent(attrCookie); } catch {}
      let parsed: any = JSON.parse(raw);
      if (typeof parsed === "string") {
        try { parsed = JSON.parse(parsed); } catch {}
      }
      if (parsed && typeof parsed === "object") {
        gclid = gclid || parsed.gclid;
        gbraid = gbraid || parsed.gbraid;
        wbraid = wbraid || parsed.wbraid;
        utm_source = utm_source || parsed.utm_source;
        utm_medium = utm_medium || parsed.utm_medium;
        utm_campaign = utm_campaign || parsed.utm_campaign;
      }
    } catch (err) {
      console.warn("[api/outbound] Failed to parse attribution cookie:", err, "raw value:", attrCookie);
    }
  }

  // 3. Generate unique Foxzil Click ID
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const clickId = `fz_${timestamp}_${random}`;

  // 4. Save click to database
  try {
    await recordOutboundClick({
      clickId,
      couponId: dealId || undefined,
      advertiserId,
      storeSlug: slug,
      storeName,
      network,
      market,
      gclid,
      gbraid,
      wbraid,
      utm_source,
      utm_medium,
      utm_campaign,
      destinationUrl,
      referrer: request.headers.get("referer") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
      createdAt: new Date(),
    });
  } catch (e) {
    console.error("[api/outbound] Failed to record click:", e);
  }

  // 5. Append SubID for the network (UniqueId for Commission Factory, clickref for Awin)
  const trackedUrl = appendNetworkSubId(destinationUrl, network, clickId);

  // Return JSON if caller requested json, else redirect
  const acceptsJson =
    request.headers.get("accept")?.includes("application/json") ||
    searchParams.get("format") === "json";

  if (acceptsJson) {
    return NextResponse.json({
      url: trackedUrl,
      clickId,
      gclid,
      cookiesReceived: request.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
    });
  }

  return NextResponse.redirect(trackedUrl, 307);
}
