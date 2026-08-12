"use client";

import { useState } from "react";
import type { CouponItem } from "@/lib/storeData";
import { useDictionary } from "@/i18n/DictionaryProvider";

interface HorizontalCouponCardProps {
  coupon: CouponItem;
  storeName: string;
}

export default function HorizontalCouponCard({ coupon, storeName }: HorizontalCouponCardProps) {
  const dict = useDictionary();
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const merchantUrl =
    coupon.affiliateUrl || `https://www.${storeName.toLowerCase()}.com`;

  const openMerchant = () => {
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
    openMerchant();
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm transition hover:shadow-md hover:border-emerald-300 group">
        
        {/* Left Section - Discount Indicator */}
        <div className="sm:w-[15%] w-full bg-red-50/50 border-b sm:border-b-0 sm:border-r border-gray-100 flex flex-col items-center justify-center p-4 min-w-[120px]">
          <span className="text-xl font-extrabold text-gray-800 text-center leading-tight mb-2">
            {coupon.discount || "DEAL"}
          </span>
          <span className="bg-red-100 text-red-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded shadow-sm tracking-wider">
            {coupon.type === "code" ? "CODE" : coupon.type}
          </span>
        </div>

        {/* Middle Section - Details */}
        <div className="flex-1 p-5 flex flex-col justify-center">
          <h3 className="text-lg font-bold text-gray-900 leading-snug group-hover:text-emerald-700 transition-colors">
            {coupon.title}
          </h3>
          <p className="mt-1 text-sm text-gray-600 line-clamp-2">
            {coupon.description}
          </p>
          
          <div className="mt-3 flex items-center gap-2">
            {coupon.verified && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {dict.cards.verified}
              </span>
            )}
            {coupon.isExclusive && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600">
                Exclusive
              </span>
            )}
          </div>
        </div>

        {/* Right Section - Action */}
        <div className="sm:w-[25%] w-full p-5 flex flex-col items-center justify-center border-t sm:border-t-0 sm:border-l border-gray-100 min-w-[200px]">
          {coupon.code ? (
            <button
              onClick={handleReveal}
              className="w-full relative inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600 shadow-sm overflow-hidden"
            >
              <span className="relative z-10">{copied ? "Copied!" : revealed ? coupon.code : dict.cards.showCouponCode}</span>
              {!revealed && (
                <div className="absolute right-0 top-0 h-full w-8 bg-emerald-700 clip-reveal flex items-center justify-center">
                  <span className="text-[10px]">*</span>
                </div>
              )}
            </button>
          ) : (
            <a
              href={merchantUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600 shadow-sm"
            >
              {dict.cards.getDeal}
            </a>
          )}
          
          <div className="mt-2 text-[11px] text-gray-500 text-center">
            {coupon.expiryDate ? (
              <span>
                Expires:{" "}
                {new Date(coupon.expiryDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "numeric",
                  year: "2-digit",
                })}
              </span>
            ) : (
              <span>Expires: Ongoing</span>
            )}
          </div>
        </div>
      </div>

      {/* Code Reveal Modal (same as original CouponCard) */}
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
