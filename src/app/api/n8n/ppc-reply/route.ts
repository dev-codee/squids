import { NextRequest, NextResponse } from "next/server";
import { recordReply } from "@/lib/db/ppc-permissions";

export const dynamic = "force-dynamic";

/**
 * POST /api/n8n/ppc-reply
 *
 * Called by the n8n "PPC Permission Reply Watcher" workflow (an IMAP Email
 * Trigger on the outreach mailbox) whenever a new message arrives. Requires
 * `Authorization: Bearer <N8N_WEBHOOK_SECRET>`, same as `/api/n8n/coupon-verify`.
 *
 * Body:
 *   from         – sender, raw header value ("Jane <jane@shop.com>") or bare address
 *   body         – plain-text body of the reply (the evidence we store)
 *   subject      – optional subject line
 *   messageId    – optional Message-ID of the reply, used for de-duplication
 *   inReplyTo    – optional In-Reply-To header
 *   references   – optional References header (string or array)
 *   receivedAt   – optional ISO timestamp; defaults to now
 *
 * Replies are matched to a permission record by thread Message-ID first, then by
 * sender address. They are **never** auto-classified: a match flips the record to
 * REVIEW_REPLY so a human reads it and records APPROVED or REFUSED by hand.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.from) {
    return NextResponse.json({ error: "Missing field: from" }, { status: 400 });
  }
  if (typeof body.body !== "string" || body.body.trim().length === 0) {
    return NextResponse.json({ error: "Missing field: body" }, { status: 400 });
  }

  const references = parseReferences(body.references, body.inReplyTo);
  const receivedAt = body.receivedAt ? new Date(body.receivedAt) : null;

  const result = await recordReply({
    from: String(body.from),
    subject: body.subject ? String(body.subject) : null,
    body: String(body.body),
    messageId: body.messageId ? normaliseMessageId(String(body.messageId)) : null,
    references,
    receivedAt: receivedAt && !Number.isNaN(receivedAt.getTime()) ? receivedAt : null,
  });

  if (!result.matched) {
    // 200, not 4xx: an unmatched message is an ordinary outcome (the mailbox
    // receives plenty of unrelated mail) and a non-2xx would make the n8n
    // execution look failed and trigger retries.
    return NextResponse.json({ ok: true, matched: false, reason: result.reason });
  }

  return NextResponse.json({
    ok: true,
    matched: true,
    permissionId: result.permission?._id,
    merchant: result.permission?.merchantName,
    status: result.permission?.status,
    ...(result.reason ? { note: result.reason } : {}),
  });
}

/**
 * Collect every Message-ID from the References / In-Reply-To headers.
 *
 * `References` arrives as one whitespace-separated string from most IMAP nodes,
 * but as an array from some — accept both.
 */
function parseReferences(references: unknown, inReplyTo: unknown): string[] {
  const out = new Set<string>();

  const add = (value: string) => {
    for (const match of value.matchAll(/<[^<>\s]+>/g)) {
      out.add(match[0]);
    }
    // Bare IDs with no angle brackets still need to match what we stored.
    if (!value.includes("<") && value.trim()) out.add(`<${value.trim()}>`);
  };

  if (Array.isArray(references)) references.forEach((r) => add(String(r)));
  else if (typeof references === "string") add(references);

  if (typeof inReplyTo === "string") add(inReplyTo);

  return Array.from(out);
}

/** Message-IDs are stored with angle brackets; normalise what n8n hands us. */
function normaliseMessageId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) return trimmed;
  return `<${trimmed.replace(/^<|>$/g, "")}>`;
}
