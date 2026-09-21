"use client";

import type { CouponVerification } from "@/lib/db/coupon-verifications";

interface LastVerifiedSectionProps {
  verifications: CouponVerification[];
  storeName: string;
}

function StatusBadge({ status }: { status: CouponVerification["status"] }) {
  const map = {
    working: "bg-emerald-100 text-emerald-700 ring-emerald-600/20",
    failed: "bg-red-100 text-red-700 ring-red-600/20",
    expired: "bg-gray-100 text-gray-600 ring-gray-500/20",
  };
  const label = { working: "Working", failed: "Failed", expired: "Expired" };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${map[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "working" ? "bg-emerald-500" : status === "failed" ? "bg-red-500" : "bg-gray-400"
        }`}
      />
      {label[status]}
    </span>
  );
}

function VerificationCard({ v }: { v: CouponVerification }) {
  const date = new Date(v.verifiedAt);
  const formattedDate = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Screenshot */}
      {v.screenshotUrl ? (
        <div className="relative h-40 w-full bg-gray-100 overflow-hidden">
          <img
            src={v.screenshotUrl}
            alt={`Checkout verification screenshot for ${v.storeName}`}
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-2 left-3">
            <StatusBadge status={v.status} />
          </div>
        </div>
      ) : (
        <div className="h-28 w-full bg-gray-50 flex items-center justify-center border-b border-gray-100">
          <div className="text-center">
            <svg className="mx-auto h-8 w-8 text-gray-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <StatusBadge status={v.status} />
          </div>
        </div>
      )}

      {/* Info */}
      <div className="p-4 space-y-2">
        {v.couponCode && (
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1">
            <svg className="h-3.5 w-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span className="font-mono text-xs font-bold text-amber-800 tracking-wide">
              {v.couponCode}
            </span>
          </div>
        )}

        {v.discountApplied && (
          <p className="text-sm font-semibold text-emerald-700">{v.discountApplied}</p>
        )}

        {v.cartTotal && (
          <p className="text-xs text-gray-500">
            Cart total: <span className="font-semibold text-gray-700">{v.cartTotal}</span>
          </p>
        )}

        {v.notes && (
          <p className="text-xs text-gray-500 leading-relaxed">{v.notes}</p>
        )}

        <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="font-medium text-gray-700">{v.verifiedBy}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formattedDate} · {formattedTime}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LastVerifiedSection({
  verifications,
  storeName,
}: LastVerifiedSectionProps) {
  if (!verifications.length) return null;

  return (
    <section className="mt-12 pt-10 border-t border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <h2 className="text-xl font-bold text-gray-900">
              Last Verified Coupons
            </h2>
          </div>
          <p className="text-sm text-gray-500">
            Our team tested these {storeName} coupons at checkout and took a screenshot as proof.
          </p>
        </div>
        <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          {verifications.length} tested
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {verifications.map((v) => (
          <VerificationCard key={`${v.couponId}-${v.storeSlug}`} v={v} />
        ))}
      </div>

      <p className="mt-4 text-[11px] text-gray-400 text-center">
        Screenshots are taken by Foxzil staff or automated verification bot. Discounts may vary based on cart contents and region.
      </p>
    </section>
  );
}
