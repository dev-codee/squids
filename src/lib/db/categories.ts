/**
 * MongoDB persistence layer for Categories.
 */

import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export interface Category {
  id?: string;
  name: string;
  slug: string;
  icon: string;
  description?: string;
  isFeatured?: boolean;
  sortOrder?: number;
  storeCount?: number;
  dealCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CategoryDoc extends Omit<Category, "id"> {
  _id?: ObjectId;
}

const COLLECTION = "categories";

/** Convert category name to URL-friendly slug */
export function slugifyCategoryName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  { name: "Electronics & Tech", slug: "electronics-tech", icon: "💻", description: "Computers, smartphones, gadgets, and software deals.", isFeatured: true, sortOrder: 1, storeCount: 0, dealCount: 0 },
  { name: "Fashion & Apparel", slug: "fashion-apparel", icon: "👗", description: "Clothing, shoes, accessories, and jewelry discounts.", isFeatured: true, sortOrder: 2, storeCount: 0, dealCount: 0 },
  { name: "Travel & Hotels", slug: "travel-hotels", icon: "✈️", description: "Flight offers, hotel bookings, vacation packages, and car rentals.", isFeatured: true, sortOrder: 3, storeCount: 0, dealCount: 0 },
  { name: "Beauty & Health", slug: "beauty-health", icon: "💄", description: "Skincare, cosmetics, health supplements, and wellness.", isFeatured: true, sortOrder: 4, storeCount: 0, dealCount: 0 },
  { name: "Home & Garden", slug: "home-garden", icon: "🏡", description: "Furniture, home decor, kitchenware, and gardening supplies.", isFeatured: true, sortOrder: 5, storeCount: 0, dealCount: 0 },
  { name: "Sports & Outdoor", slug: "sports-outdoor", icon: "⚽", description: "Sporting goods, activewear, outdoor gear, and fitness.", isFeatured: true, sortOrder: 6, storeCount: 0, dealCount: 0 },
  { name: "Software & Services", slug: "software-services", icon: "🛠️", description: "SaaS tools, web hosting, VPNs, and digital services.", isFeatured: true, sortOrder: 7, storeCount: 0, dealCount: 0 },
  { name: "Food & Dining", slug: "food-dining", icon: "🍔", description: "Restaurants, meal kits, grocery delivery, and gourmet foods.", isFeatured: true, sortOrder: 8, storeCount: 0, dealCount: 0 },
  { name: "Toys & Gaming", slug: "toys-gaming", icon: "🎮", description: "Video games, consoles, toys, and collectibles.", isFeatured: false, sortOrder: 9, storeCount: 0, dealCount: 0 },
  { name: "Automotive", slug: "automotive", icon: "🚗", description: "Car parts, accessories, and auto services.", isFeatured: false, sortOrder: 10, storeCount: 0, dealCount: 0 },
];

/**
 * Seed default categories if collection is empty.
 */
export async function seedCategoriesIfEmpty(): Promise<void> {
  try {
    const db = await getDb();
    const col = db.collection<CategoryDoc>(COLLECTION);
    await col.createIndex({ slug: 1 }, { unique: true });

    const count = await col.estimatedDocumentCount();
    if (count === 0) {
      const now = new Date();
      const docs: CategoryDoc[] = DEFAULT_CATEGORIES.map((c) => ({
        ...c,
        createdAt: now,
        updatedAt: now,
      }));
      await col.insertMany(docs);
    }
  } catch (err) {
    console.error("[db/categories] Error seeding default categories:", err);
  }
}

function mapDoc(doc: CategoryDoc): Category {
  const { _id, ...rest } = doc;
  return {
    id: _id?.toString(),
    ...rest,
  };
}

/**
 * Fetch all categories with optional search or featured filtering.
 */
export async function getCategories(query?: {
  search?: string;
  featuredOnly?: boolean;
}): Promise<Category[]> {
  const db = await getDb();
  const col = db.collection<CategoryDoc>(COLLECTION);

  await seedCategoriesIfEmpty();

  const filter: Record<string, unknown> = {};
  if (query?.search?.trim()) {
    filter.name = { $regex: query.search.trim(), $options: "i" };
  }
  if (query?.featuredOnly) {
    filter.isFeatured = true;
  }

  const docs = await col
    .find(filter)
    .sort({ sortOrder: 1, name: 1 })
    .toArray();

  return docs.map(mapDoc);
}

