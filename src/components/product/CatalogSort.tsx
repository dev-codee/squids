"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useDictionary } from "@/i18n/DictionaryProvider";
export default function CatalogSort({ value, currency }: { value: string; currency: string }) {
  const d = useDictionary(), router = useRouter(), pathname = usePathname(), params = useSearchParams(); const [pending, start] = useTransition();
  return <label className="flex items-center gap-2 text-xs text-ink-muted">{d.categoryV2.sortBy}<select aria-label={d.categoryV2.sortBy} value={value} disabled={pending} onChange={e=>{const next=new URLSearchParams(params.toString());next.set("sort",e.target.value);next.delete("page");if(currency)next.set("currency",currency);start(()=>router.push(`${pathname}?${next}`));}} className="max-w-[175px] rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-medium text-ink"><option value="relevance">{d.categoryV2.sortRelevance}</option><option value="price-asc" disabled={!currency}>{d.categoryV2.sortPriceAsc}</option><option value="price-desc" disabled={!currency}>{d.categoryV2.sortPriceDesc}</option></select></label>;
}
