import { getDb } from "@/lib/mongodb";

const COLLECTION = "coupon_votes";

export type VoteType = "up" | "down";

export interface CouponVote {
  couponId: string;
  storeSlug: string;
  voteType: VoteType;
  fingerprint: string;
  createdAt: Date;
}

export interface VoteCounts {
  up: number;
  down: number;
}

/** Cast or change a vote. One vote per fingerprint per coupon. */
export async function castVote(
  couponId: string,
  storeSlug: string,
  voteType: VoteType,
  fingerprint: string,
): Promise<VoteCounts> {
  const db = await getDb();
  const col = db.collection<CouponVote>(COLLECTION);

  await col.createIndex({ couponId: 1, fingerprint: 1 }, { unique: true });

  await col.updateOne(
    { couponId, fingerprint },
    { $set: { couponId, storeSlug, voteType, fingerprint, createdAt: new Date() } },
    { upsert: true },
  );

  return getVoteCounts(couponId);
}

/** Get up/down counts for a single coupon. */
export async function getVoteCounts(couponId: string): Promise<VoteCounts> {
  const db = await getDb();
  const col = db.collection<CouponVote>(COLLECTION);

  const [up, down] = await Promise.all([
    col.countDocuments({ couponId, voteType: "up" }),
    col.countDocuments({ couponId, voteType: "down" }),
  ]);
  return { up, down };
}

/** Get counts for multiple coupons at once (used to pre-populate a page). */
export async function getVoteCountsBatch(
  couponIds: string[],
): Promise<Record<string, VoteCounts>> {
  if (couponIds.length === 0) return {};
  const db = await getDb();
  const col = db.collection<CouponVote>(COLLECTION);

  const docs = await col
    .aggregate([
      { $match: { couponId: { $in: couponIds } } },
      { $group: { _id: { couponId: "$couponId", voteType: "$voteType" }, count: { $sum: 1 } } },
    ])
    .toArray();

  const result: Record<string, VoteCounts> = {};
  for (const couponId of couponIds) {
    result[couponId] = { up: 0, down: 0 };
  }
  for (const doc of docs) {
    const id = doc._id.couponId as string;
    const type = doc._id.voteType as VoteType;
    if (result[id]) result[id][type] = doc.count as number;
  }
  return result;
}
