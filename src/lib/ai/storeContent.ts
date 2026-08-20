/**
 * Claude-powered store/merchant page content.
 *
 * Server-side only. Turns the verified data we hold about a merchant (offers,
 * categories, rating, region) into a shopper-first store page: hero intro, trust
 * panel, best-time-to-shop, shipping/returns/payment summaries, saving strategy,
 * buying advice and FAQs. Follows a strict "never invent facts" rule — unknown
 * fields come back as "Not available" and are hidden on the page.
 *
 * Callers persist the result so tokens are only spent once per merchant.
 */

import type { Advertiser } from "@/lib/awin";
import type { Deal } from "@/lib/deals";
import { countryName } from "@/lib/countries";
import { getAnthropicClient, resolveModel, parseJsonResponse } from "@/lib/ai/client";

export { AiConfigError, isAiConfigured } from "@/lib/ai/client";

// ---------------------------------------------------------------------------
// Output shape (a pragmatic subset of the full brief, matched by the prompt)
// ---------------------------------------------------------------------------

export interface RatingBlock {
  rating?: string;
  review_count?: string;
  checked_date?: string;
  source?: string;
}
export interface BestTimeToShop {
  season?: string;
  months?: string[];
  events?: string[];
  reason?: string;
  confidence?: string;
}
export interface CalendarMonth {
  month: string;
  activity: string; // "High" | "Medium" | "Low"
}
export interface ShippingInfo {
  free_shipping?: string;
  threshold?: string;
  standard_cost?: string;
  delivery_time?: string;
  international_shipping?: string;
}
export interface ReturnsInfo {
  return_window?: string;
  refund?: string;
  exchange?: string;
  return_shipping?: string;
  conditions?: string;
}
export interface CashbackInfo {
  available?: string;
  rate?: string;
  conditions?: string;
}
export interface WarrantyInfo {
  available?: string;
  period?: string;
  conditions?: string;
}
export interface StoreFaq {
  question: string;
  answer: string;
}

export interface StorePageContent {
  hero_heading?: string;
  hero_intro?: string;
  meta_title?: string;
  meta_description?: string;
  trustpilot?: RatingBlock;
  google_rating?: RatingBlock;
  best_time_to_shop?: BestTimeToShop;
  typical_discount?: string;
  cashback?: CashbackInfo;
  shipping?: ShippingInfo;
  returns?: ReturnsInfo;
  warranty?: WarrantyInfo;
  payment_methods?: string[];
  best_saving_strategy?: string;
  shopping_calendar?: CalendarMonth[];
  merchant_overview?: string;
  categories?: string[];
  how_to_use_coupon?: string[];
  buying_advice?: string;
  editorial_tips?: string[];
  faq?: StoreFaq[];
  trust_information?: string;
  affiliate_disclosure?: string;
  information_confidence?: number;
  review_required?: boolean;
  review_reasons?: string[];
}

