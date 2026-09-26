/**
 * MongoDB persistence layer for PPC permissions.
 *
 * The hard guarantee this module exists to provide: **a merchant receives at
 * most one initial request and at most one follow-up, ever.** That is enforced
 * by the database, not by application logic:
 *
 *  - A unique index on `(merchantId, network)` means one record per scope.
 *  - `claimForRequest` matches `{ status: "READY", sentAt: null }` and sets both
 *    in one atomic `findOneAndUpdate`. A second concurrent job finds nothing.
 *  - `claimForFollowup` matches `{ status: "REQUESTED", followupSentAt: null }`
 *    the same way.
 *  - Every claim additionally requires `doNotContact: { $ne: true }`, a sticky
 *    flag set on refusal/suppression that is never cleared automatically.
 *
 * Claims happen *before* the SMTP call. If the send then fails we keep the claim
 * and record `lastSendError` instead of rolling back — rolling back would reopen
 * the double-send window, and under-sending is the safe direction. Failed sends
 * surface in the Outreach Queue for a deliberate human retry.
 */

import { ObjectId, type Filter, type WithId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { logActivity } from "@/lib/db/activity-logs";
import {
  PPC_EMAIL_PATTERN,
  PPC_FOLLOWUP_BUSINESS_DAYS,
  PPC_LANDING_PAGE_PATTERN,
  PPC_NO_RESPONSE_GRACE_DAYS,
  PPC_STATUS_ORDER,
  addBusinessDays,
  type PagedPpcPermissions,
  type PpcBrandInAdText,
  type PpcPermission,
  type PpcPermissionInput,
  type PpcPermissionStatus,
  type PpcThreadMessage,
} from "@/lib/ppc";

const COLLECTION = "ppc_permissions";

/** Shape as stored: dates are real `Date`s, `_id` is an `ObjectId`. */
interface PpcPermissionDoc
  extends Omit<
    PpcPermission,
    | "_id"
    | "sentAt"
    | "followupAt"
    | "followupSentAt"
    | "replyReceivedAt"
    | "decidedAt"
    | "economicsSignedOffAt"
    | "createdAt"
    | "updatedAt"
    | "messages"
  > {
  _id?: ObjectId;
  sentAt: Date | null;
  followupAt: Date | null;
  followupSentAt: Date | null;
  replyReceivedAt: Date | null;
  decidedAt: Date | null;
  economicsSignedOffAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  messages: (Omit<PpcThreadMessage, "at"> & { at: Date })[];
}

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

let indexesEnsured = false;

/**
 * Create the collection's indexes once per process.
 *
 * Mirrors the inline `createIndex` approach used by the other db modules (there
 * is no migration runner in this project), but guarded by a module flag so the
 * hourly cron doesn't re-issue them on every invocation.
 */
async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const db = await getDb();
  const col = db.collection<PpcPermissionDoc>(COLLECTION);
  await Promise.all([
    // One permission record per merchant per network.
    col.createIndex({ merchantId: 1, network: 1 }, { unique: true, name: "merchant_network_unique" }),
    // Drives the daily initial-send claim.
    col.createIndex({ status: 1, doNotContact: 1, sentAt: 1 }, { name: "send_claim" }),
    // Drives the hourly follow-up claim and the no-response sweep.
    col.createIndex({ status: 1, doNotContact: 1, followupAt: 1 }, { name: "followup_claim" }),
    col.createIndex({ status: 1, followupSentAt: 1 }, { name: "sweep" }),
    // Inbound reply matching: by thread Message-ID, then by contact address.
    col.createIndex({ threadRefs: 1 }, { name: "thread_refs" }),
    col.createIndex({ contactEmail: 1 }, { name: "contact_email" }),
    // Directory listing default sort.
    col.createIndex({ updatedAt: -1 }, { name: "recent" }),
  ]);
  indexesEnsured = true;
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

const iso = (d: Date | null | undefined): string | null =>
  d instanceof Date ? d.toISOString() : d ? new Date(d).toISOString() : null;

/** Convert a stored doc to the wire/client shape. */
export function serializePermission(doc: WithId<PpcPermissionDoc> | PpcPermissionDoc): PpcPermission {
  return {
    ...doc,
    _id: doc._id ? String(doc._id) : undefined,
    sentAt: iso(doc.sentAt),
    followupAt: iso(doc.followupAt),
    followupSentAt: iso(doc.followupSentAt),
    replyReceivedAt: iso(doc.replyReceivedAt),
    decidedAt: iso(doc.decidedAt),
    economicsSignedOffAt: iso(doc.economicsSignedOffAt),
    createdAt: iso(doc.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(doc.updatedAt) ?? new Date(0).toISOString(),
    messages: (doc.messages ?? []).map((m) => ({ ...m, at: iso(m.at) ?? "" })),
  } as PpcPermission;
}

/**
 * Filter that excludes every suppressed row, at the query level.
 *
 * Used by all three jobs. `doNotContact` is a sticky boolean rather than a
 * status check so that manually editing a REFUSED row back to READY still can't
 * trigger an email.
 */
function contactableFilter(): Filter<PpcPermissionDoc> {
  return { doNotContact: { $ne: true } };
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

/**
 * Create a permission record, or update the editable fields of an existing one.
 *
 * Contact/scope details are always safe to update — they never affect whether
 * something has already been sent. Status and the send timestamps are managed
 * exclusively by the jobs and the explicit decision helpers below.
 */
export async function upsertPermission(
  input: PpcPermissionInput,
): Promise<{ permission: PpcPermission; created: boolean }> {
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection<PpcPermissionDoc>(COLLECTION);

  const now = new Date();
  const network = (input.network || "awin").trim().toLowerCase();
  const merchantId = Number(input.merchantId);

  const editable: Record<string, unknown> = { updatedAt: now };
  const setIfGiven = <K extends keyof PpcPermissionInput>(key: K, transform?: (v: any) => unknown) => {
    if (input[key] !== undefined) {
      editable[key as string] = transform ? transform(input[key]) : input[key];
    }
  };

  setIfGiven("merchantName", (v: string) => String(v).trim());
  setIfGiven("merchantSlug", (v) => (v ? String(v).trim() : null));
  setIfGiven("publisherId", (v) => (v ? String(v).trim() : null));
  setIfGiven("contactName", (v) => (v ? String(v).trim() : null));
  setIfGiven("contactEmail", (v) => (v ? String(v).trim().toLowerCase() : null));
  setIfGiven("country", (v) => (v ? String(v).trim().toUpperCase() : null));
  setIfGiven("landingPage", (v) => (v ? String(v).trim() : null));
  setIfGiven("keywordsScope", (v) => (v ? String(v).trim() : null));
  setIfGiven("brandInAdText", (v) => (v as PpcBrandInAdText) || "unanswered");
  setIfGiven("notes", (v) => (v ? String(v).trim() : null));
  setIfGiven("isTest", (v) => Boolean(v));

  // Defaults applied only when the record is created. Mongo rejects an update
  // that names the same path in both `$set` and `$setOnInsert`, so any field the
  // caller actually supplied is dropped from the defaults — `$set` wins.
  const defaults: Record<string, unknown> = {
    merchantId,
    network,
    merchantName: input.merchantName?.trim() || `Merchant ${merchantId}`,
    status: "READY" as PpcPermissionStatus,
    doNotContact: false,
    brandInAdText: "unanswered" as PpcBrandInAdText,
    contactName: null,
    contactEmail: null,
    country: null,
    landingPage: null,
    keywordsScope: null,
    publisherId: null,
    merchantSlug: null,
    notes: null,
    isTest: false,
    sentAt: null,
    followupAt: null,
    followupSentAt: null,
    replyReceivedAt: null,
    decidedAt: null,
    requestMessageId: null,
    followupMessageId: null,
    threadSubject: null,
    threadRefs: [],
    messages: [],
    permissionScope: null,
    evidence: null,
    economicsSignedOffBy: null,
    economicsSignedOffAt: null,
    economicsNotes: null,
    lastSendError: null,
    createdAt: now,
  };
  for (const key of Object.keys(editable)) delete defaults[key];

  const result = await col.findOneAndUpdate(
    { merchantId, network },
    { $set: editable, $setOnInsert: defaults },
    { upsert: true, returnDocument: "after", includeResultMetadata: true },
  );

  const doc = result.value as WithId<PpcPermissionDoc>;
  return { permission: serializePermission(doc), created: !result.lastErrorObject?.updatedExisting };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getPermissionById(id: string): Promise<PpcPermission | null> {
  if (!ObjectId.isValid(id)) return null;
  await ensureIndexes();
  const db = await getDb();
  const doc = await db
    .collection<PpcPermissionDoc>(COLLECTION)
    .findOne({ _id: new ObjectId(id) });
  return doc ? serializePermission(doc) : null;
}

export async function getPermissionForMerchant(
  merchantId: number,
  network: string,
): Promise<PpcPermission | null> {
  await ensureIndexes();
  const db = await getDb();
  const doc = await db
    .collection<PpcPermissionDoc>(COLLECTION)
    .findOne({ merchantId: Number(merchantId), network: network.trim().toLowerCase() });
  return doc ? serializePermission(doc) : null;
}

export interface PpcPermissionQuery {
  status?: string;
  network?: string;
  country?: string;
  search?: string;
  /** "overdue" restricts to rows whose follow-up is due but unsent. */
  view?: "all" | "queue" | "overdue" | "needs_review" | "incomplete";
  includeTest?: boolean;
  page?: number;
  pageSize?: number;
}

function buildQueryFilter(query: PpcPermissionQuery): Filter<PpcPermissionDoc> {
  const and: Filter<PpcPermissionDoc>[] = [];

  if (query.status && query.status !== "all") {
    and.push({ status: query.status as PpcPermissionStatus });
  }
  if (query.network && query.network !== "all") {
    and.push({ network: query.network.trim().toLowerCase() });
  }
  if (query.country && query.country !== "all") {
    and.push({ country: query.country.trim().toUpperCase() });
  }
  if (query.search) {
    const safe = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(safe, "i");
    and.push({ $or: [{ merchantName: re }, { contactEmail: re }, { contactName: re }] });
  }
  if (!query.includeTest) {
    and.push({ isTest: { $ne: true } });
  }

  switch (query.view) {
    case "queue":
      // Everything still in flight or awaiting a human.
      and.push({ status: { $in: ["READY", "REQUESTED", "FOLLOWED_UP", "REVIEW_REPLY"] } });
      break;
    case "overdue":
      and.push({ status: "REQUESTED", followupSentAt: null, replyReceivedAt: null, followupAt: { $lte: new Date() } });
      break;
    case "needs_review":
      and.push({ status: "REVIEW_REPLY" });
      break;
    case "incomplete":
      // READY rows a job will skip because the contact or landing page is unusable.
      and.push({
        status: "READY",
        $or: [
          { contactEmail: null },
          { contactEmail: { $not: { $regex: PPC_EMAIL_PATTERN } } },
          { landingPage: null },
          { landingPage: { $not: { $regex: PPC_LANDING_PAGE_PATTERN, $options: "i" } } },
        ],
      });
      break;
    default:
      break;
  }

  return and.length > 0 ? { $and: and } : {};
}

/** Paged directory listing plus per-status counts for the filter chips. */
export async function listPermissions(query: PpcPermissionQuery = {}): Promise<PagedPpcPermissions> {
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection<PpcPermissionDoc>(COLLECTION);

  const filter = buildQueryFilter(query);
  const page = Math.max(1, query.page || 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize || 30));

  // Counts ignore the status filter so the chips always show every option, the
  // same way `buildFacets` works for advertisers.
  const countsFilter = buildQueryFilter({ ...query, status: undefined });

  const [items, total, grouped] = await Promise.all([
    col.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    col.countDocuments(filter),
    col.aggregate<{ _id: PpcPermissionStatus; n: number }>([
      { $match: countsFilter },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]).toArray(),
  ]);

  const counts = Object.fromEntries(PPC_STATUS_ORDER.map((s) => [s, 0])) as Record<PpcPermissionStatus, number>;
  for (const row of grouped) {
    if (row._id in counts) counts[row._id] = row.n;
  }

  return {
    items: items.map(serializePermission),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts,
  };
}

/** Count of replies waiting on a human. Drives the sidebar badge. */
export async function getReviewReplyCount(): Promise<number> {
  try {
    const db = await getDb();
    return await db
      .collection<PpcPermissionDoc>(COLLECTION)
      .countDocuments({ status: "REVIEW_REPLY", isTest: { $ne: true } });
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Atomic send claims
// ---------------------------------------------------------------------------

/** How many rows a single job invocation will process. Keeps runs bounded. */
export const PPC_SEND_BATCH_LIMIT = 25;

/**
 * Candidates for the initial request: READY, contactable, never sent, with a
 * usable email address and landing page.
 *
 * The validity checks are expressed as Mongo `$regex` rather than filtered in
 * JS so the same conditions also appear inside {@link claimForRequest}'s atomic
 * filter — there is no window where a row passes here and is claimed there with
 * a broken address.
 */
export async function findRequestCandidates(
  limit = PPC_SEND_BATCH_LIMIT,
  only?: string,
): Promise<PpcPermission[]> {
  await ensureIndexes();
  if (only && !ObjectId.isValid(only)) return [];
  const db = await getDb();
  const docs = await db
    .collection<PpcPermissionDoc>(COLLECTION)
    .find({
      ...contactableFilter(),
      ...(only ? { _id: new ObjectId(only) } : {}),
      status: "READY",
      sentAt: null,
      contactEmail: { $regex: PPC_EMAIL_PATTERN },
      landingPage: { $regex: PPC_LANDING_PAGE_PATTERN, $options: "i" },
    })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();
  return docs.map(serializePermission);
}

/**
 * Atomically claim a row for the initial send.
 *
 * Returns the updated record, or `null` when another invocation got there
 * first / the row no longer qualifies. Because `sentAt: null` is part of the
 * filter and `sentAt` is set in the same operation, this can succeed at most
 * once for the lifetime of the record.
 */
export async function claimForRequest(
  id: string,
  opts: { messageId: string; subject: string; now?: Date },
): Promise<PpcPermission | null> {
  if (!ObjectId.isValid(id)) return null;
  const db = await getDb();
  const col = db.collection<PpcPermissionDoc>(COLLECTION);
  const now = opts.now ?? new Date();
  const followupAt = addBusinessDays(now, PPC_FOLLOWUP_BUSINESS_DAYS);

  const result = await col.findOneAndUpdate(
    {
      _id: new ObjectId(id),
      ...contactableFilter(),
      status: "READY",
      sentAt: null,
      contactEmail: { $regex: PPC_EMAIL_PATTERN },
      landingPage: { $regex: PPC_LANDING_PAGE_PATTERN, $options: "i" },
    },
    {
      $set: {
        status: "REQUESTED" as PpcPermissionStatus,
        sentAt: now,
        followupAt,
        requestMessageId: opts.messageId,
        threadSubject: opts.subject,
        lastSendError: null,
        updatedAt: now,
      },
      $addToSet: { threadRefs: opts.messageId },
    },
    { returnDocument: "after" },
  );

  return result ? serializePermission(result) : null;
}

/**
 * Candidates for the single follow-up: REQUESTED, contactable, follow-up due,
 * nothing sent yet, no reply received.
 */
export async function findFollowupCandidates(
  limit = PPC_SEND_BATCH_LIMIT,
  only?: string,
): Promise<PpcPermission[]> {
  await ensureIndexes();
  if (only && !ObjectId.isValid(only)) return [];
  const db = await getDb();
  const docs = await db
    .collection<PpcPermissionDoc>(COLLECTION)
    .find({
      ...contactableFilter(),
      ...(only ? { _id: new ObjectId(only) } : {}),
      status: "REQUESTED",
      followupSentAt: null,
      replyReceivedAt: null,
      followupAt: { $ne: null, $lte: new Date() },
      contactEmail: { $regex: PPC_EMAIL_PATTERN },
      requestMessageId: { $ne: null },
      // A row whose initial send failed was claimed (so it has a sentAt and a
      // Message-ID) but the merchant never received anything. Following up would
      // reference an email they never got, and would be the *only* email they
      // ever see. `lastSendError` is cleared on every successful claim+send and
      // set on failure, so requiring it to be null means "the initial request
      // actually went out". Those rows need a manual retry, not a follow-up.
      lastSendError: null,
    })
    .sort({ followupAt: 1 })
    .limit(limit)
    .toArray();
  return docs.map(serializePermission);
}

/** Atomically claim a row for the follow-up. Succeeds at most once, ever. */
export async function claimForFollowup(
  id: string,
  opts: { messageId: string; now?: Date },
): Promise<PpcPermission | null> {
  if (!ObjectId.isValid(id)) return null;
  const db = await getDb();
  const col = db.collection<PpcPermissionDoc>(COLLECTION);
  const now = opts.now ?? new Date();

  const result = await col.findOneAndUpdate(
    {
      _id: new ObjectId(id),
      ...contactableFilter(),
      status: "REQUESTED",
      followupSentAt: null,
      replyReceivedAt: null,
      followupAt: { $ne: null, $lte: now },
      requestMessageId: { $ne: null },
      // See findFollowupCandidates: never follow up on a failed initial send.
      lastSendError: null,
    },
    {
      $set: {
        status: "FOLLOWED_UP" as PpcPermissionStatus,
        followupSentAt: now,
        followupMessageId: opts.messageId,
        lastSendError: null,
        updatedAt: now,
      },
      $addToSet: { threadRefs: opts.messageId },
    },
    { returnDocument: "after" },
  );

  return result ? serializePermission(result) : null;
}

/** Append a message to the thread log after a successful send. */
export async function appendThreadMessage(id: string, message: PpcThreadMessage): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const db = await getDb();
  await db.collection<PpcPermissionDoc>(COLLECTION).updateOne(
    { _id: new ObjectId(id) },
    {
      $push: { messages: { ...message, at: new Date(message.at || Date.now()) } },
      $set: { updatedAt: new Date() },
    },
  );
}

/**
 * Record that a claimed send failed.
 *
 * The claim is intentionally *not* released — see the module header. The row
 * stays REQUESTED/FOLLOWED_UP with `lastSendError` set and no Message-ID, which
 * the Outreach Queue renders as "send failed, needs a manual retry".
 */
export async function recordSendFailure(id: string, error: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const db = await getDb();
  await db.collection<PpcPermissionDoc>(COLLECTION).updateOne(
    { _id: new ObjectId(id) },
    { $set: { lastSendError: error.slice(0, 500), updatedAt: new Date() } },
  );
}

/**
 * Sweep FOLLOWED_UP rows that went unanswered past the grace window to
 * NO_RESPONSE, which stops all further automated email.
 */
export async function sweepNoResponse(
  graceDays = PPC_NO_RESPONSE_GRACE_DAYS,
): Promise<{ closed: number }> {
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection<PpcPermissionDoc>(COLLECTION);

  const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  const result = await col.updateMany(
    {
      status: "FOLLOWED_UP",
      replyReceivedAt: null,
      followupSentAt: { $ne: null, $lte: cutoff },
    },
    { $set: { status: "NO_RESPONSE" as PpcPermissionStatus, decidedAt: now, updatedAt: now } },
  );

  return { closed: result.modifiedCount };
}

// ---------------------------------------------------------------------------
// Inbound replies
// ---------------------------------------------------------------------------

export interface PpcReplyInput {
  /** Message-IDs from the reply's In-Reply-To / References headers. */
  references: string[];
  from: string;
  subject?: string | null;
  body: string;
  messageId?: string | null;
  receivedAt?: Date | null;
}

/**
 * Match an inbound reply to a permission record and flag it for human review.
 *
 * Matching is by thread Message-ID first (authoritative), then by sender
 * address against a record we are actually awaiting a reply on. Replies are
 * **never** auto-classified as approval or refusal — the status becomes
 * REVIEW_REPLY and a human decides. An affiliate manager writing "yes, but not
 * on brand+coupon in DE" is a nuance no classifier should be trusted with when
 * the downstream consequence is a trademark complaint.
 */
export async function recordReply(
  input: PpcReplyInput,
): Promise<{ matched: boolean; permission?: PpcPermission; reason?: string }> {
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection<PpcPermissionDoc>(COLLECTION);

  const refs = (input.references || []).map((r) => r.trim()).filter(Boolean);
  const from = (input.from || "").trim().toLowerCase();
  const fromAddress = from.match(/<([^>]+)>/)?.[1]?.toLowerCase() ?? from;
  const receivedAt = input.receivedAt ?? new Date();

  let doc: WithId<PpcPermissionDoc> | null = null;

  if (refs.length > 0) {
    doc = await col.findOne({ threadRefs: { $in: refs } });
  }

  // Fall back to the sender address, but only for records we are genuinely
  // awaiting a reply on — otherwise an unrelated email from a contact who also
  // appears on an old closed record would reopen it.
  if (!doc && fromAddress) {
    doc = await col.findOne({
      contactEmail: fromAddress,
      status: { $in: ["REQUESTED", "FOLLOWED_UP"] },
    });
  }

  if (!doc) {
    return { matched: false, reason: "No permission record matched this thread or sender." };
  }

  const alreadyLogged =
    input.messageId && (doc.messages ?? []).some((m) => m.messageId === input.messageId);
  if (alreadyLogged) {
    return { matched: true, permission: serializePermission(doc), reason: "Reply already recorded." };
  }

  const message: Omit<PpcThreadMessage, "at"> & { at: Date } = {
    direction: "inbound",
    kind: "reply",
    messageId: input.messageId ?? null,
    from: input.from,
    to: process.env.SMTP_FROM ?? null,
    subject: input.subject ?? null,
    body: input.body,
    at: receivedAt,
  };

  // A reply on an already-decided record is logged for the audit trail but does
  // not reopen it — only REQUESTED/FOLLOWED_UP move to REVIEW_REPLY.
  const shouldFlag = doc.status === "REQUESTED" || doc.status === "FOLLOWED_UP";

  const updated = await col.findOneAndUpdate(
    { _id: doc._id },
    {
      $push: { messages: message },
      $set: {
        replyReceivedAt: doc.replyReceivedAt ?? receivedAt,
        updatedAt: new Date(),
        ...(shouldFlag ? { status: "REVIEW_REPLY" as PpcPermissionStatus } : {}),
      },
      ...(input.messageId ? { $addToSet: { threadRefs: input.messageId } } : {}),
    },
    { returnDocument: "after" },
  );

  if (shouldFlag) {
    await logActivity({
      type: "system",
      title: `PPC reply received: ${doc.merchantName}`,
      description: `${input.from} replied to the PPC permission request for ${doc.merchantName}. Needs manual review.`,
      network: doc.network,
      entity: "ppc_permissions",
      status: "warning",
    }).catch(() => {});
  }

  return { matched: true, permission: updated ? serializePermission(updated) : serializePermission(doc) };
}

// ---------------------------------------------------------------------------
// Manual decisions
// ---------------------------------------------------------------------------

/**
 * Record written approval.
 *
 * `permissionScope` and `evidence` are both required: an APPROVED row without
 * the agreed scope in writing and the proof behind it cannot satisfy the launch
 * gate, so we refuse to create one.
 */
export async function approvePermission(
  id: string,
  opts: {
    permissionScope: string;
    evidence: string;
    brandInAdText?: PpcBrandInAdText;
    keywordsScope?: string | null;
    landingPage?: string | null;
    country?: string | null;
    notes?: string | null;
  },
): Promise<{ ok: boolean; permission?: PpcPermission; error?: string }> {
  if (!ObjectId.isValid(id)) return { ok: false, error: "Invalid id." };

  const scope = opts.permissionScope?.trim();
  const evidence = opts.evidence?.trim();
  if (!scope) return { ok: false, error: "permissionScope is required to approve." };
  if (!evidence) return { ok: false, error: "evidence is required to approve." };

  const db = await getDb();
  const col = db.collection<PpcPermissionDoc>(COLLECTION);
  const now = new Date();

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $set: {
        status: "APPROVED" as PpcPermissionStatus,
        permissionScope: scope,
        evidence,
        decidedAt: now,
        updatedAt: now,
        ...(opts.brandInAdText ? { brandInAdText: opts.brandInAdText } : {}),
        ...(opts.keywordsScope !== undefined ? { keywordsScope: opts.keywordsScope } : {}),
        ...(opts.landingPage !== undefined ? { landingPage: opts.landingPage } : {}),
        ...(opts.country !== undefined
          ? { country: opts.country ? opts.country.toUpperCase() : null }
          : {}),
        ...(opts.notes !== undefined ? { notes: opts.notes } : {}),
      },
    },
    { returnDocument: "after" },
  );

  if (!result) return { ok: false, error: "Permission record not found." };

  await logActivity({
    type: "system",
    title: `PPC permission approved: ${result.merchantName}`,
    description: `Written PPC permission recorded for ${result.merchantName} (${result.country ?? "no market"}). Scope: ${scope.slice(0, 200)}`,
    network: result.network,
    entity: "ppc_permissions",
    status: "success",
  }).catch(() => {});

  return { ok: true, permission: serializePermission(result) };
}

/**
 * Record a refusal or a blanket suppression.
 *
 * Both set the sticky `doNotContact` flag, which every send claim filters on.
 */
export async function suppressPermission(
  id: string,
  opts: { status: "REFUSED" | "DO_NOT_CONTACT"; evidence?: string | null; notes?: string | null },
): Promise<{ ok: boolean; permission?: PpcPermission; error?: string }> {
  if (!ObjectId.isValid(id)) return { ok: false, error: "Invalid id." };

  const db = await getDb();
  const col = db.collection<PpcPermissionDoc>(COLLECTION);
  const now = new Date();

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $set: {
        status: opts.status,
        doNotContact: true,
        decidedAt: now,
        updatedAt: now,
        // Approval is revoked: a refusal must not leave a stale scope behind
        // that the launch gate could read as permission.
        permissionScope: null,
        ...(opts.evidence !== undefined ? { evidence: opts.evidence } : {}),
        ...(opts.notes !== undefined ? { notes: opts.notes } : {}),
      },
    },
    { returnDocument: "after" },
  );

  if (!result) return { ok: false, error: "Permission record not found." };

  await logActivity({
    type: "system",
    title: `PPC permission ${opts.status === "REFUSED" ? "refused" : "suppressed"}: ${result.merchantName}`,
    description: `${result.merchantName} marked ${opts.status}. Excluded from all automated PPC outreach.`,
    network: result.network,
    entity: "ppc_permissions",
    status: "warning",
  }).catch(() => {});

  return { ok: true, permission: serializePermission(result) };
}

