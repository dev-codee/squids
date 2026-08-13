"use client";

import { useState } from "react";
import type { CouponItem } from "@/lib/storeData";

interface CouponCardProps {
  coupon: CouponItem;
  storeName: string;
}

export default function CouponCard({ coupon, storeName }: CouponCardProps) {
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const merchantUrl =
    coupon.affiliateUrl || `https://www.${storeName.toLowerCase()}.com`;

  const openMerchant = () => {
    // Open the affiliate link in a new tab; the user stays on this page.
    window.open(merchantUrl, "_blank", "noopener,noreferrer");
  };

  const handleReveal = () => {
    if (coupon.code) {
      navigator.clipboard.writeText(coupon.code).catch(() => {});
      setCopied(true);
      setRevealed(true);
      setShowModal(true);
      setTimeout(() => setCopied(false), 3000);
    }
    // Reveal the code here and send the shopper to the store in a new tab.
    openMerchant();
  };

  return (
    <>
      <div
        className={`group relative flex flex-col justify-between rounded-2xl border p-6 shadow-sm transition hover:shadow-md ${
          coupon.isExclusive
            ? "border-purple-300 bg-gradient-to-br from-purple-50/70 to-white ring-2 ring-purple-300/60 hover:border-purple-400"
            : "border-gray-200 bg-white hover:border-amber-300"
        }`}
      >
        {coupon.isExclusive && (
          <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-md">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.447a1 1 0 00-.364 1.118l1.287 3.958c.3.922-.755 1.688-1.54 1.118l-3.367-2.447a1 1 0 00-1.176 0l-3.367 2.447c-.784.57-1.838-.196-1.539-1.118l1.286-3.958a1 1 0 00-.363-1.118L2.343 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.951-.69l1.285-3.958z" />
            </svg>
            Exclusive
          </span>
        )}
        <div>
          {/* Header Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              {coupon.discount && (
                <span className="inline-flex items-center rounded-lg bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                  {coupon.discount}
                </span>
              )}
              {coupon.type === "student" && (
                <span className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
                  Student Perk
                </span>
              )}
              {coupon.type === "cashback" && (
                <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                  Cashback Offer
                </span>
              )}
            </div>

            {coupon.verified && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Verified
              </span>
            )}
          </div>

          {/* Title & Description */}
          <h3 className="text-lg font-bold text-gray-900 group-hover:text-amber-600 transition-colors">
            {coupon.title}
          </h3>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            {coupon.description}
          </p>

          {/* Special requirement tag if student or cashback */}
          {coupon.studentVerificationReq && (
            <div className="mt-3 rounded-lg bg-blue-50/70 p-2.5 text-xs text-blue-800 flex items-center gap-1.5">
              <svg className="h-4 w-4 flex-shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
              Requirements: {coupon.studentVerificationReq}
            </div>
          )}

          {coupon.cashbackRate && (
            <div className="mt-3 rounded-lg bg-emerald-50/70 p-2.5 text-xs text-emerald-800 flex items-center gap-1.5">
              <svg className="h-4 w-4 flex-shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Rate: {coupon.cashbackRate}
            </div>
          )}
        </div>

        {/* Footer info & Copy Code Button */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-gray-500">
            {coupon.verified && <span className="font-medium text-emerald-600">Active</span>}
            {coupon.verified && coupon.expiryDate && <span className="mx-1.5">•</span>}
            {coupon.expiryDate && (
              <span>
                Expires{" "}
                {new Date(coupon.expiryDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>

          {coupon.code ? (
            <button
              onClick={handleReveal}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-amber-500 active:scale-95 shadow-sm"
            >
              <span className="tracking-widest font-mono uppercase bg-gray-800 px-2 py-0.5 rounded text-amber-400">
                {revealed ? coupon.code : (coupon.code.length > 3 ? coupon.code.slice(0, 3) + "***" : "***")}
              </span>
              <span>{copied ? "Copied!" : revealed ? "Copy Code" : "Show Code"}</span>
            </button>
          ) : (
            <a
              href={merchantUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-amber-600"
            >
              Get Deal
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Code Reveal Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900">Promo Code Copied!</h3>
            <p className="mt-1 text-sm text-gray-500">{coupon.title}</p>

            <div className="my-5 rounded-xl bg-amber-50 border-2 border-dashed border-amber-300 p-4">
              <span className="text-2xl font-mono font-extrabold tracking-widest text-amber-900">
                {coupon.code}
              </span>
            </div>

            <p className="text-xs text-gray-500 mb-6">
              Paste this code during checkout at {storeName}.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <a
                href={merchantUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 text-center"
              >
                Go to {storeName}
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