const SYSTEM_PROMPT = `ROLE
You are a Senior Ecommerce Copywriter, Shopping Researcher and Editorial Fact-Checker for a coupon, deals and cashback platform.
Create a highly useful merchant/store page that helps shoppers understand what the store sells, current coupons/deals, cashback, typical savings, best times to shop, seasonal promotions, shipping, returns/refunds, payment methods, customer ratings, trust signals and practical ways to save money.
Write for SHOPPERS FIRST; SEO is secondary. Never add information merely to increase word count or keyword density.

GOLDEN RULE
NEVER INVENT FACTS. If a fact cannot be verified from the supplied INPUT DATA, use "Not available" or omit the field. Never estimate ratings, review counts, return periods, shipping prices, free-shipping thresholds, delivery times, discount percentages, best months/seasons, payment methods, cashback rates or warranty periods unless the input supports them. Preserve "Up to X%" exactly — never rewrite it as "X% off".

WHAT YOU MAY WRITE FREELY (grounded in the offers/categories provided)
- hero_heading and hero_intro (60-100 words): what the merchant sells, what current savings are available, whether cashback exists, why to check the page. No phrases like "Unlock amazing savings", "Don't miss out", "Shop smarter". Use concrete facts from the input.
- merchant_overview (100-180 words), categories, how_to_use_coupon steps, buying_advice, editorial_tips, best_saving_strategy, and faq (6-10 Q&As) — but only answer FAQs for which the input has reliable information.
- typical_discount: a range only if supported by the current offers (e.g. "Up to 70%"); otherwise "Not available".

RATINGS / SHIPPING / RETURNS / PAYMENT / WARRANTY / CASHBACK
Only fill these from the input. Do NOT combine Trustpilot and Google into one score. Never output a checked_date (leave it ""), and never attach a date or year to a rating. If unknown, set fields to "Not available". For best_time_to_shop, only claim a season/event when historical or promotional evidence is provided; otherwise set confidence "Low" and reason "Not enough historical data".

AI WRITING RULES
Avoid: "Unlock incredible savings", "Don't miss out", "Shop smarter", "Perfect for everyone", "Treat yourself", "Unbeatable prices", "Ultimate shopping destination". Prefer specific facts over promotional adjectives.

COUPON CODE RULE (STRICT)
NEVER print specific promo/voucher/coupon code strings (e.g. "BV110", "B100", "SAVE20") anywhere in the output — not in best_saving_strategy, buying_advice, how_to_use_coupon, faq, hero_intro, merchant_overview or any other field. The codes are revealed separately by a "Show Code" button, so naming them is redundant and quickly goes stale. Describe savings by their BENEFIT and CONDITIONS instead (discount amount/percentage, order minimum, product/category, customer type) — e.g. "apply the highest-value code at checkout; fixed-amount discounts apply above set order minimums, and a percentage-off code covers sitewide orders — use whichever saves more". Never write "use code X", "with code X", or list code names.

DATE RULE (STRICT)
NEVER mention specific dates, calendar years, or time-stamped phrases anywhere in the output. Do NOT write expiry / "valid until" / "ends on" dates, "as of", "last updated", "checked on <date>", or any year (e.g. 2024, 2025, 2026). Always leave every checked_date field empty (""). You MAY use evergreen month names and seasons in best_time_to_shop and shopping_calendar (e.g. "November", "post-holiday sales", "summer") because these never go stale — but NEVER attach a year to them and never present them as a fixed deadline.

CALENDAR RULE
For each shopping_calendar entry, "activity" MUST be exactly ONE word: "High", "Medium", or "Low". Never add explanations, dates, years, or extra text to the activity value. The "month" value must be a bare month name (e.g. "January") with no year.

CONFIDENCE & REVIEW
Set information_confidence 0-100 based on how complete/recent the verified data is. Set review_required true (with review_reasons) if important fields could not be verified. Always include an affiliate_disclosure noting the site may earn commission from links.

OUTPUT
Return ONLY valid JSON matching exactly this shape (use "Not available" or omit unknown fields; arrays may be empty):
{
  "hero_heading": "", "hero_intro": "", "meta_title": "", "meta_description": "",
  "trustpilot": { "rating": "", "review_count": "", "checked_date": "", "source": "" },
  "google_rating": { "rating": "", "review_count": "", "checked_date": "", "source": "" },
  "best_time_to_shop": { "season": "", "months": [], "events": [], "reason": "", "confidence": "" },
  "typical_discount": "",
  "cashback": { "available": "", "rate": "", "conditions": "" },
  "shipping": { "free_shipping": "", "threshold": "", "standard_cost": "", "delivery_time": "", "international_shipping": "" },
  "returns": { "return_window": "", "refund": "", "exchange": "", "return_shipping": "", "conditions": "" },
  "warranty": { "available": "", "period": "", "conditions": "" },
  "payment_methods": [],
  "best_saving_strategy": "",
  "shopping_calendar": [ { "month": "January", "activity": "Low" } ],
  "merchant_overview": "",
  "categories": [],
  "how_to_use_coupon": [],
  "buying_advice": "",
  "editorial_tips": [],
  "faq": [ { "question": "", "answer": "" } ],
  "trust_information": "",
  "affiliate_disclosure": "",
  "information_confidence": 0,
  "review_required": false,
  "review_reasons": []
}
No markdown, no explanation outside the JSON.`;

