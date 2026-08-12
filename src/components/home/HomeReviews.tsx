"use client";

import type { HomeReview } from "@/lib/db/homeSettings";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1 text-amber-400">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-4 h-4 ${star <= rating ? "fill-current" : "text-gray-300 fill-current"}`}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function HomeReviews({ reviews }: { reviews: HomeReview[] }) {
  return (
    <section className="py-12 bg-[#F9F9F9]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Promo codes and deals - they really work!
        </h2>
        <p className="mt-2 text-gray-600">These people have already verified that:</p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {(!reviews || reviews.length === 0) ? (
            <div className="col-span-1 md:col-span-3 text-center text-gray-500 py-8 border border-dashed border-gray-300 rounded-lg bg-white">
              No reviews available yet. Add some in the dashboard!
            </div>
          ) : (
            reviews.slice(0, 3).map((review, i) => (
              <div key={i} className="bg-white p-6 rounded shadow-sm border border-gray-100 flex flex-col h-full">
                <div className="font-bold text-gray-900 text-lg">{review.author}</div>
                <div className="mt-2">
                  <StarRating rating={review.rating} />
                </div>
                <p className="mt-4 text-sm text-gray-600 leading-relaxed flex-1">
                  {review.comment}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
