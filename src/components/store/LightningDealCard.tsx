"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { DealItem } from "@/lib/storeData";
import { useDictionary } from "@/i18n/DictionaryProvider";
import { useCurrency } from "@/i18n/CurrencyProvider";
import ProductImage from "@/components/product/ProductImage";
import ProductIcon from "@/components/product/ProductIcon";

export default function LightningDealCard({ deal }: { deal: DealItem }) {
  const params = useParams();
  const dict = useDictionary();
  const { region } = useCurrency();
  const [timeLeft, setTimeLeft] = useState(deal.endsInSeconds ?? 0);

  useEffect(() => {
    setTimeLeft(deal.endsInSeconds ?? 0);
    if (!deal.endsInSeconds || deal.type !== "lightning") return;
    const deadline = Date.now() + deal.endsInSeconds * 1000;
    const interval = setInterval(() => setTimeLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 1000);
    return () => clearInterval(interval);
  }, [deal.id, deal.endsInSeconds, deal.type]);

  const formatTime = (seconds: number) => [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map(n => String(n).padStart(2, "0")).join(":");
  const date = (value: string) => new Date(value).toLocaleDateString(region.locale);

  return (
    <article className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 sm:grid-cols-[120px_minmax(0,1fr)_180px] sm:gap-5 sm:p-5">
      <ProductImage src={deal.imageUrl} title={deal.title} className="h-28 w-full rounded-lg bg-slate-50 p-3 sm:h-32" />
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap gap-2">
          {deal.discount && <span className="rounded bg-brand-soft px-2 py-1 text-[11px] font-semibold text-brand-hover">{deal.discount}</span>}
          {(deal.isExclusive || deal.badge) && <span className="rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-ink-soft">{deal.isExclusive ? dict.cards.exclusive : deal.badge}</span>}
        </div>
        <h3 className="text-sm font-semibold leading-relaxed text-ink sm:text-base">{deal.title}</h3>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-muted">{deal.description}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
          {deal.expiryDate && <span>{dict.cards.expires}: {date(deal.expiryDate)}</span>}
          {deal.updatedAt && <span>{dict.cards.updated}: {date(deal.updatedAt)}</span>}
          {deal.type === "lightning" && deal.endsInSeconds !== undefined && <span className="font-medium text-brand-hover">{dict.cards.endsIn} <span className="font-mono tabular-nums">{formatTime(timeLeft)}</span></span>}
        </div>
      </div>
      <div className="col-span-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4 sm:col-span-1 sm:block sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
        <div>
          {deal.salePrice ? <><p className="text-[11px] text-ink-muted">{dict.productShop.itemPrice}</p><p className="mt-1 text-2xl font-bold tracking-tight text-ink">{deal.salePrice}</p><p className="mt-1 text-[11px] text-ink-muted">{dict.productShop.deliveryUnknown}</p></> : <p className="text-xs text-ink-muted">{dict.productShop.checkPrice}</p>}
        </div>
        <a href={`/api/outbound?dealId=${encodeURIComponent(deal.id)}&market=${encodeURIComponent(String(params?.country || "US"))}`} target="_blank" rel="nofollow noopener noreferrer sponsored" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-hover sm:mt-4 sm:w-full">
          {dict.cards.getDeal}<ProductIcon name="external" className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  );
}
