/**
 * Phase B data-contract backfill.
 *
 * Derives merchant-markets, retailer offers and structured promotions from the
 * existing advertisers / products / deals collections.
 *
 *   node scripts/run-migrate-data-contract.mjs --dry-run
 *   node scripts/run-migrate-data-contract.mjs
 *
 * Safe to re-run. Every write is an idempotent upsert on a stable ID, and
 * operator-owned fields (permissions, status, checkedAt, review stamps) are only
 * written on insert, so a second run cannot undo a reviewer's decision.
 *
 * NOTHING THIS CREATES IS PUBLISHED. Merchant-markets land as `pending` with no
 * permissions; offers land as `draft`. Rights and prices have not been confirmed
 * by anyone, and the brief blocks publishing until they are.
 *
 * This mirrors src/lib/migrations/backfill-data-contract.ts, which the admin
 * route POST /api/admin/migrate-data-contract runs inside the app. The logic is
 * kept in step with that module; the TypeScript version is the reference.
 */

import { MongoClient } from "mongodb";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const envFile = readFileSync(join(__dirname, "../.env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env.local optional */ }

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("MONGODB_URI not set"); process.exit(1); }

const DRY_RUN = process.argv.includes("--dry-run");
/**
 * Configured markets, read from src/lib/regions.ts so this script and the app
 * can never drift apart. A hardcoded copy here silently created merchant-markets
 * for regions the site does not serve (and missed ones it does).
 */
function readConfiguredMarkets() {
  const src = readFileSync(join(__dirname, "../src/lib/regions.ts"), "utf8");
  const block = src.match(/REGIONS[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!block) {
    console.error("Could not read REGIONS from src/lib/regions.ts — aborting rather than guessing.");
    process.exit(1);
  }
  const codes = [...block[1].matchAll(/^\s{2}([A-Z]{2}):/gm)].map((m) => m[1]);
  if (codes.length === 0) {
    console.error("No region codes parsed from src/lib/regions.ts — aborting.");
    process.exit(1);
  }
  return new Set(codes);
}

const CONFIGURED_MARKETS = readConfiguredMarkets();

/** Market -> currency, also read from src/lib/regions.ts. */
const REGION_CURRENCY = (() => {
  const src = readFileSync(join(__dirname, "../src/lib/regions.ts"), "utf8");
  const map = new Map();
  for (const m of src.matchAll(/^\s{2}([A-Z]{2}):\s*\{\s*currency:\s*"([A-Z]{3})"/gm)) {
    map.set(m[1], m[2]);
  }
  return map;
})();
const WORLDWIDE = new Set(["WW", "GLOBAL", "INT", "00", "WORLDWIDE"]);

const warnings = [];

/** Mirrors storeSlug() in src/lib/networks.ts. */
function cleanAdvertiserName(name) {
  if (!name) return name;
  const cleaned = name
    .replace(/\s*[-[(]?\b(WW|GLOBAL|INT|WORLDWIDE|MANY GEOS?|DE|FR|UK|GB|US|ES|IT|CA|AU)\b[\])]?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || name;
}
function storeSlug(name) {
  return cleanAdvertiserName(name || "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Mirrors resolveMarkets() in src/lib/model/marketResolution.ts. */
function resolveMarkets(adv) {
  const raw = [
    ...(Array.isArray(adv.countryCodes) ? adv.countryCodes : []),
    adv.countryCode ?? "",
    adv.region ?? "",
  ].map((c) => String(c || "").trim().toUpperCase()).filter(Boolean);

  const worldwide = raw.some((c) => WORLDWIDE.has(c));
  const markets = [...new Set(raw.filter((c) => CONFIGURED_MARKETS.has(c)))];
  return { markets, worldwide };
}

function hostOf(url) {
  if (typeof url !== "string" || !url.trim()) return [];
  try { return [new URL(url).host.replace(/^www\./, "")]; } catch { return []; }
}

/** Mirrors parseDiscountText() in src/lib/model/promotion.ts. */
function parseDiscountText(text) {
  const unknown = { known: false, reason: "not-sourced" };
  const empty = { kind: "percentage", value: unknown, isUpTo: false, maxCap: unknown };
  if (!text) return empty;
  const raw = String(text).trim();
  const isUpTo = /\b(up to|bis zu|jusqu'a|hasta|fino a)\b/i.test(raw);

  if (/free\s+(delivery|shipping)|gratis versand|livraison gratuite|envio gratis|spedizione gratuita/i.test(raw)) {
    return { ...empty, kind: "free-delivery", isUpTo, description: raw };
  }
  if (/cashback/i.test(raw)) {
    const pct = raw.match(/(\d+(?:[.,]\d+)?)\s*%/);
    return { ...empty, kind: "cashback", isUpTo,
      value: pct ? { known: true, value: Number(pct[1].replace(",", ".")) } : unknown,
      description: raw };
  }
  if (/\b(gift|geschenk|cadeau|regalo|omaggio)\b/i.test(raw)) {
    return { ...empty, kind: "gift", isUpTo, description: raw };
  }
  const pct = raw.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (pct) {
    return { ...empty, kind: "percentage", isUpTo, value: { known: true, value: Number(pct[1].replace(",", ".")) } };
  }
  const amount = raw.match(/(?:[$£€¥₹]|AUD|USD|EUR|GBP)\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:[$£€¥₹])/i);
  if (amount) {
    const digits = amount[1] ?? amount[2];
    return { ...empty, kind: "fixed-amount", isUpTo, value: { known: true, value: Number(digits.replace(",", ".")) } };
  }
  return empty;
}

function emptyPromotionStructure() {
  const unknown = { known: false, reason: "not-sourced" };
  return {
    benefit: { kind: "percentage", value: unknown, isUpTo: false, maxCap: unknown },
    conditions: {
      minSpend: unknown, minSpendBasis: "unknown",
      eligibleCategories: [], eligibleProductIds: [], exclusions: [],
      customerType: "unknown", requiresMembership: null, requiresApp: null,
      requiresAccount: null, requiresSubscription: null, paymentMethod: null,
      stackable: null, stackingNotes: null,
    },
    timezone: null,
    evidenceStatus: "merchant-listed",
    evidenceSourceUrl: null, evidenceCheckedAt: null, evidenceCheckedBy: null,
  };
}

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("awin_affiliates");
  const now = new Date();

  console.log(`[data-contract] ${DRY_RUN ? "DRY RUN — nothing will be written" : "applying"}\n`);

  // ---- 1. merchant_markets ------------------------------------------------
  const advertisers = await db.collection("advertisers").find({}, { projection: { _id: 0 } }).toArray();
  const mmRecords = [];
  let mmSkipped = 0;

  for (const adv of advertisers) {
    const name = String(adv.name ?? "").trim();
    const id = Number(adv.id);
    const network = String(adv.network ?? "awin").toLowerCase();
    if (!name || !Number.isFinite(id)) { mmSkipped++; continue; }

    const slug = storeSlug(name);
    if (!slug) {
      mmSkipped++;
      warnings.push(`advertiser ${id} ("${name}"): name produces an empty slug, skipped`);
      continue;
    }

    const { markets, worldwide } = resolveMarkets(adv);

    // An advertiser that names no configured market is SKIPPED, not parked in a
    // default one. A first dry run put 730 merchants into US this way — "Kiwi
    // BR", "Casa Andina PE", "Answear UA", "Shopee MY", "Kaspersky LATAM" among
    // them. A wrong country association is not made harmless by a pending status.
    if (markets.length === 0) {
      mmSkipped++;
      warnings.push(
        worldwide
          ? `advertiser ${id} ("${name}"): worldwide code only, no specific market — skipped; assign its markets deliberately`
          : `advertiser ${id} ("${name}"): no configured market on record — skipped; assign a market before publishing`,
      );
      continue;
    }

    for (const market of markets) {
      mmRecords.push({
        id: `${network}:${id}:${market}`,
        merchantId: id, network, market,
        displayName: name, slug,
        currency: adv.currencyCode || REGION_CURRENCY.get(market) || "USD",
        websiteUrl: adv.url ?? null,
        approvedDomains: hostOf(adv.url),
        feedSourceIds: [network],
      });
    }
  }

  // `(market, slug)` is uniquely indexed — it is the public store URL. Two
  // advertisers resolving to the same pair is a duplicate in the source data
  // ("Nolo (US)" vs "Nolo US"; four "Triple Eight Distribution" rows). Writing
  // them would throw a duplicate-key error mid-batch or hand one merchant's
  // canonical URL to another, so the colliding group is withheld entirely.
  const byKey = new Map();
  for (const r of mmRecords) {
    const key = `${r.market}|${r.slug}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
  }
  const safeRecords = [];
  for (const [key, group] of byKey) {
    if (group.length === 1) { safeRecords.push(group[0]); continue; }
    mmSkipped += group.length;
    warnings.push(
      `slug collision on ${key}: ${group.length} advertisers resolve to the same store URL (` +
      group.map((g) => `${g.merchantId} "${g.displayName}"`).join(", ") +
      ") — all withheld; merge the duplicates first",
    );
  }

  if (!DRY_RUN && safeRecords.length) {
    const col = db.collection("merchant_markets");
    await col.createIndex({ id: 1 }, { unique: true });
    await col.createIndex({ market: 1, slug: 1 }, { unique: true });
    await col.createIndex({ merchantId: 1, network: 1 });
    await col.createIndex({ status: 1, market: 1 });
    await col.bulkWrite(safeRecords.map((mm) => ({
      updateOne: {
        filter: { id: mm.id },
        update: {
          $set: { ...mm, updatedAt: now },
          $setOnInsert: {
            permissions: {
              seo: false, ppc: false, brandBidding: false,
              deepLinks: false, voucherDistribution: false,
              sourceUrl: null, confirmedAt: null, confirmedBy: null,
            },
            commission: {}, policyUrls: {},
            status: "pending", reviewedBy: null, reviewedAt: null,
            createdAt: now,
          },
        },
        upsert: true,
      },
    })), { ordered: false });
  }
  console.log(`merchant_markets: scanned ${advertisers.length}, prepared ${safeRecords.length}, skipped ${mmSkipped}`);

  // ---- 2. offers ----------------------------------------------------------
  const mmDocs = DRY_RUN
    ? safeRecords
    : await db.collection("merchant_markets")
        .find({}, { projection: { _id: 0, id: 1, merchantId: 1, market: 1, currency: 1 } }).toArray();

  const byMerchant = new Map();
  for (const mm of mmDocs) {
    const list = byMerchant.get(mm.merchantId) ?? [];
    list.push(mm);
    byMerchant.set(mm.merchantId, list);
  }

  const products = await db.collection("products").find({}, { projection: { _id: 0 } }).toArray();
  const offers = [];
  let offersSkipped = 0;

  for (const p of products) {
    const advertiserId = Number(p.advertiserId);
    const productId = Number(p.id);
    if (!Number.isFinite(advertiserId) || !Number.isFinite(productId)) { offersSkipped++; continue; }

    const candidates = byMerchant.get(advertiserId) ?? [];
    if (candidates.length === 0) {
      offersSkipped++;
      warnings.push(`product ${productId}: advertiser ${advertiserId} has no merchant-market record`);
      continue;
    }
    if (candidates.length > 1) {
      warnings.push(`product ${productId}: advertiser ${advertiserId} trades in ${candidates.length} markets — confirm the price applies to each`);
    }

    for (const mm of candidates) {
      offers.push({
        id: `${mm.id}:${p.id}`,
        merchantMarketId: mm.id,
        productId,
        sourceItemId: String(p.id),
        // An absent price stays unknown. It is never zero.
        itemPrice: typeof p.salePrice === "number" && Number.isFinite(p.salePrice)
          ? { known: true, value: p.salePrice }
          : { known: false, reason: "not-sourced" },
        currency: mm.currency || "USD",
        // The legacy boolean cannot tell "out of stock" from "never stated".
        stock: p.inStock ? "in-stock" : "unknown",
        condition: "unknown",
        destinationUrl: p.trackingUrl ?? null,
        sourceUpdatedAt: null,
        fetchedAt: null,
        eligibility: { markets: [mm.market], customerType: "any" },
      });
    }
  }

  if (!DRY_RUN && offers.length) {
    const col = db.collection("offers");
    await col.createIndex({ id: 1 }, { unique: true });
    await col.createIndex({ productId: 1, status: 1 });
    await col.createIndex({ merchantMarketId: 1, status: 1 });
    await col.createIndex({ status: 1, sourceUpdatedAt: 1 });
    await col.bulkWrite(offers.map((o) => ({
      updateOne: {
        filter: { id: o.id },
        update: {
          $set: { ...o, updatedAt: now },
          $setOnInsert: {
            // Never auto-published, and never claimed as checked.
            status: "draft",
            statusReason: "backfilled from legacy product row; not yet validated",
            checkedAt: null,
            createdAt: now,
          },
        },
        upsert: true,
      },
    })), { ordered: false });
  }
  console.log(`offers:           scanned ${products.length}, prepared ${offers.length}, skipped ${offersSkipped}`);

  // ---- 3. promotion structure on deals ------------------------------------
  const deals = await db.collection("deals")
    .find({ promotion: { $exists: false } },
          { projection: { _id: 0, id: 1, network: 1, discountText: 1, syncedAt: 1 } })
    .toArray();

  let parsed = 0;
  const dealOps = deals.map((d) => {
    const structure = emptyPromotionStructure();
    const benefit = parseDiscountText(d.discountText ?? null);
    if (benefit.value.known || benefit.kind !== "percentage") {
      structure.benefit = benefit;
      parsed++;
    }
    return {
      updateOne: {
        filter: { network: d.network ?? "awin", id: d.id },
        update: {
          $set: {
            promotion: structure,
            // syncedAt is our write time — a fetch stamp at best, never a check.
            fetchedAt: d.syncedAt ? new Date(d.syncedAt).toISOString() : null,
            sourceUpdatedAt: null,
            checkedAt: null,
          },
        },
      },
    };
  });

  if (!DRY_RUN && dealOps.length) {
    await db.collection("deals").bulkWrite(dealOps, { ordered: false });
  }
  console.log(`promotions:       scanned ${deals.length}, structured ${dealOps.length}, benefit parsed ${parsed}`);
  if (deals.length > parsed) {
    warnings.push(`${deals.length - parsed} deals had a discount label that could not be read confidently; their benefit stays unknown`);
  }

  // ---- 4. delivery_rules: indexes only ------------------------------------
  // No rule can be derived from anything we hold. Delivery is unknown until an
  // operator sources it, and unknown is a value, not a zero.
  if (!DRY_RUN) {
    const col = db.collection("delivery_rules");
    await col.createIndex({ id: 1 }, { unique: true });
    await col.createIndex({ merchantMarketId: 1, serviceLevel: 1 });
    await col.createIndex({ "zone.market": 1 });
  }
  console.log("delivery_rules:   indexes ensured; no rules derived (nothing on record to derive from)");

  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s) — each needs an operator decision:`);
    for (const w of warnings.slice(0, 50)) console.log("  -", w);
    if (warnings.length > 50) console.log(`  … and ${warnings.length - 50} more`);
  }

  console.log(DRY_RUN
    ? "\nDry run complete. Re-run without --dry-run to write."
    : "\nDone. Nothing is published: merchant-markets are 'pending' with no permissions and offers are 'draft'.\nGrant rights and publish deliberately before any page or campaign uses them.");

  await client.close();
}

run().catch((err) => { console.error(err); process.exit(1); });
