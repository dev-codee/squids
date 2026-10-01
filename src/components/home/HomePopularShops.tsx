"use client";

import Link from "next/link";
import type { PopularShopData } from "@/lib/db/deals";
import { cleanAdvertiserName, storeSlug } from "@/lib/networks";
import { useDictionary } from "@/i18n/DictionaryProvider";
import HomeSection from "./HomeSection";

/** Popular stores row — logo tiles with the live offer count. */
export default function HomePopularShops({
  shops,
  country,
}: {
  shops: PopularShopData[];
  country: string;
}) {
  const dict = useDictionary();
  if (!shops || shops.length === 0) return null;

  return (
    <HomeSection
      title={dict.home.popularShopsTitle}
      action={dict.header.stores}
      actionHref={`/${country.toLowerCase()}/stores`}
      tone="canvas"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {shops.slice(0, 8).map((shop) => {
          const name = cleanAdvertiserName(shop.name);
          return (
            <Link
              key={`${shop.network}-${shop.id}`}
              href={`/${country.toLowerCase()}/${storeSlug(name)}`}
              className="group flex h-28 flex-col items-center justify-center gap-2 rounded-card border border-line bg-white p-3 transition hover:border-brand-border hover:shadow-card"
            >
              <span className="flex h-10 w-full items-center justify-center overflow-hidden">
                {shop.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shop.logoUrl}
                    alt={`${name} logo`}
                    className="max-h-full max-w-[85%] object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center text-xs font-semibold text-ink group-hover:text-brand">
                {name}
              </span>
              <span className="text-[10px] font-medium text-ink-muted">
                {shop.dealCount} {dict.home.dealsLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </HomeSection>
  );
}
