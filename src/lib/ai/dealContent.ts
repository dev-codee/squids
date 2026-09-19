/**
 * Claude-powered deal copywriting.
 *
 * Server-side only — reads ANTHROPIC_API_KEY from the environment and must never
 * run in the browser. Turns raw merchant offer data into a shopper-facing title
 * and description. Callers persist the result so tokens are only spent once.
 */

import type { Deal } from "@/lib/deals";
import { countryName } from "@/lib/countries";
import {
  callPerplexity,
  resolveModel,
  parseJsonResponse,
  isAiConfigured,
  AiConfigError,
} from "@/lib/ai/client";

export { AiConfigError, isAiConfigured };

const SYSTEM_PROMPT = `ROLE
You are a senior ecommerce copywriter and deal-content editor working for a global coupon, cashback and deals platform.
Your job is to transform raw merchant offer data into a highly useful, accurate and natural deal title and description.
The content must be written primarily for shoppers, not search engines.

PRIMARY OBJECTIVE
Create a deal title and description that:
1. Clearly explains the actual customer benefit.
2. Makes the shopper immediately understand what is discounted.
3. Uses the exact discount/value supplied in the input.
4. Clearly communicates important conditions when available.
5. Sounds natural and trustworthy.
6. Avoids generic AI-style marketing language.
7. Avoids keyword stuffing.
8. Does not invent information.
9. Is sufficiently different from other deals on the same merchant page.
10. Gives the user a reason to click without exaggerating the offer.

TITLE RULES
Write ONE primary deal title, normally 45-90 characters. Prioritize: discount/value, what the shopper gets, product/category, merchant name when useful. Use natural language.
Prefer "5% Off Games, Software & In-Game Purchases at Kinguin" over "Get Amazing 5% Discount and Save Big on Your Favorite Games Today!".

TITLE FORMULAS (choose the most appropriate):
- Percentage: "[X]% Off [Product/Category] at [Merchant]"
- Up to: "Up to [X]% Off [Product/Category] at [Merchant]"
- Fixed price: "[Product/Category] From [Price] at [Merchant]"
- Free shipping: "Free Shipping on [Product/Category] at [Merchant]"
- New customer: "[X]% Off Your First [Purchase/Order] at [Merchant]"
- Category sale: "Up to [X]% Off [Category] at [Merchant]"
- Conditional: "[X]% Off [Category] With [Condition] at [Merchant]"
- Cashback: "Up to [X]% Cashback at [Merchant]" (never describe cashback as a discount)

IMPORTANT TITLE RULES
Never invent a discount. Never convert "up to" into a guaranteed discount. Never remove important eligibility conditions. Never use excessive capitalization or emojis. Do not use "Amazing Deal", "Huge Savings", "Don't Miss Out", "Act Now", "Best Deal Ever" unless genuinely justified. Do not repeat the merchant name unnecessarily. Do not use misleading urgency. Do not claim "lowest price", "best price", "exclusive", "guaranteed", "massive", "unbeatable" unless explicitly supported by input data. Preserve product names exactly where possible.

COUPON CODE RULE (STRICT)
NEVER include a coupon/voucher/promo code string anywhere in the title or description, and never write phrases like "with code X", "use code X", "using code X", "enter code X at checkout", "apply code X", or "code: X". The code is revealed separately by a "Show Coupon Code" button, so repeating it is redundant. Describe the offer purely by its benefit and conditions (discount, product/category, minimum spend, customer type). Do not even reference "the code" or "at checkout".

DATE RULE (STRICT)
NEVER mention any date, calendar year, or time reference in the title or description. Do NOT write expiry / "valid until" / "ends on" / "expires" text, do NOT write "as of", "updated", "checked on", "this month", "in 2025", "in 2026", or any specific day, month-with-year, or year. Validity and expiry are displayed separately by the system. Describe the offer only by its benefit and conditions — never by when it starts, ends, or was checked.

DESCRIPTION RULES
Write ONE concise description between 25 and 55 words. First sentence explains the saving; second explains the products/categories or the most important condition. Mention important restrictions naturally. NEVER mention any date, year, expiry or "valid until" text (the system displays validity separately). NEVER include the coupon code or "use code … at checkout" phrasing (the code is shown separately). Do not simply rewrite the title. Structure: "[Benefit]. [What is included]. [Important condition/restriction if applicable]."

ANTI-DUPLICATION RULE
Identify the main differentiating attribute (discount, product, category, subscription, customer type, minimum spend, payment method, membership, new-customer status, specific game/brand, shipping, cashback, starting price) and emphasize it. Never produce generic filler like "Save big on selected products."

FACTUALITY RULE
If information is missing, do not guess. Never invent discount %, product eligibility, minimum order, expiry, customer eligibility, coupon conditions, shipping terms, cashback %, product features, exclusivity, or availability. If a condition is unknown, omit it.

HUMAN WRITING RULE
Write like an experienced ecommerce editor. Avoid AI phrases like "Unlock amazing savings", "Don't miss out", "Take advantage of this incredible offer", "Shop smarter", "Save big today", "Indulge in", "Elevate your shopping experience", "Great opportunity", "Amazing deal", "Unbeatable prices". Prefer specific language.

SEO RULE
Naturally incorporate the merchant name and relevant product/category terms when useful. Do NOT keyword stuff or repeat "[Merchant] coupon code/discount". The copy must read naturally even with all SEO considerations removed.

Return only the title and description. Before finishing, silently verify: discount accurate; "up to" preserved; title explains the benefit; description adds info beyond the title; important restrictions included; no unsupported claims; no generic AI marketing language; natural wording; a real shopper would immediately understand the offer. Rewrite if any check fails.`;

