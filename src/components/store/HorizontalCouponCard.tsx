"use client";

import { useDialogFocus } from "@/components/common/useDialogFocus";
import { deliveryKind } from "@/lib/model/offerPresentation";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { CouponItem } from "@/lib/storeData";
import { useDictionary } from "@/i18n/DictionaryProvider";
import { trackCouponEvent, GtmCouponEventName } from "@/lib/gtm";
import CouponVotes from "@/components/store/CouponVotes";
import { getExpiryBadge, EXPIRY_BADGE_CLASSES } from "@/lib/expiry";

interface HorizontalCouponCardProps {
  coupon: CouponItem;
  storeName: string;
  market?: string;
  merchantId?: string;
  /** Merchant site, used for the "read current terms" links in the T&C panel. */
  merchantUrl?: string;
}

/**
 * Offer card: the benefit, the eligibility badge, the primary action, and a
 * collapsible terms panel covering minimum spend, exclusions, expiry and
 * verification. Fields we don't hold are labelled and pointed at the merchant's
 * own terms rather than guessed at.
 */
export default function HorizontalCouponCard({
  coupon,
  storeName,
  market,
  merchantId,
  merchantUrl,
}: HorizontalCouponCardProps) {
  const dict = useDictionary();
  const t = dict.storeV2;
  const ui = dict.offerUi;
  const params = useParams();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const dialogRef = useDialogFocus(showModal, () => setShowModal(false));
  const [revealed, setRevealed] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const routeCountry =
    (typeof params?.country === "string" ? params.country : "") || "AU";
  const routeStore = (typeof params?.store === "string" ? params.store : "") || "";

  const computedMarket = (market || routeCountry).toUpperCase();
  const computedMerchantId =
    merchantId || routeStore || storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // Tracked outbound URL routes through /api/outbound to associate gclid & assign network SubID
  const outboundUrl = `/api/outbound?dealId=${encodeURIComponent(coupon.id)}&slug=${encodeURIComponent(computedMerchantId)}&market=${encodeURIComponent(computedMarket)}`;

  const track = (eventName: GtmCouponEventName, buttonLocation: string) => {
    trackCouponEvent(eventName, {
      merchant_id: computedMerchantId,
      merchant_name: storeName,
      market: computedMarket,
      coupon_id: coupon.id,
      offer_type: coupon.type || (coupon.code ? "code" : "deal"),
      button_location: buttonLocation,
      coupon_code: coupon.code || undefined,
    });
  };

  const openMerchant = (buttonLocation = "coupon_card") => {
    track("affiliate_click", buttonLocation);
    window.open(outboundUrl, "_blank", "noopener,noreferrer");
  };

  const copyCode = (buttonLocation = "coupon_card") => {
    if (!coupon.code) return;
    Promise.resolve().then(() => navigator.clipboard.writeText(coupon.code!))
      .then(() => {
        setCopyFailed(false);
        setCopied(true);
        track("coupon_copy", buttonLocation);
        setTimeout(() => setCopied(false), 3000);
      })
      .catch(() => {
        // Clipboard access can be denied or unavailable. Say so and leave the
        // code on screen to select, rather than failing silently.
        setCopied(false);
        setCopyFailed(true);
      });
  };

  const expiryBadge = getExpiryBadge(coupon.expiryDate);

  const handleReveal = () => {
    track("show_coupon_click", "coupon_card");
    setRevealed(true);
    setShowModal(true);
    track("coupon_reveal", "reveal_modal");
    copyCode("coupon_card");
    openMerchant("coupon_card");
  };

  // Eligibility badge shown in the card's left rail.
  const shipping = deliveryKind(coupon.delivery, computedMarket);
  const isDelivery = !!coupon.delivery || /deliver|shipping|livraison|versand|spedizion|env[ií]o/i.test(`${coupon.title} ${coupon.discount}`);
  const badge = isDelivery ? (shipping === "free" ? ui.freeDelivery : shipping === "conditional" ? ui.conditionalDelivery : ui.delivery) : coupon.code
    ? coupon.type === "student"
      ? dict.cards.studentPerk
      : coupon.type === "cashback"
        ? dict.cards.cashbackOffer
        : dict.common.code
    : dict.common.deal;

  const expiryText = coupon.expiryDate
    ? new Date(coupon.expiryDate).toLocaleDateString(computedMarket === "FR" ? "fr-FR" : "en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : t.expiryUnknown;

  const c = coupon.conditions;
  const termsRows: { label: string; value: string; href?: string }[] = [
    { label: t.minimumSpend, value: c?.minSpend?.known ? `${c.minSpend.value}${coupon.currency ? ` ${coupon.currency}` : ""}` : ui.unknown },
    { label: t.customerEligibility, value: c?.customerType === "new" ? ui.newCustomer : c?.customerType === "existing" ? ui.existingCustomer : c?.customerType === "any" ? ui.anyCustomer : ui.unknown },
    { label: t.exclusions, value: c?.exclusions?.length ? c.exclusions.join("; ") : ui.unknown },
    { label: t.expiry, value: expiryText },
    { label: t.verification, value: coupon.evidenceStatus === "checkout-tested" ? `${ui.checkoutTested} · ${new Date(coupon.checkedAt!).toLocaleDateString(computedMarket === "FR" ? "fr-FR" : "en-GB")}` : coupon.evidenceStatus === "community-reported" ? ui.communityReported : ui.merchantListed },
    ...(coupon.sourceUrl ? [{ label: ui.source, value: ui.sourceTerms, href: coupon.sourceUrl }] : []),
  ];

  return (
    <>
      <article className="overflow-hidden rounded-card border border-line bg-white shadow-card transition hover:shadow-card-hover">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-5 sm:p-5">
          {/* Eligibility rail: one tile carrying both the offer kind and the
              discount value, so the number a shopper scans for sits inside the
              badge rather than floating beside it. */}
          <div className="flex flex-shrink-0 sm:w-28">
            <div className="flex w-full min-w-[84px] flex-col items-center justify-center gap-1 rounded-card border border-brand-border bg-brand-soft/60 px-3 py-2.5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                {badge}
              </span>
              {coupon.discount && !isDelivery && (
                <span className="text-xl font-extrabold leading-none text-brand">
                  {coupon.discount}
                </span>
              )}
            </div>
          </div>

          {/* Benefit */}
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-bold leading-snug text-ink">
              {coupon.title}
            </h3>
            {coupon.description && (
              <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
                {coupon.description}
              </p>
            )}
            {!coupon.code && (
              <p className="mt-1 text-sm text-ink-muted">{t.noCodeNeeded}</p>
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {coupon.evidenceStatus === "checkout-tested" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                  ✓ {ui.checkoutTested}
                </span>
              ) : coupon.evidenceStatus === "merchant-listed" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                  {ui.merchantListed}
                </span>
              ) : coupon.evidenceStatus === "community-reported" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  {ui.communityReported}
                </span>
              ) : coupon.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  ✓ {dict.cards.verified}
                </span>
              ) : null}
              {coupon.isExclusive && (
                <span className="inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">
                  {dict.cards.exclusive}
                </span>
              )}
              {expiryBadge && (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${EXPIRY_BADGE_CLASSES[expiryBadge.tone]}`}
                >
                  {computedMarket === "FR" ? "Expiration proche" : expiryBadge.label}
                </span>
              )}
            </div>
          </div>

          {/* Primary action */}
          <div className="flex flex-shrink-0 flex-col items-stretch gap-2 sm:w-44">
            {coupon.code ? (
              <button
                onClick={handleReveal}
                className="rounded-[9px] bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
              >
                {copied ? dict.cards.copied : revealed ? coupon.code : dict.cards.showCode}
              </button>
            ) : (
              <a
                href={outboundUrl}
                target="_blank"
                rel="nofollow noopener noreferrer sponsored"
                onClick={() => track("affiliate_click", "coupon_card")}
                className="rounded-[9px] border border-brand px-4 py-2.5 text-center text-sm font-semibold text-brand transition-colors hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
              >
                {dict.cards.getDeal}
              </a>
            )}
            <CouponVotes
              couponId={coupon.id}
              storeSlug={storeName}
              label={dict.cards.didThisWork}
            />
          </div>
        </div>

        {/* Terms and conditions */}
        <div className="border-t border-line">
          <button
            type="button"
            onClick={() => setTermsOpen((v) => !v)}
            aria-expanded={termsOpen}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-ink-soft transition-colors hover:text-ink sm:px-5"
          >
            {t.termsTitle}
            <span aria-hidden className={`transition-transform ${termsOpen ? "rotate-180" : ""}`}>
              ⌄
            </span>
          </button>

          {termsOpen && (
            <div className="animate-fade-in border-t border-line bg-canvas-sunk px-4 py-3 sm:px-5">
              {coupon.terms && <p className="mb-3 text-sm text-ink">{coupon.terms}</p>}
              {coupon.delivery && <p className="mb-3 text-sm text-ink">{ui.delivery}: {coupon.delivery.charge?.known ? `${coupon.delivery.charge.value} ${coupon.delivery.currency}` : ui.unknown}{coupon.delivery.freeThreshold?.known ? ` · ${t.minimumSpend}: ${coupon.delivery.freeThreshold.value} ${coupon.delivery.currency}` : ""} · {coupon.delivery.zone.market} {coupon.delivery.restrictions?.join("; ")}</p>}
              <dl className="text-sm">
                {termsRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex flex-wrap justify-between gap-2 border-b border-line py-2 last:border-0"
                  >
                    <dt className="font-medium text-ink-soft">{row.label}</dt>
                    <dd className="text-right text-ink">
                      {row.href ? (
                        <a
                          href={row.href}
                          target="_blank"
                          rel="nofollow noopener noreferrer sponsored"
                          className="text-brand underline-offset-2 hover:underline"
                        >
                          {row.value}
                        </a>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-2 flex justify-end border-t border-line/60 pt-2">
                <Link
                  href={`/${computedMarket.toLowerCase()}/report-issue?type=expired_deal&deal=${encodeURIComponent(coupon.id)}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted transition-colors hover:text-brand hover:underline"
                  title={ui.report}
                >
                  <span>⚑</span> {ui.report}
                </Link>
              </div>
            </div>
          )}
        </div>
      </article>

      {/* Code reveal modal */}
      {showModal && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={dict.cards.copyCode} tabIndex={-1} className="max-h-[90dvh] overflow-y-auto w-full max-w-md rounded-card bg-white p-6 text-center shadow-card-hover">
            {/* The heading must not claim a copy that did not happen. */}
            <h3 className="text-xl font-bold text-ink">
              {copied ? dict.cards.promoCodeCopied : dict.cards.copyCode}
            </h3>
            <p className="mt-1 text-sm text-ink-soft">{coupon.title}</p>

            <button
              type="button"
              onClick={() => copyCode("reveal_modal")}
              className="my-5 w-full rounded-card border-2 border-dashed border-brand-border bg-brand-soft p-4 transition hover:bg-white"
              title={dict.cards.copyCode}
            >
              <span className="font-mono text-2xl font-extrabold tracking-widest text-ink">
                {coupon.code}
              </span>
              <span className="mt-1 block font-sans text-xs text-brand">
                {copied ? dict.cards.copied : dict.cards.copyCode}
              </span>
            </button>

            {copyFailed && (
              <p role="alert" className="-mt-3 mb-4 text-xs font-medium text-red-700">
                {dict.cards.copyFailed}
              </p>
            )}

            <p className="mb-6 text-xs text-ink-muted">
              {dict.cards.pasteCode.replace("{store}", storeName)}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-[9px] border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-canvas"
              >
                {dict.cards.close}
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  openMerchant("reveal_modal");
                }}
                className="flex-1 rounded-[9px] bg-brand px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-brand-hover"
              >
                {dict.cards.goTo.replace("{store}", storeName)}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
