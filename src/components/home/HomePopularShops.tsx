"use client";

import Link from "next/link";
import type { PopularShopData } from "@/lib/db/deals";

function storeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function HomePopularShops({
  shops,
  country,
}: {
  shops: PopularShopData[];
  country: string;
}) {
  return (
    <section className="py-12 bg-white">
      <div className="max-w-5xl mx-auto px-4 text-center">
        <h2 className="text-xl font-bold text-gray-900">Popular shops</h2>
        <p className="mt-2 text-sm text-gray-500 mb-8">Save money every time - on any purchase!</p>

        {(!shops || shops.length === 0) ? (
          <div className="w-full text-center text-gray-500 py-4 border border-dashed border-gray-300 rounded-lg">
            No popular shops yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {shops.slice(0, 8).map((shop) => (
              <Link
                key={`${shop.network}-${shop.id}`}
                href={`/${country.toLowerCase()}/${storeSlug(shop.name)}`}
                className="group flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
              >
                <div className="flex h-12 w-full items-center justify-center overflow-hidden">
                  {shop.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={shop.logoUrl}
                      alt={`${shop.name} logo`}
                      className="max-h-12 max-w-full object-contain transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-sm font-bold text-gray-800">{shop.name}</span>
                  )}
                </div>
                <div>
                  <p className="truncate text-sm font-semibold text-gray-800">{shop.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{shop.dealCount} deals</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