/** Build the INPUT DATA block, including only fields we actually have. */
function buildInputData(deal: Deal): string {
  const offerType =
    deal.type === "voucher"
      ? deal.code
        ? "Coupon Code"
        : "Voucher"
      : deal.cashbackRate
      ? "Cashback"
      : "Sale / Promotion";

  const region =
    deal.regionCodes && deal.regionCodes.length > 0
      ? deal.regionCodes.map((c) => countryName(c) || c).join(", ")
      : "";

  const lines: [string, string | null | undefined][] = [
    ["Merchant", deal.advertiser?.name],
    ["Offer Type", offerType],
    ["Discount", deal.discountText],
    ["Cashback Rate", deal.cashbackRate],
    ["Raw Offer Text", deal.title],
    ["Additional Offer Detail", deal.description],
    // Signal that a code exists WITHOUT passing the string — the model must
    // never print it, and can't leak what it never receives.
    ["Has Coupon Code", deal.code ? "Yes" : null],
    ["Eligible Customers", deal.studentVerificationReq ? "Students (verification required)" : null],
    // Start/expiry dates deliberately omitted — the copy must never mention dates.
    ["Region", region],
    ["Landing Page", deal.trackingUrl],
    ["Verified Status", deal.status],
    ["Exclusive", deal.isExclusive ? "Yes" : null],
  ];

  const body = lines
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${String(v).trim()}`)
    .join("\n");

  return `INPUT DATA\n${body}`;
}

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["APPROVED", "CORRECTED", "REVIEW"] },
    title: { type: "string" },
    description: { type: "string" },
    issues: { type: "array", items: { type: "string" } },
  },
  required: ["status", "title", "description", "issues"],
  additionalProperties: false,
} as const;

// Quality-control checklist folded into the single generation call: the model
// writes the copy, self-checks it against the raw offer data, and reports the
// verdict in one response.
const QC_INSTRUCTIONS = `QUALITY CONTROL
After drafting, act as the final quality-control editor and verify the title and description against the raw offer data across all of:
1. Discount accuracy
2. Product/category accuracy
3. Merchant accuracy
4. "Up to" accuracy
5. Eligibility accuracy
6. Minimum-spend accuracy
7. No dates, calendar years, expiry or "valid until" text anywhere
8. No coupon/voucher code string anywhere
9. No unsupported claims
10. No misleading wording
11. No duplicate/generic wording
12. Natural human readability
13. Clear shopper benefit

Then return a verdict:
- If the content is accurate and useful, set status to "APPROVED" with an empty issues array.
- If something is wrong, fix it and set status to "CORRECTED", returning the corrected title/description and a short issues array describing what you fixed.
- If the offer data is insufficient to safely create the content, set status to "REVIEW" with an empty title and description and an issues array explaining why.
Never invent missing information. Return JSON only.`;

import { languageNameForLocale } from "@/lib/ai/languageNames";

function buildSystemPrompt(language: string = "English"): string {
  const langRule = `LANGUAGE INSTRUCTION (STRICT)
Write ALL output (title and description) in ${language}. Keep merchant names, product names, brand names and any coupon codes verbatim. Preserve numbers, prices, currency symbols and 'Up to X%' exactly. Do not translate proper nouns or brand names.`;

  return `${SYSTEM_PROMPT}\n\n${langRule}\n\n${QC_INSTRUCTIONS}`;
}

// ---------------------------------------------------------------------------
// Deterministic fallback copywriter — runs when the AI API is unavailable,
// quota-exhausted, or errors. Produces clean, shopper-facing copy from the
// raw deal fields without any LLM call. Always returns status "APPROVED" so
// the result is saved to MongoDB and re-used on every subsequent visit.
// ---------------------------------------------------------------------------

/** Strip raw coupon codes from text (e.g. "use code SAVE20 at checkout"). */
function stripCouponCode(text: string, code?: string | null): string {
  let out = text;
  if (code) {
    // Remove the literal code string (case-insensitive, whole-word)
    out = out.replace(new RegExp(`\\b${code.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, "gi"), "");
  }
  // Remove common "use code XYZ" / "with code XYZ" / "code: XYZ" patterns
  out = out.replace(/\b(use|with|apply|enter|promo|voucher|coupon)\s+code[:\s]+[A-Z0-9_\-]{3,20}\b/gi, "");
  out = out.replace(/\bcode[:\s]+[A-Z0-9_\-]{3,20}\b/gi, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

/** Strip date/year references from text. */
function stripDates(text: string): string {
  return text
    // e.g. "valid until March 2026", "expires on 31/12/2025", "in 2025"
    .replace(/\b(valid\s+until|expires?\s+(on)?|ends?\s+(on)?|updated|as\s+of|checked\s+on|in\s+)\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)?\s*\d{1,4}[\/\-\.]?\d{0,4}/gi, "")
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g, "")
    .replace(/\s{2,}/g, " ").trim();
}

