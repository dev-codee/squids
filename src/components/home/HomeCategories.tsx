"use client";

import Link from "next/link";
import type { HomeCategory } from "@/lib/db/homeSettings";

export default function HomeCategories({ categories }: { categories: HomeCategory[] }) {
  return (
    <section className="py-12 bg-[#F9F9F9]">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-xl font-bold text-gray-900">Categories</h2>
        <p className="mt-2 text-sm text-gray-500 mb-8">Save money every time - on any purchase!</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-left">
          {(!categories || categories.length === 0) ? (
            <div className="col-span-2 sm:col-span-3 lg:col-span-4 text-center text-gray-500 py-6 border border-dashed border-gray-300 rounded-lg">
              No categories added yet.
            </div>
          ) : (
            categories.map((cat, i) => (
              <Link
                key={i}
                href={cat.url}
                className="flex items-center gap-3 p-3 rounded hover:bg-white transition"
              >
                <div className="text-gray-400 text-lg w-6 text-center">
                  {cat.iconName}
                </div>
                <span className="text-sm font-semibold text-gray-700 hover:text-amber-500 transition">
                  {cat.name}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
