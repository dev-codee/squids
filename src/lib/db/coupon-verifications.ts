import { getDb } from "@/lib/mongodb";

const COLLECTION = "coupon_verifications";

export interface CouponVerification {
  _id?: string;
  couponId: string;
  couponCode: string | null;
  storeSlug: string;
  storeName: string;
  verifiedAt: Date;
  verifiedBy: string;
  status: "working" | "failed" | "expired";
  screenshotUrl: string | null;
  discountApplied: string | null;
  cartTotal: string | null;
  notes: string | null;
}

export async function saveVerification(data: Omit<CouponVerification, "_id">): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTION).updateOne(
    { couponId: data.couponId, storeSlug: data.storeSlug },
    { $set: { ...data, verifiedAt: new Date(data.verifiedAt) } },
    { upsert: true },
  );
}

export async function getVerificationForCoupon(
  couponId: string,
  storeSlug: string,
): Promise<CouponVerification | null> {
  const db = await getDb();
  const doc = await db
    .collection<CouponVerification>(COLLECTION)
    .findOne({ couponId, storeSlug });
  return doc ?? null;
}

export async function getLatestVerificationsForStore(
  storeSlug: string,
  limit = 5,
): Promise<CouponVerification[]> {
  const db = await getDb();
  return db
    .collection<CouponVerification>(COLLECTION)
    .find({ storeSlug, status: "working" })
    .sort({ verifiedAt: -1 })
    .limit(limit)
    .toArray();
}

export async function getAllVerificationsForStore(
  storeSlug: string,
): Promise<CouponVerification[]> {
  const db = await getDb();
  return db
    .collection<CouponVerification>(COLLECTION)
    .find({ storeSlug })
    .sort({ verifiedAt: -1 })
    .toArray();
}
