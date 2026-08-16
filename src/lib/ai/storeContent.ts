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
Only fill these from the input. Do NOT combine Trustpilot and Google into one score. Do not present an old rating without a date. If unknown, set fields to "Not available". For best_time_to_shop, only claim a season/event when historical or promotional evidence is provided; otherwise set confidence "Low" and reason "Not enough historical data".

AI WRITING RULES
Avoid: "Unlock incredible savings", "Don't miss out", "Shop smarter", "Perfect for everyone", "Treat yourself", "Unbeatable prices", "Ultimate shopping destination". Prefer specific facts over promotional adjectives.

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

/** Compact one-line summary of the offers we hold for the merchant. */
function summariseOffers(deals: Deal[]): string {
  if (deals.length === 0) return "None on record.";
  return deals
    .slice(0, 30)
    .map((d) => {
      const parts = [d.aiTitle?.trim() || d.title];
      if (d.discountText) parts.push(`discount: ${d.discountText}`);
      if (d.code) parts.push(`code: ${d.code}`);
      if (d.cashbackRate) parts.push(`cashback: ${d.cashbackRate}`);
      if (d.endDate) parts.push(`expires: ${d.endDate.slice(0, 10)}`);
      return `- ${parts.join(" | ")}`;
    })
    .join("\n");
}

function buildInputData(
  advertiser: Advertiser,
  deals: Deal[],
  ctx: { country: string; currency: string },
): string {
  const coupons = deals.filter((d) => d.type === "voucher");
  const promos = deals.filter((d) => d.type === "promotion");
  const cashbackDeal = deals.find((d) => d.cashbackRate || d.subtype === "cashback");

  const lines: [string, string | null | undefined][] = [
    ["Merchant", advertiser.name],
    ["Merchant URL", advertiser.url],
    ["Country", `${countryName(ctx.country) || ctx.country} (${ctx.country})`],
    ["Currency", ctx.currency],
    ["Store Categories", advertiser.categories?.join(", ")],
    ["Merchant Description", advertiser.description],
    ["Customer Rating (internal)", advertiser.rating ? `${advertiser.rating}/5` : null],
    ["Typical Savings (internal)", advertiser.avgSavings],
    ["Cashback", cashbackDeal?.cashbackRate || (cashbackDeal ? "Available" : null)],
    ["Active Coupons Count", String(coupons.length)],
    ["Active Deals Count", String(promos.length)],
    ["Last Verified", new Date().toISOString().slice(0, 10)],
  ];

  const body = lines
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${String(v).trim()}`)
    .join("\n");

  return `INPUT DATA\n${body}\n\nCurrent Offers:\n${summariseOffers(deals)}`;
}

/**
 * Generate store-page content for a merchant via Claude. Returns a best-effort
 * StorePageContent; fields it can't verify come back as "Not available".
 *
 * @throws {AiConfigError} when ANTHROPIC_API_KEY is not set.
 */
export async function generateStorePageContent(
  advertiser: Advertiser,
  deals: Deal[],
  ctx: { country: string; currency: string },
): Promise<StorePageContent> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: resolveModel(),
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildInputData(advertiser, deals, ctx) }],
  });

  const parsed = parseJsonResponse<StorePageContent>(response);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI returned invalid store-page content.");
  }
  return parsed;
}
