"use client";

import { useMemo, useState } from "react";
import type { CouponItem } from "@/lib/storeData";
import HorizontalCouponCard from "./HorizontalCouponCard";

type FilterKey = "all" | "code" | "no-code" | "exclusive";
type SortKey = "recent" | "expiring" | "discount";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "code", label: "Code required" },
  { key: "no-code", label: "No code needed" },
  { key: "exclusive", label: "Exclusive" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Newest" },
  { key: "expiring", label: "Expiring soon" },
  { key: "discount", label: "Highest discount" },
];

/** Extracts the leading number from strings like "20% OFF" or "$15 OFF" for sorting. */
function discountValue(discount: string): number {
  const match = discount.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

interface OfferListProps {
  items: CouponItem[];
  storeName: string;
  market?: string;
  merchantId?: string;
  /** Label used in the empty-filter state, e.g. "coupons" or "deals". */
  itemLabel?: string;
}

/**
 * Client-side filter + sort bar wrapping a store's coupon/deal list. Wraps
 * HorizontalCouponCard directly (rather than taking a render prop) since
 * function props can't cross the server/client boundary.
 */
export default function OfferList({
  items,
  storeName,
  market,
  merchantId,
  itemLabel = "offers",
}: OfferListProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const visible = useMemo(() => {
    let list = items;
    if (filter === "code") list = list.filter((i) => !!i.code);
    else if (filter === "no-code") list = list.filter((i) => !i.code);
    else if (filter === "exclusive") list = list.filter((i) => i.isExclusive);

    const timeOf = (i: CouponItem) => (i.updatedAt ? new Date(i.updatedAt).getTime() : 0);
    const expiryOf = (i: CouponItem) =>
      i.expiryDate ? new Date(i.expiryDate).getTime() : Number.POSITIVE_INFINITY;

    return [...list].sort((a, b) => {
      if (sort === "expiring") return expiryOf(a) - expiryOf(b);
      if (sort === "discount") return discountValue(b.discount) - discountValue(a.discount);
      return timeOf(b) - timeOf(a);
    });
  }, [items, filter, sort]);

  if (items.length === 0) return null;

  return (
    <div>
      {/* Filter + sort controls — only worth showing once there's enough to sift through */}
      {items.length > 3 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === f.key
                    ? "bg-amber-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No {itemLabel} match this filter.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((item) => (
            <HorizontalCouponCard
              key={item.id}
              coupon={item}
              storeName={storeName}
              market={market}
              merchantId={merchantId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
