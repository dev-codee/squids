"use client";

import Link from "next/link";
import type { Product } from "@/lib/products";
import { useCurrency } from "@/i18n/CurrencyProvider";
import { useDictionary } from "@/i18n/DictionaryProvider";
import HomeSection from "./HomeSection";

/**
 * "Compare before you buy" — the product comparison row from the hero's
 * Products tab. Renders nothing when the region has no products, so the section
 * simply disappears instead of showing an empty shelf.
 */
export default function HomeProducts({
  products,
  country,
}: {
  products: Product[];
  country: string;
}) {
  const lc = country.toLowerCase();
  const dict = useDictionary();
  const t = dict.homeV2;
  const { format } = useCurrency();

  if (!products.length) return null;

  return (
    <HomeSection title={t.productsTitle} tone="canvas">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const sale = p.salePrice;

          return (
            <article
              key={p.id}
              className="flex flex-col overflow-hidden rounded-card border border-line bg-white shadow-card transition hover:shadow-card-hover"
            >
              <div className="relative flex h-44 items-center justify-center bg-canvas-sunk p-4">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-sm text-ink-muted">{p.title.charAt(0)}</span>
                )}
              </div>

              <div className="flex flex-1 flex-col p-4">
                <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">
                  {p.title}
                </h3>
                {p.category && (
                  <p className="mt-1.5 text-xs text-ink-muted">{p.category}</p>
                )}

                {typeof sale === "number" && (
                  <p className="mt-3 text-lg font-bold text-ink">{format(sale, p.currency)}</p>
                )}

                <Link
                  href={`/${lc}/product/${p.id}`}
                  className="mt-auto block rounded-[9px] bg-brand px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
                >
                  {t.checkOffers}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </HomeSection>
  );
}
