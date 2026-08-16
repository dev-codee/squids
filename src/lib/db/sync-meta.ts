/**
 * Sync metadata tracking.
 *
 * Stores the last successful sync timestamp for each entity type
 * (advertisers, deals, transactions) per network so cron jobs can do
 * incremental syncs.
 *
 * Entity keys are network-prefixed: "awin:advertisers", "admitad:deals", etc.
 * The old bare keys ("advertisers", "deals", "transactions") are treated as
 * aliases for the "awin:*" equivalents for backwards compatibility.
 */

import { getDb } from "@/lib/mongodb";

const COLLECTION = "sync_meta";

/**
 * Sync entity keys.
 *
 * Bare keys ("advertisers", etc.) are legacy aliases for "awin:*".
 * New code should always use the network-prefixed form.
 */
export type SyncEntity =
  | "advertisers"
  | "deals"
  | "transactions"
  | "awin:advertisers"
  | "awin:deals"
  | "awin:transactions"
  | "admitad:advertisers"
  | "admitad:deals"
  | "admitad:transactions"
  | "commission-factory:advertisers"
  | "commission-factory:deals"
  | "commission-factory:transactions"
  | "kwanko:advertisers"
  | "kwanko:deals"
  | "kwanko:transactions"
  | "welcome:deals";

interface SyncMetaDoc {
  entity: string;
  lastSyncedAt: Date;
  lastCount: number;
  status: "success" | "error";
  errorMessage?: string;
}

/**
 * Normalise a sync entity key so bare keys map to "awin:*".
 */
function normaliseEntity(entity: SyncEntity): string {
  if (entity === "advertisers") return "awin:advertisers";
  if (entity === "deals") return "awin:deals";
  if (entity === "transactions") return "awin:transactions";
  return entity;
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
  const key = normaliseEntity(entity);

  const doc = await col.findOne(
    { entity: key, status: "success" },
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
  const key = normaliseEntity(entity);

  await col.updateOne(
    { entity: key },
    {
      $set: {
        entity: key,
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
  const key = normaliseEntity(entity);

  await col.updateOne(
    { entity: key },
    {
      $set: {
        entity: key,
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
