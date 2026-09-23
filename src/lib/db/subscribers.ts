/**
 * MongoDB persistence for "follow store" alert subscribers.
 *
 * A subscriber is identified by email and holds a list of followed stores
 * (by slug) plus a single alert-frequency preference. Consent is double
 * opt-in: a new subscriber starts as `pending` and only moves to `confirmed`
 * after clicking the link sent to their inbox (see `src/lib/email.ts` and
 * `src/app/api/subscriptions/*`).
 *
 * A single random `token` per subscriber authenticates the confirm/manage/
 * unsubscribe links — there is no login for the public site, so the token in
 * the URL *is* the credential. It's never exposed anywhere but those emails.
 */

import { randomBytes } from "crypto";
import { getDb } from "@/lib/mongodb";

const COLLECTION = "subscribers";

export type AlertFrequency = "instant" | "daily" | "weekly";
export type SubscriberStatus = "pending" | "confirmed" | "unsubscribed";

export interface FollowedStore {
  /** Public store slug, e.g. "amazon" — matches `/[country]/[store]`. */
  slug: string;
  network: string;
  advertiserId: string;
  name: string;
  addedAt: Date;
}

export interface SubscriberDoc {
  email: string;
  stores: FollowedStore[];
  frequency: AlertFrequency;
  status: SubscriberStatus;
  token: string;
  createdAt: Date;
  consentAt: Date;
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
  /** Cursor: deals `firstSeenAt` after this are "new" and unnotified for this subscriber. */
  lastNotifiedAt: Date | null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function getCollection() {
  const db = await getDb();
  const col = db.collection<SubscriberDoc>(COLLECTION);
  await col.createIndex({ email: 1 }, { unique: true });
  await col.createIndex({ token: 1 });
  await col.createIndex({ status: 1, frequency: 1, "stores.slug": 1 });
  return col;
}

/**
 * Follow a store — creates the subscriber if new, or adds the store to an
 * existing one. Re-subscribing after a full unsubscribe requires fresh
 * consent (back to `pending`).
 */
export async function followStore(params: {
  email: string;
  store: Omit<FollowedStore, "addedAt">;
  frequency: AlertFrequency;
}): Promise<{ subscriber: SubscriberDoc; needsConfirmation: boolean; alreadyFollowing: boolean }> {
  const col = await getCollection();
  const email = normalizeEmail(params.email);
  const now = new Date();

  const existing = await col.findOne({ email });

  if (!existing) {
    const doc: SubscriberDoc = {
      email,
      stores: [{ ...params.store, addedAt: now }],
      frequency: params.frequency,
      status: "pending",
      token: randomBytes(24).toString("hex"),
      createdAt: now,
      consentAt: now,
      confirmedAt: null,
      unsubscribedAt: null,
      lastNotifiedAt: null,
    };
    await col.insertOne(doc);
    return { subscriber: doc, needsConfirmation: true, alreadyFollowing: false };
  }

  const alreadyFollowing = existing.stores.some((s) => s.slug === params.store.slug);
  const reactivating = existing.status === "unsubscribed";

  if (!alreadyFollowing) {
    await col.updateOne(
      { email },
      { $addToSet: { stores: { ...params.store, addedAt: now } } },
    );
  }

  if (reactivating) {
    // A full unsubscribe withdrew consent — following again needs fresh
    // double opt-in rather than silently reactivating.
    await col.updateOne(
      { email },
      {
        $set: {
          frequency: params.frequency,
          status: "pending",
          consentAt: now,
          unsubscribedAt: null,
          confirmedAt: null,
        },
      },
    );
  } else {
    await col.updateOne({ email }, { $set: { frequency: params.frequency } });
  }

  const updated = await col.findOne({ email });
  const needsConfirmation = updated!.status !== "confirmed";
  return { subscriber: updated!, needsConfirmation, alreadyFollowing };
}

export async function getSubscriberByToken(token: string): Promise<SubscriberDoc | null> {
  if (!token) return null;
  const col = await getCollection();
  return col.findOne({ token });
}

/** Confirms double opt-in. Starts the notification cursor at "now" so no backlog floods in. */
export async function confirmSubscriber(token: string): Promise<SubscriberDoc | null> {
  const col = await getCollection();
  const now = new Date();
  const result = await col.findOneAndUpdate(
    { token, status: "pending" },
    { $set: { status: "confirmed", confirmedAt: now, lastNotifiedAt: now } },
    { returnDocument: "after" },
  );
  if (result) return result as unknown as SubscriberDoc;
  // Already confirmed (e.g. link clicked twice) — return the existing doc so
  // the confirm page can still say "you're all set" instead of erroring.
  return col.findOne({ token, status: "confirmed" });
}

export async function updateFrequency(token: string, frequency: AlertFrequency): Promise<boolean> {
  const col = await getCollection();
  const result = await col.updateOne({ token }, { $set: { frequency } });
  return result.matchedCount > 0;
}

export async function removeStore(token: string, slug: string): Promise<boolean> {
  const col = await getCollection();
  const result = await col.updateOne({ token }, { $pull: { stores: { slug } } });
  return result.matchedCount > 0;
}

/** Full unsubscribe (all stores, no more alerts) or scoped to a single store. */
export async function unsubscribe(token: string, storeSlug?: string): Promise<boolean> {
  const col = await getCollection();
  if (storeSlug) {
    return removeStore(token, storeSlug);
  }
  const result = await col.updateOne(
    { token },
    { $set: { status: "unsubscribed", unsubscribedAt: new Date() } },
  );
  return result.matchedCount > 0;
}

/** All confirmed subscribers following a given store, for a given frequency. */
export async function getSubscribersForStore(
  storeSlug: string,
  frequency: AlertFrequency,
): Promise<SubscriberDoc[]> {
  const col = await getCollection();
  return col
    .find({ status: "confirmed", frequency, "stores.slug": storeSlug })
    .toArray();
}

/** All confirmed subscribers for a frequency tier (used to drive the digest cron). */
export async function getSubscribersByFrequency(frequency: AlertFrequency): Promise<SubscriberDoc[]> {
  const col = await getCollection();
  return col.find({ status: "confirmed", frequency }).toArray();
}

export async function markNotified(email: string, at: Date): Promise<void> {
  const col = await getCollection();
  await col.updateOne({ email: normalizeEmail(email) }, { $set: { lastNotifiedAt: at } });
}