import { languageNameForLocale } from "@/lib/ai/languageNames";

function buildStoreSystemPrompt(language: string = "English"): string {
  const langRule = `LANGUAGE INSTRUCTION (STRICT)
Write ALL shopper-facing text (hero_heading, hero_intro, meta_title, meta_description, best_saving_strategy, merchant_overview, categories, how_to_use_coupon, buying_advice, editorial_tips, faq questions and answers, trust_information, affiliate_disclosure, etc.) in ${language}.
When a field is unknown or not supported by input data, localize "Not available" naturally into ${language} (e.g., German: "Nicht verfügbar", French: "Non disponible", Spanish: "No disponible", Italian: "Non disponibile") or omit the field.
Keep merchant names, brand names, product names, URLs and proper nouns verbatim. Preserve numbers, prices, currency symbols, and discounts exactly.
Calendar activity values MUST still remain strictly one of "High", "Medium", or "Low".`;

  return `${SYSTEM_PROMPT}\n\n${langRule}`;
}

/** Compact one-line summary of the offers we hold for the merchant. */
function summariseOffers(deals: Deal[]): string {
  if (deals.length === 0) return "None on record.";
  return deals
    .slice(0, 30)
    .map((d) => {
      const parts = [d.aiTitle?.trim() || d.title];
      if (d.discountText) parts.push(`discount: ${d.discountText}`);
      // Deliberately NOT passing d.code — store-page prose must never name
      // specific promo/voucher codes (they are revealed via "Show Code").
      if (d.cashbackRate) parts.push(`cashback: ${d.cashbackRate}`);
      // Deliberately NOT passing expiry dates — store-page prose must never
      // mention any date (validity/expiry is displayed separately).
      return `- ${parts.join(" | ")}`;
    })
    .join("\n");
}

export interface StoreContentContext {
  country: string;
  currency: string;
  language?: string;
  locale?: string;
}

function buildInputData(
  advertiser: Advertiser,
  deals: Deal[],
  ctx: StoreContentContext,
  language: string,
): string {
  const coupons = deals.filter((d) => d.type === "voucher");
  const promos = deals.filter((d) => d.type === "promotion");
  const cashbackDeal = deals.find((d) => d.cashbackRate || d.subtype === "cashback");

  const lines: [string, string | null | undefined][] = [
    ["Merchant", advertiser.name],
    ["Merchant URL", advertiser.url],
    ["Country", `${countryName(ctx.country) || ctx.country} (${ctx.country})`],
    ["Currency", ctx.currency],
    ["Target Language", language],
    ["Store Categories", advertiser.categories?.join(", ")],
    ["Merchant Description", advertiser.description],
    ["Customer Rating (internal)", advertiser.rating ? `${advertiser.rating}/5` : null],
    ["Typical Savings (internal)", advertiser.avgSavings],
    ["Cashback", cashbackDeal?.cashbackRate || (cashbackDeal ? "Available" : null)],
    ["Active Coupons Count", String(coupons.length)],
    ["Active Deals Count", String(promos.length)],
    // "Last Verified" date deliberately omitted — the copy must never output a date.
  ];

  const body = lines
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${String(v).trim()}`)
    .join("\n");

  return `INPUT DATA\n${body}\n\nCurrent Offers:\n${summariseOffers(deals)}`;
}

/**
 * Generate store-page content for a merchant via Claude in the specified language.
 * Returns a best-effort StorePageContent; fields it can't verify come back as localized "Not available".
 *
 * @throws {AiConfigError} when ANTHROPIC_API_KEY is not set.
 */
export async function generateStorePageContent(
  advertiser: Advertiser,
  deals: Deal[],
  ctx: StoreContentContext,
): Promise<StorePageContent> {
  const language =
    ctx.language ||
    (ctx.locale ? languageNameForLocale(ctx.locale) : "English");

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: resolveModel(),
    max_tokens: 4096,
    system: buildStoreSystemPrompt(language),
    messages: [{ role: "user", content: buildInputData(advertiser, deals, ctx, language) }],
  });

  const parsed = parseJsonResponse<StorePageContent>(response);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI returned invalid store-page content.");
  }
  return parsed;
}
