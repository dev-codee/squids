import { NextRequest, NextResponse } from "next/server";
import { getNewDealsSince, type NewDealForAlert } from "@/lib/db/deals";
import {
  getSubscribersByFrequency,
  markNotified,
  type AlertFrequency,
} from "@/lib/db/subscribers";
import { sendMail, newOffersDigestEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/regions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Same allow-list as the other cron routes (Vercel Cron header or CRON_SECRET). */
function isAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const querySecret = request.nextUrl.searchParams.get("secret");
  return querySecret === secret;
}

const MAX_OFFERS_PER_EMAIL = 25;

async function notifyTier(tier: AlertFrequency): Promise<{ subscribers: number; emailsSent: number }> {
  const subscribers = await getSubscribersByFrequency(tier);
  if (subscribers.length === 0) return { subscribers: 0, emailsSent: 0 };

  // One DB query for the whole tier: fetch everything new since the earliest
  // cursor among these subscribers, then filter per-subscriber in memory.
  const earliestSince = subscribers.reduce<Date>((min, s) => {
    const cursor = s.lastNotifiedAt ?? s.confirmedAt ?? s.createdAt;
    return cursor < min ? cursor : min;
  }, subscribers[0].lastNotifiedAt ?? subscribers[0].confirmedAt ?? subscribers[0].createdAt);

  const newDeals = await getNewDealsSince(earliestSince);
  if (newDeals.length === 0) return { subscribers: subscribers.length, emailsSent: 0 };

  const dealsBySlug = new Map<string, NewDealForAlert[]>();
  for (const deal of newDeals) {
    const list = dealsBySlug.get(deal.advertiserSlug) ?? [];
    list.push(deal);
    dealsBySlug.set(deal.advertiserSlug, list);
  }

  const siteUrl = getSiteUrl();
  let emailsSent = 0;

  for (const subscriber of subscribers) {
    const since = subscriber.lastNotifiedAt ?? subscriber.confirmedAt ?? subscriber.createdAt;
    const matches: NewDealForAlert[] = [];
    for (const store of subscriber.stores) {
      const forStore = dealsBySlug.get(store.slug) ?? [];
      for (const deal of forStore) {
        if (deal.firstSeenAt > since) matches.push(deal);
      }
    }

    if (matches.length === 0) continue;

    const offers = matches.slice(0, MAX_OFFERS_PER_EMAIL).map((d) => ({
      storeName: d.advertiserName,
      title: d.title,
      discountText: d.discountText,
      url: `${siteUrl}/us/${d.advertiserSlug}`,
    }));

    const unsubscribeUrl = `${siteUrl}/api/subscriptions/unsubscribe?token=${subscriber.token}`;
    const manageUrl = `${siteUrl}/us/subscriptions?token=${subscriber.token}`;
    const { subject, html } = newOffersDigestEmail({ offers, unsubscribeUrl, manageUrl });

    const sent = await sendMail({ to: subscriber.email, subject, html });
    if (sent) emailsSent++;

    // Advance the cursor regardless of send success — a transient SMTP
    // failure shouldn't cause the same offers to be retried indefinitely.
    await markNotified(subscriber.email, new Date());
  }

  return { subscribers: subscribers.length, emailsSent };
}

/**
 * GET /api/cron/notify-subscribers?tier=instant|daily|weekly
 *
 * Sends follow-store alert digests for one frequency tier. Scheduled
 * separately per tier in vercel.json (hourly for instant, once a day for
 * daily, once a week for weekly).
 */
export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tierParam = request.nextUrl.searchParams.get("tier");
  const tier: AlertFrequency = tierParam === "daily" || tierParam === "weekly" ? tierParam : "instant";

  try {
    const result = await notifyTier(tier);
    return NextResponse.json({ success: true, tier, ...result });
  } catch (error) {
    console.error(`[cron/notify-subscribers] tier=${tier} failed:`, error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
