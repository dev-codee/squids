import { NextRequest, NextResponse } from "next/server";
import {
  getSubscriberByToken,
  updateFrequency,
  removeStore,
  unsubscribe,
  type AlertFrequency,
} from "@/lib/db/subscribers";

export const dynamic = "force-dynamic";

const VALID_FREQUENCIES: AlertFrequency[] = ["instant", "daily", "weekly"];

function serialize(subscriber: NonNullable<Awaited<ReturnType<typeof getSubscriberByToken>>>) {
  return {
    email: subscriber.email,
    status: subscriber.status,
    frequency: subscriber.frequency,
    stores: subscriber.stores.map((s) => ({ slug: s.slug, name: s.name })),
  };
}

/** GET /api/subscriptions/manage?token=... — fetch current prefs for the manage page. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const subscriber = await getSubscriberByToken(token);
  if (!subscriber) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(serialize(subscriber));
}

/**
 * POST /api/subscriptions/manage
 * Body: { token, action: "frequency" | "removeStore" | "unsubscribeAll", frequency?, storeSlug? }
 */
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const token = typeof body?.token === "string" ? body.token : "";
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const existing = await getSubscriberByToken(token);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  switch (body?.action) {
    case "frequency": {
      if (!VALID_FREQUENCIES.includes(body?.frequency)) {
        return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
      }
      await updateFrequency(token, body.frequency);
      break;
    }
    case "removeStore": {
      if (typeof body?.storeSlug !== "string" || !body.storeSlug) {
        return NextResponse.json({ error: "Missing storeSlug" }, { status: 400 });
      }
      await removeStore(token, body.storeSlug);
      break;
    }
    case "unsubscribeAll": {
      await unsubscribe(token);
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const updated = await getSubscriberByToken(token);
  return NextResponse.json(serialize(updated!));
}
