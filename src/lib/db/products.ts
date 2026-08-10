import { getDb } from "@/lib/mongodb";
import type { Product, PagedProducts } from "@/lib/products";

const COLLECTION = "products";

export interface ProductQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  advertiserId?: number;
}

export async function getProductsFromDb(query: ProductQuery): Promise<PagedProducts> {
  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);

  const filter: Record<string, unknown> = {};

  if (query.search?.trim()) {
    filter.title = { $regex: query.search.trim(), $options: "i" };
  }
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
    products: docs as Product[],
    page,
    pageSize,
    total,
    totalPages,
  };
}

export async function getNextProductId(): Promise<number> {
  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);
  const maxDoc = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  return maxDoc.length > 0 ? maxDoc[0].id + 1 : 10000;
}

export async function createProduct(product: Product): Promise<Product> {
  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);

  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ advertiserId: 1 });

  await col.updateOne({ id: product.id }, { $set: product }, { upsert: true });

  return product;
}

export async function updateProduct(id: number, data: Partial<Product>): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);

  const result = await col.updateOne({ id }, { $set: data });
  return result.matchedCount > 0;
}

export async function deleteProduct(id: number): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);

  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}
