"use client";
import { useState } from "react";
import { useCurrency } from "@/i18n/CurrencyProvider";
import { useDictionary } from "@/i18n/DictionaryProvider";
import type { Known } from "@/lib/model/known";
import type { DeliveredTotalBreakdown } from "@/lib/model/deliveredTotal";
import { selectProductOffers } from "@/lib/model/productOffers";
import ProductIcon from "./ProductIcon";
export interface RetailerOffer {
  productId: number;
  retailerName: string;
  retailerKey?: string;
  retailerLogo?: string | null;
  inStock: boolean;
  trackingUrl: string | null;
  matchBasis: "source" | "identifier" | "manual" | "title";
  breakdown: DeliveredTotalBreakdown;
  currency: string;
}
export default function OfferTable({ offers, canClaimComparison = false, defaultCurrency }: { offers: RetailerOffer[]; canClaimComparison?: boolean; defaultCurrency?: string }) {
  const d=useDictionary(),t=d.productV2,u=d.productShop;const {region}=useCurrency();
  const currencies=Array.from(new Set(offers.map(o=>o.currency)));
  const [currency,setCurrency]=useState(defaultCurrency&&currencies.includes(defaultCurrency)?defaultCurrency:currencies[0]||region.currency);
  const [sort,setSort]=useState<"total"|"item"|"retailer">("total"),[stock,setStock]=useState(false);
  const {ordered,bestId}=selectProductOffers(offers,currency,sort,stock);
  const money=(n:number,c:string)=>new Intl.NumberFormat(region.locale,{style:"currency",currency:c}).format(n);
  const show=(v:Known<number>,c:string,zero?:string)=>v.known?(v.value===0&&zero?zero:money(v.value,c)):t.unknown;
  return <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"><label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={stock} onChange={e=>setStock(e.target.checked)} className="h-4 w-4 accent-brand" />{u.onlyInStock}</label><div className="flex flex-wrap items-center gap-3">{currencies.length>1&&<label className="flex items-center gap-2 text-xs text-ink-muted">{u.currency}<select aria-label={u.currency} value={currency} onChange={e=>setCurrency(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-ink">{currencies.map(c=><option key={c}>{c}</option>)}</select></label>}<label className="flex items-center gap-2 text-xs text-ink-muted">{t.sortBy}<select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-medium text-ink"><option value="total">{t.colTotal}</option><option value="item">{t.colItemPrice}</option><option value="retailer">{u.retailerOrder}</option></select></label></div></div>
    <div className="space-y-3">{ordered.map(offer=>{
      const b=offer.breakdown, best=canClaimComparison&&offer.productId===bestId;
      return <article key={offer.productId} className={`overflow-hidden rounded-xl border bg-white ${best?"border-emerald-400":"border-slate-200"}`}>
        {best&&<div className="flex items-center gap-1.5 bg-emerald-50 px-5 py-2 text-xs font-semibold text-emerald-800"><ProductIcon name="check" className="h-3.5 w-3.5" />{u.bestTotal}</div>}
        <div className="grid items-center gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_160px_190px]">
          <div className="flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-lg font-bold text-ink">{offer.retailerName.charAt(0)}</span><div className="min-w-0"><h3 className="text-base font-bold text-ink">{offer.retailerName}</h3><p className={`mt-1 flex items-center gap-1.5 text-xs ${offer.inStock?"text-emerald-700":"text-ink-muted"}`}><span className={`h-1.5 w-1.5 rounded-full ${offer.inStock?"bg-emerald-500":"bg-slate-300"}`} />{offer.inStock?t.inStock:t.stockUnknown}</p>{offer.matchBasis==="title"&&<span className="mt-1 inline-block text-[11px] font-medium text-amber-700">{t.matchBasisTitle}</span>}</div></div>
          <div><p className="text-[11px] text-ink-muted">{t.colItemPrice}{b.quantity > 1 ? ` × ${b.quantity}` : ""}</p><p className="mt-0.5 text-[22px] font-bold tracking-tight text-ink">{show(b.itemPrice,offer.currency)}</p><p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-muted"><ProductIcon name="truck" className="h-3.5 w-3.5 shrink-0" />{b.delivery.known ? `${t.colDelivery}: ${show(b.delivery,offer.currency,t.freeDelivery)}` : u.deliveryUnknown}</p></div>
          <div className="border-t border-slate-100 pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">{b.total.known&&<p className="mb-2 text-sm font-semibold text-ink">{money(b.total.value,offer.currency)} <span className="text-[11px] font-normal text-ink-muted">{t.colTotal}{b.estimated?` · ${t.estimated}`:""}</span></p>}{offer.trackingUrl?<a href={offer.trackingUrl} target="_blank" rel="nofollow noopener noreferrer sponsored" className="flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover">{u.visitRetailer}<ProductIcon name="external" className="h-3.5 w-3.5" /></a>:<span className="text-sm text-ink-muted">{u.checkAvailability}</span>}</div>
        </div>
        <details className="group border-t border-slate-100"><summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-3 text-xs font-medium text-ink-soft hover:bg-slate-50"><span>{u.offerDetails}</span><span className="flex items-center gap-2 text-[11px] text-ink-muted">{b.checkedAt?`${t.lastChecked} ${new Date(b.checkedAt).toLocaleDateString(region.locale)}`:t.neverChecked}<ProductIcon name="chevron" className="h-3.5 w-3.5 rotate-90 transition group-open:-rotate-90" /></span></summary>
          <div className="grid gap-4 border-t border-slate-100 bg-slate-50/60 p-5 sm:grid-cols-2"><dl className="space-y-2 text-xs">{[[t.colItemPrice,show(b.itemPrice,offer.currency)],[t.quantity,String(b.quantity)],[t.colDiscount,show(b.eligibleDiscount,offer.currency,t.none)],[t.colDelivery,show(b.delivery,offer.currency,t.freeDelivery)],[t.colOtherCharges,show(b.otherMandatoryCharges,offer.currency,t.none)],["Tax",show(b.additionalTax,offer.currency,t.none)],[t.colTotal,b.total.known?money(b.total.value,offer.currency):t.totalUnknown]].map(([label,value])=><div key={label} className="flex justify-between gap-4"><dt className="text-ink-muted">{label}</dt><dd className="font-medium text-ink">{value}</dd></div>)}</dl><div className="space-y-2 text-xs leading-relaxed text-ink-soft"><p>{offer.matchBasis==="title"?t.matchCaution:offer.matchBasis==="manual"?t.matchBasisManual:offer.matchBasis==="source"?t.thisListing:t.matchBasisIdentifier}</p>{b.conditionalPromotions.map(p=><p key={p.promotionId} className="rounded-lg bg-amber-50 p-3 text-amber-900">{t.conditionalOffer}: {p.conditions.join("; ")}</p>)}<p>{d.productV2.confirmedAtCheckout}</p></div></div>
        </details>
      </article>;
    })}</div>
    {ordered.length===0&&<div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-ink-muted">{u.noFilteredOffers}<button className="ml-2 font-semibold text-brand" onClick={()=>setStock(false)}>{u.reset}</button></div>}
    <details className="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-3"><summary className="cursor-pointer text-xs font-semibold text-ink-soft">{t.howWeRank}</summary><p className="mt-3 text-xs leading-relaxed text-ink-muted">{t.rankingNote}</p>{offers.some(o=>o.matchBasis==="title")&&<p className="mt-2 text-xs text-amber-800">{t.matchCaution}</p>}</details>
  </div>;
}
