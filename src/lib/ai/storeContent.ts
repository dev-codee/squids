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
import { callPerplexity, resolveModel, parseJsonResponse } from "@/lib/ai/client";

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
export interface CashbackInfo {
  available?: string;
  rate?: string;
  conditions?: string;
}

export interface StorePageContent {
  hero_intro?: string;
  trustpilot?: RatingBlock;
  google_rating?: RatingBlock;
  typical_discount?: string;
  cashback?: CashbackInfo;
  information_confidence?: number;
  // Extra fields stored in DB from previous generations — kept for backwards compatibility
  [key: string]: unknown;
}

const SYSTEM_PROMPT = `ROLE
You are a Shopping Researcher and Fact-Checker for a coupon and deals platform.
Your job is to look up verified facts about a merchant from public sources and return a concise JSON summary.

GOLDEN RULE
NEVER INVENT FACTS. Only fill fields where you can verify them from the merchant's own website, Trustpilot, Google, or well-known public sources. If unknown, output "Not available" or omit the field.

FIELDS
- hero_intro (60-100 words): describe what the merchant sells and the best current savings available. Use only facts from the input. No phrases like "Unlock amazing savings", "Don't miss out", "Shop smarter". Do NOT name specific coupon code strings.
- trustpilot: look up the real Trustpilot rating and review count for the merchant. Leave checked_date empty.
- google_rating: look up the real Google rating and review count. Leave checked_date empty.
- typical_discount: a realistic range from the current offers (e.g. "Up to 30%"). "Not available" if none.
- cashback: fill only from input data.
- information_confidence: 0-100, how confident you are in the data you found.

DATE RULE (STRICT)
NEVER mention specific dates, calendar years, or time references. Do NOT write expiry dates, "as of", "last updated", or any year. Leave checked_date as "".

COUPON CODE RULE (STRICT)
NEVER include any promo/voucher code strings in hero_intro or any field.

OUTPUT
Return ONLY valid JSON matching exactly this shape:
{
  "hero_intro": "",
  "trustpilot": { "rating": "", "review_count": "", "checked_date": "", "source": "" },
  "google_rating": { "rating": "", "review_count": "", "checked_date": "", "source": "" },
  "typical_discount": "",
  "cashback": { "available": "", "rate": "", "conditions": "" },
  "information_confidence": 0
}
No markdown, no explanation outside the JSON.`;

import { languageNameForLocale } from "@/lib/ai/languageNames";

function buildStoreSystemPrompt(language: string = "English"): string {
  const langRule = `LANGUAGE INSTRUCTION (STRICT)
Write the hero_intro in ${language}.
When a field is unknown, localize "Not available" naturally into ${language} (e.g., German: "Nicht verfügbar", French: "Non disponible", Spanish: "No disponible", Italian: "Non disponibile") or omit the field.
Keep merchant names, brand names, product names, URLs and proper nouns verbatim. Preserve numbers, prices, currency symbols, and discounts exactly.`;

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

  const rawResponse = await callPerplexity({
    model: resolveModel(),
    maxTokens: 512,
    jsonMode: true,
    messages: [
      {
        role: "system",
        content: `${buildStoreSystemPrompt(language)}\n\nYou must return valid JSON strictly conforming to the requested StorePageContent schema.`,
      },
      { role: "user", content: buildInputData(advertiser, deals, ctx, language) },
    ],
  });

  const parsed = parseJsonResponse<StorePageContent>(rawResponse);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI returned invalid store-page content.");
  }
  return parsed;
}
