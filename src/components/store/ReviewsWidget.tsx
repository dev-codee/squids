"use client";

import type { StoreReviewItem } from "@/lib/storeData";
import { useDictionary } from "@/i18n/DictionaryProvider";

interface ReviewsWidgetProps {
  reviews: StoreReviewItem[];
  rating: number;
  totalReviews: number;
  storeName: string;
}

export default function ReviewsWidget({
  reviews,
  rating,
  totalReviews,
  storeName,
}: ReviewsWidgetProps) {
  const dict = useDictionary();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            {dict.reviewsWidget.title.replace("{store}", storeName)}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {dict.reviewsWidget.subtitle.replace("{store}", storeName)}
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3">
          <span className="text-3xl font-extrabold text-amber-900">{rating}</span>
          <div>
            <div className="flex text-amber-400 text-sm">
              {"★".repeat(Math.floor(rating))}
              {"☆".repeat(5 - Math.floor(rating))}
            </div>
            <p className="text-xs text-amber-800 font-medium">
              {dict.reviewsWidget.basedOnRatings.replace("{count}", totalReviews.toLocaleString())}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {reviews.map((rev) => (
          <div
            key={rev.id}
            className="flex flex-col justify-between rounded-xl border border-gray-100 bg-gray-50/50 p-4"
          >
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-gray-900">{rev.author}</span>
                <span className="text-gray-400">{rev.date}</span>
              </div>
              <div className="flex text-amber-400 text-xs mb-2">
                {"★".repeat(rev.rating)}
              </div>
              <h4 className="text-sm font-bold text-gray-900">{rev.title}</h4>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                "{rev.comment}"
              </p>
            </div>

            {rev.verifiedBuyer && (
              <div className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {dict.reviewsWidget.verifiedSavingsUser}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
