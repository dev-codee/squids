/**
 * AI & Automated Store SEO Title & Short Description Generator
 *
 * Analyzes all active deals and coupons for a given merchant to find the
 * maximum discount percentage (e.g., 50% Off, 70% Off), and generates a
 * concise, non-fluffy SEO title and short description.
 *
 * Persisted to MongoDB on first visit and fully editable from the Admin Panel.
 */

import { getDb } from "@/lib/mongodb";
import type { Advertiser } from "@/lib/awin";
import type { Deal } from "@/lib/deals";
import { cleanAdvertiserName } from "@/lib/networks";

export interface StoreSeoResult {
  seoTitle: string;
  seoDescription: string;
  maxDiscount: string | null;
}

/**
 * Scan all store deals and coupons to find the maximum discount percentage
 * or top savings phrase (e.g., "70%", "50%", "$20 Off").
 */
export function analyzeMaxDiscount(deals: Deal[]): {
  maxPercent: number | null;
  maxDiscountText: string | null;
} {
  let maxPercent: number | null = null;
  let topTextFallback: string | null = null;

  for (const deal of deals) {
    const textSources = [
      deal.discountText,
      deal.title,
      deal.description,
    ].filter(Boolean);

    // 1. Calculate percentage from price savings if available
    if (
      typeof deal.originalPrice === "number" &&
      typeof deal.salePrice === "number" &&
      deal.originalPrice > deal.salePrice &&
      deal.salePrice > 0
    ) {
      const pct = Math.round(
        ((deal.originalPrice - deal.salePrice) / deal.originalPrice) * 100,
      );
      if (pct > 0 && (maxPercent === null || pct > maxPercent)) {
        maxPercent = pct;
      }
    }

    // 2. Parse percentage strings from discountText, title, description (e.g. "50%", "up to 70% off")
    for (const text of textSources) {
      if (!text) continue;
      const matches = text.match(/\b(\d{1,2})\s*%/g);
      if (matches) {
        for (const m of matches) {
          const num = Number.parseInt(m.replace(/\D/g, ""), 10);
          if (num > 0 && num <= 95) {
            if (maxPercent === null || num > maxPercent) {
              maxPercent = num;
            }
          }
        }
      }

      if (!topTextFallback && deal.discountText?.trim()) {
        topTextFallback = deal.discountText.trim();
      }
    }
  }

  if (maxPercent !== null && maxPercent > 0) {
    return {
      maxPercent,
      maxDiscountText: `${maxPercent}%`,
    };
  }

  return {
    maxPercent: null,
    maxDiscountText: topTextFallback,
  };
}

/**
 * Generate a short, non-fluffy SEO title and description for a store page.
 */
export function generateStoreSeoContent(
  storeName: string,
  deals: Deal[],
): StoreSeoResult {
  const cleanName = cleanAdvertiserName(storeName);
  const { maxDiscountText } = analyzeMaxDiscount(deals);

  const currentMonth = new Date().toLocaleString("default", { month: "long" });
  const currentYear = new Date().getFullYear();

  let seoTitle: string;
  let seoDescription: string;

  if (maxDiscountText) {
    seoTitle = `${cleanName} Promo Codes & Up to ${maxDiscountText} Off (${currentMonth} ${currentYear})`;
    seoDescription = `Save up to ${maxDiscountText} off at ${cleanName} with verified promo codes, discount vouchers, and deals for ${currentMonth} ${currentYear}.`;
  } else {
    seoTitle = `${cleanName} Promo Codes, Vouchers & Deals (${currentMonth} ${currentYear})`;
    seoDescription = `Find verified ${cleanName} promo codes, discount vouchers, and daily deals for ${currentMonth} ${currentYear}. Updated daily.`;
  }

  return {
    seoTitle,
    seoDescription,
    maxDiscount: maxDiscountText,
  };
}

/**
 * Ensure an advertiser document in MongoDB has cached `seoTitle`, `seoDescription`,
 * and `maxDiscount`. If missing, auto-generates them on first visit and persists to DB.
 */
export async function ensureAdvertiserSeo(
  advertiser: Advertiser,
  deals: Deal[],
): Promise<{
  seoTitle: string;
  seoDescription: string;
  maxDiscount: string | null;
}> {
  // 1. If admin or AI has already saved SEO title & description, return existing
  if (advertiser.seoTitle && advertiser.seoDescription) {
    return {
      seoTitle: advertiser.seoTitle,
      seoDescription: advertiser.seoDescription,
      maxDiscount: advertiser.maxDiscount ?? null,
    };
  }

  // 2. Otherwise compute from deals & store name
  const generated = generateStoreSeoContent(advertiser.name, deals);

  // If advertiser has custom override for title or description, honor it
  const finalTitle = advertiser.seoTitle || generated.seoTitle;
  const finalDesc = advertiser.seoDescription || generated.seoDescription;
  const finalMaxDisc = advertiser.maxDiscount || generated.maxDiscount;

  // 3. Persist to MongoDB so it is saved for all subsequent visits and editable in Admin
  try {
    const db = await getDb();
    await db.collection("advertisers").updateOne(
      { id: advertiser.id, network: advertiser.network ?? "awin" },
      {
        $set: {
          seoTitle: finalTitle,
          seoDescription: finalDesc,
          maxDiscount: finalMaxDisc,
          seoGeneratedAt: new Date(),
        },
      },
    );
  } catch (err) {
    console.warn(
      `[seo] Failed to persist SEO content for ${advertiser.name}:`,
      err,
    );
  }

  return {
    seoTitle: finalTitle,
    seoDescription: finalDesc,
    maxDiscount: finalMaxDisc,
  };
}
