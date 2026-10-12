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
  const specs = [[d.productV2.specSize, product.size], [d.productV2.specColour, product.colour || product.flavour], [d.productV2.specPack, product.packCount && product.packCount > 1 ? String(product.packCount) : null], [d.productV2.specCondition, product.condition && product.condition !== "unknown" ? product.condition : null]].filter(([, value]) => value);
  return <section id="overview" className="mb-6 scroll-mt-44 overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
      <div className="min-w-0 flex-1"><p className="mb-2 text-xs text-ink-muted">{[product.brand, product.category || t.products].filter(Boolean).join(" · ")}</p><h1 className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">{product.title}</h1></div>
      <ProductSaveButton product={product} />
    </div>
    <div className="grid md:grid-cols-[minmax(240px,0.9fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col items-center justify-center border-b border-slate-100 p-6 md:border-b-0 md:border-r sm:p-8">
        <button type="button" onClick={() => dialog.current?.showModal()} className="group relative h-56 w-full cursor-zoom-in sm:h-72" aria-label={`${d.productCompare.enlargeImage}: ${product.title}`}>
          <ProductImage priority src={product.imageUrl} title={product.title} className="h-full w-full p-3 transition-transform group-hover:scale-[1.03]" />
          <span className="absolute bottom-0 right-0 rounded-full border border-slate-200 bg-white p-2 text-ink-muted"><ProductIcon name="search" className="h-4 w-4" /></span>
        </button>
      </div>
      <div className="flex flex-col justify-center p-5 sm:p-7">
        {specs.length > 0 && <dl className="mb-5 flex flex-wrap gap-2">{specs.map(([label, value]) => <div key={label} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs"><dt className="text-[10px] text-ink-muted">{label}</dt><dd className="mt-0.5 font-semibold text-ink">{value}</dd></div>)}</dl>}
        <a href="#product-details" className="mb-5 inline-flex w-fit items-center gap-1 text-xs font-semibold text-ink-soft hover:text-brand">{t.details}<ProductIcon name="chevron" className="h-3 w-3" /></a>
        <div className="border-t border-slate-100 pt-5"><p className="text-xs text-ink-muted">{offerCount > 1 ? t.from : t.itemPrice}</p>
          <p className="mt-1 text-4xl font-bold tracking-tight text-ink sm:text-5xl">{price !== null ? format(price, currency) : t.checkPrice}</p>
          <p className="mt-2 text-xs text-ink-muted">{t.shippingNote}</p>
          {retailerName && <p className="mt-3 flex items-center gap-2 text-xs text-ink-soft"><ProductIcon name="store" className="h-4 w-4" />{t.priceAt} {retailerName}</p>}
          <div className="mt-5 flex flex-wrap gap-3"><a href="#retailer-offers" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-hover">{d.productV2.comparePrices}{offerCount > 0 && <span className="rounded bg-black/10 px-1.5 text-xs">{offerCount}</span>}<ProductIcon name="arrow" className="h-4 w-4" /></a>
            <a href="#price-alert" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-xs font-semibold text-ink hover:border-brand"><ProductIcon name="bell" className="h-4 w-4" />{d.productV2.setPriceAlert}</a></div>
          <a href="#price-history" className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-ink-soft hover:text-brand"><ProductIcon name="chart" className="h-4 w-4" />{d.productV2.priceHistory}<ProductIcon name="chevron" className="h-3 w-3" /></a>
        </div>
      </div>
    </div>
    <p className="border-t border-slate-100 px-5 py-3 text-[11px] leading-relaxed text-ink-muted sm:px-7">{d.productV2.disclosure}</p>
    <dialog ref={dialog} aria-label={product.title} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }} className="w-[min(90vw,800px)] rounded-xl bg-white p-6 backdrop:bg-ink/60">
      <button type="button" onClick={() => dialog.current?.close()} aria-label={d.productCompare.closeImage} className="absolute right-4 top-4 rounded-full border border-line bg-white p-2"><ProductIcon name="close" /></button>
      <ProductImage src={product.imageUrl} title={product.title} className="h-[65vh] w-full p-6" /><p className="mt-4 text-center text-sm font-medium text-ink">{product.title}</p>
    </dialog>
  </section>;
}
