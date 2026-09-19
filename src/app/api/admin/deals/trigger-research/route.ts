import { NextRequest, NextResponse } from "next/server";
import { getAdvertiserByIdFromDb } from "@/lib/db/advertisers";
import { saveDiscoveredDeals, type DiscoveredDealInput } from "@/lib/db/discovered-deals";

export const dynamic = "force-dynamic";

/**
 * System prompt for searching real coupon codes across popular coupon sites.
 */
const COUPON_RESEARCH_SYSTEM_PROMPT = `You are an expert ecommerce deal and coupon researcher.
Your task is to search across major coupon sites (such as RetailMeNot, CouponCabin, Slickdeals, Dealspotr, Honey) and official merchant sites to find current, active, verified promo codes, coupon codes, and discount deals for the requested store.

RULES:
1. Extract REAL coupon codes if available (e.g. "SAVE20", "WELCOME10", "FREESHIP").
2. Distinguish between:
   - "voucher": has a coupon/promo code
   - "deal": no code needed (sale, clearance, sitewide discount)
3. For discountText, use short punchy labels: e.g. "20% OFF", "$15 OFF", "FREE SHIPPING", "UP TO 50% OFF".
4. Exclude expired, invalid, or fake deals.
5. Provide a clear, shopper-friendly title and 1-2 sentence description explaining any exclusions.

Return ONLY a valid JSON object matching this schema:
{
  "deals": [
    {
      "title": "20% Off Storewide",
      "code": "CODE20",
      "type": "voucher",
      "discountText": "20% OFF",
      "description": "Save 20% on all orders. Exclusions may apply to new arrivals.",
      "terms": "Valid online only.",
      "sourceName": "RetailMeNot",
      "endDate": null
    }
  ]
}`;

/**
 * Call Perplexity Sonar with web search to research coupons.
 */
async function researchCouponsViaPerplexity(
  storeName: string,
  domain?: string,
): Promise<DiscoveredDealInput[]> {
  const apiKey =
    process.env.PERPLEXITY_API_KEY ||
    process.env.AI_API_KEY;

  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY or AI_API_KEY is not configured.");
  }

  const model = process.env.PERPLEXITY_MODEL || "sonar";

  const userPrompt = `Find all active coupon codes, discount codes, promo vouchers, and sale deals for "${storeName}" ${domain ? `(website: ${domain})` : ""} across popular coupon sites like RetailMeNot, CouponCabin, and the official site.`;

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: COUPON_RESEARCH_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1500,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Perplexity API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "{}";

  // Parse JSON from code fence or raw text
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const target = fence ? fence[1].trim() : text.trim();
  const start = target.indexOf("{");
  const end = target.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return [];
  }

  const parsed = JSON.parse(target.slice(start, end + 1));
  const rawDeals: any[] = Array.isArray(parsed.deals) ? parsed.deals : [];

  return rawDeals.map((d) => ({
    title: d.title || `Offer at ${storeName}`,
    description: d.description || null,
    code: d.code ? String(d.code).trim().toUpperCase() : undefined,
    type: (d.code ? "voucher" : (d.type || "deal")) as "voucher" | "deal",
    discountText: d.discountText || null,
    terms: d.terms || null,
    endDate: d.endDate || null,
    sourceName: d.sourceName || "AI Web Research",
  }));
}

/**
 * POST /api/admin/deals/trigger-research
 * Body: { advertiserId?: number, storeName?: string, domain?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const advertiserId = body.advertiserId ? Number(body.advertiserId) : undefined;
    let storeName = body.storeName ? String(body.storeName).trim() : "";
    let domain = body.domain ? String(body.domain).trim() : "";
    let network = body.network ? String(body.network).trim() : "awin";

    // If advertiserId is provided, enrich with store details from database
    if (advertiserId) {
      const adv = await getAdvertiserByIdFromDb(advertiserId);
      if (adv) {
        if (!storeName) storeName = adv.name;
        if (!domain && (adv as any).displayUrl) domain = (adv as any).displayUrl;
        if (!domain && adv.url) {
          try {
            domain = new URL(adv.url).hostname.replace(/^www\./, "");
          } catch {}
        }
        network = adv.network || network;
      }
    }

    if (!storeName) {
      return NextResponse.json(
        { error: "storeName or advertiserId is required." },
        { status: 400 },
      );
    }

    // 1. If an n8n webhook URL is configured, forward to n8n!
    const n8nWebhookUrl = process.env.N8N_RESEARCH_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      try {
        const n8nRes = await fetch(n8nWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            advertiserId,
            storeName,
            domain,
            network,
            triggeredAt: new Date().toISOString(),
          }),
        });

        if (n8nRes.ok) {
          const n8nData = await n8nRes.json().catch(() => ({}));
          return NextResponse.json({
            ok: true,
            mode: "n8n",
            message: "Dispatched research job to n8n workflow.",
            n8nResponse: n8nData,
          });
        }
        console.warn("[trigger-research] n8n returned non-200, falling back to direct AI search:", n8nRes.status);
      } catch (n8nErr) {
        console.warn("[trigger-research] n8n webhook unreachable, falling back to direct AI search:", n8nErr);
      }
    }

    // 2. Direct AI search fallback (Perplexity Sonar Web Search)
    const discoveredItems = await researchCouponsViaPerplexity(storeName, domain);

    if (discoveredItems.length === 0) {
      return NextResponse.json({
        ok: true,
        mode: "ai_direct",
        message: `No active coupons found across popular sites for ${storeName}.`,
        inserted: 0,
        skippedExisting: 0,
      });
    }

    // Attach advertiserId and network
    const candidateInputs = discoveredItems.map((item) => ({
      ...item,
      advertiserId,
      advertiserName: storeName,
      network,
    }));

    const result = await saveDiscoveredDeals(candidateInputs, advertiserId);

    return NextResponse.json({
      ok: true,
      mode: "ai_direct",
      message: `Discovered ${discoveredItems.length} coupons for ${storeName} (${result.inserted} new staged for review, ${result.skippedExisting} already existing).`,
      inserted: result.inserted,
      skippedExisting: result.skippedExisting,
      deals: result.items,
    });
  } catch (error) {
    console.error("[/api/admin/deals/trigger-research] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to execute coupon research." },
      { status: 500 },
    );
  }
}