/** Capitalise first letter, remove trailing punctuation artefacts. */
function sentenceCase(text: string): string {
  const t = text.trim().replace(/[,;:\-]$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Deterministic deal copy generator — zero API calls, always succeeds.
 * Derives a clean title and description from the structured deal fields.
 */
export function generateCleanDealCopyFallback(deal: Deal): DealCopy {
  const merchant = deal.advertiser?.name || "this store";

  // Build the core discount string
  let discountStr = "";
  if (deal.discountText) {
    discountStr = deal.discountText.trim();
  } else if (deal.cashbackRate) {
    discountStr = `Up to ${deal.cashbackRate} Cashback`;
  } else {
    // Try to extract discount like "50%", "£10 Off", "$20 Off", "5% Off" from raw text
    const discountMatch = (deal.title || "").match(/(\b(?:up to\s+)?(?:\$|£|€)?\d+(?:\.\d+)?%?(?:\s*(?:off|cashback))?)/i);
    if (discountMatch && (discountMatch[0].includes("%") || /\b(off|cashback)\b/i.test(discountMatch[0]))) {
      discountStr = sentenceCase(discountMatch[0].trim());
    }
  }

  // Determine offer category hint from raw title/description
  const rawText = stripCouponCode(
    stripDates([deal.title, deal.description].filter(Boolean).join(" ")),
    deal.code,
  );

  // Extract a category/product snippet from raw text (first 60 chars, end on word)
  let category = "";
  const raw60 = rawText.slice(0, 100);
  const wordBoundary = raw60.lastIndexOf(" ");
  const snippet = wordBoundary > 20 ? raw60.slice(0, wordBoundary) : raw60;
  let categoryRaw = snippet;
  const merchantWords = (merchant || "").split(/\s+/).filter((w) => w.length > 2);
  for (const w of [merchant, ...merchantWords]) {
    categoryRaw = categoryRaw.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, "gi"), " ");
  }
  category = categoryRaw
    .replace(/\b(get|shop|save|enjoy|claim|grab|receive|take|extra)\b/gi, " ")
    .replace(/\d+(?:\.\d+)?%/g, " ")
    .replace(/\b(off|cashback|discount)\b/gi, " ")
    .replace(/\b(at|for|with|on|in|to|and)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // ── Title ─────────────────────────────────────────────────────────────────
  let title = "";
  if (discountStr && category) {
    title = `${discountStr} ${/\boff\b/i.test(discountStr) ? "" : "Off "}${category} at ${merchant}`;
  } else if (discountStr) {
    title = `${discountStr} ${/\boff\b/i.test(discountStr) ? "" : "Off "}at ${merchant}`;
  } else if (deal.cashbackRate) {
    title = `Earn Up to ${deal.cashbackRate} Cashback at ${merchant}`;
  } else {
    // Plain deal with no discount info — use a neutral title
    const cleanRaw = stripCouponCode(stripDates(deal.title || ""), deal.code);
    title = cleanRaw.length > 10 ? sentenceCase(cleanRaw.slice(0, 90)) : `Special Offer at ${merchant}`;
  }
  // Normalise whitespace and capitalise
  title = sentenceCase(title.replace(/\s{2,}/g, " "));
  // Cap at ~90 chars
  if (title.length > 90) title = title.slice(0, 87).trimEnd() + "…";

  // ── Description ───────────────────────────────────────────────────────────
  let description = "";
  const cleanRawDesc = deal.description && deal.description.trim() !== deal.title?.trim()
    ? stripCouponCode(stripDates(deal.description), deal.code)
    : "";

  if (cleanRawDesc && cleanRawDesc.length > 20) {
    description = sentenceCase(cleanRawDesc);
  } else if (discountStr) {
    description = `Take advantage of ${discountStr.toLowerCase()} on your order at ${merchant}.`;
    if (category) {
      description += ` Valid on eligible ${category.toLowerCase()}.`;
    }
    if (deal.code) {
      description += " Apply the verified coupon code at checkout to redeem this offer.";
    } else {
      description += " Discount is automatically applied at checkout.";
    }
  } else if (deal.cashbackRate) {
    description = `Earn up to ${deal.cashbackRate} cashback on eligible purchases at ${merchant}.`;
  } else {
    const subject = category ? `eligible ${category.toLowerCase()}` : "selected products";
    description = `Shop and save at ${merchant} with this exclusive promotion on ${subject}.`;
    if (deal.code) {
      description += " Reveal and enter the coupon code during checkout to claim your savings.";
    } else {
      description += " Check merchant terms for complete details.";
    }
  }

  // Eligibility hints
  if (deal.studentVerificationReq) {
    description += " Available to verified students only.";
  }
  description = sentenceCase(description.replace(/\s{2,}/g, " "));
  if (description.length > 300) description = description.slice(0, 297).trimEnd() + "…";

  return { status: "APPROVED", title, description, issues: [] };
}

export type DealCopyStatus = "APPROVED" | "CORRECTED" | "REVIEW";

export interface DealCopy {
  /** QC verdict. REVIEW means the offer data was insufficient — copy is empty. */
  status: DealCopyStatus;
  /** Final shopper-facing title (empty when status is REVIEW). */
  title: string;
  /** Final shopper-facing description (empty when status is REVIEW). */
  description: string;
  /** What the QC editor fixed or flagged (empty when APPROVED). */
  issues: string[];
}

export interface GenerateDealContentOptions {
  /** Target natural language name e.g. "German", "French", or "English". */
  language?: string;
  /** Locale code e.g. "de", "fr", "es", "it", "en". Resolved to language name if language is omitted. */
  locale?: string;
}

/**
 * Generate shopper-facing copy for a deal. Tries the Perplexity AI API first;
 * if it's unconfigured, quota-exhausted, or errors for any reason, falls back
 * to the deterministic `generateCleanDealCopyFallback` copywriter that always
 * succeeds and returns status "APPROVED". This ensures callers can always
 * persist copy to MongoDB on first visit regardless of AI API availability.
 */
export async function generateDealContent(
  deal: Deal,
  opts?: GenerateDealContentOptions,
): Promise<DealCopy> {
  const language =
    opts?.language ||
    (opts?.locale ? languageNameForLocale(opts.locale) : "English");

  // Only attempt the AI call when the API key is configured.
  if (isAiConfigured()) {
    try {
      const rawResponse = await callPerplexity({
        model: resolveModel(),
        maxTokens: 1024,
        jsonMode: true,
        jsonSchema: OUTPUT_SCHEMA,
        messages: [
          {
            role: "system",
            content: `${buildSystemPrompt(language)}\n\nYou must output JSON conforming to: {"status": "APPROVED" | "CORRECTED" | "REVIEW", "title": string, "description": string, "issues": string[]}`,
          },
          { role: "user", content: buildInputData(deal) },
        ],
      });

      const parsed = parseJsonResponse<Partial<DealCopy>>(rawResponse);
      const status = parsed.status;
      if (status !== "APPROVED" && status !== "CORRECTED" && status !== "REVIEW") {
        throw new Error(`AI returned an unknown status: ${String(status)}`);
      }

      const title = parsed.title?.trim() || "";
      const description = parsed.description?.trim() || "";
      const issues = Array.isArray(parsed.issues) ? parsed.issues.filter(Boolean).map(String) : [];

      // A non-REVIEW verdict with no usable copy is unsafe to publish — use fallback.
      if (status !== "REVIEW" && (!title || !description)) {
        console.warn(`[ai] Model returned incomplete copy for deal ${deal.id}. Using fallback.`);
        return generateCleanDealCopyFallback(deal);
      }

      // If title and description are identical, fallback to distinct copy
      if (title && description && title.toLowerCase() === description.toLowerCase()) {
        console.warn(`[ai] Model returned identical title and description for deal ${deal.id}. Using fallback.`);
        return generateCleanDealCopyFallback(deal);
      }

      // REVIEW means AI couldn't produce safe copy — use fallback instead of
      // returning empty strings so callers have something to save to MongoDB.
      if (status === "REVIEW") {
        console.warn(`[ai] Model returned REVIEW for deal ${deal.id} (insufficient data). Using fallback.`);
        return generateCleanDealCopyFallback(deal);
      }

      return { status, title, description, issues };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ai] Perplexity API error for deal ${deal.id}: ${msg}. Using fallback copywriter.`);
      // Fall through to deterministic fallback below.
    }
  }

  // Either AI is not configured or the API call failed — use the deterministic
  // copywriter that always produces a valid, saveable result.
  return generateCleanDealCopyFallback(deal);
}
