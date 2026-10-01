"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useDictionary } from "@/i18n/DictionaryProvider";
import { useCurrency } from "@/i18n/CurrencyProvider";

/**
 * Product filter panel.
 *
 * Only exposes controls backed by structured data we actually hold — stock
 * status and the item price. Brand, size and product type aren't fields on the
 * product feed, so they're absent rather than shown as dead controls.
 *
 * Selections live in the URL so a filtered view is linkable and the back button
 * works; `page` is dropped on every change so results never land out of range.
 */
export default function CategoryFilters() {
  const dict = useDictionary();
  const t = dict.categoryV2;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { region } = useCurrency();

  const inStock = searchParams.get("stock") === "1";
  const minPrice = searchParams.get("min") ?? "";
  const maxPrice = searchParams.get("max") ?? "";
  const hasFilters = inStock || minPrice !== "" || maxPrice !== "";

  const apply = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <aside className="rounded-card border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">{t.filters}</h2>
        {hasFilters && (
          <button
            type="button"
            onClick={() => apply({ stock: null, min: null, max: null })}
            className="text-xs font-semibold text-brand hover:underline"
          >
            {t.clearFilters}
          </button>
        )}
      </div>

      {/* Availability */}
      <fieldset className="mt-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t.availability}
        </legend>
        <label className="mt-2 flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => apply({ stock: e.target.checked ? "1" : null })}
            className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
          />
          {t.inStockOnly}
        </label>
      </fieldset>

      {/* Item price */}
      <fieldset className="mt-5">
        <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t.priceLabel} ({region.currency})
        </legend>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            defaultValue={minPrice}
            onBlur={(e) => apply({ min: e.target.value || null })}
            aria-label={`${t.priceLabel} min`}
            placeholder="0"
            className="w-full min-w-0 rounded-[9px] border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
          <span className="text-ink-muted" aria-hidden>–</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            defaultValue={maxPrice}
            onBlur={(e) => apply({ max: e.target.value || null })}
            aria-label={`${t.priceLabel} max`}
            placeholder="∞"
            className="w-full min-w-0 rounded-[9px] border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">{t.priceBasis}</p>
      </fieldset>
    </aside>
  );
}
