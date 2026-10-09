"use client";
import { useRef } from "react";
import type { Product } from "@/lib/products";
import { useDictionary } from "@/i18n/DictionaryProvider";
import { useCurrency } from "@/i18n/CurrencyProvider";
import ProductImage from "./ProductImage";
import ProductSaveButton from "./ProductSaveButton";
import ProductIcon from "./ProductIcon";
export default function ProductHero({ product, price, currency, offerCount, retailerName }: { product: Product; price: number | null; currency: string; offerCount: number; retailerName?: string }) {
  const d=useDictionary(),t=d.productShop;const {format}=useCurrency(); const dialog=useRef<HTMLDialogElement>(null);
  const specs=[product.brand,product.size,product.colour,product.packCount&&product.packCount>1?`${product.packCount} ${t.packUnits}`:null,product.condition&&product.condition!=="unknown"?product.condition:null].filter(Boolean);
  return <section id="overview" className="scroll-mt-44 grid gap-7 pb-8 pt-2 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12">
    <div className="relative flex min-h-72 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 sm:min-h-96 sm:p-8"><button type="button" onClick={()=>dialog.current?.showModal()} className="h-64 w-full cursor-zoom-in sm:h-80" aria-label={product.title}><ProductImage priority src={product.imageUrl} title={product.title} className="h-full w-full p-4" /></button><div className="absolute right-4 top-4"><ProductSaveButton product={product} /></div>{product.brand&&<span className="absolute bottom-5 left-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">{product.brand}</span>}</div>
    <div className="flex flex-col justify-center"><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-brand">{product.category||t.products}</p><h1 className="text-[28px] font-bold leading-[1.15] tracking-tight text-ink sm:text-4xl">{product.title}</h1>
      {specs.length>0&&<div className="mt-4 flex flex-wrap gap-2">{specs.map((s,i)=><span key={i} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-ink-soft">{s}</span>)}</div>}
      <a href="#product-details" className="mt-4 flex w-fit items-center gap-1 text-xs font-medium text-ink-muted hover:text-brand">{t.details}<ProductIcon name="chevron" className="h-3 w-3" /></a>
      <div className="mt-6 rounded-2xl border border-brand-border bg-[#fff8f4] p-5 sm:p-6"><p className="text-xs text-ink-soft">{offerCount>1?t.from:t.itemPrice}</p><div className="mt-1 flex flex-wrap items-baseline gap-3"><p className="text-[38px] font-bold leading-tight tracking-tight text-ink">{price!==null?format(price,currency):t.checkPrice}</p><span className="text-xs text-ink-muted">{currency}</span></div><p className="mt-1 text-xs text-ink-muted">{t.shippingNote}</p>{retailerName&&<p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft"><ProductIcon name="store" className="h-3.5 w-3.5" />{t.priceAt} {retailerName}</p>}
      <div className="mt-5 flex flex-wrap gap-2"><a href="#retailer-offers" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover">{t.seeOffers}<ProductIcon name="arrow" className="h-4 w-4" /></a><a href="#price-alert" aria-label={d.productV2.setPriceAlert} title={d.productV2.setPriceAlert} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-brand-border bg-white px-3 text-brand hover:bg-brand-soft"><ProductIcon name="bell" /></a></div>
      <p className="mt-3 text-center text-[11px] text-ink-muted">{offerCount===1?d.productV2.oneOfferOnly:`${offerCount} ${t.retailerCount}`}</p></div>
      <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-ink-muted"><ProductIcon name="store" className="mt-0.5 h-3.5 w-3.5 shrink-0" />{d.productV2.disclosure}</p>
    </div>
    <dialog ref={dialog} aria-label={product.title} className="w-[min(90vw,800px)] rounded-2xl bg-white p-6 backdrop:bg-ink/60"><button onClick={()=>dialog.current?.close()} aria-label={d.categoryV2.closeFilters} className="absolute right-4 top-4 rounded-full border border-line bg-white p-2"><ProductIcon name="close" /></button><ProductImage src={product.imageUrl} title={product.title} className="h-[65vh] w-full p-6" /><p className="mt-4 text-center text-sm font-medium text-ink">{product.title}</p></dialog>
  </section>;
}
