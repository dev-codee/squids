"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSavedItems } from "@/lib/savedItems";
import { useCurrency } from "@/i18n/CurrencyProvider";
import { useDictionary } from "@/i18n/DictionaryProvider";
import Breadcrumbs from "@/components/store/Breadcrumbs";

export default function SavedProductsPage() {
  const params = useParams();
  const lc = (typeof params?.country === "string" ? params.country : "us").toLowerCase();
  const { items, toggle, isReady } = useSavedItems();
  const { format } = useCurrency();
  const dict = useDictionary();
  const t = dict.categoryV2 as Record<string, string>;

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <div className="mx-auto max-w-shell px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: dict.header.home, href: `/${lc}` },
            { label: "Saved Products" },
          ]}
        />

        <header className="mt-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Saved Products
          </h1>
          <p className="mt-2 text-base text-ink-soft">
            Products you bookmarked to track prices and compare later without needing an account.
          </p>
        </header>

        {!isReady ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-card border border-line bg-white" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-card border border-dashed border-line-strong bg-white p-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </span>
            <h2 className="mt-4 text-base font-bold text-ink">No saved products yet</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Click the bookmark icon on any product comparison card to save it here.
            </p>
            <Link
              href={`/${lc}/categories`}
              className="mt-5 inline-block rounded-[9px] bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover"
            >
              Browse categories
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <article
                key={item.id}
                className="group relative flex flex-col overflow-hidden rounded-card border border-line bg-white shadow-card transition hover:shadow-card-hover"
              >
                <div className="relative flex h-44 items-center justify-center bg-canvas-sunk p-4">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="max-h-full max-w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-sm text-ink-muted">{item.title.charAt(0)}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => toggle(item)}
                    aria-label="Remove from saved"
                    title="Remove"
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-brand shadow-sm hover:bg-canvas"
                  >
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">
                    {item.title}
                  </h3>
                  {item.size && (
                    <p className="mt-1 text-xs font-medium text-brand">{item.size}</p>
                  )}
                  {item.category && (
                    <p className="mt-0.5 text-xs text-ink-muted">{item.category}</p>
                  )}

                  {typeof item.salePrice === "number" && (
                    <p className="mt-3 text-lg font-bold text-ink">{format(item.salePrice)}</p>
                  )}

                  <div className="mt-auto pt-4">
                    <Link
                      href={`/${lc}/product/${item.id}`}
                      className="block rounded-[9px] bg-brand px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
                    >
                      {t.comparePrices || "Compare prices"}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
