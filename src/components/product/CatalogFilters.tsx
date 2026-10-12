"use client";
import { useState } from "react";
import Link from "next/link";
import { useDictionary } from "@/i18n/DictionaryProvider";
import type { ProductFacets } from "@/lib/db/products";
import { readProductCatalogParams } from "@/lib/model/productCatalog";
import ProductIcon from "./ProductIcon";

function FacetGroup({ name, label, all, values, selected }: { name: string; label: string; all: string; values: { name: string; count: number }[]; selected: string }) {
  const [search, setSearch] = useState("");
  const [value, setValue] = useState(selected);
  const shown = values.filter(v => v.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <details open={name === "category" || name === "brand" || Boolean(selected)} className="group border-t border-slate-100 py-4">
    <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink">{label}<ProductIcon name="chevron" className="h-3.5 w-3.5 rotate-90 group-open:-rotate-90" /></summary>
    {values.length > 7 && <input type="search" value={search} onChange={e => setSearch(e.target.value)} aria-label={label} placeholder={label} className="mt-3 w-full rounded-md border border-slate-200 px-3 py-2 text-xs" />}
    <div className="mt-3 max-h-52 space-y-1 overflow-y-auto pr-1">
      <label className="flex cursor-pointer items-center gap-2 rounded py-1.5 text-xs text-ink-soft"><input type="radio" name={name} value="" checked={!value} onChange={() => setValue("")} className="h-4 w-4 accent-brand" />{all}</label>
      {shown.map(v => <label key={v.name} className="flex cursor-pointer items-center gap-2 rounded py-1.5 text-xs text-ink-soft"><input type="radio" name={name} value={v.name} checked={value === v.name} onChange={() => setValue(v.name)} className="h-4 w-4 shrink-0 accent-brand" /><span className="flex-1">{v.name}</span><span className="text-ink-muted">{v.count}</span></label>)}
      {value && !shown.some(v => v.name === value) && <input type="hidden" name={name} value={value} />}
    </div>
  </details>;
}

export default function CatalogFilters({ country, facets, query }: { country: string; facets: ProductFacets; query: ReturnType<typeof readProductCatalogParams> }) {
  const d = useDictionary(), t = d.productShop;
  const [open, setOpen] = useState(false), [currency, setCurrency] = useState(query.currency);
  const control = "mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:bg-slate-50 disabled:text-ink-muted";
  const groups = [{name:"category",label:t.category,all:t.allCategories,values:facets.categories ?? [],selected:query.category},{name:"brand",label:d.categoryV2.brandLabel,all:d.categoryV2.allBrands,values:facets.brands,selected:query.brand},{name:"size",label:d.categoryV2.sizeLabel,all:d.categoryV2.allSizes,values:facets.sizes,selected:query.size},{name:"condition",label:d.categoryV2.conditionLabel,all:d.categoryV2.allConditions,values:facets.conditions,selected:query.condition}];
  return <aside className="self-start rounded-xl border border-slate-200 bg-white lg:sticky lg:top-36 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto">
    <div className="flex items-center justify-between px-5 py-4"><h2 className="flex items-center gap-2 text-sm font-bold text-ink"><ProductIcon name="filter" className="h-4 w-4" />{d.categoryV2.filters}</h2><Link href={`/${country}/products`} className="hidden text-xs font-medium text-ink-muted hover:text-brand lg:block">{t.reset}</Link><button type="button" className="text-sm font-semibold text-brand lg:hidden" aria-expanded={open} aria-controls="catalog-filters" onClick={() => setOpen(!open)}>{open ? d.categoryV2.closeFilters : d.categoryV2.openFilters}</button></div>
    <form id="catalog-filters" method="get" action={`/${country}/products`} className={`${open ? "block" : "hidden"} px-5 pb-5 lg:block`}>
      {query.search && <input type="hidden" name="search" value={query.search} />}<input type="hidden" name="view" value={query.view} /><input type="hidden" name="sort" value={query.sort} />
      <fieldset className="border-t border-slate-100 py-4"><legend className="sr-only">{t.priceRange}</legend><label className="block text-xs font-semibold text-ink">{t.currency}<select name="currency" value={currency} onChange={e => setCurrency(e.target.value)} className={control}><option value="">{t.allCurrencies}</option>{(facets.currencies ?? []).map(v => <option key={v.name} value={v.name}>{v.name}</option>)}</select></label>
        <p className="mt-4 text-sm font-semibold text-ink">{t.priceRange}</p><div className="grid grid-cols-2 gap-2"><label className="sr-only" htmlFor="price-min">{t.minPrice}</label><input id="price-min" className={control} type="number" name="min" min="0" step="0.01" disabled={!currency} defaultValue={query.minPrice} placeholder={t.minPrice} /><label className="sr-only" htmlFor="price-max">{t.maxPrice}</label><input id="price-max" className={control} type="number" name="max" min="0" step="0.01" disabled={!currency} defaultValue={query.maxPrice} placeholder={t.maxPrice} /></div>{!currency && <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">{t.currencyHint}</p>}
      </fieldset>
      <label className="flex cursor-pointer items-center gap-2.5 border-t border-slate-100 py-4 text-sm text-ink-soft"><input type="checkbox" name="stock" value="1" defaultChecked={query.inStockOnly} className="h-4 w-4 accent-brand" />{d.categoryV2.inStockOnly}</label>
      {groups.filter(group => group.values.length > 0).map(group => <FacetGroup key={group.name} {...group} />)}
      <div className="sticky -bottom-5 border-t border-slate-100 bg-white pb-1 pt-4"><button className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-3 py-3 text-sm font-semibold text-white hover:bg-brand" type="submit">{t.apply}<ProductIcon name="arrow" className="h-4 w-4" /></button><Link href={`/${country}/products`} className="mt-3 block text-center text-xs font-medium text-ink-muted hover:text-brand lg:hidden">{t.reset}</Link></div>
    </form>
  </aside>;
}
