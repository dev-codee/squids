"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Deal } from "@/lib/deals";
import { dealDisplayTitle, dealDisplayDescription } from "@/lib/deals";
import { localeForCountry } from "@/lib/ai/languageNames";
import { useDictionary } from "@/i18n/DictionaryProvider";
import HomeSection from "./HomeSection";

function storeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type Filter = "all" | "codes" | "deals" | "delivery";

/**
 * Words that mark a free-delivery style offer, across the languages we ship
 * dictionaries for. Matched against the shopper-facing title + description.
 */
const DELIVERY_WORDS =
  /(deliver|shipping|postage|versand|lieferung|livraison|envío|envio|spedizion|consegna)/i;

/**
 * "Store deals" — the recent offers shelf with the All / Codes / Deals /
 * Delivery filter chips and the affiliate disclosure required next to them.
 */
export default function HomeStoreDeals({
  deals,
  country,
}: {
  deals: Deal[];
  country: string;
}) {
  const dict = useDictionary();
  const t = dict.homeV2;
  const locale = localeForCountry(country);
  const lc = country.toLowerCase();
  const [filter, setFilter] = useState<Filter>("all");

  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: t.filterAll },
    { key: "codes", label: t.filterCodes },
    { key: "deals", label: t.filterDeals },
    { key: "delivery", label: t.filterDelivery },
  ];

  const visible = useMemo(() => {
    return deals.filter((deal) => {
      if (filter === "all") return true;
      if (filter === "codes") return Boolean(deal.code);
      if (filter === "deals") return !deal.code;
      const text = `${dealDisplayTitle(deal, locale)} ${dealDisplayDescription(deal, locale)}`;
      return DELIVERY_WORDS.test(text);
    });
  }, [deals, filter, locale]);

  if (!deals.length) return null;

  return (
    <HomeSection title={t.storeDealsTitle} tone="white">
      {/* Filter chips + affiliate disclosure */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label={t.storeDealsTitle} className="flex flex-wrap gap-2">
          {chips.map((chip) => {
            const active = filter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(chip.key)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-white text-ink-soft hover:border-line-strong hover:text-ink"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-ink-muted">{t.commissionNote}</p>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong bg-canvas p-10 text-center text-sm text-ink-muted">
          {t.noDealsForFilter}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.slice(0, 6).map((deal) => {
            const slug = storeSlug(deal.advertiser.name);
            const hasCode = Boolean(deal.code);
            const discount = deal.discountText?.trim();
            return (
              <article
                key={`${deal.network}-${deal.id}`}
                className="flex overflow-hidden rounded-card border border-line bg-white shadow-card transition hover:shadow-card-hover"
              >
                {/* Store logo panel */}
                <div className="flex w-28 flex-shrink-0 items-center justify-center border-r border-line bg-canvas-sunk p-3 sm:w-32">
                  {deal.advertiser.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={deal.advertiser.logoUrl}
                      alt={`${deal.advertiser.name} logo`}
                      className="max-h-14 max-w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-xl font-bold text-ink-muted">
                      {deal.advertiser.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col p-4">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ink">
                      {deal.advertiser.name}
                    </span>
                    {discount && (
                      <span className="flex-shrink-0 rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand">
                        {discount}
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 line-clamp-2 text-[15px] font-medium leading-snug text-ink">
                    {dealDisplayTitle(deal, locale)}
                  </p>

                  <div className="mt-auto pt-3">
                  <Link
                    href={`/${lc}/${slug}`}
                    className={`inline-block rounded-[9px] px-4 py-2 text-center text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 ${
                      hasCode
                        ? "bg-brand text-white hover:bg-brand-hover"
                        : "border border-brand text-brand hover:bg-brand-soft"
                    }`}
                  >
                    {hasCode ? dict.cards.showCode : dict.cards.getDeal}
                  </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </HomeSection>
  );
}
