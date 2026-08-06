"use client";

import { useState } from "react";
import type { Deal } from "@/lib/deals";

/** How many days until a date, or null if unparseable / already past. */
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.ceil(
    (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  return diff >= 0 ? diff : null;
}

function ExpiryBadge({ endDate }: { endDate: string | null }) {
  const days = daysUntil(endDate);
  if (days === null) return null;

  let colorClass = "text-gray-500";
  let label = `Expires in ${days} day${days !== 1 ? "s" : ""}`;

  if (days <= 2) {
    colorClass = "text-red-600";
    label = days === 0 ? "Expires today" : `Expires in ${days} day${days !== 1 ? "s" : ""}`;
  } else if (days <= 7) {
    colorClass = "text-amber-600";
  }

  return (
    <span className={`text-xs font-medium ${colorClass}`}>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="mr-1 inline-block"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      {label}
    </span>
  );
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 px-3 py-1.5 font-mono text-sm font-semibold tracking-wide text-gray-800">
        {code}
      </span>
      <button
        onClick={handleCopy}
        className="relative inline-flex items-center justify-center rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 shadow-card transition hover:bg-gray-50 hover:text-gray-700"
        aria-label="Copy code"
        title="Copy code"
      >
        {copied ? (
          <>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-green-600"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg">
              Copied!
            </span>
          </>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
}

const TYPE_STYLES: Record<string, string> = {
  voucher: "bg-purple-50 text-purple-700 ring-purple-600/20",
  promotion: "bg-blue-50 text-blue-700 ring-blue-600/20",
};

export default function DealCard({ deal }: { deal: Deal }) {
  return (
    <div className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-card transition hover:border-gray-300 hover:shadow-card-hover">
      {/* Header: advertiser info + type badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
            {deal.advertiser.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={deal.advertiser.logoUrl}
                alt={`${deal.advertiser.name} logo`}
                className="h-full w-full object-contain"
                loading="lazy"
              />
            ) : (
              <span className="text-sm font-semibold text-gray-400">
                {deal.advertiser.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span className="truncate text-xs font-medium text-gray-500">
            {deal.advertiser.name}
          </span>
        </div>
        <span
          className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${
            TYPE_STYLES[deal.type] ?? TYPE_STYLES.promotion
          }`}
        >
          {deal.type}
        </span>
      </div>

      {/* Title + description */}
      <div className="mt-3 flex-1">
        <h3 className="text-sm font-semibold leading-snug text-gray-900 line-clamp-2">
          {deal.title}
        </h3>
        {deal.description && (
          <p className="mt-1 text-xs leading-relaxed text-gray-500 line-clamp-2">
            {deal.description}
          </p>
        )}
      </div>

      {/* Voucher code */}
      {deal.code && (
        <div className="mt-3">
          <CopyCodeButton code={deal.code} />
        </div>
      )}

      {/* Footer: expiry + CTA */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <ExpiryBadge endDate={deal.endDate} />

        {deal.trackingUrl ? (
          <a
            href={deal.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover"
          >
            Get Deal
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        ) : (
          <span className="text-xs text-gray-400">No link available</span>
        )}
      </div>
    </div>
  );
}
