"use client";

import Link from "next/link";
import type { HomePopularShop } from "@/lib/db/homeSettings";

export default function HomePopularShops({ shops }: { shops: HomePopularShop[] }) {
  return (
    <section className="py-12 bg-white">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-xl font-bold text-gray-900">Popular shops</h2>
        <p className="mt-2 text-sm text-gray-500 mb-8">Save money every time - on any purchase!</p>

        <div className="flex flex-wrap justify-center gap-3">
          {(!shops || shops.length === 0) ? (
            <div className="w-full text-center text-gray-500 py-4 border border-dashed border-gray-300 rounded-lg">
              No popular shops added yet.
            </div>
          ) : (
            shops.map((shop, i) => (
              <Link
                key={i}
                href={shop.url}
                className="px-5 py-2 rounded-full border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition shadow-sm"
              >
                {shop.name}
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
