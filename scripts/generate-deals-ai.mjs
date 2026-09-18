/**
 * Bulk Deal Title & Description Generator via Perplexity AI
 *
 * Scans MongoDB for deals lacking an AI-generated title and description,
 * calls Perplexity AI (Sonar) to generate high-quality shopper-facing copy,
 * and updates the database in real-time.
 *
 * Usage:
 *   node --env-file=.env.local scripts/generate-deals-ai.mjs [options]
 *
 * Options:
 *   --limit <number>       Max number of deals to process (default: 50, 0 for all)
 *   --store <slug/name>    Only process deals for a specific store
 *   --concurrency <n>      Parallel requests to Perplexity (default: 2)
 *   --delay <ms>           Pause between calls to prevent rate limiting (default: 600)
 *   --force                Regenerate copy even if deal already has aiTitle
 */

import { MongoClient } from "mongodb";

// --- CLI arguments parser ---
const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return def;
}
const hasFlag = (name) => args.includes(name);

const LIMIT = parseInt(getArg("--limit", "50"), 10);
const STORE = getArg("--store", null);
const CONCURRENCY = parseInt(getArg("--concurrency", "1"), 10);
const DELAY_MS = parseInt(getArg("--delay", "800"), 10);
const FORCE = hasFlag("--force");

const API_KEY =
  process.env.PERPLEXITY_API_KEY ||
  process.env.AI_API_KEY ||
  process.env.ANTHROPIC_API_KEY;

let MODEL = process.env.PERPLEXITY_MODEL || "sonar";
if (process.env.AI_MODEL && !process.env.AI_MODEL.startsWith("claude")) {
  MODEL = process.env.AI_MODEL;
}

if (!API_KEY) {
  console.error("❌ Error: Missing PERPLEXITY_API_KEY in environment or .env.local.");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- System prompt ---
const SYSTEM_PROMPT = `ROLE
You are a senior ecommerce copywriter and deal-content editor for a global coupon and deals platform.
Transform raw merchant offer data into a highly useful, accurate, and natural deal title and description for shoppers.

TITLE RULES:
- Write ONE primary deal title (45-90 characters).
- Formats: "[X]% Off [Product/Category] at [Merchant]", "Up to [X]% Off [Product/Category] at [Merchant]", "[Product] From [Price] at [Merchant]", "Free Shipping on [Product] at [Merchant]".
- Never invent discounts or convert "up to" into guaranteed discounts.
- NEVER mention coupon codes (e.g. "use code", "code: XYZ").
- NEVER mention dates, months, or years (e.g. "in 2026", "expires", "valid until").

DESCRIPTION RULES:
- Write ONE concise description between 25 and 55 words.
- Sentence 1: Explains the discount/saving.
- Sentence 2: Explains included products/categories or restrictions.
- NEVER include promo codes or date/year references.

Return ONLY a valid JSON object matching this exact schema:
{
  "status": "APPROVED",
  "title": "string",
  "description": "string",
  "issues": []
}`;

function buildPrompt(deal) {
  const lines = [
    `Merchant: ${deal.advertiser?.name || deal.storeName || "Merchant"}`,
    `Offer Type: ${deal.code ? "Coupon Code" : "Sale / Discount"}`,
    `Discount: ${deal.discountText || ""}`,
    `Raw Offer Title: ${deal.title || ""}`,
    `Raw Offer Description: ${deal.description || ""}`,
    `Has Coupon Code: ${deal.code ? "Yes" : "No"}`,
  ];
  return lines.filter(Boolean).join("\n");
}

function parseJson(text) {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const target = fence ? fence[1].trim() : trimmed;

  const start = target.indexOf("{");
  const end = target.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return JSON.parse(target.slice(start, end + 1));
  }
  return JSON.parse(target);
}

