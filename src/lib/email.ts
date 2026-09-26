/**
 * Outbound email — SMTP via nodemailer.
 *
 * Used for follow-store alert confirmations and digests (see
 * `src/lib/db/subscribers.ts` and `src/app/api/subscriptions/*`).
 *
 * Requires SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM in the
 * environment. When they're not set, `sendMail` logs and no-ops instead of
 * throwing, so the rest of the site keeps working without email configured.
 */

import nodemailer, { type Transporter } from "nodemailer";

let cachedTransporter: Transporter | null | undefined;

function isConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
}

function getTransporter(): Transporter | null {
  if (cachedTransporter !== undefined) return cachedTransporter;

  if (!isConfigured()) {
    console.warn(
      "[email] SMTP_HOST/SMTP_USER/SMTP_PASS not set — emails will be logged, not sent.",
    );
    cachedTransporter = null;
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return cachedTransporter;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email. Best-effort — returns false (and logs) instead of throwing,
 * so a bad send never breaks the subscribe/unsubscribe request that triggered
 * it or a batch digest run.
 */
export async function sendMail({ to, subject, html, text }: SendMailOptions): Promise<boolean> {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || "Foxzil Alerts <alerts@foxzil.com>";

  if (!transporter) {
    console.log(`[email] (not sent — SMTP unconfigured) to=${to} subject="${subject}"`);
    return false;
  }

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    });
    return true;
  } catch (error) {
    console.error(`[email] Failed to send to ${to}:`, error);
    return false;
  }
}

/** Shared footer with an unsubscribe link, appended to every alert email. */
function emailShell(bodyHtml: string, unsubscribeUrl: string, manageUrl: string): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      ${bodyHtml}
      <hr style="margin: 32px 0 16px; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="font-size: 12px; color: #9ca3af; line-height: 1.6;">
        You're receiving this because you asked to be notified about new offers from a store you follow.
        <a href="${manageUrl}" style="color: #9ca3af;">Manage your alerts</a> ·
        <a href="${unsubscribeUrl}" style="color: #9ca3af;">Unsubscribe</a>
      </p>
    </div>
  `;
}

export function confirmSubscriptionEmail(opts: {
  confirmUrl: string;
  unsubscribeUrl: string;
  manageUrl: string;
  storeNames: string[];
}): { subject: string; html: string } {
  const { confirmUrl, unsubscribeUrl, manageUrl, storeNames } = opts;
  const storeList = storeNames.join(", ");
  return {
    subject: "Confirm your store alerts",
    html: emailShell(
      `
        <h1 style="font-size: 18px; margin: 0 0 12px;">Confirm your alert${storeNames.length > 1 ? "s" : ""}</h1>
        <p style="font-size: 14px; line-height: 1.6;">
          You asked to be notified about new offers from <strong>${storeList}</strong>.
          Click below to confirm — you won't receive any alerts until you do.
        </p>
        <p style="margin: 24px 0;">
          <a href="${confirmUrl}" style="background: #f59e0b; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Confirm my alerts
          </a>
        </p>
        <p style="font-size: 12px; color: #9ca3af;">If you didn't request this, you can ignore this email.</p>
      `,
      unsubscribeUrl,
      manageUrl,
    ),
  };
}

export function newOffersDigestEmail(opts: {
  unsubscribeUrl: string;
  manageUrl: string;
  offers: { storeName: string; title: string; discountText?: string | null; url: string }[];
}): { subject: string; html: string } {
  const { unsubscribeUrl, manageUrl, offers } = opts;
  const storeCount = new Set(offers.map((o) => o.storeName)).size;
  const subject =
    offers.length === 1
      ? `New offer from ${offers[0].storeName}`
      : `${offers.length} new offers from ${storeCount} store${storeCount > 1 ? "s" : ""} you follow`;

  const rows = offers
    .map(
      (o) => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
            <div style="font-size: 12px; font-weight: 700; color: #f59e0b; text-transform: uppercase;">${o.storeName}</div>
            <a href="${o.url}" style="font-size: 14px; font-weight: 600; color: #1f2937; text-decoration: none;">${o.title}</a>
            ${o.discountText ? `<div style="font-size: 13px; color: #059669; margin-top: 2px;">${o.discountText}</div>` : ""}
          </td>
        </tr>
      `,
    )
    .join("");

  return {
    subject,
    html: emailShell(
      `
        <h1 style="font-size: 18px; margin: 0 0 12px;">New offers from stores you follow</h1>
        <table style="width: 100%; border-collapse: collapse;">${rows}</table>
      `,
      unsubscribeUrl,
      manageUrl,
    ),
  };
}

// ---------------------------------------------------------------------------
// Threaded send (PPC permission outreach)
// ---------------------------------------------------------------------------

/**
 * Build an RFC 5322 Message-ID we control.
 *
 * We generate it rather than reading it back from the SMTP response so the
 * value is known *before* the send and can be persisted atomically with the
 * status transition. The domain comes from SMTP_FROM so the ID matches the
 * sending domain and survives Gmail's own rewriting.
 */
export function buildMessageId(prefix: string): string {
  const from = process.env.SMTP_FROM || "alerts@foxzil.com";
  const domain = (from.match(/@([^>\s]+)/)?.[1] || "foxzil.com").replace(/[>\s]/g, "");
  const unique = `${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 10)}`;
  return `<${prefix}.${unique}@${domain}>`;
}

export interface SendThreadedMailOptions extends SendMailOptions {
  /** Pre-built Message-ID for this message (see {@link buildMessageId}). */
  messageId: string;
  /** Message-ID this is a direct reply/follow-up to. Keeps Gmail threading. */
  inReplyTo?: string | null;
  /** Full ancestor chain, oldest first. */
  references?: string[];
  /** Reply-To override, when replies should land somewhere other than SMTP_FROM. */
  replyTo?: string | null;
}

/**
 * Send a message that participates in a mail thread.
 *
 * Unlike {@link sendMail} this *throws* on failure. The PPC outreach jobs claim
 * a row before sending, so the caller needs the error in order to record it on
 * the record rather than silently treating a failed send as delivered.
 */
export async function sendThreadedMail(opts: SendThreadedMailOptions): Promise<{ messageId: string; delivered: boolean }> {
  const { to, subject, html, text, messageId, inReplyTo, references, replyTo } = opts;
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || "Foxzil <alerts@foxzil.com>";

  if (!transporter) {
    // Unconfigured SMTP is a configuration error for outreach, not a soft
    // no-op: pretending we emailed a merchant would corrupt the audit trail.
    throw new Error("SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS).");
  }

  await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    messageId,
    ...(inReplyTo ? { inReplyTo } : {}),
    ...(references && references.length > 0 ? { references } : {}),
    ...(replyTo ? { replyTo } : {}),
  });

  return { messageId, delivered: true };
}
