import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/mongodb";
import { CACHE_TAGS, PUBLIC_REVALIDATE } from "@/lib/cache";

const COLLECTION = "home_settings";

export interface HomeReview {
  author: string;
  rating: number; // 1-5
  comment: string;
}

export interface HomePopularShop {
  name: string;
  url: string; // Internal or external link
}

export interface HomeCategory {
  name: string;
  iconName: string; // e.g. "shopping-bag", "monitor"
  url: string;
}

export interface HomeFaq {
  question: string;
  answer: string;
}

export interface HomeSettings {
  _id?: string;
  reviews: HomeReview[];
  popularShops: HomePopularShop[];
  categories: HomeCategory[];
  faqs: HomeFaq[];
  updatedAt: Date;
}

const DEFAULT_SETTINGS: HomeSettings = {
  reviews: [],
  popularShops: [],
  categories: [],
  faqs: [],
  updatedAt: new Date(),
};

/**
 * Get the global home settings document.
 * If it doesn't exist, returns default empty settings.
 */
async function getHomeSettingsUncached(): Promise<HomeSettings> {
  const db = await getDb();
  const col = db.collection<HomeSettings>(COLLECTION);

  const doc = await col.findOne({});
  if (!doc) {
    return DEFAULT_SETTINGS;
  }
  return doc;
}

/** Cached home settings for the public homepage. */
export const getHomeSettings = unstable_cache(
  getHomeSettingsUncached,
  ["public:home-settings"],
  { revalidate: PUBLIC_REVALIDATE, tags: [CACHE_TAGS.homeSettings] },
);

/**
 * Update the global home settings document.
 * Overwrites the entire single document.
 */
export async function updateHomeSettings(data: Omit<HomeSettings, "_id" | "updatedAt">): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<HomeSettings>(COLLECTION);

  const doc = {
    ...data,
    updatedAt: new Date(),
  };

  const result = await col.updateOne(
    {},
    { $set: doc },
    { upsert: true }
  );

  return result.acknowledged;
}