/**
 * Get a single category by slug.
 */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  const db = await getDb();
  const col = db.collection<CategoryDoc>(COLLECTION);
  await seedCategoriesIfEmpty();

  const doc = await col.findOne({ slug: normalizedSlug });
  return doc ? mapDoc(doc) : null;
}

/**
 * Create a new category.
 */
export async function createCategory(data: Partial<Category>): Promise<Category> {
  const db = await getDb();
  const col = db.collection<CategoryDoc>(COLLECTION);

  const name = (data.name || "").trim();
  if (!name) throw new Error("Category name is required.");

  const slug = data.slug ? slugifyCategoryName(data.slug) : slugifyCategoryName(name);

  const existing = await col.findOne({ slug });
  if (existing) {
    throw new Error(`Category with slug "${slug}" already exists.`);
  }

  const now = new Date();
  const doc: CategoryDoc = {
    name,
    slug,
    icon: data.icon || "🏷️",
    description: data.description || "",
    isFeatured: Boolean(data.isFeatured),
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 99,
    storeCount: 0,
    dealCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const res = await col.insertOne(doc);
  return {
    id: res.insertedId.toString(),
    ...doc,
  };
}

/**
 * Update an existing category by ID or Slug.
 */
export async function updateCategory(
  idOrSlug: string,
  update: Partial<Category>,
): Promise<Category | null> {
  const db = await getDb();
  const col = db.collection<CategoryDoc>(COLLECTION);

  const filter = ObjectId.isValid(idOrSlug)
    ? { _id: new ObjectId(idOrSlug) }
    : { slug: idOrSlug.trim().toLowerCase() };

  const updateData: Partial<CategoryDoc> = {
    updatedAt: new Date(),
  };

  if (update.name !== undefined) updateData.name = update.name.trim();
  if (update.slug !== undefined) updateData.slug = slugifyCategoryName(update.slug);
  if (update.icon !== undefined) updateData.icon = update.icon.trim();
  if (update.description !== undefined) updateData.description = update.description;
  if (update.isFeatured !== undefined) updateData.isFeatured = Boolean(update.isFeatured);
  if (update.sortOrder !== undefined) updateData.sortOrder = Number(update.sortOrder);

  const res = await col.findOneAndUpdate(
    filter,
    { $set: updateData },
    { returnDocument: "after" },
  );

  return res ? mapDoc(res) : null;
}

/**
 * Delete a category by ID or Slug.
 */
export async function deleteCategory(idOrSlug: string): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<CategoryDoc>(COLLECTION);

  const filter = ObjectId.isValid(idOrSlug)
    ? { _id: new ObjectId(idOrSlug) }
    : { slug: idOrSlug.trim().toLowerCase() };

  const res = await col.deleteOne(filter);
  return res.deletedCount > 0;
}

/**
 * Recount storeCount and dealCount for all categories from advertisers and deals collections.
 */
export async function recountCategoryStats(): Promise<void> {
  try {
    const db = await getDb();
    const categoriesCol = db.collection<CategoryDoc>(COLLECTION);
    const advertisersCol = db.collection("advertisers");
    const dealsCol = db.collection("deals");

    const categories = await categoriesCol.find({}).toArray();

    for (const cat of categories) {
      const nameRegex = new RegExp(`^${cat.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
      const slugRegex = new RegExp(`^${cat.slug}$`, "i");

      // Count stores that match category name or slug in their categories array
      const storeCount = await advertisersCol.countDocuments({
        $or: [
          { categories: { $elemMatch: { $regex: nameRegex } } },
          { categories: { $elemMatch: { $regex: slugRegex } } },
          { categories: cat.name },
          { categories: cat.slug },
        ],
      });

      // Count active deals that match category
      const dealCount = await dealsCol.countDocuments({
        $or: [
          { category: cat.name },
          { category: cat.slug },
          { "advertiser.categories": { $elemMatch: { $regex: nameRegex } } },
        ],
      });

      await categoriesCol.updateOne(
        { _id: cat._id },
        { $set: { storeCount, dealCount, updatedAt: new Date() } },
      );
    }
  } catch (err) {
    console.error("[db/categories] Error recounting category stats:", err);
  }
}