/** Manual economics sign-off — the last non-automatable launch gate. */
export async function setEconomicsSignOff(
  id: string,
  opts: { signedOffBy: string | null; notes?: string | null },
): Promise<{ ok: boolean; permission?: PpcPermission; error?: string }> {
  if (!ObjectId.isValid(id)) return { ok: false, error: "Invalid id." };

  const db = await getDb();
  const col = db.collection<PpcPermissionDoc>(COLLECTION);
  const now = new Date();
  const by = opts.signedOffBy?.trim() || null;

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $set: {
        economicsSignedOffBy: by,
        // Clearing the name withdraws the sign-off, which re-blocks the gate.
        economicsSignedOffAt: by ? now : null,
        ...(opts.notes !== undefined ? { economicsNotes: opts.notes } : {}),
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!result) return { ok: false, error: "Permission record not found." };
  return { ok: true, permission: serializePermission(result) };
}

/** Log a message by hand — a phone call, or a reply that arrived out-of-band. */
export async function addManualNote(
  id: string,
  opts: { body: string; direction?: "outbound" | "inbound"; subject?: string | null },
): Promise<{ ok: boolean; permission?: PpcPermission; error?: string }> {
  if (!ObjectId.isValid(id)) return { ok: false, error: "Invalid id." };
  const body = opts.body?.trim();
  if (!body) return { ok: false, error: "body is required." };

  const db = await getDb();
  const col = db.collection<PpcPermissionDoc>(COLLECTION);

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $push: {
        messages: {
          direction: opts.direction ?? "inbound",
          kind: "manual" as const,
          messageId: null,
          from: null,
          to: null,
          subject: opts.subject ?? null,
          body,
          at: new Date(),
        },
      },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" },
  );

  if (!result) return { ok: false, error: "Permission record not found." };
  return { ok: true, permission: serializePermission(result) };
}

/** Delete a record. Only ever used to clean up dry-run rows. */
export async function deletePermission(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const db = await getDb();
  const res = await db
    .collection<PpcPermissionDoc>(COLLECTION)
    .deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount > 0;
}
