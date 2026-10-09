"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useDictionary } from "@/i18n/DictionaryProvider";

/** Labelled sort control. Each option states what it sorts on. */
export default function CategorySort() {
  const dict = useDictionary();
  const t = dict.categoryV2;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = searchParams.get("sort") || "relevance";

  const change = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "relevance") next.delete("sort");
    else next.set("sort", value);
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <label className="flex items-center gap-2 text-sm text-ink-muted">
      {t.sortBy}
      <select
        value={current}
        onChange={(e) => change(e.target.value)}
        className="rounded-[9px] border border-line bg-white px-2.5 py-1.5 text-sm font-medium text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      >
        <option value="relevance">{t.sortRelevance}</option>
        <option value="price-asc">{t.sortPriceAsc}</option>
        <option value="price-desc">{t.sortPriceDesc}</option>
      </select>
    </label>
  );
}
