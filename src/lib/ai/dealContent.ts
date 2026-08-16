/**
 * Claude-powered deal copywriting.
 *
 * Server-side only — reads ANTHROPIC_API_KEY from the environment and must never
 * run in the browser. Turns raw merchant offer data into a shopper-facing title
 * and description. Callers persist the result so tokens are only spent once.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Deal } from "@/lib/deals";
import { countryName } from "@/lib/countries";

/** Thrown when the Anthropic API key isn't configured. Lets callers no-op cleanly. */
export class AiConfigError extends Error {}

/** Default model — override with AI_MODEL (or ANTHROPIC_MODEL). */
const DEFAULT_MODEL = "claude-opus-4-8";

/** Resolve the configured model, preferring AI_MODEL. */
function resolveModel(): string {
  return process.env.AI_MODEL || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

let cachedClient: Anthropic | null = null;

/** Lazily construct the Anthropic client, throwing AiConfigError if unconfigured. */
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiConfigError(
      "Missing ANTHROPIC_API_KEY. Set it to enable AI deal-copy generation.",
    );
  }
  if (!cachedClient) cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

/** True when AI generation is available (key present). Safe to call anywhere. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM_PROMPT = `ROLE
You are a senior ecommerce copywriter and deal-content editor working for a global coupon, promo code, cashback and deals platform.
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
Never invent a discount. Never convert "up to" into a guaranteed discount. Never remove important eligibility conditions. Never use excessive capitalization or emojis. Do not use "Amazing Deal", "Huge Savings", "Don't Miss Out", "Act Now", "Best Deal Ever" unless genuinely justified. Do not repeat the merchant name unnecessarily. Do not put the coupon code in the title unless it materially helps identify the offer. Do not use misleading urgency. Do not claim "lowest price", "best price", "exclusive", "guaranteed", "massive", "unbeatable" unless explicitly supported by input data. Preserve product names exactly where possible.

DESCRIPTION RULES
Write ONE concise description between 25 and 55 words. First sentence explains the saving; second explains the products/categories or the most important condition. Mention important restrictions naturally. If an expiration date is provided, do NOT repeat it (the system displays expiry separately). Do not simply rewrite the title. Structure: "[Benefit]. [What is included]. [Important condition/restriction if applicable]."

ANTI-DUPLICATION RULE
Identify the main differentiating attribute (discount, product, category, subscription, customer type, minimum spend, payment method, membership, new-customer status, specific game/brand, shipping, cashback, starting price) and emphasize it. Never produce generic filler like "Save big on selected products."

FACTUALITY RULE
If information is missing, do not guess. Never invent discount %, product eligibility, minimum order, expiry, customer eligibility, coupon conditions, shipping terms, cashback %, product features, exclusivity, or availability. If a condition is unknown, omit it.

HUMAN WRITING RULE
Write like an experienced ecommerce editor. Avoid AI phrases like "Unlock amazing savings", "Don't miss out", "Take advantage of this incredible offer", "Shop smarter", "Save big today", "Indulge in", "Elevate your shopping experience", "Great opportunity", "Amazing deal", "Unbeatable prices". Prefer specific language.

SEO RULE
Naturally incorporate the merchant name and relevant product/category terms when useful. Do NOT keyword stuff or repeat "[Merchant] coupon/promo code/discount". The copy must read naturally even with all SEO considerations removed.

Return only the title and description. Before finishing, silently verify: discount accurate; "up to" preserved; title explains the benefit; description adds info beyond the title; important restrictions included; no unsupported claims; no generic AI marketing language; natural wording; a real shopper would immediately understand the offer. Rewrite if any check fails.`;

/** Build the INPUT DATA block, including only fields we actually have. */
function buildInputData(deal: Deal): string {
  const offerType =
    deal.type === "voucher"
      ? deal.code
        ? "Promo Code"
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
    ["Coupon Code", deal.code],
    ["Eligible Customers", deal.studentVerificationReq ? "Students (verification required)" : null],
    ["Expiration Date", deal.endDate],
    ["Start Date", deal.startDate],
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
    title: { type: "string" },
    description: { type: "string" },
  },
  required: ["title", "description"],
  additionalProperties: false,
} as const;

export interface DealCopy {
  title: string;
  description: string;
}

/**
 * Generate a shopper-facing title + description for a single deal via Claude.
 * Uses structured outputs so the result is always valid `{title, description}`.
 *
 * @throws {AiConfigError} when ANTHROPIC_API_KEY is not set.
 */
export async function generateDealContent(deal: Deal): Promise<DealCopy> {
  const client = getClient();
  const model = resolveModel();

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    // Structured outputs guarantee a valid { title, description } object.
    // Note: no `effort` here — it isn't supported on Haiku 4.5 and the detailed
    // system prompt already does the heavy lifting.
    output_config: {
      format: { type: "json_schema", schema: OUTPUT_SCHEMA },
    },
    messages: [{ role: "user", content: buildInputData(deal) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";
  let parsed: Partial<DealCopy>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`AI returned non-JSON deal copy: ${raw.slice(0, 200)}`);
  }

  const title = parsed.title?.trim();
  const description = parsed.description?.trim();
  if (!title || !description) {
    throw new Error("AI returned incomplete deal copy (missing title or description).");
  }
  return { title, description };
}
