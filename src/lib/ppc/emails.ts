/**
 * PPC permission outreach email templates.
 *
 * Two messages only, ever, per merchant: an initial request and one follow-up
 * in the same thread. Both are plain, specific, and state in writing that the
 * campaign stays inactive without a written reply — the reply itself is the
 * evidence we store on the permission record.
 *
 * Styling deliberately stays close to `lib/email.ts`'s alert shell, but without
 * the unsubscribe footer: this is one-to-one business correspondence with a
 * programme contact, not a marketing list.
 */

import type { PpcPermission } from "@/lib/ppc";
import { countryName } from "@/lib/countries";

/** Wrapper shared by both messages. */
function shell(bodyHtml: string, signature: string): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937; font-size: 14px; line-height: 1.65;">
      ${bodyHtml}
      <p style="margin: 24px 0 0; white-space: pre-line;">${signature}</p>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Sign-off block, built from env so it is configured in one place. */
function signature(): string {
  const name = process.env.PPC_SENDER_NAME || "Foxzil Partnerships";
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.foxzil.com";
  const host = site.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `${escapeHtml(name)}\n${escapeHtml(host)}`;
}

/** Market label used in the subject line — full country name when we know it. */
function marketLabel(permission: Pick<PpcPermission, "country">): string {
  if (!permission.country) return "all markets";
  return countryName(permission.country) || permission.country.toUpperCase();
}

/**
 * Subject of the initial request. The follow-up reuses this value verbatim
 * (persisted as `threadSubject`) so mail clients keep both in one thread.
 */
export function ppcRequestSubject(permission: Pick<PpcPermission, "merchantName" | "country">): string {
  return `Foxzil PPC permission request — ${permission.merchantName} — ${marketLabel(permission)}`;
}

/**
 * Initial permission request.
 *
 * Asks the four things we must have on record before a campaign can run:
 * brand + coupon keyword permission, brand name in ad copy, any prohibited
 * keywords / geo / direct-linking rules, and whether promoted coupons are
 * commissionable.
 */
export function ppcRequestEmail(permission: PpcPermission): { subject: string; html: string; text: string } {
  const greeting = permission.contactName
    ? `Hi ${escapeHtml(permission.contactName.split(/\s+/)[0])},`
    : "Hello,";

  const publisherLine = permission.publisherId
    ? `<li><strong>Our publisher ID:</strong> ${escapeHtml(permission.publisherId)} (${escapeHtml(permission.network)})</li>`
    : "";

  const keywordsLine = permission.keywordsScope
    ? `<li><strong>Keywords we'd like to bid on:</strong> ${escapeHtml(permission.keywordsScope)}</li>`
    : `<li><strong>Keywords we'd like to bid on:</strong> your brand name and brand + "coupon" / "voucher code" variants</li>`;

  const html = shell(
    `
      <p style="margin: 0 0 16px;">${greeting}</p>

      <p style="margin: 0 0 16px;">
        I run <strong>Foxzil</strong>, a coupon and deals site. We're an affiliate partner of
        <strong>${escapeHtml(permission.merchantName)}</strong> and we'd like to ask permission before
        running any paid search for your brand in <strong>${escapeHtml(marketLabel(permission))}</strong>.
      </p>

      <p style="margin: 0 0 8px;">Details of what we're proposing:</p>
      <ul style="margin: 0 0 16px; padding-left: 20px;">
        <li><strong>Market:</strong> ${escapeHtml(marketLabel(permission))}</li>
        ${keywordsLine}
        <li><strong>Landing page:</strong> <a href="${escapeHtml(permission.landingPage || "")}" style="color: #4f46e5;">${escapeHtml(permission.landingPage || "")}</a></li>
        ${publisherLine}
      </ul>

      <p style="margin: 0 0 8px;">Could you confirm, in writing, four things:</p>
      <ol style="margin: 0 0 16px; padding-left: 20px;">
        <li style="margin-bottom: 6px;">
          Are we permitted to bid on your <strong>brand keywords and brand + coupon/voucher keywords</strong>
          in this market?
        </li>
        <li style="margin-bottom: 6px;">
          May we use your <strong>brand name in the ad copy</strong> (headline / description)?
        </li>
        <li style="margin-bottom: 6px;">
          Are there any <strong>prohibited keywords, geo restrictions, or direct-linking rules</strong>
          we need to follow? (For example: no direct linking, display URL requirements, negative-keyword lists.)
        </li>
        <li style="margin-bottom: 6px;">
          Are <strong>coupons promoted through paid search commissionable</strong> at the normal rate,
          or is there a different rate for PPC traffic?
        </li>
      </ol>

      <p style="margin: 0 0 16px;">
        To be clear: <strong>the campaign stays inactive until we have your written permission.</strong>
        If the answer to any of the above is no, or you'd rather we didn't run paid search at all,
        just say so and we'll leave it switched off — and we won't ask again.
      </p>

      <p style="margin: 0 0 16px;">A reply to this email is all we need. Thanks for your time.</p>
    `,
    signature(),
  );

  return {
    subject: ppcRequestSubject(permission),
    html,
    text: htmlToText(html),
  };
}

/**
 * The single follow-up, sent in the same thread once, two business days later.
 * Short by design: it restates the ask and the fact that we stay inactive.
 */
export function ppcFollowupEmail(permission: PpcPermission): { subject: string; html: string; text: string } {
  const greeting = permission.contactName
    ? `Hi ${escapeHtml(permission.contactName.split(/\s+/)[0])},`
    : "Hello,";

  const html = shell(
    `
      <p style="margin: 0 0 16px;">${greeting}</p>

      <p style="margin: 0 0 16px;">
        Just following up on my note below about running paid search for
        <strong>${escapeHtml(permission.merchantName)}</strong> in
        <strong>${escapeHtml(marketLabel(permission))}</strong> — brand and brand + coupon keywords,
        pointing at <a href="${escapeHtml(permission.landingPage || "")}" style="color: #4f46e5;">our ${escapeHtml(permission.merchantName)} page</a>.
      </p>

      <p style="margin: 0 0 16px;">
        Nothing is running and nothing will run without your written confirmation — a one-line
        yes or no is genuinely fine. This is the last time I'll email you about it either way.
      </p>
    `,
    signature(),
  );

  return {
    // Same subject as the original so clients keep one thread. The In-Reply-To
    // and References headers do the real work; this is belt and braces.
    subject: permission.threadSubject || ppcRequestSubject(permission),
    html,
    text: htmlToText(html),
  };
}

/** Rough HTML→text for the multipart alternative. */
function htmlToText(html: string): string {
  return html
    .replace(/<li[^>]*>/g, "\n  - ")
    .replace(/<\/p>|<\/li>|<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
