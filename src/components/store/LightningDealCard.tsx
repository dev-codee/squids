"use client";

import { useEffect, useState } from "react";
import type { DealItem } from "@/lib/storeData";
import { useDictionary } from "@/i18n/DictionaryProvider";

interface LightningDealCardProps {
  deal: DealItem;
}

export default function LightningDealCard({ deal }: LightningDealCardProps) {
  const dict = useDictionary();
  const [timeLeft, setTimeLeft] = useState<number>(deal.endsInSeconds || 14400);

  useEffect(() => {
    if (!timeLeft) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-amber-300">
      <div>
        {/* Deal Image & Badge Header */}
        <div className="relative mb-4 h-48 w-full overflow-hidden rounded-xl bg-gray-100">
          {deal.imageUrl ? (
            <img
              src={deal.imageUrl}
              alt={deal.title}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              No Image
            </div>
          )}

          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {deal.discount && (
              <span className="inline-flex rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white shadow">
                {deal.discount}
              </span>
            )}
            {deal.badge && (
              <span className="inline-flex rounded-lg bg-gray-900/90 px-2 py-0.5 text-[10px] font-semibold text-amber-300 backdrop-blur-sm">
                {deal.badge}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className="text-base font-bold text-gray-900 line-clamp-2">
          {deal.title}
        </h4>
        <p className="mt-1 text-xs text-gray-500 line-clamp-2">{deal.description}</p>

        {/* Price & Savings */}
        <div className="mt-3 flex items-baseline gap-2">
          {deal.salePrice && (
            <span className="text-xl font-extrabold text-gray-900">{deal.salePrice}</span>
          )}
          {deal.originalPrice && (
            <span className="text-xs text-gray-400 line-through">{deal.originalPrice}</span>
          )}
        </div>

        {/* Lightning Claim Progress Bar */}
        {deal.stockPercentage !== undefined && (
          <div className="mt-4">
            <div className="flex justify-between text-xs font-medium text-gray-600 mb-1">
              <span>{dict.cards.claimed}</span>
              <span className="font-bold text-amber-600">{deal.stockPercentage}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                style={{ width: `${deal.stockPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Countdown Timer */}
        {deal.type === "lightning" && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {dict.cards.endsIn}
            </span>
            <span className="font-mono font-bold text-red-900 tracking-wider">
              {formatTime(timeLeft)}
            </span>
          </div>
        )}
      </div>

      {/* Buy/Get Deal Button */}
      <a
        href={deal.affiliateUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-amber-600 active:scale-95"
      >
        {dict.cards.grabThisDeal}
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </a>
    </div>
  );
}
