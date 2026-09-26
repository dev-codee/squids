/**
 * PPC permission outreach runner — the three scheduled jobs.
 *
 *   sendInitialRequests()  daily   READY  → REQUESTED   (one email, ever)
 *   sendFollowups()        hourly  REQUESTED → FOLLOWED_UP (one email, ever)
 *   closeNoResponse()      daily   FOLLOWED_UP → NO_RESPONSE (stops sending)
 *
 * Each send is claimed atomically in the database *before* the SMTP call — see
 * the header of `lib/db/ppc-permissions` for why the claim is never rolled back
 * on failure.
 *
 * ## Dry-run
 *
 * Two independent safety nets, both of which redirect the recipient to
 * `PPC_TEST_EMAIL` and prefix the subject:
 *
 *  - `PPC_DRY_RUN=true` (or `?dryRun=1` on the cron route) — a global switch for
 *    validating the whole flow against your own inbox.
 *  - a record's own `isTest` flag — always redirected, **even in production**, so
 *    a test row can never reach a real merchant.
 *
 * Dry-run with no `PPC_TEST_EMAIL` configured aborts rather than sending.
 */

import {
  PPC_SEND_BATCH_LIMIT,
  appendThreadMessage,
  claimForFollowup,
  claimForRequest,
  findFollowupCandidates,
  findRequestCandidates,
  recordSendFailure,
  sweepNoResponse,
} from "@/lib/db/ppc-permissions";
import { buildMessageId, sendThreadedMail } from "@/lib/email";
import { ppcFollowupEmail, ppcRequestEmail, ppcRequestSubject } from "@/lib/ppc/emails";
import { logActivity } from "@/lib/db/activity-logs";
import type { PpcPermission } from "@/lib/ppc";

export interface PpcOutreachOptions {
  /** Force the global dry-run redirect on for this run. */
  dryRun?: boolean;
  /** Cap on rows processed in one invocation. */
  limit?: number;
  /**
   * Restrict the run to a single permission record id.
   *
   * Used by the "Send now" action in the admin UI. The record still has to pass
   * every eligibility condition in the claim filter — this narrows the batch, it
   * does not bypass any guard.
   */
  only?: string;
}

export interface PpcSendResult {
  considered: number;
  sent: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  details: { merchant: string; to: string; outcome: "sent" | "skipped" | "failed"; note?: string }[];
}

/** Global dry-run switch. */
function isGlobalDryRun(override?: boolean): boolean {
  if (override === true) return true;
  return process.env.PPC_DRY_RUN === "true";
}

function testInbox(): string | null {
  const addr = process.env.PPC_TEST_EMAIL?.trim();
  return addr || null;
}

/**
 * Resolve the actual recipient for a record.
 *
 * Returns `null` when the send must be aborted (dry-run requested with no test
 * inbox configured) — the caller leaves the row untouched rather than mailing
 * the merchant.
 */
function resolveRecipient(
  permission: PpcPermission,
  globalDryRun: boolean,
): { to: string; redirected: boolean } | { to: null; reason: string } {
  const redirect = globalDryRun || permission.isTest;

  if (!redirect) {
    if (!permission.contactEmail) return { to: null, reason: "No contact email." };
    return { to: permission.contactEmail, redirected: false };
  }

  const inbox = testInbox();
  if (!inbox) {
    return {
      to: null,
      reason: permission.isTest
        ? "Record is flagged isTest but PPC_TEST_EMAIL is not configured."
        : "PPC_DRY_RUN is on but PPC_TEST_EMAIL is not configured.",
    };
  }
  return { to: inbox, redirected: true };
}

/** Prefix that makes a redirected email obvious in your own inbox. */
function subjectFor(subject: string, redirected: boolean, permission: PpcPermission): string {
  if (!redirected) return subject;
  return `[DRY RUN → ${permission.contactEmail ?? "no contact"}] ${subject}`;
}

// ---------------------------------------------------------------------------
// Job 1 — daily initial request
// ---------------------------------------------------------------------------

/**
 * Send the initial permission request to every eligible READY record.
 *
 * Eligibility (valid email, valid landing page, contactable, never sent) is
 * enforced in the claim's own filter, so a row that changes between the
 * candidate query and the claim is simply skipped.
 */
