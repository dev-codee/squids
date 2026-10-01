/**
 * One-time migration: backfill regionCodes on deals that have empty arrays
 * but whose advertiser has a specific (non-WW) countryCode.
 *
 * Run: node scripts/run-migrate-region-codes.mjs
 */

import { MongoClient } from "mongodb";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse .env.local manually (no dotenv dependency needed)
try {
  const envFile = readFileSync(join(__dirname, "../.env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env.local optional */ }

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("MONGODB_URI not set"); process.exit(1); }

const WW_CODES = new Set(["WW", "GLOBAL", "INT", "00", ""]);

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("awin_affiliates");

  const dealsCol = db.collection("deals");
  const advCol   = db.collection("advertisers");

  console.log("Loading advertisers...");
  const advertisers = await advCol
    .find({}, { projection: { id: 1, network: 1, countryCode: 1, countryCodes: 1 } })
    .toArray();

  const advMap = new Map();
  for (const a of advertisers) {
    advMap.set(`${a.network ?? "awin"}:${a.id}`, {
      countryCode: a.countryCode,
      countryCodes: a.countryCodes,
    });
  }
  console.log(`  ${advMap.size} advertisers loaded.`);

  console.log("Finding deals with empty regionCodes...");
  const deals = await dealsCol
    .find({ $or: [{ regionCodes: { $size: 0 } }, { regionCodes: { $exists: false } }] })
    .project({ id: 1, network: 1, "advertiser.id": 1 })
    .toArray();
  console.log(`  ${deals.length} deals to inspect.`);

  let updated = 0;
  let skipped = 0;

  for (const deal of deals) {
    const key = `${deal.network ?? "awin"}:${deal.advertiser?.id}`;
    const adv = advMap.get(key);
    if (!adv) { skipped++; continue; }

    let regionCodes = [];
    if (Array.isArray(adv.countryCodes) && adv.countryCodes.length > 0) {
      regionCodes = adv.countryCodes.map(c => String(c).toUpperCase()).filter(c => c.length > 0);
    } else if (adv.countryCode) {
      regionCodes = [String(adv.countryCode).toUpperCase()];
    }

    const isSpecific = regionCodes.length > 0 && !regionCodes.every(c => WW_CODES.has(c));
    if (!isSpecific) { skipped++; continue; }

    await dealsCol.updateOne(
      { id: deal.id, network: deal.network },
      { $set: { regionCodes } }
    );
    updated++;

    if (updated % 100 === 0) console.log(`  ... ${updated} updated so far`);
  }

  console.log(`\nDone. Updated: ${updated}  |  Skipped (WW/no adv): ${skipped}`);
  await client.close();
}

run().catch(err => { console.error(err); process.exit(1); });
