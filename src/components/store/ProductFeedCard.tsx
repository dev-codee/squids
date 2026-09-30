"use client";

import type { ProductFeedItem } from "@/lib/storeData";
import { useCurrency } from "@/i18n/CurrencyProvider";

interface ProductFeedCardProps {
  product: ProductFeedItem;
}

export default function ProductFeedCard({ product }: ProductFeedCardProps) {
  const { format } = useCurrency();
  return (
    <div className="group flex flex-col justify-between rounded-2xl border border-line bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md">
      <div>
        {/* Product Image */}
        <div className="relative mb-3 h-44 w-full overflow-hidden rounded-xl bg-canvas">
          <img
            src={product.image}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute top-2 right-2 rounded-lg bg-red-600 px-2 py-0.5 text-xs font-bold text-white shadow">
            -{product.discountPercentage}%
          </span>
          <span className="absolute top-2 left-2 rounded-lg bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink-soft backdrop-blur-sm">
            {product.category}
          </span>
        </div>

        {/* Title */}
        <h4 className="text-sm font-bold text-ink group-hover:text-brand-hover line-clamp-2">
          {product.title}
        </h4>

        {/* Rating & Reviews */}
        <div className="mt-2 flex items-center gap-1 text-xs text-ink-soft">
          <span className="text-brand font-bold">★ {product.rating}</span>
          <span>({product.reviewsCount.toLocaleString()})</span>
        </div>

        {/* Price */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-extrabold text-ink">
            {format(product.salePrice)}
          </span>
          <span className="text-xs text-ink-muted line-through">
            {format(product.originalPrice)}
          </span>
        </div>
      </div>

      {/* Buy Now Button */}
      <a
        href={product.affiliateUrl}
        target="_blank"
        rel="nofollow noopener noreferrer sponsored"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-2 px-4 text-xs font-bold text-white transition hover:bg-brand"
      >
        View Product
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}
