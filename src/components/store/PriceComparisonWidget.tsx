"use client";

import type { PriceComparisonItem } from "@/lib/storeData";
import { useCurrency } from "@/i18n/CurrencyProvider";
import { useDictionary } from "@/i18n/DictionaryProvider";

interface PriceComparisonWidgetProps {
  items: PriceComparisonItem[];
  storeName: string;
}

export default function PriceComparisonWidget({ items, storeName }: PriceComparisonWidgetProps) {
  const { format } = useCurrency();
  const dict = useDictionary();
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            {dict.priceComparisonWidget.title}
          </h3>
          <p className="text-xs text-gray-500">
            {dict.priceComparisonWidget.subtitle.replace("{store}", storeName)}
          </p>
        </div>
        <span className="inline-flex items-center rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          {dict.priceComparisonWidget.updatedHourly}
        </span>
      </div>

      <div className="space-y-6">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4 md:flex-row md:items-center md:justify-between"
          >
            {/* Product info */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-white border border-gray-200 p-1">
                <img
                  src={item.image}
                  alt={item.productName}
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                  {item.category}
                </span>
                <h4 className="text-sm font-bold text-gray-900">{item.productName}</h4>
              </div>
            </div>

            {/* Competitor prices */}
            <div className="flex flex-wrap items-center gap-3">
              {item.competitors.map((comp, idx) => {
                const isCurrentStore = comp.storeName.toLowerCase() === storeName.toLowerCase();
                const isBestPrice = comp.price === Math.min(...item.competitors.map((c) => c.price));

                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 rounded-xl p-2.5 border text-xs font-medium ${
                      isBestPrice
                        ? "border-emerald-300 bg-emerald-50 text-emerald-900 font-bold"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    <span className="text-gray-500">{comp.storeName}:</span>
                    <span className={isBestPrice ? "text-emerald-700 font-extrabold" : "font-semibold"}>
                      {format(comp.price)}
                    </span>
                    {isBestPrice && (
                      <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                        Lowest
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
