"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/products";
import { useDictionary } from "@/i18n/DictionaryProvider";
import { useCurrency } from "@/i18n/CurrencyProvider";
import ProductImage from "./ProductImage";
import ProductIcon from "./ProductIcon";

export default function ProductVariants({ product, variants, country }: { product: Product; variants: Product[]; country: string }) {
  const d = useDictionary(), { format } = useCurrency();
  const [size, setSize] = useState("");
  const [colour, setColour] = useState("");
  const products = [product, ...variants];
  const sizes = Array.from(new Set(products.map(p => p.size).filter((v): v is string => Boolean(v))));
  const colours = Array.from(new Set(products.map(p => p.colour).filter((v): v is string => Boolean(v))));
  const shown = products.filter(p => (!size || p.size === size) && (!colour || p.colour === colour));
  return <section className="h-full rounded-xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="variant-heading">
    <h2 id="variant-heading" className="text-lg font-bold text-ink">{d.productV2.variantTitle} <span className="ml-1 text-sm font-normal text-ink-muted">({products.length})</span></h2>
    <p className="mt-1 text-xs leading-relaxed text-ink-muted">{d.productV2.variantNote}</p>
    <div className="mt-4 space-y-3">{[{ label: d.productV2.specSize, values: sizes, value: size, set: setSize }, { label: d.productV2.specColour, values: colours, value: colour, set: setColour }].filter(f => f.values.length > 1).map(f => <fieldset key={f.label}>
      <legend className="mb-2 text-xs font-semibold text-ink-soft">{f.label}</legend>
      <div className="flex flex-wrap gap-2">{f.values.map(value => <button key={value} type="button" aria-pressed={f.value === value} onClick={() => f.set(f.value === value ? "" : value)} className={`rounded-md border px-3 py-2 text-xs font-medium ${f.value === value ? "border-ink bg-ink text-white" : "border-slate-200 bg-white text-ink hover:border-ink"}`}>{value}</button>)}</div>
    </fieldset>)}</div>
    <div className="mt-5 grid max-h-[340px] gap-2 overflow-y-auto sm:grid-cols-2" aria-live="polite">
      {shown.map(p => <Link key={p.id} href={`/${country}/product/${p.id}`} aria-current={p.id === product.id ? "page" : undefined} className={`relative flex items-center gap-3 rounded-lg border p-3 transition ${p.id === product.id ? "border-brand bg-brand-soft" : "border-slate-200 hover:border-slate-400"}`}>
        <ProductImage src={p.imageUrl} title={p.title} className="h-14 w-12 shrink-0" />
        <div className="min-w-0 pr-3"><p className="text-xs font-medium leading-relaxed text-ink">{[p.size, p.colour, p.flavour, p.packCount && p.packCount > 1 ? `${p.packCount} ${d.productShop.packUnits}` : null].filter(Boolean).join(" · ") || p.title}</p>
          <p className="mt-1.5 text-sm font-bold text-ink">{typeof p.salePrice === "number" && Number.isFinite(p.salePrice) && p.salePrice >= 0 ? format(p.salePrice, p.currency || "USD") : d.productShop.checkPrice}</p></div>
        {p.id === product.id && <ProductIcon name="check" className="absolute right-2 top-2 h-3.5 w-3.5 text-brand" />}
      </Link>)}
    </div>
    {shown.length === 0 && <p className="mt-5 text-sm text-ink-muted">{d.productShop.noResults} <button onClick={() => { setSize(""); setColour(""); }} className="font-semibold text-brand">{d.productShop.reset}</button></p>}
  </section>;
}
