/**
 * Corrections & Disputes Persistence Layer (§15)
 *
 * Implements ticket creation, querying, and resolution tracking for
 * shopper and retailer reports.
 */

import { randomBytes } from "crypto";
import { getDb } from "@/lib/mongodb";
import {
  type CorrectionTicket,
  type CreateCorrectionInput,
  type CorrectionStatus,
  type DisputeType,
  canTransitionCorrection,
} from "@/lib/model/correction";

const COLLECTION = "corrections";

interface CorrectionDoc extends CorrectionTicket {
  _id?: unknown;
}

export async function ensureCorrectionIndexes(): Promise<void> {
  const db = await getDb();
  const col = db.collection<CorrectionDoc>(COLLECTION);
  await Promise.all([
    col.createIndex({ id: 1 }, { unique: true }),
    col.createIndex({ status: 1, createdAt: -1 }),
    col.createIndex({ country: 1, disputeType: 1 }),
    col.createIndex({ productId: 1 }),
  ]);
}

function strip(doc: CorrectionDoc): CorrectionTicket {
  const { _id, ...rest } = doc;
  return rest as CorrectionTicket;
}

/**
 * Creates a new correction ticket.
 */
export async function createCorrection(
  input: CreateCorrectionInput,
): Promise<CorrectionTicket> {
  const db = await getDb();
  const col = db.collection<CorrectionDoc>(COLLECTION);
  await ensureCorrectionIndexes();

  const now = new Date().toISOString();
  const ticketId = `corr_${Date.now()}_${randomBytes(4).toString("hex")}`;

  const ticket: CorrectionTicket = {
    id: ticketId,
    country: input.country.toUpperCase(),
    disputeType: input.disputeType,
    productId: input.productId?.trim() || undefined,
    productTitle: input.productTitle?.trim() || undefined,
    dealId: input.dealId?.trim() || undefined,
    storeSlug: input.storeSlug?.trim() || undefined,
    pageUrl: input.pageUrl?.trim() || undefined,
    description: input.description.trim(),
    reporterEmail: input.reporterEmail?.trim().toLowerCase() || undefined,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  await col.insertOne({ ...ticket });
  return ticket;
}

/**
 * Retrieves a list of corrections matching optional filters.
 */
export async function getCorrections(options?: {
  status?: CorrectionStatus;
  disputeType?: DisputeType;
  country?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: CorrectionTicket[]; total: number }> {
  const db = await getDb();
  const col = db.collection<CorrectionDoc>(COLLECTION);

  const query: Record<string, any> = {};
  if (options?.status) query.status = options.status;
  if (options?.disputeType) query.disputeType = options.disputeType;
  if (options?.country) query.country = options.country.toUpperCase();

  const limit = Math.max(1, Math.min(100, options?.limit ?? 25));
  const offset = Math.max(0, options?.offset ?? 0);

  const [docs, total] = await Promise.all([
    col
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
    col.countDocuments(query),
  ]);

  return {
    items: docs.map(strip),
    total,
  };
}

/**
 * Finds a single correction by ticket ID.
 */
export async function getCorrectionById(
  id: string,
): Promise<CorrectionTicket | null> {
  const db = await getDb();
  const col = db.collection<CorrectionDoc>(COLLECTION);
  const doc = await col.findOne({ id });
  return doc ? strip(doc) : null;
}

/**
 * Updates a correction ticket's status and records resolution audit notes.
 */
export async function updateCorrectionStatus(
  id: string,
  update: {
    status: CorrectionStatus;
    resolutionNotes?: string;
    reviewedBy: string;
  },
): Promise<CorrectionTicket | null> {
  const db = await getDb();
  const col = db.collection<CorrectionDoc>(COLLECTION);

  const existing = await col.findOne({ id });
  if (!existing) return null;

  if (!canTransitionCorrection(existing.status, update.status)) {
    throw new Error(
      `Cannot transition correction from ${existing.status} to ${update.status}`,
    );
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, any> = {
    status: update.status,
    reviewedBy: update.reviewedBy,
    reviewedAt: now,
    updatedAt: now,
  };

  if (update.resolutionNotes !== undefined) {
    updatePayload.resolutionNotes = update.resolutionNotes;
  }

  const result = await col.findOneAndUpdate(
    { id },
    { $set: updatePayload },
    { returnDocument: "after" },
  );

  return result ? strip(result) : null;
}

/**
 * Aggregates summary statistics across all correction tickets.
 */
export async function getCorrectionStats(): Promise<{
  pending: number;
  reviewing: number;
  resolved: number;
  rejected: number;
  total: number;
}> {
  const db = await getDb();
  const col = db.collection<CorrectionDoc>(COLLECTION);

  const [pending, reviewing, resolved, rejected, total] = await Promise.all([
    col.countDocuments({ status: "pending" }),
    col.countDocuments({ status: "reviewing" }),
    col.countDocuments({ status: "resolved" }),
    col.countDocuments({ status: "rejected" }),
    col.countDocuments({}),
  ]);

  return { pending, reviewing, resolved, rejected, total };
}
