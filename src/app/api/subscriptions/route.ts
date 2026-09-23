import { NextRequest, NextResponse } from "next/server";
import { followStore, type AlertFrequency } from "@/lib/db/subscribers";
import { sendMail, confirmSubscriptionEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/regions";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_FREQUENCIES: AlertFrequency[] = ["instant", "daily", "weekly"];

/**
 * POST /api/subscriptions
 *
 * "Follow this store" — creates or updates a follow-store alert subscription.
 * Body: { email, consent: true, frequency, country, store: { slug, network, advertiserId, name } }
 *
 * New subscribers are double opt-in: nothing is sent until they click the
 * confirmation link, so `consent` here just records that they ticked the box
 * requesting alerts — it doesn't skip verification.
 */
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const consent = body?.consent === true;
  const frequency: AlertFrequency = VALID_FREQUENCIES.includes(body?.frequency)
    ? body.frequency
    : "instant";
  const country = typeof body?.country === "string" && /^[a-z]{2}$/i.test(body.country)
    ? body.country.toLowerCase()
    : "us";
  const store = body?.store;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json(
      { error: "Please confirm you'd like to receive these alerts." },
      { status: 400 },
    );
  }
  if (!store?.slug || !store?.name) {
    return NextResponse.json({ error: "Missing store." }, { status: 400 });
  }

  try {
    const { subscriber, needsConfirmation } = await followStore({
      email,
      frequency,
      store: {
        slug: String(store.slug),
        network: String(store.network || "awin"),
        advertiserId: String(store.advertiserId || ""),
        name: String(store.name).slice(0, 200),
      },
    });

    if (needsConfirmation) {
      const siteUrl = getSiteUrl();
      const confirmUrl = `${siteUrl}/api/subscriptions/confirm?token=${subscriber.token}&country=${country}`;
      const manageUrl = `${siteUrl}/${country}/subscriptions?token=${subscriber.token}`;
      const unsubscribeUrl = `${siteUrl}/api/subscriptions/unsubscribe?token=${subscriber.token}&country=${country}`;
      const { subject, html } = confirmSubscriptionEmail({
        confirmUrl,
        unsubscribeUrl,
        manageUrl,
        storeNames: subscriber.stores.map((s) => s.name),
      });
      await sendMail({ to: subscriber.email, subject, html });
    }

    return NextResponse.json({ ok: true, needsConfirmation });
  } catch (error) {
    console.error("[subscriptions] follow failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
