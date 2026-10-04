"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useDictionary } from "@/i18n/DictionaryProvider";
import { useCurrency } from "@/i18n/CurrencyProvider";
import type { ProductFacets } from "@/lib/db/products";

interface CategoryFiltersProps {
  tab?: "products" | "deals";
  facets?: ProductFacets;
}

/**
 * Enhanced Category filter panel.
 * Supports both Products and Deals tabs with structured filtering:
 * - Products: Stock, Price bounds, Brand, Size, Condition
 * - Deals: Offer type, Customer eligibility, Verification status, Store name
 *
 * Includes an accessible mobile slide-over drawer and clean URL param synchronization.
 */
export default function CategoryFilters({ tab = "products", facets }: CategoryFiltersProps) {
  const dict = useDictionary();
  const t = dict.categoryV2 as Record<string, string>;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { region } = useCurrency();

  const [mobileOpen, setMobileOpen] = useState(false);

  // Product tab filters
  const inStock = searchParams.get("stock") === "1";
  const minPrice = searchParams.get("min") ?? "";
  const maxPrice = searchParams.get("max") ?? "";
  const selectedBrand = searchParams.get("brand") ?? "";
  const selectedSize = searchParams.get("size") ?? "";
  const selectedCondition = searchParams.get("condition") ?? "";

  // Deals tab filters
  const discountType = searchParams.get("dtype") ?? "";
  const customerType = searchParams.get("cust") ?? "";
  const evidenceStatus = searchParams.get("evidence") ?? "";
  const storeFilter = searchParams.get("store") ?? "";

  const hasProductFilters =
    inStock ||
    minPrice !== "" ||
    maxPrice !== "" ||
    selectedBrand !== "" ||
    selectedSize !== "" ||
    selectedCondition !== "";

  const hasDealFilters =
    discountType !== "" ||
    customerType !== "" ||
    evidenceStatus !== "" ||
    storeFilter !== "";

  const hasActiveFilters = tab === "products" ? hasProductFilters : hasDealFilters;

  const activeCount = tab === "products"
    ? [inStock, minPrice, maxPrice, selectedBrand, selectedSize, selectedCondition].filter(Boolean).length
    : [discountType, customerType, evidenceStatus, storeFilter].filter(Boolean).length;

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

  const clearAll = () => {
    if (tab === "products") {
      apply({
        stock: null,
        min: null,
        max: null,
        brand: null,
        size: null,
        condition: null,
      });
    } else {
      apply({
        dtype: null,
        cust: null,
        evidence: null,
        store: null,
      });
    }
  };

  const filterContent = (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-ink">{t.filters || "Filters"}</h2>
          {activeCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-semibold text-brand hover:underline"
          >
            {t.clearFilters || "Clear filters"}
          </button>
        )}
      </div>

      {tab === "products" ? (
        <>
          {/* Availability */}
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t.availability || "Availability"}
            </legend>
            <label className="mt-2.5 flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => apply({ stock: e.target.checked ? "1" : null })}
                className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
              />
              {t.inStockOnly || "In stock only"}
            </label>
          </fieldset>

          {/* Item price */}
          <fieldset className="border-t border-line pt-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t.priceLabel || "Price"} ({region.currency})
            </legend>
            <div className="mt-2.5 flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                defaultValue={minPrice}
                key={`min-${minPrice}`}
                onBlur={(e) => apply({ min: e.target.value || null })}
                aria-label={`${t.priceLabel || "Price"} min`}
                placeholder="0"
                className="w-full min-w-0 rounded-[9px] border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <span className="text-ink-muted" aria-hidden>–</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                defaultValue={maxPrice}
                key={`max-${maxPrice}`}
                onBlur={(e) => apply({ max: e.target.value || null })}
                aria-label={`${t.priceLabel || "Price"} max`}
                placeholder="∞"
                className="w-full min-w-0 rounded-[9px] border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
              {t.priceBasis || "Item price. Delivery excluded until confirmed."}
            </p>
          </fieldset>

          {/* Brand Filter */}
          {facets?.brands && facets.brands.length > 0 && (
            <fieldset className="border-t border-line pt-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t.brandLabel || "Brand"}
              </legend>
              <select
                value={selectedBrand}
                onChange={(e) => apply({ brand: e.target.value || null })}
                className="mt-2.5 w-full rounded-[9px] border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              >
                <option value="">{t.allBrands || "All brands"}</option>
                {facets.brands.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} ({b.count})
                  </option>
                ))}
              </select>
            </fieldset>
          )}

          {/* Size / Pack Filter */}
          {facets?.sizes && facets.sizes.length > 0 && (
            <fieldset className="border-t border-line pt-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t.sizeLabel || "Size / Pack"}
              </legend>
              <select
                value={selectedSize}
                onChange={(e) => apply({ size: e.target.value || null })}
                className="mt-2.5 w-full rounded-[9px] border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              >
                <option value="">{t.allSizes || "All sizes"}</option>
                {facets.sizes.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.count})
                  </option>
                ))}
              </select>
            </fieldset>
          )}

          {/* Condition Filter */}
          {facets?.conditions && facets.conditions.length > 0 && (
            <fieldset className="border-t border-line pt-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t.conditionLabel || "Condition"}
              </legend>
              <select
                value={selectedCondition}
                onChange={(e) => apply({ condition: e.target.value || null })}
                className="mt-2.5 w-full rounded-[9px] border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              >
                <option value="">{t.allConditions || "All conditions"}</option>
                {facets.conditions.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name.charAt(0).toUpperCase() + c.name.slice(1)} ({c.count})
                  </option>
                ))}
              </select>
            </fieldset>
          )}
        </>
      ) : (
        <>
          {/* Store Name Filter */}
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t.filterStoreLabel || "Store name"}
            </legend>
            <input
              type="text"
              defaultValue={storeFilter}
              key={`store-${storeFilter}`}
              onBlur={(e) => apply({ store: e.target.value.trim() || null })}
              placeholder={t.filterStorePlaceholder || "Filter by store..."}
              className="mt-2.5 w-full rounded-[9px] border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </fieldset>

          {/* Offer Type */}
          <fieldset className="border-t border-line pt-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t.offerTypeLabel || "Offer type"}
            </legend>
            <div className="mt-2.5 space-y-2">
              {[
                { key: "", label: t.allOfferTypes || "All offer types" },
                { key: "code", label: t.typeCodes || "Promo codes" },
                { key: "deal", label: t.typeDeals || "Sales & deals" },
                { key: "student", label: t.typeStudent || "Student offers" },
                { key: "cashback", label: t.typeCashback || "Cashback" },
                { key: "free-delivery", label: t.typeDelivery || "Free delivery" },
              ].map((item) => (
                <label key={item.key} className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                  <input
                    type="radio"
                    name="dealType"
                    checked={discountType === item.key}
                    onChange={() => apply({ dtype: item.key || null })}
                    className="h-4 w-4 border-line-strong text-brand focus:ring-brand"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Customer Eligibility */}
          <fieldset className="border-t border-line pt-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t.customerTypeLabel || "Customer eligibility"}
            </legend>
            <select
              value={customerType}
              onChange={(e) => apply({ cust: e.target.value || null })}
              className="mt-2.5 w-full rounded-[9px] border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            >
              <option value="">{t.allCustomers || "All customers"}</option>
              <option value="new">{t.newCustomers || "New customers"}</option>
              <option value="existing">{t.existingCustomers || "Existing customers"}</option>
            </select>
          </fieldset>

          {/* Verification Level */}
          <fieldset className="border-t border-line pt-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t.evidenceStatusLabel || "Verification level"}
            </legend>
            <select
              value={evidenceStatus}
              onChange={(e) => apply({ evidence: e.target.value || null })}
              className="mt-2.5 w-full rounded-[9px] border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            >
              <option value="">{t.allEvidence || "All verification levels"}</option>
              <option value="checkout-tested">{t.checkoutTested || "Checkout-tested"}</option>
              <option value="merchant-listed">{t.merchantListed || "Merchant-listed"}</option>
              <option value="community-reported">{t.communityReported || "Community-reported"}</option>
            </select>
          </fieldset>
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Toggle */}
      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex w-full items-center justify-between rounded-[9px] border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm"
        >
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span>{t.openFilters || "Filters"}</span>
          </span>
          {activeCount > 0 && (
            <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile Modal Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative ml-auto flex h-full w-full max-w-xs flex-col bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3">
              <span className="text-base font-bold text-ink">{t.filters || "Filters"}</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {filterContent}
            </div>
            <div className="border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="w-full rounded-[9px] bg-brand py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-brand-hover"
              >
                {t.closeFilters || "Done"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar Panel */}
      <aside className="hidden rounded-card border border-line bg-white p-4 lg:block">
        {filterContent}
      </aside>
    </>
  );
}
