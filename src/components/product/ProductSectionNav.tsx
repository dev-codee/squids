"use client";

import { useEffect, useState } from "react";
import { useDictionary } from "@/i18n/DictionaryProvider";

export default function ProductSectionNav({ offerCount }: { offerCount: number }) {
  const d = useDictionary();
  const [active, setActive] = useState("retailer-offers");
  useEffect(() => {
    const sections = ["retailer-offers", "price-history", "product-details"];
    const update = () => {
      const visible = sections.map(id => ({ id, rect: document.getElementById(id)?.getBoundingClientRect() }))
        .filter(item => item.rect && item.rect.bottom > 180)
        .sort((a, b) => Math.abs(a.rect!.top - 180) - Math.abs(b.rect!.top - 180));
      if (visible[0]) setActive(visible[0].id);
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return <nav aria-label={d.productShop.viewOptions} className="sticky top-[117px] z-20 border-y border-slate-200 bg-white shadow-sm">
    <div className="mx-auto flex max-w-shell gap-5 overflow-x-auto px-4 sm:gap-8 sm:px-6 lg:px-8">
      {[["retailer-offers", d.productV2.comparePrices], ["price-history", d.productV2.priceHistory], ["product-details", d.productShop.details]].map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => setActive(id)} aria-current={active === id ? "location" : undefined} className={`flex shrink-0 items-center gap-2 border-b-[3px] py-4 text-sm font-semibold transition ${active === id ? "border-brand text-ink" : "border-transparent text-ink-soft hover:border-slate-300"}`}>
        {label}{id === "retailer-offers" && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-ink-soft">{offerCount}</span>}
      </a>)}
    </div>
  </nav>;
}
