/**
 * MongoDB persistence layer for Store Meta.
 *
 * Stores the normalised `StoreMeta` type from `@/lib/storeMeta` with a
 * `createdAt` and `updatedAt` timestamp.
 */

import { getDb } from "@/lib/mongodb";
import type { StoreMeta, PagedStoreMeta } from "@/lib/storeMeta";

const COLLECTION = "storeMeta";

interface StoreMetaDoc extends StoreMeta {
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreMetaQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

// ---------------------------------------------------------------------------
// Read — used by the API route
// ---------------------------------------------------------------------------

function buildFilter(query: StoreMetaQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (query.search?.trim()) {
    filter.$or = [
      { slug: { $regex: query.search.trim(), $options: "i" } },
      { categories: { $regex: query.search.trim(), $options: "i" } },
    ];
  }

  return filter;
}

export async function getStoreMetasFromDb(
  query: StoreMetaQuery,
): Promise<PagedStoreMeta> {
  const db = await getDb();
  const col = db.collection<StoreMetaDoc>(COLLECTION);

  const filter = buildFilter(query);

  const pageSize = Math.min(
    Math.max(1, query.pageSize || 24),
    100,
  );
  const total = await col.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page || 1), totalPages);
  const skip = (page - 1) * pageSize;

  const docs = await col
    .find(filter, { projection: { _id: 0, createdAt: 0, updatedAt: 0 } })
    .sort({ advertiserId: 1 })
    .skip(skip)
    .limit(pageSize)
    .toArray();

  return {
    storeMetas: docs as unknown as StoreMeta[],
    page,
    pageSize,
    total,
    totalPages,
  };
}

export async function getStoreMetaById(id: number): Promise<StoreMeta | null> {
  const db = await getDb();
  const col = db.collection<StoreMetaDoc>(COLLECTION);
  const doc = await col.findOne({ id }, { projection: { _id: 0, createdAt: 0, updatedAt: 0 } });
  return (doc as unknown as StoreMeta) || null;
}

export async function getStoreMetaByAdvertiserId(advertiserId: number): Promise<StoreMeta | null> {
  const db = await getDb();
  const col = db.collection<StoreMetaDoc>(COLLECTION);
  const doc = await col.findOne({ advertiserId }, { projection: { _id: 0, createdAt: 0, updatedAt: 0 } });
  return (doc as unknown as StoreMeta) || null;
}

export async function getNextStoreMetaId(): Promise<number> {
  const db = await getDb();
  const col = db.collection<StoreMetaDoc>(COLLECTION);
  const maxDoc = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const maxId = maxDoc.length > 0 ? maxDoc[0].id : 0;
  return Math.max(maxId + 1, 1);
}

// ---------------------------------------------------------------------------
// Write — used by Admin API
// ---------------------------------------------------------------------------

export async function createStoreMeta(meta: StoreMeta): Promise<StoreMeta> {
  const db = await getDb();
  const col = db.collection<StoreMetaDoc>(COLLECTION);

  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ advertiserId: 1 }, { unique: true });
  await col.createIndex({ slug: 1 }); // Optional explicit slug

  const now = new Date();
  const doc: StoreMetaDoc = {
    ...meta,
    createdAt: now,
    updatedAt: now,
  };

  await col.updateOne(
    { id: meta.id },
    { $set: doc },
    { upsert: true }
  );

  return meta;
}

export async function updateStoreMeta(
  id: number,
  data: Partial<StoreMeta>,
): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<StoreMetaDoc>(COLLECTION);

  const result = await col.updateOne(
    { id },
    { $set: { ...data, updatedAt: new Date() } }
  );

  return result.matchedCount > 0;
}

export async function deleteStoreMeta(id: number): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<StoreMetaDoc>(COLLECTION);

  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}
