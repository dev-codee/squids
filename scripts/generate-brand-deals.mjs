// One-off: create the generic "Best Discounts & Deals at {store}" deal
// (codeless type:"deal", carrying the affiliate tracking link with our publisher
// ID) for EVERY advertiser in the DB. Idempotent — safe to re-run.
//
// Usage: node scripts/generate-brand-deals.mjs
import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

// --- Load MONGODB_URI + publisher ids from .env.local ----------------------
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const MONGODB_URI = env.MONGODB_URI;
const AWIN_PUBLISHER_ID = env.AWIN_PUBLISHER_ID || "1353171";
const CF_AFFILIATE_ID = env.CF_AFFILIATE_ID || "89228";
const BRAND_DEAL_ID_BASE = 2_000_000_000;

// --- Mirror of src/lib/networks.ts:cleanAdvertiserName ---------------------
function cleanAdvertiserName(name) {
  if (!name) return name;
  const cleaned = name
    .replace(/\s*[-[(]?\b(WW|GLOBAL|INT|WORLDWIDE|MANY GEOS?|DE|FR|UK|GB|US|ES|IT|CA|AU)\b[\])]?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || name;
}

// --- Mirror of src/lib/affiliateUrls.ts:resolveAffiliateTrackingUrl --------
function resolveAffiliateTrackingUrl(network, advertiserId, rawUrl) {
  const net = (network || "awin").toLowerCase().trim();
  const advId = Number(advertiserId);

  if (rawUrl && rawUrl.includes("awin1.com")) {
    return rawUrl
      .replace(/([?&]awinaffid=)\d+/i, `$1${AWIN_PUBLISHER_ID}`)
      .replace(/([?&]id=)\d+/i, `$1${AWIN_PUBLISHER_ID}`);
  }
  if (rawUrl && rawUrl.includes("cfjump.com")) {
    return rawUrl.replace(/(cfjump\.com\/)\d+(\/)/i, `$1${CF_AFFILIATE_ID}$2`);
  }
  if (rawUrl && (rawUrl.includes("admitad.com") || rawUrl.includes("/g/"))) {
    return rawUrl;
  }
  if (net === "commission-factory" && advId) {
    if (rawUrl && rawUrl.startsWith("http") && !rawUrl.includes("cfjump.com")) {
      return `https://t.cfjump.com/${CF_AFFILIATE_ID}/t/${advId}?Url=${encodeURIComponent(rawUrl)}`;
    }
    return `https://t.cfjump.com/${CF_AFFILIATE_ID}/t/${advId}`;
  }
  if (net === "awin" && advId) {
    if (rawUrl && rawUrl.startsWith("http") && !rawUrl.includes("awin1.com")) {
      return `https://www.awin1.com/cread.php?awinmid=${advId}&awinaffid=${AWIN_PUBLISHER_ID}&ued=${encodeURIComponent(rawUrl)}`;
    }
    return `https://www.awin1.com/awclick.php?mid=${advId}&id=${AWIN_PUBLISHER_ID}`;
  }
  return rawUrl || "#";
}

const title = (name) => `Best Discounts & Deals at ${name}`;
const description = (name) =>
  `Welcome to ${name}! Discover the latest discounts, exclusive deals, and money-saving offers. Shop smarter, save more, and never miss a great deal.`;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db("awin_affiliates");
  const dealsCol = db.collection("deals");
  const advCol = db.collection("advertisers");

  await dealsCol.createIndex({ network: 1, id: 1 }, { unique: true });

  const advertisers = await advCol
    .find({}, { projection: { _id: 0, id: 1, network: 1, name: 1, logoUrl: 1, url: 1, countryCode: 1, countryCodes: 1 } })
    .toArray();

  const now = new Date();
  const ops = [];
  for (const a of advertisers) {
    if (!a?.id || !a.name) continue;
    const network = a.network ?? "awin";
    const name = cleanAdvertiserName(a.name);
    const regionCodes =
      Array.isArray(a.countryCodes) && a.countryCodes.length > 0
        ? a.countryCodes.map((c) => String(c).toUpperCase())
        : a.countryCode
        ? [String(a.countryCode).toUpperCase()]
        : [];

    const brand = {
      id: BRAND_DEAL_ID_BASE + a.id,
      network,
      title: title(name),
      description: description(name),
      advertiser: { id: a.id, name, logoUrl: a.logoUrl ?? null },
      type: "deal",
      code: null,
      startDate: null,
      endDate: null,
      status: "active",
      trackingUrl: resolveAffiliateTrackingUrl(a.network, a.id, a.url),
      regionCodes,
      isBrandDeal: true,
    };

    ops.push({
      updateOne: {
        filter: { network: brand.network, id: brand.id },
        update: { $setOnInsert: { ...brand, syncedAt: now } },
        upsert: true,
      },
    });
  }

  let created = 0;
  if (ops.length > 0) {
    const res = await dealsCol.bulkWrite(ops, { ordered: false });
    created = res.upsertedCount;
  }

  console.log(
    `Advertisers seen: ${advertisers.length} | Brand deals created: ${created} | ` +
      `Existing (skipped): ${advertisers.length - created}`,
  );

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
