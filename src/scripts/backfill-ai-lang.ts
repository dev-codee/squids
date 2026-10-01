/**
 * Migration / Backfill Script: Phase 2 AI Content Multilingual Support
 *
 * Copies legacy flat AI fields (aiTitle, aiDescription, aiStorePage, etc.)
 * into their corresponding 'en' slots (aiTitleByLang.en, aiStorePageByLang.en).
 *
 * Idempotent: safe to run multiple times without overwriting existing ByLang data.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' src/scripts/backfill-ai-lang.ts
 *   or run via npm script/admin endpoint.
 */

import { getDb } from "@/lib/mongodb";

export async function runBackfillAiLanguage(): Promise<{
  dealsUpdated: number;
  advertisersUpdated: number;
}> {
  const db = await getDb();

  // 1. Backfill Deals
  const dealsCol = db.collection("deals");
  const dealsToMigrate = await dealsCol
    .find({
      $or: [
        { aiTitle: { $ne: null, $exists: true } },
        { aiDescription: { $ne: null, $exists: true } },
        { aiGeneratedAt: { $ne: null, $exists: true } },
      ],
      "aiTitleByLang.en": { $exists: false },
    })
    .toArray();

  let dealsUpdated = 0;
  if (dealsToMigrate.length > 0) {
    const dealOps = dealsToMigrate.map((d) => {
      const setFields: Record<string, unknown> = {};
      if (d.aiTitle) setFields["aiTitleByLang.en"] = d.aiTitle;
      if (d.aiDescription) setFields["aiDescriptionByLang.en"] = d.aiDescription;
      if (d.aiStatus) setFields["aiStatusByLang.en"] = d.aiStatus;
      if (d.aiIssues) setFields["aiIssuesByLang.en"] = d.aiIssues;
      if (d.aiGeneratedAt) setFields["aiGeneratedAtByLang.en"] = d.aiGeneratedAt;

      return {
        updateOne: {
          filter: { _id: d._id },
          update: { $set: setFields },
        },
      };
    });

    const res = await dealsCol.bulkWrite(dealOps, { ordered: false });
    dealsUpdated = res.modifiedCount;
  }

  // 2. Backfill Advertisers
  const advCol = db.collection("advertisers");
  const advsToMigrate = await advCol
    .find({
      aiStorePage: { $ne: null, $exists: true },
      "aiStorePageByLang.en": { $exists: false },
    })
    .toArray();

  let advertisersUpdated = 0;
  if (advsToMigrate.length > 0) {
    const advOps = advsToMigrate.map((a) => {
      const setFields: Record<string, unknown> = {
        "aiStorePageByLang.en": a.aiStorePage,
      };
      if (a.aiStorePageAt) setFields["aiStorePageAtByLang.en"] = a.aiStorePageAt;

      return {
        updateOne: {
          filter: { _id: a._id },
          update: { $set: setFields },
        },
      };
    });

    const res = await advCol.bulkWrite(advOps, { ordered: false });
    advertisersUpdated = res.modifiedCount;
  }

  return { dealsUpdated, advertisersUpdated };
}

// Direct execution when invoked from CLI
if (require.main === module) {
  runBackfillAiLanguage()
    .then(({ dealsUpdated, advertisersUpdated }) => {
      console.log(`[backfill] Completed:`);
      console.log(`- Deals updated with en ByLang copy: ${dealsUpdated}`);
      console.log(`- Advertisers updated with en ByLang store page: ${advertisersUpdated}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[backfill] Failed:", err);
      process.exit(1);
    });
}
