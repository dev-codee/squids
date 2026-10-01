"use client";

import Link from "next/link";
import type { HomeCategory } from "@/lib/db/homeSettings";
import { useDictionary } from "@/i18n/DictionaryProvider";
import HomeSection from "./HomeSection";

export interface HomeCategoryTile {
  name: string;
  slug: string;
  icon: string;
  storeCount?: number;
}

/**
 * "Shop by category" — icon tiles across the content width.
 *
 * Categories are resolved on the server and passed in. They used to be fetched
 * in an effect, which meant the crawlable HTML for this section was the string
 * "Loading categories…" rather than the category links themselves.
 */
export default function HomeCategories({
  categories,
  fallback,
  country,
}: {
  /** Resolved categories for the current market, rendered as-is. */
  categories: HomeCategoryTile[];
  /** Admin-curated list used when the market has no matching categories. */
  fallback?: HomeCategory[];
  country: string;
}) {
  const dict = useDictionary();
  const lc = country.toLowerCase();

  const tiles: HomeCategoryTile[] =
    categories.length > 0
      ? categories
      : (fallback ?? []).map((c) => ({
          name: c.name,
          slug: c.url?.split("/").pop() || c.name.toLowerCase(),
          icon: c.iconName || "\u{1F3F7}\uFE0F",
        }));

  if (tiles.length === 0) return null;

  return (
    <HomeSection
      title={dict.homeV2.categoriesTitle}
      action={dict.home.viewAllCategories}
      actionHref={`/${lc}/categories`}
      tone="white"
    >
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {tiles.slice(0, 12).map((cat) => (
          <Link
            key={cat.slug}
            href={`/${lc}/category/${cat.slug}`}
            className="group flex flex-col items-center gap-2 rounded-card border border-line bg-white px-3 py-5 text-center transition hover:border-brand-border hover:shadow-card"
          >
            <span
              aria-hidden
              className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas-sunk text-xl transition-colors group-hover:bg-brand-soft"
            >
              {cat.icon || "\u{1F3F7}\uFE0F"}
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
    </HomeSection>
  );
}