export async function sendInitialRequests(opts: PpcOutreachOptions = {}): Promise<PpcSendResult> {
  const dryRun = isGlobalDryRun(opts.dryRun);
  const candidates = await findRequestCandidates(opts.limit ?? PPC_SEND_BATCH_LIMIT, opts.only);

  const result: PpcSendResult = {
    considered: candidates.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    dryRun,
    details: [],
  };

  for (const candidate of candidates) {
    const recipient = resolveRecipient(candidate, dryRun);
    if (recipient.to === null) {
      result.skipped++;
      result.details.push({
        merchant: candidate.merchantName,
        to: candidate.contactEmail ?? "—",
        outcome: "skipped",
        note: recipient.reason,
      });
      continue;
    }

    const messageId = buildMessageId("ppc-req");
    const subject = ppcRequestSubject(candidate);

    // Claim first: from here on this row can never be picked up again.
    const claimed = await claimForRequest(candidate._id!, { messageId, subject });
    if (!claimed) {
      result.skipped++;
      result.details.push({
        merchant: candidate.merchantName,
        to: recipient.to,
        outcome: "skipped",
        note: "Already claimed by another run, or no longer eligible.",
      });
      continue;
    }

    const email = ppcRequestEmail(claimed);

    try {
      await sendThreadedMail({
        to: recipient.to,
        subject: subjectFor(email.subject, recipient.redirected, claimed),
        html: email.html,
        text: email.text,
        messageId,
      });

      await appendThreadMessage(claimed._id!, {
        direction: "outbound",
        kind: "initial",
        messageId,
        from: process.env.SMTP_FROM ?? null,
        to: recipient.to,
        subject: email.subject,
        body: email.text,
        at: new Date().toISOString(),
        isTest: recipient.redirected,
      });

      result.sent++;
      result.details.push({ merchant: claimed.merchantName, to: recipient.to, outcome: "sent" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await recordSendFailure(claimed._id!, message);
      result.failed++;
      result.details.push({
        merchant: claimed.merchantName,
        to: recipient.to,
        outcome: "failed",
        note: message,
      });
    }
  }

  if (result.sent > 0 || result.failed > 0) {
    await logActivity({
      type: "system",
      title: `PPC permission requests sent (${result.sent})`,
      description: `Initial PPC permission outreach: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped.${dryRun ? " Dry run." : ""}`,
      entity: "ppc_permissions",
      stats: { created: result.sent, total: result.considered },
      status: result.failed > 0 ? "warning" : "success",
    }).catch(() => {});
  }

  return result;
}

// ---------------------------------------------------------------------------
// Job 2 — hourly follow-up
// ---------------------------------------------------------------------------

/**
 * Send the single follow-up, in the same thread, to every REQUESTED record
 * whose follow-up window has passed with no reply.
 */
export async function sendFollowups(opts: PpcOutreachOptions = {}): Promise<PpcSendResult> {
  const dryRun = isGlobalDryRun(opts.dryRun);
  const candidates = await findFollowupCandidates(opts.limit ?? PPC_SEND_BATCH_LIMIT, opts.only);

  const result: PpcSendResult = {
    considered: candidates.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    dryRun,
    details: [],
  };

  for (const candidate of candidates) {
    const recipient = resolveRecipient(candidate, dryRun);
    if (recipient.to === null) {
      result.skipped++;
      result.details.push({
        merchant: candidate.merchantName,
        to: candidate.contactEmail ?? "—",
        outcome: "skipped",
        note: recipient.reason,
      });
      continue;
    }

    const messageId = buildMessageId("ppc-fup");

    const claimed = await claimForFollowup(candidate._id!, { messageId });
    if (!claimed) {
      result.skipped++;
      result.details.push({
        merchant: candidate.merchantName,
        to: recipient.to,
        outcome: "skipped",
        note: "Already followed up, reply arrived, or no longer eligible.",
      });
      continue;
    }

    const email = ppcFollowupEmail(claimed);

    try {
      await sendThreadedMail({
        to: recipient.to,
        subject: subjectFor(email.subject, recipient.redirected, claimed),
        html: email.html,
        text: email.text,
        messageId,
        // Threads the follow-up under the original request.
        inReplyTo: claimed.requestMessageId,
        references: claimed.requestMessageId ? [claimed.requestMessageId] : [],
      });

      await appendThreadMessage(claimed._id!, {
        direction: "outbound",
        kind: "followup",
        messageId,
        from: process.env.SMTP_FROM ?? null,
        to: recipient.to,
        subject: email.subject,
        body: email.text,
        at: new Date().toISOString(),
        isTest: recipient.redirected,
      });

      result.sent++;
      result.details.push({ merchant: claimed.merchantName, to: recipient.to, outcome: "sent" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await recordSendFailure(claimed._id!, message);
      result.failed++;
      result.details.push({
        merchant: claimed.merchantName,
        to: recipient.to,
        outcome: "failed",
        note: message,
      });
    }
  }

  if (result.sent > 0 || result.failed > 0) {
    await logActivity({
      type: "system",
      title: `PPC follow-ups sent (${result.sent})`,
      description: `PPC permission follow-ups: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped.${dryRun ? " Dry run." : ""}`,
      entity: "ppc_permissions",
      stats: { updated: result.sent, total: result.considered },
      status: result.failed > 0 ? "warning" : "success",
    }).catch(() => {});
  }

  return result;
}

// ---------------------------------------------------------------------------
// Job 3 — daily no-response sweep
// ---------------------------------------------------------------------------

/** Close out unanswered follow-ups. Sends nothing. */
export async function closeNoResponse(): Promise<{ closed: number }> {
  const result = await sweepNoResponse();

  if (result.closed > 0) {
    await logActivity({
      type: "system",
      title: `PPC outreach closed as no-response (${result.closed})`,
      description: `${result.closed} PPC permission record${result.closed === 1 ? "" : "s"} went unanswered past the grace window. No further automated email will be sent.`,
      entity: "ppc_permissions",
      stats: { updated: result.closed },
      status: "info",
    }).catch(() => {});
  }

  return result;
}
