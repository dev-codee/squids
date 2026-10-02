"use client";

import { useCurrency } from "@/i18n/CurrencyProvider";
import { useDictionary } from "@/i18n/DictionaryProvider";
import type { Known } from "@/lib/model/known";
import type { DeliveredTotalBreakdown } from "@/lib/model/deliveredTotal";
import { rankByDeliveredTotal, type RankedRow } from "@/lib/model/deliveredTotal";

export interface RetailerOffer {
  productId: number;
  retailerName: string;
  inStock: boolean;
  trackingUrl: string | null;
  /**
   * How this row was identified as the same product.
   *  - "source"     — the record this page is for, so identity is certain.
   *  - "identifier" — a shared GTIN/MPN with no contradicting variant field.
   *  - "manual"     — a named reviewer signed the match off.
   *  - "title"      — matched on normalised title only. Never an exact claim.
   */
  matchBasis: "source" | "identifier" | "manual" | "title";
  /** The full cost breakdown. Every money field may legitimately be unknown. */
  breakdown: DeliveredTotalBreakdown;
  currency: string;
}

/**
 * Retailer comparison table.
 *
 * Rows are ranked by **known delivered total**, which is the only ordering the
 * brief permits a comparison to claim. A row whose total cannot be completed —
 * because delivery, a mandatory fee or the tax basis is not on record — is not
 * sorted into that list at all. It appears below it, labelled, so it is neither
 * hidden nor presented as the expensive end of a complete comparison.
 *
 * Conditional offers are shown as conditions, never as a lower price: a coupon
 * we cannot confirm the shopper qualifies for does not move the total.
 */
