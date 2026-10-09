"use client";
import { useState } from "react";
import Link from "next/link";
import { useDictionary } from "@/i18n/DictionaryProvider";
import type { ProductFacets } from "@/lib/db/products";
import { readProductCatalogParams } from "@/lib/model/productCatalog";
import ProductIcon from "./ProductIcon";
export default function CatalogFilters({ country, facets, query }: { country: string; facets: ProductFacets; query: ReturnType<typeof readProductCatalogParams> }) {
  const d = useDictionary(), t = d.productShop; const [open, setOpen] = useState(false); const [currency, setCurrency] = useState(query.currency);
  const control = "mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:bg-slate-50 disabled:text-ink-muted";
  return <aside className="self-start rounded-2xl border border-slate-200 bg-white lg:sticky lg:top-36">
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="flex items-center gap-2 text-sm font-bold text-ink"><ProductIcon name="filter" className="h-4 w-4" />{d.categoryV2.filters}</h2><Link href={`/${country}/products`} className="hidden text-xs font-medium text-brand hover:underline lg:block">{t.reset}</Link><button className="text-sm font-semibold text-brand lg:hidden" aria-expanded={open} aria-controls="catalog-filters" onClick={() => setOpen(!open)}>{open ? d.categoryV2.closeFilters : d.categoryV2.openFilters}</button></div>
    <form id="catalog-filters" method="get" action={`/${country}/products`} className={`${open ? "block" : "hidden"} space-y-5 p-5 lg:block`}>
      {query.search && <input type="hidden" name="search" value={query.search} />}<input type="hidden" name="view" value={query.view} /><input type="hidden" name="sort" value={query.sort} />
      {[["category", t.category, t.allCategories, facets.categories ?? [], query.category], ["brand", d.categoryV2.brandLabel, d.categoryV2.allBrands, facets.brands, query.brand], ["size", d.categoryV2.sizeLabel, d.categoryV2.allSizes, facets.sizes, query.size], ["condition", d.categoryV2.conditionLabel, d.categoryV2.allConditions, facets.conditions, query.condition]].map(([name, label, all, values, value]) => (values as {name:string;count:number}[]).length > 0 && <label className="block text-xs font-semibold text-ink" key={String(name)}>{String(label)}<select name={String(name)} defaultValue={String(value)} className={control}><option value="">{String(all)}</option>{(values as {name:string;count:number}[]).map(v=><option key={v.name} value={v.name}>{v.name} ({v.count})</option>)}</select></label>)}
      <div className="border-t border-slate-100 pt-5"><label className="block text-xs font-semibold text-ink">{t.currency}<select name="currency" value={currency} onChange={e=>setCurrency(e.target.value)} className={control}><option value="">{t.allCurrencies}</option>{(facets.currencies ?? []).map(v=><option key={v.name} value={v.name}>{v.name}</option>)}</select></label>
        <fieldset className="mt-4"><legend className="text-xs font-semibold text-ink">{t.priceRange}{currency ? ` (${currency})` : ""}</legend><div className="mt-1 grid grid-cols-2 gap-2"><label className="sr-only" htmlFor="price-min">{t.minPrice}</label><input id="price-min" className={control} type="number" name="min" min="0" step="0.01" disabled={!currency} defaultValue={query.minPrice} placeholder={t.minPrice} /><label className="sr-only" htmlFor="price-max">{t.maxPrice}</label><input id="price-max" className={control} type="number" name="max" min="0" step="0.01" disabled={!currency} defaultValue={query.maxPrice} placeholder={t.maxPrice} /></div>{!currency && <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">{t.currencyHint}</p>}</fieldset>
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 border-t border-slate-100 pt-5 text-sm text-ink-soft"><input type="checkbox" name="stock" value="1" defaultChecked={query.inStockOnly} className="h-4 w-4 accent-brand" />{d.categoryV2.inStockOnly}</label>
      <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-3 text-sm font-semibold text-white hover:bg-brand-hover" type="submit">{t.apply}<ProductIcon name="arrow" className="h-4 w-4" /></button>
      <Link href={`/${country}/products`} className="block text-center text-xs font-medium text-ink-muted hover:text-brand lg:hidden">{t.reset}</Link>
    </form>
  </aside>;
}
