/**
 * Persistence layer for immutable raw feed snapshots and failure recovery logs.
 */

import { getDb } from "@/lib/mongodb";
import type {
  FeedSnapshot,
  FeedFailureRecord,
  FeedEntity,
} from "@/lib/model/feedSnapshot";

const SNAPSHOTS_COLLECTION = "feed_snapshots";
const FAILURES_COLLECTION = "feed_failures";

interface SnapshotDoc extends FeedSnapshot {
  _id?: unknown;
}

interface FailureDoc extends FeedFailureRecord {
  _id?: unknown;
}

export async function ensureSnapshotIndexes(): Promise<void> {
  const db = await getDb();
  const snaps = db.collection<SnapshotDoc>(SNAPSHOTS_COLLECTION);
  const fails = db.collection<FailureDoc>(FAILURES_COLLECTION);

  await Promise.all([
    snaps.createIndex({ id: 1 }, { unique: true }),
    snaps.createIndex({ network: 1, entity: 1, fetchedAt: -1 }),
    snaps.createIndex({ network: 1, entity: 1, isLastGood: 1 }),
    fails.createIndex({ id: 1 }, { unique: true }),
    fails.createIndex({ network: 1, entity: 1, failedAt: -1 }),
    fails.createIndex({ deadLetter: 1 }),
  ]);
}

function stripSnap(doc: SnapshotDoc): FeedSnapshot {
  const { _id, ...rest } = doc;
  return rest as FeedSnapshot;
}

function stripFail(doc: FailureDoc): FeedFailureRecord {
  const { _id, ...rest } = doc;
  return rest as FeedFailureRecord;
}

/**
 * Record an immutable feed snapshot.
 * If status is success, marks it as the newest `isLastGood` for that network+entity.
 */
export async function recordFeedSnapshot(snapshot: FeedSnapshot): Promise<void> {
  const db = await getDb();
  const col = db.collection<SnapshotDoc>(SNAPSHOTS_COLLECTION);
  await ensureSnapshotIndexes();

  const isGood = snapshot.status === "success" && snapshot.recordCount > 0;

  if (isGood) {
    // Unset previous last good for this network:entity
    await col.updateMany(
      { network: snapshot.network, entity: snapshot.entity, isLastGood: true },
      { $set: { isLastGood: false } },
    );
  }

  await col.updateOne(
    { id: snapshot.id },
    { $set: { ...snapshot, isLastGood: isGood } },
    { upsert: true },
  );
}

/**
 * Fetch the last known good snapshot for recovery / rollback reference.
 */
export async function getLastGoodSnapshot(
  network: string,
  entity: FeedEntity,
): Promise<FeedSnapshot | null> {
  const db = await getDb();
  const col = db.collection<SnapshotDoc>(SNAPSHOTS_COLLECTION);

  const doc = await col.findOne({
    network,
    entity,
    isLastGood: true,
  });

  return doc ? stripSnap(doc) : null;
}

/**
 * Record a failure during ingest or processing.
 */
export async function recordFeedFailure(failure: FeedFailureRecord): Promise<void> {
  const db = await getDb();
  const col = db.collection<FailureDoc>(FAILURES_COLLECTION);
  await ensureSnapshotIndexes();

  await col.updateOne(
    { id: failure.id },
    { $set: failure },
    { upsert: true },
  );
}

export interface FeedHealthItem {
  network: string;
  entity: string;
  lastFetchedAt: string | null;
  lastSourceUpdatedAt: string | null;
  lastRecordCount: number;
  lastStatus: string;
  lastGoodFetchedAt: string | null;
  lastGoodRecordCount: number;
  recentFailures: number;
  deadLetterCount: number;
}

/**
 * Get comprehensive feed health report across all networks and entities.
 */
export async function getFeedHealthOverview(): Promise<FeedHealthItem[]> {
  const db = await getDb();
  const snaps = db.collection<SnapshotDoc>(SNAPSHOTS_COLLECTION);
  const fails = db.collection<FailureDoc>(FAILURES_COLLECTION);

  const networks = ["awin", "admitad", "commission-factory", "kwanko"];
  const entities: FeedEntity[] = ["advertisers", "deals", "products", "transactions"];

  const results: FeedHealthItem[] = [];

  for (const network of networks) {
    for (const entity of entities) {
      const [latest, lastGood, recentFails, deadLetters] = await Promise.all([
        snaps.findOne({ network, entity }, { sort: { fetchedAt: -1 } }),
        snaps.findOne({ network, entity, isLastGood: true }),
        fails.countDocuments({ network, entity }),
        fails.countDocuments({ network, entity, deadLetter: true }),
      ]);

      results.push({
        network,
        entity,
        lastFetchedAt: latest?.fetchedAt ?? null,
        lastSourceUpdatedAt: latest?.sourceUpdatedAt ?? null,
        lastRecordCount: latest?.recordCount ?? 0,
        lastStatus: latest?.status ?? "unknown",
        lastGoodFetchedAt: lastGood?.fetchedAt ?? null,
        lastGoodRecordCount: lastGood?.recordCount ?? 0,
        recentFailures: recentFails,
        deadLetterCount: deadLetters,
      });
    }
  }

  return results;
}

export async function getRecentFeedFailures(limit = 25): Promise<FeedFailureRecord[]> {
  const db = await getDb();
  const col = db.collection<FailureDoc>(FAILURES_COLLECTION);

  const docs = await col
    .find({})
    .sort({ failedAt: -1 })
    .limit(limit)
    .toArray();

  return docs.map(stripFail);
}
