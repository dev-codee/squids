"use client";

import { useCurrency } from "@/i18n/CurrencyProvider";
import { useDictionary } from "@/i18n/DictionaryProvider";

export interface RetailerOffer {
  productId: number;
  retailerName: string;
  itemPrice: number | null;
  inStock: boolean;
  trackingUrl: string | null;
  /**
   * How this row was identified as the same product.
   *  - "source" — the record this page is for, so identity is certain.
   *  - "title"  — matched on normalised title only, with no verified identifier.
   */
  matchBasis: "source" | "title";
}

/**
 * Retailer comparison table.
 *
 * The product feed carries no delivery cost or other mandatory charges, so no
 * delivered total is known for any retailer. Every row therefore shows
 * "Total unknown" and offers "Check total at store"; the ordering is by item
 * price only and says so. We never present an item price as a delivered total.
 *
 * Identity is equally unproven: the feed has no GTIN, brand or model, so rows
 * other than this page's own listing are title matches and are labelled as such.
 * Nothing here claims to be a verified exact-variant comparison.
 */
export default function OfferTable({ offers }: { offers: RetailerOffer[] }) {
  const dict = useDictionary();
  const t = dict.productV2;
  const { format } = useCurrency();

  // Rank by item price; rows with no price sit at the end.
  const ranked = [...offers].sort((a, b) => {
    const left = a.itemPrice ?? Number.POSITIVE_INFINITY;
    const right = b.itemPrice ?? Number.POSITIVE_INFINITY;
    return left - right;
  });

  const cheapest = ranked.find((o) => typeof o.itemPrice === "number");

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
              <th scope="col" className="px-4 py-2.5 font-semibold text-ink-soft">{t.colTotal}</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-ink-soft">{t.colShop}</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((offer) => {
              const isCheapest = cheapest?.productId === offer.productId;
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
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          offer.matchBasis === "source"
                            ? "bg-canvas-sunk text-ink-soft"
                            : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        {offer.matchBasis === "source" ? t.thisListing : t.matchBasisTitle}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {typeof offer.itemPrice === "number" ? format(offer.itemPrice) : t.unknown}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{t.unknown}</td>
                  <td className="px-4 py-3 text-ink-muted">{t.unknown}</td>
                  <td className="px-4 py-3 font-semibold text-ink-muted">{t.totalUnknown}</td>
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
        {ranked.map((offer) => {
          const isCheapest = cheapest?.productId === offer.productId;
          return (
            <article
              key={offer.productId}
              className={`rounded-card border bg-white p-4 ${isCheapest ? "border-emerald-300" : "border-line"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{offer.retailerName}</span>
                  <span
                    className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      offer.matchBasis === "source"
                        ? "bg-canvas-sunk text-ink-soft"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {offer.matchBasis === "source" ? t.thisListing : t.matchBasisTitle}
                  </span>
                </span>
                <span className="flex-shrink-0 text-xs text-ink-muted">
                  {offer.inStock ? t.inStock : t.stockUnknown}
                </span>
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-soft">{t.colItemPrice}</dt>
                  <dd className="font-medium text-ink">
                    {typeof offer.itemPrice === "number" ? format(offer.itemPrice) : t.unknown}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-soft">{t.colDiscount}</dt>
                  <dd className="text-ink-muted">{t.unknown}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-soft">{t.colDelivery}</dt>
                  <dd className="text-ink-muted">{t.unknown}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-line pt-1.5">
                  <dt className="font-medium text-ink-soft">{t.colTotal}</dt>
                  <dd className="font-semibold text-ink-muted">{t.totalUnknown}</dd>
                </div>
              </dl>
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
        {offers.some((o) => o.matchBasis === "title") && (
          <p className="rounded-card border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs leading-relaxed text-amber-900">
            <span aria-hidden className="mr-1.5">⚠</span>
            {t.matchCaution}
          </p>
        )}
        {cheapest && (
          <p className="rounded-card border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900">
            {t.lowestItemPrice}
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
