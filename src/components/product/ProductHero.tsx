"use client";

import { useRef } from "react";
import type { Product } from "@/lib/products";
import { useDictionary } from "@/i18n/DictionaryProvider";
import { useCurrency } from "@/i18n/CurrencyProvider";
import ProductImage from "./ProductImage";
import ProductSaveButton from "./ProductSaveButton";
import ProductIcon from "./ProductIcon";

export default function ProductHero({ product, price, currency, offerCount, retailerName }: {
  product: Product; price: number | null; currency: string; offerCount: number; retailerName?: string;
}) {
  const d = useDictionary(), t = d.productShop;
  const { format } = useCurrency();
  const dialog = useRef<HTMLDialogElement>(null);
  const specs = [product.size, product.colour, product.packCount && product.packCount > 1 ? `${product.packCount} ${t.packUnits}` : null, product.condition && product.condition !== "unknown" ? product.condition : null].filter(Boolean);

  return (
    <section id="overview" className="mb-6 scroll-mt-44 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)_300px] xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <div className="relative flex items-center justify-center p-6 lg:p-8">
          <button type="button" onClick={() => dialog.current?.showModal()} className="h-60 w-full cursor-zoom-in sm:h-72" aria-label={product.title}>
            <ProductImage priority src={product.imageUrl} title={product.title} className="h-full w-full p-3" />
          </button>
          <div className="absolute right-4 top-4"><ProductSaveButton product={product} /></div>
        </div>
        <div className="flex flex-col justify-center px-6 pb-6 lg:px-4 lg:py-8">
          <p className="mb-2 text-xs font-medium text-ink-muted">{[product.brand, product.category || t.products].filter(Boolean).join(" · ")}</p>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">{product.title}</h1>
          {specs.length > 0 && <p className="mt-4 text-sm leading-7 text-ink-soft">{specs.join(" · ")}</p>}
          <a href="#product-details" className="mt-4 inline-flex w-fit items-center gap-1 text-sm font-medium text-brand hover:underline">{t.details}<ProductIcon name="chevron" className="h-3.5 w-3.5" /></a>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 border-t border-slate-100 pt-4">
            <a href="#price-history" className="inline-flex items-center gap-2 text-xs font-medium text-ink-soft hover:text-brand"><ProductIcon name="chart" className="h-4 w-4" />{d.productV2.priceHistory}</a>
            <a href="#price-alert" className="inline-flex items-center gap-2 text-xs font-medium text-ink-soft hover:text-brand"><ProductIcon name="bell" className="h-4 w-4" />{d.productV2.setPriceAlert}</a>
          </div>
        </div>
        <div className="flex flex-col justify-center border-t border-slate-200 bg-slate-50/70 p-6 lg:border-l lg:border-t-0 lg:p-7">
          <p className="text-xs text-ink-soft">{offerCount > 1 ? t.from : t.itemPrice}</p>
          <p className="mt-1 text-4xl font-bold tracking-tight text-ink">{price !== null ? format(price, currency) : t.checkPrice}</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">{t.shippingNote}</p>
          {retailerName && <p className="mt-4 flex items-center gap-2 text-xs text-ink-soft"><ProductIcon name="store" className="h-4 w-4" />{t.priceAt} {retailerName}</p>}
          <a href="#retailer-offers" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover">{t.seeOffers}<ProductIcon name="arrow" className="h-4 w-4" /></a>
          <p className="mt-3 text-center text-xs text-ink-muted">{offerCount === 1 ? d.productV2.oneOfferOnly : `${offerCount} ${t.retailerCount}`}</p>
        </div>
      </div>
      <p className="border-t border-slate-100 px-6 py-3 text-[11px] leading-relaxed text-ink-muted">{d.productV2.disclosure}</p>
      <dialog ref={dialog} aria-label={product.title} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }} className="w-[min(90vw,800px)] rounded-xl bg-white p-6 backdrop:bg-ink/60">
        <button type="button" onClick={() => dialog.current?.close()} aria-label={d.categoryV2.closeFilters} className="absolute right-4 top-4 rounded-full border border-line bg-white p-2"><ProductIcon name="close" /></button>
        <ProductImage src={product.imageUrl} title={product.title} className="h-[65vh] w-full p-6" /><p className="mt-4 text-center text-sm font-medium text-ink">{product.title}</p>
      </dialog>
    </section>
  );
}