export default function OfferTable({
  offers,
  canClaimComparison = false,
}: {
  offers: RetailerOffer[];
  /** Two independent retailers matched on identifiers. Gates the claim line. */
  canClaimComparison?: boolean;
}) {
  const dict = useDictionary();
  const t = dict.productV2;
  const { region } = useCurrency();

  // Amounts are already in the merchant-market's own currency, so they are
  // formatted as-is. Converting them again would restate a real price.
  const money = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(region.locale, { style: "currency", currency }).format(
        amount,
      );
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  const show = (value: Known<number>, currency: string, zeroLabel?: string) => {
    if (!value.known) return t.unknown;
    if (value.value === 0 && zeroLabel) return zeroLabel;
    return money(value.value, currency);
  };

  const rows: RankedRow<RetailerOffer>[] = offers.map((offer) => ({
    row: offer,
    breakdown: offer.breakdown,
  }));
  const ranking = rankByDeliveredTotal(rows, (offer) => String(offer.productId));

  const cheapestId = ranking.ranked[0]?.row.productId;
  const ordered = [...ranking.ranked, ...ranking.withoutKnownTotal];
  const anyTitleMatch = offers.some((o) => o.matchBasis === "title");

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-card border border-line bg-white md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas-sunk text-left">
              <th scope="col" className="px-4 py-2.5 font-semibold text-ink-soft">{t.colRetailer}</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-ink-soft">{t.colItemPrice}</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-ink-soft">{t.colDiscount}</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-ink-soft">{t.colDelivery}</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-ink-soft">{t.colOtherCharges}</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-ink-soft">{t.colTotal}</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-ink-soft">{t.colShop}</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map(({ row: offer, breakdown }) => {
              const isCheapest = cheapestId === offer.productId;
              return (
                <tr
                  key={offer.productId}
                  className={`border-b border-line last:border-0 ${isCheapest ? "bg-emerald-50/50" : ""}`}
                >
                  <td className="px-4 py-3 font-semibold text-ink">
                    {offer.retailerName}
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-normal text-ink-muted">
                        {offer.inStock ? t.inStock : t.stockUnknown}
                      </span>
                      <MatchChip basis={offer.matchBasis} t={t} />
                    </span>
                    <span className="mt-1 block text-[11px] font-normal text-ink-muted">
                      {t.lastChecked}:{" "}
                      {breakdown.checkedAt
                        ? new Date(breakdown.checkedAt).toLocaleDateString(region.locale)
                        : t.neverChecked}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {show(breakdown.itemPrice, offer.currency)}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {show(breakdown.eligibleDiscount, offer.currency, t.none)}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {show(breakdown.delivery, offer.currency, t.freeDelivery)}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {show(breakdown.otherMandatoryCharges, offer.currency, t.none)}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {breakdown.total.known ? (
                      <span className="text-ink">
                        {money(breakdown.total.value, offer.currency)}
                        {breakdown.estimated && (
                          <span className="ml-1 text-[11px] font-normal text-ink-muted">
                            {t.estimated}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-ink-muted">{t.totalUnknown}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {offer.trackingUrl ? (
                      <a
                        href={offer.trackingUrl}
                        target="_blank"
                        rel="nofollow noopener noreferrer sponsored"
                        className="inline-block rounded-[9px] border border-brand px-4 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand-soft"
                      >
                        {t.checkRetailer}
                      </a>
                    ) : (
                      <span className="text-xs text-ink-muted">{t.unknown}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards keeping every cost component */}
      <div className="space-y-3 md:hidden">
        {ordered.map(({ row: offer, breakdown }) => {
          const isCheapest = cheapestId === offer.productId;
          return (
            <article
              key={offer.productId}
              className={`rounded-card border bg-white p-4 ${isCheapest ? "border-emerald-300" : "border-line"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{offer.retailerName}</span>
                  <MatchChip basis={offer.matchBasis} t={t} className="mt-1 inline-block" />
                </span>
                <span className="flex-shrink-0 text-xs text-ink-muted">
                  {offer.inStock ? t.inStock : t.stockUnknown}
                </span>
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <Line label={t.colItemPrice} value={show(breakdown.itemPrice, offer.currency)} />
                <Line
                  label={t.colDiscount}
                  value={show(breakdown.eligibleDiscount, offer.currency, t.none)}
                />
                <Line
                  label={t.colDelivery}
                  value={show(breakdown.delivery, offer.currency, t.freeDelivery)}
                />
                <Line
                  label={t.colOtherCharges}
                  value={show(breakdown.otherMandatoryCharges, offer.currency, t.none)}
                />
                <div className="flex justify-between gap-3 border-t border-line pt-1.5">
                  <dt className="font-medium text-ink-soft">{t.colTotal}</dt>
                  <dd className={`font-semibold ${breakdown.total.known ? "text-ink" : "text-ink-muted"}`}>
                    {breakdown.total.known
                      ? money(breakdown.total.value, offer.currency)
                      : t.totalUnknown}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] text-ink-muted">
                {t.lastChecked}:{" "}
                {breakdown.checkedAt
                  ? new Date(breakdown.checkedAt).toLocaleDateString(region.locale)
                  : t.neverChecked}
              </p>
              {breakdown.conditionalPromotions.length > 0 && (
                <Conditions breakdown={breakdown} t={t} />
              )}
              {offer.trackingUrl && (
                <a
                  href={offer.trackingUrl}
                  target="_blank"
                  rel="nofollow noopener noreferrer sponsored"
                  className="mt-3 block rounded-[9px] border border-brand px-4 py-2 text-center text-sm font-semibold text-brand transition-colors hover:bg-brand-soft"
                >
                  {t.checkRetailer}
                </a>
              )}
            </article>
          );
        })}
      </div>

      {/* Ranking explanation — what the ordering does and does not claim. */}
      <div className="mt-3 space-y-2">
        {anyTitleMatch && (
          <p className="rounded-card border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs leading-relaxed text-amber-900">
            <span aria-hidden className="mr-1.5">⚠</span>
            {t.matchCaution}
          </p>
        )}
        {ranking.knownCount > 0 && canClaimComparison && ranking.canClaimLowest ? (
          <p className="rounded-card border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900">
            {t.lowestDeliveredTotal.replace("{known}", String(ranking.knownCount))}
          </p>
        ) : (
          <p className="rounded-card border border-line bg-canvas px-4 py-2.5 text-xs text-ink-soft">
            {t.noClaimYet}
          </p>
        )}
        {ranking.withoutKnownTotal.length > 0 && (
          <p className="rounded-card border border-line bg-canvas px-4 py-2.5 text-xs text-ink-soft">
            {t.excludedFromRanking}
          </p>
        )}
        <p className="rounded-card border border-line bg-canvas px-4 py-2.5 text-xs leading-relaxed text-ink-soft">
          <span aria-hidden className="mr-1.5 text-brand">ⓘ</span>
          {t.rankingNote}
        </p>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function Conditions({
  breakdown,
  t,
}: {
  breakdown: DeliveredTotalBreakdown;
  t: Record<string, string>;
}) {
  const conditions = Array.from(
    new Set(breakdown.conditionalPromotions.flatMap((p) => p.conditions)),
  );
  if (conditions.length === 0) return null;
  return (
    <div className="mt-2 rounded-[9px] border border-amber-200 bg-amber-50 px-3 py-2">
      <p className="text-[11px] font-semibold text-amber-900">{t.conditionalOffer}</p>
      <ul className="mt-1 space-y-0.5 text-[11px] text-amber-900">
        {conditions.map((condition) => (
          <li key={condition}>· {condition}</li>
        ))}
      </ul>
    </div>
  );
}

function MatchChip({
  basis,
  t,
  className = "",
}: {
  basis: RetailerOffer["matchBasis"];
  t: Record<string, string>;
  className?: string;
}) {
  const label =
    basis === "source"
      ? t.thisListing
      : basis === "identifier"
        ? t.matchBasisIdentifier
        : basis === "manual"
          ? t.matchBasisManual
          : t.matchBasisTitle;
  const tone =
    basis === "title" ? "bg-amber-50 text-amber-800" : "bg-canvas-sunk text-ink-soft";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${tone} ${className}`}>
      {label}
    </span>
  );
}
