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
 * Localized "Verified Coupon codes and offers for the" phrasing, keyed by the
 * 2-letter language code. Used so the store title reads in the region's language
 * just like the rest of the store-page copy.
 */
const STORE_TITLE_PHRASE: Record<string, string> = {
  en: "Verified Coupon codes and offers for the",
  de: "Verifizierte Gutscheincodes und Angebote für",
  fr: "Codes promo vérifiés et offres pour",
  es: "Códigos de descuento verificados y ofertas para",
  it: "Codici sconto verificati e offerte per",
};

/** Capitalize the first letter (localized month names are lowercase in fr/es/it). */
function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Canonical store-title format with an auto-updating, localized month & year and
 * a phrase translated into the region's language.
 */
export function formatStoreTitle(
  storeName: string,
  date = new Date(),
  locale = "en",
): string {
  const cleanName = cleanAdvertiserName(storeName);
  const lang = (locale || "en").toLowerCase().slice(0, 2);
  const phrase = STORE_TITLE_PHRASE[lang] ?? STORE_TITLE_PHRASE.en;
  const month = capitalizeFirst(date.toLocaleDateString(lang, { month: "long" }));
  const year = date.getFullYear();
  return `${cleanName} ${phrase} ${month} ${year}`;
}

const EN_MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";

/**
 * Keep the "... for the <Month> <Year>" portion of a cached English store title
 * in sync with the current date, so previously generated/saved titles never show
 * a stale month or year.
 */
export function refreshStoreTitleDate(title: string, date = new Date()): string {
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const year = date.getFullYear();
  return title.replace(
    new RegExp(`(${EN_MONTHS})\\s+\\d{4}`, "i"),
    `${month} ${year}`,
  );
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
 * Generate a short, non-fluffy, localized SEO title and description for a store page.
 */
export function generateStoreSeoContent(
  storeName: string,
  deals: Deal[],
  locale = "en",
): StoreSeoResult {
  const cleanName = cleanAdvertiserName(storeName);
  const { maxDiscountText } = analyzeMaxDiscount(deals);

  const lang = (locale || "en").toLowerCase().slice(0, 2);
  const currentMonth = new Date().toLocaleDateString(lang, { month: "long" });
  const currentYear = new Date().getFullYear();

  // Store title format is fixed for every AI/auto-generated store, with the
  // month, year, and phrasing auto-localized to the region so the title reads in
  // the local language just like the rest of the store-page copy.
  const seoTitle = formatStoreTitle(storeName, new Date(), locale);

  let seoDescription: string;

  if (lang === "de") {
    if (maxDiscountText) {
      seoDescription = `Sparen Sie bis zu ${maxDiscountText} bei ${cleanName} mit verifizierten Gutscheincodes, Rabatten und Angeboten für ${currentMonth} ${currentYear}.`;
    } else {
      seoDescription = `Finden Sie verifizierte ${cleanName} Gutscheincodes, Rabatte und tägliche Angebote für ${currentMonth} ${currentYear}. Täglich aktualisiert.`;
    }
  } else if (lang === "fr") {
    if (maxDiscountText) {
      seoDescription = `Économisez jusqu'à ${maxDiscountText} chez ${cleanName} avec des codes promo vérifiés, des bons de réduction et des offres pour ${currentMonth} ${currentYear}.`;
    } else {
      seoDescription = `Trouvez des codes promo vérifiés, des bons de réduction et des offres quotidiennes pour ${cleanName} (${currentMonth} ${currentYear}). Mis à jour quotidiennement.`;
    }
  } else if (lang === "es") {
    if (maxDiscountText) {
      seoDescription = `Ahorra hasta un ${maxDiscountText} en ${cleanName} con códigos de descuento verificados, cupones y ofertas para ${currentMonth} ${currentYear}.`;
    } else {
      seoDescription = `Encuentra códigos de descuento verificados, cupones y ofertas diarias para ${cleanName} (${currentMonth} ${currentYear}). Actualizado a diario.`;
    }
  } else if (lang === "it") {
    if (maxDiscountText) {
      seoDescription = `Risparmia fino al ${maxDiscountText} su ${cleanName} con codici sconto verificati, coupon e offerte per ${currentMonth} ${currentYear}.`;
    } else {
      seoDescription = `Trova codici sconto verificati, coupon e offerte giornaliere per ${cleanName} (${currentMonth} ${currentYear}). Aggiornato quotidianamente.`;
    }
  } else {
    // English & default: ALWAYS use "Coupon Code" / "Coupon Codes" instead of "Promo Code"
    if (maxDiscountText) {
      seoDescription = `Save up to ${maxDiscountText} off at ${cleanName} with verified coupon codes, discount vouchers, and deals for ${currentMonth} ${currentYear}.`;
    } else {
      seoDescription = `Find verified ${cleanName} coupon codes, discount vouchers, and daily deals for ${currentMonth} ${currentYear}. Updated daily.`;
    }
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
  locale = "en",
): Promise<{
  seoTitle: string;
  seoDescription: string;
  maxDiscount: string | null;
}> {
  // 1. If admin or AI has already saved SEO title & description for English, return clean existing
  if (locale === "en" && advertiser.seoTitle && advertiser.seoDescription) {
    const cleanedTitle = refreshStoreTitleDate(
      advertiser.seoTitle
        .replace(/promo\s*codes?/gi, "Coupon Codes")
        .replace(/promo\s*code/gi, "Coupon Code")
        .replace(/\s*-\s*Foxzil\b/gi, "")
        .replace(/\bFoxzil\b\s*-\s*/gi, "")
        // Drop the legacy dot after the store name: "Name. Verified…" → "Name Verified…"
        .replace(/\.\s+(Verified\b)/i, " $1")
        .trim(),
    );
    const cleanedDesc = advertiser.seoDescription
      .replace(/promo\s*codes?/gi, "coupon codes")
      .replace(/promo\s*code/gi, "coupon code")
      .replace(/\bon Foxzil\b/gi, "")
      .replace(/\bby Foxzil Team\b/gi, "")
      .replace(/\bFoxzil\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    return {
      seoTitle: cleanedTitle,
      seoDescription: cleanedDesc,
      maxDiscount: advertiser.maxDiscount ?? null,
    };
  }

  // 2. Otherwise compute from deals & store name in target locale
  const generated = generateStoreSeoContent(advertiser.name, deals, locale);

  // The admin-editable cached seoTitle/seoDescription are stored in English only,
  // so for non-English regions always use the freshly generated, localized copy
  // (otherwise the title/description would leak English into a translated page).
  const isEnglish = (locale || "en").toLowerCase().slice(0, 2) === "en";

  // If advertiser has custom override for title or description, honor it (English only)
  const finalTitle = (isEnglish && advertiser.seoTitle) || generated.seoTitle;
  const finalDesc = (isEnglish && advertiser.seoDescription) || generated.seoDescription;
  const finalMaxDisc = advertiser.maxDiscount || generated.maxDiscount;

  // 3. Persist to MongoDB so it is saved for all subsequent visits and editable in
  // Admin. Only the canonical English copy is cached in the (locale-agnostic) doc;
  // non-English titles/descriptions are localized on the fly so a translated visit
  // never overwrites the shared field and leaks its language into other locales.
  if (isEnglish) {
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
  }

  return {
    seoTitle: finalTitle,
    seoDescription: finalDesc,
    maxDiscount: finalMaxDisc,
  };
}
