"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { Product } from "@/lib/products";
import { useCurrency } from "@/i18n/CurrencyProvider";
import { useDictionary } from "@/i18n/DictionaryProvider";
import { useSavedItems } from "@/lib/savedItems";

/**
 * Category product card.
 *
 * Shows the name, the variant we actually hold, the item price and its basis,
 * and two distinct actions. Deliberately carries no star rating and no
 * "was/now" saving unless the feed supplies a real original price — the brief
 * forbids inventing either.
 */
export default function CompareProductCard({ product }: { product: Product }) {
  const dict = useDictionary();
  const t = dict.categoryV2 as Record<string, string>;
  const { format } = useCurrency();
  const params = useParams();
  const lc = (typeof params?.country === "string" ? params.country : "us").toLowerCase();
  const { isSaved, toggle } = useSavedItems();

  const saved = isSaved(product.id);
  const sale = product.salePrice;
  const href = product.trackingUrl || undefined;
  const compareHref = `/${lc}/product/${product.id}`;

  const variantDetails = [
    product.brand,
    product.size,
    product.packCount && product.packCount > 1 ? `${product.packCount}-pack` : null,
    product.condition && product.condition !== "unknown" ? product.condition : null,
  ].filter(Boolean);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-card border border-line bg-white shadow-card transition hover:shadow-card-hover">
      <div className="relative flex h-44 items-center justify-center bg-canvas-sunk p-4">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.title}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
          />
        ) : (
          <span className="text-sm text-ink-muted">{product.title.charAt(0)}</span>
        )}
        <span
          className={`absolute left-3 top-3 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
            product.inStock
              ? "bg-white text-ink-soft"
              : "bg-canvas text-ink-muted"
          }`}
        >
          {product.inStock ? t.inStock : t.outOfStock}
        </span>

        {/* Save item bookmark button */}
        <button
          type="button"
          onClick={() =>
            toggle({
              id: product.id,
              title: product.title,
              imageUrl: product.imageUrl,
              salePrice: product.salePrice,
              currency: product.currency,
              category: product.category,
              brand: product.brand,
              size: product.size,
            })
          }
          aria-label={saved ? t.savedItemActive || "Saved" : t.savedItem || "Save"}
          title={saved ? t.savedItemActive || "Saved" : t.savedItem || "Save"}
          className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition ${
            saved
              ? "border-brand bg-brand text-white"
              : "border-line bg-white text-ink-muted hover:border-brand hover:text-brand"
          }`}
        >
          <svg className="h-4 w-4" fill={saved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">
          {product.title}
        </h3>
        
        {variantDetails.length > 0 && (
          <p className="mt-1 text-xs font-medium text-brand">
            {variantDetails.join(" · ")}
          </p>
        )}

        <p className="mt-0.5 text-xs text-ink-muted">{t.multipleRetailers}</p>
        {product.category && (
          <p className="mt-0.5 text-xs text-ink-muted">{product.category}</p>
        )}

        {typeof sale === "number" && (
          <>
            <p className="mt-2.5 text-lg font-bold text-ink">{format(sale, product.currency)}</p>
            <p className="mt-0.5 text-[11px] text-ink-muted">{t.priceBasis}</p>
          </>
        )}

        <div className="mt-auto space-y-2 pt-3">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="nofollow noopener noreferrer sponsored"
              className="block text-sm font-semibold text-brand underline-offset-2 hover:underline"
            >
              {t.viewCurrentPrice} →
            </a>
          ) : (
            <span className="block text-sm font-semibold text-ink-muted">
              {t.viewCurrentPrice}
            </span>
          )}
          {/* Comparison lives on our own product page, not the retailer's. */}
          <Link
            href={compareHref}
            className="block rounded-[9px] bg-brand px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
          >
            {t.comparePrices}
          </Link>
        </div>
      </div>
    </article>
  );
}
