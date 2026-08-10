"use client";

import type { ProductFeedItem } from "@/lib/storeData";

interface ProductFeedCardProps {
  product: ProductFeedItem;
}

export default function ProductFeedCard({ product }: ProductFeedCardProps) {
  return (
    <div className="group flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-amber-400 hover:shadow-md">
      <div>
        {/* Product Image */}
        <div className="relative mb-3 h-44 w-full overflow-hidden rounded-xl bg-gray-50">
          <img
            src={product.image}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute top-2 right-2 rounded-lg bg-red-600 px-2 py-0.5 text-xs font-bold text-white shadow">
            -{product.discountPercentage}%
          </span>
          <span className="absolute top-2 left-2 rounded-lg bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-gray-700 backdrop-blur-sm">
            {product.category}
          </span>
        </div>

        {/* Title */}
        <h4 className="text-sm font-bold text-gray-900 group-hover:text-amber-600 line-clamp-2">
          {product.title}
        </h4>

        {/* Rating & Reviews */}
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
          <span className="text-amber-400 font-bold">★ {product.rating}</span>
          <span>({product.reviewsCount.toLocaleString()})</span>
        </div>

        {/* Price */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-extrabold text-gray-900">
            ${product.salePrice.toFixed(2)}
          </span>
          <span className="text-xs text-gray-400 line-through">
            ${product.originalPrice.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Buy Now Button */}
      <a
        href={product.affiliateUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-2 px-4 text-xs font-bold text-white transition hover:bg-amber-500"
      >
        View Product
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}
