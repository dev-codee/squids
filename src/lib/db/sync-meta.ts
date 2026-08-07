/**
 * Sync metadata tracking.
 *
 * Stores the last successful sync timestamp for each entity type
 * (advertisers, deals, transactions) so cron jobs can do incremental syncs.
 */

import { getDb } from "@/lib/mongodb";

const COLLECTION = "sync_meta";

export type SyncEntity = "advertisers" | "deals" | "transactions";

interface SyncMetaDoc {
  entity: SyncEntity;
  lastSyncedAt: Date;
  lastCount: number;
  status: "success" | "error";
  errorMessage?: string;
}

/**
 * Get the last successful sync time for a given entity.
 * Returns `null` if the entity has never been synced.
 */
export async function getLastSyncTime(
  entity: SyncEntity,
): Promise<Date | null> {
  const db = await getDb();
  const col = db.collection<SyncMetaDoc>(COLLECTION);

  const doc = await col.findOne(
    { entity, status: "success" },
    { sort: { lastSyncedAt: -1 } },
  );

  return doc?.lastSyncedAt ?? null;
}

/**
 * Record a successful sync for a given entity.
 */
export async function updateSyncTime(
  entity: SyncEntity,
  count: number,
): Promise<void> {
  const db = await getDb();
  const col = db.collection<SyncMetaDoc>(COLLECTION);

  await col.updateOne(
    { entity },
    {
      $set: {
        entity,
        lastSyncedAt: new Date(),
        lastCount: count,
        status: "success" as const,
      },
      $unset: { errorMessage: "" },
    },
    { upsert: true },
  );
}

/**
 * Record a failed sync for a given entity (for debugging).
 */
export async function recordSyncError(
  entity: SyncEntity,
  errorMessage: string,
): Promise<void> {
  const db = await getDb();
  const col = db.collection<SyncMetaDoc>(COLLECTION);

  await col.updateOne(
    { entity },
    {
      $set: {
        entity,
        lastSyncedAt: new Date(),
        lastCount: 0,
        status: "error" as const,
        errorMessage,
      },
    },
    { upsert: true },
  );
}

/**
 * Get sync status for all entities (useful for a dashboard/health endpoint).
 */
export async function getAllSyncStatus(): Promise<SyncMetaDoc[]> {
  const db = await getDb();
  const col = db.collection<SyncMetaDoc>(COLLECTION);
  return col.find({}).toArray();
}
