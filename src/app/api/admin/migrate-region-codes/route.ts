import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

const WW_CODES = new Set(["WW", "GLOBAL", "INT", "00", ""]);

/**
 * POST /api/admin/migrate-region-codes
 *
 * One-time migration: for every deal where regionCodes is empty,
 * look up the advertiser's countryCode. If it's a specific country
 * (not WW/GLOBAL/INT), stamp that country into regionCodes so the
 * country filter stops showing those deals on wrong country pages.
 */
export async function POST() {
  const db = await getDb();
  const dealsCol = db.collection("deals");
  const advCol = db.collection("advertisers");

  // Load all advertisers into a lookup map
  const advertisers = await advCol
    .find({}, { projection: { id: 1, network: 1, countryCode: 1, countryCodes: 1 } })
    .toArray();

  const advMap = new Map<string, { countryCode?: string; countryCodes?: string[] }>();
  for (const a of advertisers) {
    advMap.set(`${a.network ?? "awin"}:${a.id}`, {
      countryCode: a.countryCode,
      countryCodes: a.countryCodes,
    });
  }

  // Find all deals with empty regionCodes
  const deals = await dealsCol
    .find({ $or: [{ regionCodes: { $size: 0 } }, { regionCodes: { $exists: false } }] })
    .project({ id: 1, network: 1, "advertiser.id": 1 })
    .toArray();

  let updated = 0;
  for (const deal of deals) {
    const key = `${deal.network ?? "awin"}:${deal.advertiser?.id}`;
    const adv = advMap.get(key);
    if (!adv) continue;

    let regionCodes: string[] = [];
    if (Array.isArray(adv.countryCodes) && adv.countryCodes.length > 0) {
      regionCodes = adv.countryCodes
        .map((c: string) => String(c).toUpperCase())
        .filter((c: string) => c.length > 0);
    } else if (adv.countryCode) {
      const cc = String(adv.countryCode).toUpperCase();
      regionCodes = [cc];
    }

    // Only update if we got a non-WW specific country
    const isSpecific = regionCodes.length > 0 && !regionCodes.every((c) => WW_CODES.has(c));
    if (!isSpecific) continue;

    await dealsCol.updateOne({ id: deal.id, network: deal.network }, { $set: { regionCodes } });
    updated++;
  }

  return NextResponse.json({ ok: true, updated, total: deals.length });
}
