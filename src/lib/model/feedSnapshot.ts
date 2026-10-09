/**
 * Immutable raw feed snapshots and failure recovery modeling.
 *
 * The brief (§11, p.11–12):
 * "Immutable raw source snapshots with sourceUpdatedAt and fetchedAt.
 * Bounded retries with backoff, dead-letter queue, rate-limit handling,
 * last-good recovery, rollback."
 */

export type FeedEntity = "advertisers" | "deals" | "products" | "transactions";
export type FeedSyncStatus = "success" | "partial" | "failed";

export interface FeedSnapshot {
  id: string; // `${network}:${entity}:${batchId}`
  batchId: string;
  network: string;
  entity: FeedEntity;
  recordCount: number;
  fetchedAt: string; // ISO timestamp
  sourceUpdatedAt?: string | null;
  status: FeedSyncStatus;
  checksum?: string | null;
  errorMessage?: string | null;
  isLastGood?: boolean;
}

export interface FeedFailureRecord {
  id: string; // `${network}:${entity}:${batchId}`
  batchId: string;
  network: string;
  entity: FeedEntity;
  failedAt: string;
  error: string;
  retryCount: number;
  nextRetryAt?: string | null;
  deadLetter: boolean;
}

/**
 * Calculates exponential backoff retry time.
 * Max 5 retries; base 2 minutes up to ~32 minutes.
 */
export function calculateNextRetryTime(
  retryCount: number,
  now: Date = new Date(),
): { nextRetryAt: string | null; deadLetter: boolean } {
  const MAX_RETRIES = 5;
  if (retryCount >= MAX_RETRIES) {
    return { nextRetryAt: null, deadLetter: true };
  }

  const delayMinutes = Math.pow(2, retryCount) * 2;
  const next = new Date(now.getTime() + delayMinutes * 60 * 1000);
  return { nextRetryAt: next.toISOString(), deadLetter: false };
}

/**
 * Generates a stable batch ID for a feed sync run.
 */
export function generateBatchId(network: string, entity: string, at: Date = new Date()): string {
  const stamp = at.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).substring(2, 7);
  return `${network}_${entity}_${stamp}_${rand}`;
}
