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
      <div
        className={`relative flex flex-col sm:flex-row rounded-lg border overflow-hidden shadow-sm transition hover:shadow-md group ${
          coupon.isExclusive
            ? "border-purple-300 bg-gradient-to-r from-purple-50/70 to-white ring-2 ring-purple-300/60 hover:border-purple-400"
            : "border-gray-200 bg-white hover:border-emerald-300"
        }`}
      >
        {coupon.isExclusive && (
          <span className="absolute top-0 left-0 z-10 inline-flex items-center gap-1 rounded-br-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.447a1 1 0 00-.364 1.118l1.287 3.958c.3.922-.755 1.688-1.54 1.118l-3.367-2.447a1 1 0 00-1.176 0l-3.367 2.447c-.784.57-1.838-.196-1.539-1.118l1.286-3.958a1 1 0 00-.363-1.118L2.343 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.951-.69l1.285-3.958z" />
            </svg>
            Exclusive
          </span>
        )}

        {/* Left Section - Discount Indicator */}
        <div className="sm:w-[15%] w-full bg-red-50/50 border-b sm:border-b-0 sm:border-r border-gray-100 flex flex-col items-center justify-center p-4 min-w-[120px]">
          <span className="text-xl font-extrabold text-gray-800 text-center leading-tight mb-2">
            {coupon.discount || dict.common.deal}
          </span>
          <span className="bg-red-100 text-red-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded shadow-sm tracking-wider">
            {coupon.code
              ? coupon.type === "code"
                ? dict.common.code
                : coupon.type
              : dict.common.deal}
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
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700 ring-1 ring-inset ring-purple-600/20">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.447a1 1 0 00-.364 1.118l1.287 3.958c.3.922-.755 1.688-1.54 1.118l-3.367-2.447a1 1 0 00-1.176 0l-3.367 2.447c-.784.57-1.838-.196-1.539-1.118l1.286-3.958a1 1 0 00-.363-1.118L2.343 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.951-.69l1.285-3.958z" />
                </svg>
                {dict.cards.exclusive}
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
              <span className="relative z-10">{copied ? dict.cards.copied : revealed ? coupon.code : dict.cards.showCouponCode}</span>
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
                {dict.cards.expires}:{" "}
                {new Date(coupon.expiryDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "numeric",
                  year: "2-digit",
                })}
              </span>
            ) : (
              <span>{dict.cards.active}</span>
            )}
          </div>
          {coupon.updatedAt && (
            <div className="mt-0.5 text-[10px] text-gray-400 text-center">
              {dict.cards.updated}:{" "}
              {new Date(coupon.updatedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "numeric",
                year: "2-digit",
              })}
            </div>
          )}
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
            <h3 className="text-xl font-bold text-gray-900">{dict.cards.promoCodeCopied}</h3>
            <p className="mt-1 text-sm text-gray-500">{coupon.title}</p>

            <div className="my-5 rounded-xl bg-amber-50 border-2 border-dashed border-amber-300 p-4">
              <span className="text-2xl font-mono font-extrabold tracking-widest text-amber-900">
                {coupon.code}
              </span>
            </div>

            <p className="text-xs text-gray-500 mb-6">
              {dict.cards.pasteCode.replace("{store}", storeName)}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {dict.cards.close}
              </button>
              <a
                href={merchantUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 text-center"
              >
                {dict.cards.goTo.replace("{store}", storeName)}
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
