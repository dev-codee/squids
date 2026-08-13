/**
 * One-shot migration: add `network: "awin"` to all existing documents
 * and replace the old `{ id: 1 }` unique index with a composite
 * `{ network: 1, id: 1 }` unique index.
 *
 * Safe to re-run (idempotent).
 */

import { getDb } from "@/lib/mongodb";

const COLLECTIONS = ["advertisers", "deals", "transactions"] as const;

export interface MigrationResult {
  collection: string;
  backfilledCount: number;
  oldIndexDropped: boolean;
  newIndexCreated: boolean;
}

/**
 * Run the network migration across all three collections.
 *
 * 1. Stamps `network: "awin"` on every document missing the field.
 * 2. Drops the legacy `{ id: 1 }` unique index (if it exists).
 * 3. Creates the composite `{ network: 1, id: 1 }` unique index.
 */
export async function runNetworkMigration(): Promise<MigrationResult[]> {
  const db = await getDb();
  const results: MigrationResult[] = [];

  for (const name of COLLECTIONS) {
    const col = db.collection(name);

    // 1. Backfill: stamp existing rows with network: "awin"
    const backfill = await col.updateMany(
      { network: { $exists: false } },
      { $set: { network: "awin" } },
    );

    // 2. Drop old unique index on { id: 1 } if it exists
    let oldIndexDropped = false;
    try {
      // List existing indexes and find one with key { id: 1 }
      const indexes = await col.indexes();
      const hasOldIndex = indexes.some(
        (idx) =>
          idx.unique === true &&
          JSON.stringify(idx.key) === JSON.stringify({ id: 1 }),
      );

      if (hasOldIndex) {
        await col.dropIndex({ id: 1 } as any);
        oldIndexDropped = true;
      }
    } catch {
      // Index may already be gone — that's fine
    }

    // 3. Create composite unique index (idempotent)
    await col.createIndex({ network: 1, id: 1 }, { unique: true });

    results.push({
      collection: name,
      backfilledCount: backfill.modifiedCount,
      oldIndexDropped,
      newIndexCreated: true,
    });
  }

  return results;
}
