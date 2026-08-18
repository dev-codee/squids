const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

function getEnv() {
  const envPath = path.resolve(__dirname, ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    const lines = content.replace(/\r/g, "").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
        process.env[key] = val;
      }
    }
  }
}

getEnv();

function resolveAffiliateTrackingUrl(network, advId, rawUrl) {
  const net = (network || "awin").toLowerCase().trim();
  const id = Number(advId);
  const AWIN_ID = process.env.AWIN_PUBLISHER_ID || process.env.NEXT_PUBLIC_AWIN_PUBLISHER_ID || "1353171";
  const CF_ID = process.env.CF_AFFILIATE_ID || process.env.NEXT_PUBLIC_CF_AFFILIATE_ID || "89228";

  // Already a tracking link — enforce OUR publisher ID, rewriting any foreign
  // affiliate ID baked into the feed URL so we never hand traffic to another publisher.
  if (rawUrl && rawUrl.includes("awin1.com")) {
    return rawUrl
      .replace(/([?&]awinaffid=)\d+/i, `$1${AWIN_ID}`)
      .replace(/([?&]id=)\d+/i, `$1${AWIN_ID}`);
  }
  if (rawUrl && rawUrl.includes("cfjump.com")) {
    return rawUrl.replace(/(cfjump\.com\/)\d+(\/)/i, `$1${CF_ID}$2`);
  }
  if (rawUrl && (rawUrl.includes("admitad.com") || rawUrl.includes("/g/"))) {
    return rawUrl;
  }

  if (net === "commission-factory" && id) {
    const cfId = process.env.CF_AFFILIATE_ID || process.env.NEXT_PUBLIC_CF_AFFILIATE_ID || "89228";
    if (rawUrl && rawUrl.startsWith("http") && !rawUrl.includes("cfjump.com")) {
      return `https://t.cfjump.com/${cfId}/t/${id}?Url=${encodeURIComponent(rawUrl)}`;
    }
    return `https://t.cfjump.com/${cfId}/t/${id}`;
  }

  if (net === "awin" && id) {
    const awinId = process.env.AWIN_PUBLISHER_ID || process.env.NEXT_PUBLIC_AWIN_PUBLISHER_ID || "1353171";
    if (rawUrl && rawUrl.startsWith("http") && !rawUrl.includes("awin1.com")) {
      return `https://www.awin1.com/cread.php?awinmid=${id}&awinaffid=${awinId}&ued=${encodeURIComponent(rawUrl)}`;
    }
    return `https://www.awin1.com/awclick.php?mid=${id}&id=${awinId}`;
  }

  return rawUrl || "#";
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("No MONGODB_URI found");
    return;
  }
  console.log("Connecting to MongoDB...");
  const client = new MongoClient(uri);
  await client.connect();
  console.log("Connected successfully!");
  const db = client.db("awin_affiliates");

  const advCol = db.collection("advertisers");
  const dealsCol = db.collection("deals");

  // 1. Advertisers
  console.log("Scanning advertisers...");
  const advCursor = advCol.find({}, { projection: { _id: 1, network: 1, id: 1, url: 1 } });
  let advOps = [];
  let updatedAdv = 0;

  while (await advCursor.hasNext()) {
    const adv = await advCursor.next();
    const resolved = resolveAffiliateTrackingUrl(adv.network, adv.id, adv.url);
    if (resolved && resolved !== adv.url) {
      advOps.push({
        updateOne: {
          filter: { _id: adv._id },
          update: { $set: { url: resolved } },
        },
      });
      if (advOps.length >= 500) {
        const res = await advCol.bulkWrite(advOps, { ordered: false });
        updatedAdv += res.modifiedCount;
        advOps = [];
      }
    }
  }
  if (advOps.length > 0) {
    const res = await advCol.bulkWrite(advOps, { ordered: false });
    updatedAdv += res.modifiedCount;
  }
  console.log(`Advertisers updated: ${updatedAdv}`);

  // 2. Deals
  console.log("Scanning deals...");
  const dealCursor = dealsCol.find({}, { projection: { _id: 1, network: 1, "advertiser.id": 1, trackingUrl: 1 } });
  let dealOps = [];
  let updatedDeals = 0;

  while (await dealCursor.hasNext()) {
    const deal = await dealCursor.next();
    const resolved = resolveAffiliateTrackingUrl(
      deal.network,
      deal.advertiser?.id,
      deal.trackingUrl,
    );
    if (resolved && resolved !== deal.trackingUrl) {
      dealOps.push({
        updateOne: {
          filter: { _id: deal._id },
          update: { $set: { trackingUrl: resolved } },
        },
      });
      if (dealOps.length >= 500) {
        const res = await dealsCol.bulkWrite(dealOps, { ordered: false });
        updatedDeals += res.modifiedCount;
        dealOps = [];
      }
    }
  }
  if (dealOps.length > 0) {
    const res = await dealsCol.bulkWrite(dealOps, { ordered: false });
    updatedDeals += res.modifiedCount;
  }
  console.log(`Deals updated: ${updatedDeals}`);

  const beautyAmora = await advCol.findOne({ id: 83335 });
  console.log("Beauty Amora (#83335) URL:", beautyAmora?.url);

  await client.close();
  console.log("All done!");
}

run().catch(console.error);
