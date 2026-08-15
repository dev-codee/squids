"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { HomeCategory } from "@/lib/db/homeSettings";

interface MasterCategory {
  id?: string;
  name: string;
  slug: string;
  icon: string;
  storeCount?: number;
  dealCount?: number;
}

export default function HomeCategories({ categories: initialCategories }: { categories?: HomeCategory[] }) {
  const params = useParams();
  const country = (params?.country as string) || "us";
  const [categories, setCategories] = useState<MasterCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.categories && data.categories.length > 0) {
          setCategories(data.categories);
        } else if (initialCategories && initialCategories.length > 0) {
          setCategories(
            initialCategories.map((c) => ({
              name: c.name,
              slug: c.url?.split("/").pop() || c.name.toLowerCase(),
              icon: c.iconName || "🏷️",
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [initialCategories]);

  return (
    <section className="py-12 bg-[#F9F9F9]">
      <div className="max-w-5xl mx-auto px-4 text-center">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold text-gray-900">Explore by Category</h2>
            <p className="mt-1 text-sm text-gray-500">Save money every time - on any purchase!</p>
          </div>
          <Link
            href={`/${country.toLowerCase()}/categories`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover"
          >
            View All Categories <span aria-hidden>→</span>
          </Link>
        </div>

        {loading ? (
          <div className="py-8 text-sm text-gray-400">Loading categories…</div>
        ) : categories.length === 0 ? (
          <div className="py-8 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg text-sm">
            No categories added yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 text-left">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/${country.toLowerCase()}/category/${cat.slug}`}
                className="group flex flex-col justify-between p-4 rounded-xl border border-gray-200 bg-white shadow-xs hover:border-accent/40 hover:shadow-sm transition"
              >
                <div>
                  <span className="block truncate text-xs font-bold text-gray-800 group-hover:text-accent transition">
                    {cat.name}
                  </span>
                </div>
                {typeof cat.storeCount === "number" && (
                  <span className="mt-2 block text-[10px] text-gray-400 font-medium">
                    {cat.storeCount} {cat.storeCount === 1 ? "store" : "stores"}
                  </span>
                )}
              </Link>
            ))}

          </div>
        )}
      </div>
    </section>
  );
}

