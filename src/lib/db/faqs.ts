import { getDb } from "@/lib/mongodb";
import type { FAQ, Paged } from "@/lib/content";

const COLLECTION = "faqs";

export interface FAQQuery {
  page?: number;
  pageSize?: number;
  advertiserId?: number;
}

export async function getFAQsFromDb(query: FAQQuery): Promise<Paged<FAQ>> {
  const db = await getDb();
  const col = db.collection<FAQ>(COLLECTION);

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
    items: docs as FAQ[],
    page,
    pageSize,
    total,
    totalPages,
  };
}

export async function getNextFAQId(): Promise<number> {
  const db = await getDb();
  const col = db.collection<FAQ>(COLLECTION);
  const maxDoc = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  return maxDoc.length > 0 ? maxDoc[0].id + 1 : 10000;
}

export async function createFAQ(faq: FAQ): Promise<FAQ> {
  const db = await getDb();
  const col = db.collection<FAQ>(COLLECTION);

  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ advertiserId: 1 });

  await col.updateOne({ id: faq.id }, { $set: faq }, { upsert: true });
  return faq;
}

export async function updateFAQ(id: number, data: Partial<FAQ>): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<FAQ>(COLLECTION);

  const result = await col.updateOne({ id }, { $set: data });
  return result.matchedCount > 0;
}

export async function deleteFAQ(id: number): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<FAQ>(COLLECTION);

  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}
