"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { HomeCategory } from "@/lib/db/homeSettings";
import { useDictionary } from "@/i18n/DictionaryProvider";
import HomeSection from "./HomeSection";

interface MasterCategory {
  id?: string;
  name: string;
  slug: string;
  icon: string;
  storeCount?: number;
  dealCount?: number;
}

/** "Shop by category" — icon tiles across the content width. */
export default function HomeCategories({
  categories: initialCategories,
}: {
  categories?: HomeCategory[];
}) {
  const dict = useDictionary();
  const params = useParams();
  const country = (params?.country as string) || "us";
  const [categories, setCategories] = useState<MasterCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/categories?country=${encodeURIComponent(country)}`)
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
            })),
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [initialCategories, country]);

  return (
    <HomeSection
      title={dict.homeV2.categoriesTitle}
      action={dict.home.viewAllCategories}
      actionHref={`/${country.toLowerCase()}/categories`}
      tone="white"
    >
      {loading ? (
        <div className="py-8 text-sm text-ink-muted">{dict.home.loadingCategories}</div>
      ) : categories.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong bg-canvas py-10 text-center text-sm text-ink-muted">
          {dict.home.noCategoriesYet}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {categories.slice(0, 12).map((cat) => (
            <Link
              key={cat.slug}
              href={`/${country.toLowerCase()}/category/${cat.slug}`}
              className="group flex flex-col items-center gap-2 rounded-card border border-line bg-white px-3 py-5 text-center transition hover:border-brand-border hover:shadow-card"
            >
              <span
                aria-hidden
                className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas-sunk text-xl transition-colors group-hover:bg-brand-soft"
              >
                {cat.icon || "🏷️"}
              </span>
              <span className="w-full truncate text-xs font-semibold text-ink group-hover:text-brand">
                {(dict.categoryNames as Record<string, string>)[cat.name] ?? cat.name}
              </span>
              {typeof cat.storeCount === "number" && (
                <span className="text-[10px] font-medium text-ink-muted">
                  {cat.storeCount}{" "}
                  {cat.storeCount === 1 ? dict.home.store : dict.home.stores}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </HomeSection>
  );
}
