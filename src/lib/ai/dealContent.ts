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
  getAnthropicClient,
  resolveModel,
  parseJsonResponse,
} from "@/lib/ai/client";

export { AiConfigError, isAiConfigured } from "@/lib/ai/client";

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
 * Generate shopper-facing copy for a deal in a single Claude call: the model
 * drafts the title/description, self-QCs it against the raw offer data, and
 * returns a verdict in the specified language (default English).
 *
 * @throws {AiConfigError} when ANTHROPIC_API_KEY is not set.
 */
export async function generateDealContent(
  deal: Deal,
  opts?: GenerateDealContentOptions,
): Promise<DealCopy> {
  const language =
    opts?.language ||
    (opts?.locale ? languageNameForLocale(opts.locale) : "English");

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: resolveModel(),
    max_tokens: 1024,
    system: buildSystemPrompt(language),
    // Structured outputs guarantee a valid verdict object.
    // Note: no `effort` here — it isn't supported on Haiku 4.5.
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [{ role: "user", content: buildInputData(deal) }],
  });

  const parsed = parseJsonResponse<Partial<DealCopy>>(response);
  const status = parsed.status;
  if (status !== "APPROVED" && status !== "CORRECTED" && status !== "REVIEW") {
    throw new Error(`AI returned an unknown status: ${String(status)}`);
  }

  const title = parsed.title?.trim() || "";
  const description = parsed.description?.trim() || "";
  const issues = Array.isArray(parsed.issues) ? parsed.issues.filter(Boolean).map(String) : [];

  // A non-REVIEW verdict with no usable copy is unsafe to publish — treat as REVIEW.
  if (status !== "REVIEW" && (!title || !description)) {
    return {
      status: "REVIEW",
      title: "",
      description: "",
      issues: issues.length ? issues : ["Model returned incomplete copy."],
    };
  }

  return {
    status,
    title: status === "REVIEW" ? "" : title,
    description: status === "REVIEW" ? "" : description,
    issues,
  };
}