async function callPerplexity(prompt, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 1024,
        temperature: 0.2,
        response_format: {
          type: "json_schema",
          json_schema: {
            schema: {
              type: "object",
              properties: {
                status: { type: "string", enum: ["APPROVED", "CORRECTED", "REVIEW"] },
                title: { type: "string" },
                description: { type: "string" },
                issues: { type: "array", items: { type: "string" } },
              },
              required: ["status", "title", "description", "issues"],
            },
          },
        },
      }),
    });

    if (res.status === 429) {
      if (attempt < retries) {
        console.warn(`   ⚠️ Rate limit hit. Pausing 2.5s before retry (attempt ${attempt}/${retries})...`);
        await sleep(2500);
        continue;
      }
    }

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${err}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    return parseJson(content);
  }
}

async function main() {
  console.log("==========================================================");
  console.log("🚀 BULK DEAL TITLE & DESCRIPTION GENERATOR (Perplexity AI)");
  console.log("==========================================================");
  console.log(`🤖 Model:        ${MODEL}`);
  console.log(`🎯 Limit:        ${LIMIT === 0 ? "ALL" : LIMIT}`);
  console.log(`⚡ Concurrency:  ${CONCURRENCY}`);
  if (STORE) console.log(`🏪 Store filter: ${STORE}`);
  console.log("----------------------------------------------------------\n");

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db("awin_affiliates");
  const dealsCol = db.collection("deals");

  // Build query
  const query = {};
  if (!FORCE) {
    query.$or = [
      { aiTitle: null },
      { aiTitle: { $exists: false } },
      { aiTitle: "" },
    ];
    query.aiGeneratedAt = { $exists: false };
  }

  if (STORE) {
    const regex = new RegExp(STORE, "i");
    query.$or = [
      ...(query.$or || []),
      { "advertiser.name": regex },
      { storeSlug: regex },
    ];
  }

  const countMissing = await dealsCol.countDocuments(query);
  console.log(`📊 Found ${countMissing} deals eligible for AI generation.`);

  if (countMissing === 0) {
    console.log("✨ All matching deals already have AI copy!");
    await client.close();
    return;
  }

  let cursor = dealsCol.find(query).sort({ id: -1 });
  if (LIMIT > 0) cursor = cursor.limit(LIMIT);
  const deals = await cursor.toArray();

  console.log(`⏳ Starting processing for ${deals.length} deals...\n`);

  let processed = 0;
  let successCount = 0;
  let failCount = 0;

  async function processDeal(deal, idx) {
    const rawTitle = (deal.title || "").slice(0, 45);
    const store = deal.advertiser?.name || deal.storeSlug || "Unknown";
    const prompt = buildPrompt(deal);

    try {
      const result = await callPerplexity(prompt);
      const title = result.title?.trim() || "";
      const description = result.description?.trim() || "";
      const status = result.status || "APPROVED";
      const nowIso = new Date().toISOString();

      // Update MongoDB
      await dealsCol.updateOne(
        { _id: deal._id },
        {
          $set: {
            aiTitle: title,
            aiDescription: description,
            aiStatus: status,
            aiIssues: result.issues || [],
            aiGeneratedAt: nowIso,
            "aiTitleByLang.en": title,
            "aiDescriptionByLang.en": description,
            "aiStatusByLang.en": status,
            "aiGeneratedAtByLang.en": nowIso,
            syncedAt: new Date(),
          },
        }
      );

      successCount++;
      console.log(
        `[${idx + 1}/${deals.length}] ✅ ${store}: "${rawTitle}..."\n      👉 Title: "${title}"`
      );
    } catch (err) {
      failCount++;
      console.error(
        `[${idx + 1}/${deals.length}] ❌ ${store} (ID: ${deal.id}): ${err.message}`
      );
    }
  }

  // Process in small batches with concurrency
  for (let i = 0; i < deals.length; i += CONCURRENCY) {
    const chunk = deals.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map((d, cIdx) => processDeal(d, i + cIdx)));
    if (DELAY_MS > 0 && i + CONCURRENCY < deals.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log("\n==========================================================");
  console.log(`🎉 Finished!`);
  console.log(`   ✅ Successfully updated: ${successCount}`);
  if (failCount > 0) console.log(`   ❌ Failed: ${failCount}`);
  console.log("==========================================================");

  await client.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
