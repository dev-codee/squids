import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { resolveAffiliateTrackingUrl } from "@/lib/affiliateUrls";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    const advCol = db.collection("advertisers");
    const dealsCol = db.collection("deals");

    const advertisers = await advCol.find({}).toArray();
    let updatedAdvCount = 0;

    for (const adv of advertisers) {
      const resolvedUrl = resolveAffiliateTrackingUrl(adv.network, adv.id, adv.url);
      if (resolvedUrl && resolvedUrl !== adv.url) {
        await advCol.updateOne(
          { _id: adv._id },
          { $set: { url: resolvedUrl } },
        );
        updatedAdvCount++;
      }
    }

    const deals = await dealsCol.find({}).toArray();
    let updatedDealsCount = 0;

    for (const deal of deals) {
      const resolvedTracking = resolveAffiliateTrackingUrl(
        deal.network,
        deal.advertiser?.id,
        deal.trackingUrl,
      );
      if (resolvedTracking && resolvedTracking !== deal.trackingUrl) {
        await dealsCol.updateOne(
          { _id: deal._id },
          { $set: { trackingUrl: resolvedTracking } },
        );
        updatedDealsCount++;
      }
    }

    return NextResponse.json({
      success: true,
      updatedAdvertisers: updatedAdvCount,
      totalAdvertisers: advertisers.length,
      updatedDeals: updatedDealsCount,
      totalDeals: deals.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
