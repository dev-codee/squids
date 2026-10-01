import { getDb } from "@/lib/mongodb";
import type { StoreReview, Paged } from "@/lib/content";

const COLLECTION = "reviews";

export interface ReviewQuery {
  page?: number;
  pageSize?: number;
  advertiserId?: number;
}

export async function getReviewsFromDb(query: ReviewQuery): Promise<Paged<StoreReview>> {
  const db = await getDb();
  const col = db.collection<StoreReview>(COLLECTION);

  const filter: Record<string, unknown> = {};

  if (query.advertiserId) {
    filter.advertiserId = query.advertiserId;
  }

  const pageSize = Math.max(1, Math.min(100, query.pageSize || 24));
  const total = await col.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(totalPages, query.page || 1));
  const skip = (page - 1) * pageSize;

  const docs = await col
    .find(filter, { projection: { _id: 0 } })
    .sort({ id: -1 })
    .skip(skip)
    .limit(pageSize)
    .toArray();

  return {
    items: docs as StoreReview[],
    page,
    pageSize,
    total,
    totalPages,
  };
}

export async function getNextReviewId(): Promise<number> {
  const db = await getDb();
  const col = db.collection<StoreReview>(COLLECTION);
  const maxDoc = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  return maxDoc.length > 0 ? maxDoc[0].id + 1 : 10000;
}

export async function createReview(review: StoreReview): Promise<StoreReview> {
  const db = await getDb();
  const col = db.collection<StoreReview>(COLLECTION);

  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ advertiserId: 1 });

  await col.updateOne({ id: review.id }, { $set: review }, { upsert: true });
  return review;
}

export async function updateReview(id: number, data: Partial<StoreReview>): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<StoreReview>(COLLECTION);

  const result = await col.updateOne({ id }, { $set: data });
  return result.matchedCount > 0;
}

export async function deleteReview(id: number): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<StoreReview>(COLLECTION);

  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}
