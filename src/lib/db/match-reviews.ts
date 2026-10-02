/**
 * The manual match review queue.
 *
 * A pair of product records that look like the same item but cannot be proven
 * so lands here. Until a named reviewer rules on it, the public page may show
 * the row as a candidate but never as an exact match — `classifyMatch` enforces
 * that, and this collection is where its rulings come from.
 *
 * One document per pair, keyed by `matchPairId`, so re-running the matcher
 * cannot create duplicates or overwrite a decision a person already made.
 */

import { getDb } from "@/lib/mongodb";
import type { MatchResult, MatchRuling, ReviewBasis } from "@/lib/model/matching";
import { matchPairId } from "@/lib/model/matching";

const COLLECTION = "match_reviews";

export type MatchReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "split-variant"
  | "needs-data";

export interface MatchReview {
  /** `matchPairId(sourceProductId, candidateProductId)`. */
  pairId: string;
  sourceProductId: number;
  candidateProductId: number;
  sourceTitle: string;
  candidateTitle: string;
  sourceAdvertiserId: number;
  candidateAdvertiserId: number;

  reviewBasis: ReviewBasis | null;
  matchedOn: string[];
  conflicts: string[];
  reason: string;

  status: MatchReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

interface MatchReviewDoc extends MatchReview {
  _id?: unknown;
}

export async function ensureMatchReviewIndexes(): Promise<void> {
  const db = await getDb();
  const col = db.collection<MatchReviewDoc>(COLLECTION);
  await Promise.all([
    col.createIndex({ pairId: 1 }, { unique: true }),
    col.createIndex({ status: 1, updatedAt: -1 }),
    col.createIndex({ sourceProductId: 1 }),
    col.createIndex({ candidateProductId: 1 }),
  ]);
}

function strip(doc: MatchReviewDoc): MatchReview {
  const { _id, ...rest } = doc;
  return rest as MatchReview;
}

/**
 * Queue a candidate pair.
 *
 * Idempotent, and deliberately one-way on status: `$setOnInsert` holds the
 * status and reviewer fields, so an ingest that re-proposes a pair cannot reset
 * a decision back to pending. Only the derived evidence is refreshed.
 */
export async function queueMatchReview(params: {
  source: { id: number; title: string; advertiserId: number };
  candidate: { id: number; title: string; advertiserId: number };
  result: MatchResult;
}): Promise<void> {
  const db = await getDb();
  const col = db.collection<MatchReviewDoc>(COLLECTION);
  const now = new Date();
  const pairId = matchPairId(params.source.id, params.candidate.id);

  await col.updateOne(
    { pairId },
    {
      $set: {
        sourceProductId: params.source.id,
        candidateProductId: params.candidate.id,
        sourceTitle: params.source.title,
        candidateTitle: params.candidate.title,
        sourceAdvertiserId: params.source.advertiserId,
        candidateAdvertiserId: params.candidate.advertiserId,
        reviewBasis: params.result.reviewBasis,
        matchedOn: params.result.matchedOn,
        conflicts: params.result.conflicts,
        reason: params.result.reason,
        updatedAt: now,
      },
      $setOnInsert: {
        pairId,
        status: "pending" as MatchReviewStatus,
        reviewedBy: null,
        reviewedAt: null,
        notes: null,
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

export interface MatchReviewQuery {
  status?: MatchReviewStatus;
  productId?: number;
  page?: number;
  pageSize?: number;
}

export async function getMatchReviews(query: MatchReviewQuery = {}): Promise<{
  items: MatchReview[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}> {
  const db = await getDb();
  const col = db.collection<MatchReviewDoc>(COLLECTION);

  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.productId) {
    filter.$or = [
      { sourceProductId: query.productId },
      { candidateProductId: query.productId },
    ];
  }

  const pageSize = Math.max(1, Math.min(100, query.pageSize || 25));
  const total = await col.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(totalPages, query.page || 1));

  const docs = await col
    .find(filter, { projection: { _id: 0 } })
    .sort({ updatedAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();

  return { items: docs.map(strip), page, pageSize, total, totalPages };
}

export async function countPendingMatchReviews(): Promise<number> {
  const db = await getDb();
  return db.collection(COLLECTION).countDocuments({ status: "pending" });
}

/**
 * Record a reviewer's decision.
 *
 * An approval without a named reviewer is refused here as well as in
 * `classifyMatch`: the brief requires manual matches to be attributable, and a
 * blank name would produce a row that claims exactness with nobody behind it.
 */
export async function ruleOnMatch(params: {
  pairId: string;
  status: Exclude<MatchReviewStatus, "pending">;
  reviewedBy: string;
  notes?: string | null;
}): Promise<boolean> {
  if (params.status === "approved" && !params.reviewedBy.trim()) {
    throw new Error("An approved match must name its reviewer.");
  }

  const db = await getDb();
  const col = db.collection<MatchReviewDoc>(COLLECTION);
  const result = await col.updateOne(
    { pairId: params.pairId },
    {
      $set: {
        status: params.status,
        reviewedBy: params.reviewedBy.trim() || null,
        reviewedAt: new Date().toISOString(),
        notes: params.notes ?? null,
        updatedAt: new Date(),
      },
    },
  );
  return result.matchedCount > 0;
}

/** Rulings for a set of pairs, in the shape `classifyMatch` consumes. */
export async function getRulingsForProduct(
  productId: number,
): Promise<Map<string, MatchRuling>> {
  const db = await getDb();
  const col = db.collection<MatchReviewDoc>(COLLECTION);
  const docs = await col
    .find(
      {
        status: { $ne: "pending" },
        $or: [{ sourceProductId: productId }, { candidateProductId: productId }],
      },
      { projection: { _id: 0 } },
    )
    .toArray();

  return new Map(
    docs
      .map(strip)
      .filter((d): d is MatchReview & { status: MatchRuling["status"] } =>
        d.status !== "pending",
      )
      .map((d) => [
        d.pairId,
        {
          pairId: d.pairId,
          status: d.status,
          reviewedBy: d.reviewedBy,
          reviewedAt: d.reviewedAt,
          notes: d.notes,
        } satisfies MatchRuling,
      ]),
  );
}
